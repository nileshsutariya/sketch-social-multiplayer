import { randomBytes } from "node:crypto";
import { words } from "./words.js";
export const rooms = new Map();
export function createRoom() {
  let id;
  do {
    id = randomBytes(4).toString("hex");
  } while (rooms.has(id));
  const room = {
    id,
    players: [],
    host: null,
    settings: { rounds: 3, duration: 60, words: [...words] },
    phase: "lobby",
    round: 0,
    turnId: null,
    drawer: null,
    word: null,
    choices: [],
    guessed: [],
    eligible: [],
    events: [],
    replays: [],
    chat: [],
    deadline: 0,
    queue: [],
    seq: 0,
  };
  rooms.set(id, room);
  return room;
}
export function publicState(r, p) {
  const elapsed =
    r.phase === "drawing" ? Math.max(0, Date.now() - r.started) : 0;
  const visible = Math.floor(
    (elapsed / (r.settings.duration * 1000)) *
      Math.max(1, Math.floor((r.word?.length || 0) / 2)),
  );
  const hint = r.word
    ? Array.from(r.word)
        .map((c, i) =>
          c === " "
            ? " "
            : r.hintOrder?.slice(0, visible).includes(i)
              ? c
              : "_",
        )
        .join(" ")
    : "";
  return {
    id: r.id,
    players: r.players.map(({ token, socket, expiry, ...p }) => p),
    host: r.host,
    settings: {
      rounds: r.settings.rounds,
      duration: r.settings.duration,
      words: r.phase === "lobby" ? r.settings.words : undefined,
    },
    phase: r.phase,
    round: r.round,
    turnId: r.turnId,
    drawer: r.drawer,
    deadline: r.deadline,
    serverTime: Date.now(),
    hint,
    word:
      p?.id === r.drawer || r.phase === "results" || r.phase === "finished"
        ? r.word
        : null,
    choices: p?.id === r.drawer ? r.choices : [],
    events: r.events,
    seq: r.seq,
    chat: r.chat,
    replays: r.phase === "finished" ? r.replays : [],
    guessed: r.guessed,
  };
}
