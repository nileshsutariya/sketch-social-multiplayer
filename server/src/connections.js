import { randomUUID } from "node:crypto";
import { rooms, createRoom, publicState } from "./rooms.js";
import { newPlayer, restorePlayer } from "./players.js";
import { disconnectPlayer } from "./reconnection.js";
import { normalize, closeGuess } from "./words.js";
import { guessScore } from "./scoring.js";
import { allow } from "./rate-limit.js";
import { validateDrawing } from "./drawing.js";
export function connections(io, engine) {
  io.on("connection", (socket) => {
    const current = () => {
      const r = rooms.get(socket.data.room);
      const p = r?.players.find(
        (p) => p.id === socket.data.player && p.socket === socket.id,
      );
      return { r, p };
    };
    const reply = (cb, value) => {
      if (typeof cb === "function") cb(value);
    };
    socket.on("join", (data, cb) => {
      if (socket.data.room)
        return reply(cb, { error: "Already joined a room." });
      if (!allow(socket, "join", 5, 10000))
        return reply(cb, { error: "Please wait before joining again." });
      const name =
        typeof data?.name === "string" ? data.name.trim().slice(0, 24) : "";
      if (!name) return reply(cb, { error: "Enter a nickname." });
      let r = data.create ? createRoom() : rooms.get(data.room);
      if (!r) return reply(cb, { error: "Room not found." });
      let p = r.players.find((p) => p.token === data.token);
      if (p?.connected)
        return reply(cb, {
          error: "This identity is already connected in another tab.",
        });
      if (!p) {
        if (r.players.length >= 12)
          return reply(cb, { error: "Room is full (12 players)." });
        p = newPlayer(name, socket);
        r.players.push(p);
      } else {
        restorePlayer(p, socket);
      }
      r.host ??= p.id;
      socket.data.room = r.id;
      socket.data.player = p.id;
      socket.join(r.id);
      engine.message(r, `${p.name} joined.`);
      reply(cb, { room: r.id, player: p.id, token: p.token });
      engine.publish(r);
    });
    socket.on("configure", (data, cb) => {
      const { r, p } = current();
      if (!r || p?.id !== r.host || r.phase !== "lobby")
        return reply(cb, { error: "Only the lobby host can change settings." });
      const list = Array.isArray(data?.words)
        ? [
            ...new Set(
              data.words
                .map((w) => (typeof w === "string" ? normalize(w) : ""))
                .filter((w) => /^[a-z ]{2,32}$/.test(w)),
            ),
          ]
        : [];
      if (
        !Number.isInteger(data?.rounds) ||
        data.rounds < 1 ||
        data.rounds > 8 ||
        !Number.isInteger(data.duration) ||
        data.duration < 20 ||
        data.duration > 180 ||
        list.length < 3 ||
        list.length > 200
      )
        return reply(cb, {
          error:
            "Use 1–8 rounds, 20–180 seconds, and 3–200 distinct words (letters and spaces).",
        });
      r.settings = {
        rounds: data.rounds,
        duration: data.duration,
        words: list,
      };
      engine.publish(r);
      reply(cb, { ok: true });
    });
    socket.on("start", (_, cb) => {
      const { r, p } = current();
      if (
        !r ||
        p?.id !== r.host ||
        !["lobby", "finished"].includes(r.phase) ||
        r.players.filter((p) => p.connected).length < 2
      )
        return reply(cb, {
          error: "Host needs at least two connected players.",
        });
      engine.start(r);
      reply(cb, { ok: true });
    });
    socket.on("choose", (data, cb) => {
      const { r, p } = current();
      if (
        !r ||
        r.phase !== "choosing" ||
        p?.id !== r.drawer ||
        data?.turnId !== r.turnId ||
        !r.choices.includes(data.word)
      )
        return reply(cb, { error: "Invalid word choice." });
      if (Date.now() >= r.deadline) {
        engine.tick(r);
        return reply(cb, { error: "Selection time expired." });
      }
      engine.select(r, data.word);
      reply(cb, { ok: true });
    });
    socket.on("draw", (data, cb) => {
      const { r, p } = current();
      if (
        !r ||
        r.phase !== "drawing" ||
        p?.id !== r.drawer ||
        data?.turnId !== r.turnId ||
        !allow(socket, "draw", 100) ||
        !validateDrawing(data.event)
      )
        return reply(cb, { error: "Drawing rejected." });
      if (r.seen.has(data.event.id))
        return reply(cb, { ok: true, duplicate: true });
      if (r.events.length >= 12000)
        return reply(cb, { error: "Canvas event limit reached." });
      if (Date.now() >= r.deadline) {
        engine.end(r);
        return reply(cb, { error: "Turn ended." });
      }
      const { id, type, gesture, color, size, points } = data.event;
      const e = {
        id,
        type,
        gesture,
        color,
        size,
        points,
        seq: ++r.seq,
        at: Date.now() - r.started,
      };
      r.seen.add(e.id);
      r.events.push(e);
      io.to(r.id).emit("drawing", { turnId: r.turnId, event: e });
      reply(cb, { ok: true });
    });
    socket.on("chat", (data, cb) => {
      const { r, p } = current();
      if (
        !r ||
        !p ||
        !allow(socket, "chat", 5, 5000) ||
        typeof data?.text !== "string" ||
        !data.text.trim() ||
        data.text.length > 200
      )
        return reply(cb, {
          error:
            "Message rejected: maximum 200 characters, five messages per five seconds.",
        });
      const text = data.text.trim();
      const guess = normalize(text);
      if (r.phase === "drawing" && data.turnId !== r.turnId)
        return reply(cb, { error: "This guess belongs to an expired turn." });
      if (r.phase === "drawing" && Date.now() >= r.deadline) {
        engine.end(r);
        return reply(cb, { error: "Turn ended." });
      }
      if (r.phase === "drawing" && guess === normalize(r.word)) {
        if (p.id === r.drawer || r.guessed.includes(p.id))
          return reply(cb, { ok: true });
        if (!r.eligible.includes(p.id))
          return reply(cb, { error: "You can guess on the next turn." });
        p.score += guessScore(
          (r.deadline - Date.now()) / 1000,
          r.settings.duration,
        );
        r.guessed.push(p.id);
        const drawer = r.players.find((x) => x.id === r.drawer);
        if (drawer) drawer.score += 50;
        engine.message(r, `${p.name} guessed correctly!`);
        if (
          r.eligible.every(
            (id) =>
              r.guessed.includes(id) ||
              !r.players.some((p) => p.id === id && p.connected),
          )
        )
          engine.end(r);
      } else if (
        r.phase === "drawing" &&
        (p.id === r.drawer || r.guessed.includes(p.id))
      ) {
        return reply(cb, {
          error: "Chat is muted after seeing or guessing the word.",
        });
      } else {
        r.chat.push({ id: randomUUID(), name: p.name, text });
        r.chat = r.chat.slice(-100);
        if (r.phase === "drawing" && closeGuess(guess, normalize(r.word)))
          socket.emit("notice", "Close!");
      }
      engine.publish(r);
      reply(cb, { ok: true });
    });
    socket.on("sync", () => {
      const { r, p } = current();
      if (r && p && allow(socket, "sync", 2))
        socket.emit("state", publicState(r, p));
    });
    socket.on("disconnect", () => {
      const { r, p } = current();
      if (!r || !p) return;
      disconnectPlayer(r, p, engine);
    });
  });
}
