import { randomInt, randomUUID } from "node:crypto";
import { publicState } from "./rooms.js";
import { archiveTurn } from "./replay.js";
export function gameEngine(io) {
  const publish = (r) => {
    // Project state separately for each recipient: only the drawer sees secrets.
    for (const p of r.players)
      if (p.connected) io.to(p.socket).emit("state", publicState(r, p));
  };
  function message(r, text) {
    r.chat.push({ id: randomUUID(), system: true, text });
    r.chat = r.chat.slice(-100);
  }
  function next(r) {
    const connected = r.players.filter((p) => p.connected);
    if (connected.length < 2) {
      r.phase = "lobby";
      r.deadline = 0;
      r.word = null;
      r.drawer = null;
      r.turnId = null;
      r.choices = [];
      r.events = [];
      r.seq = 0;
      message(r, "Game paused: at least two players are needed.");
      publish(r);
      return;
    }
    r.queue = r.queue.filter((id) => connected.some((p) => p.id === id));
    if (!r.queue.length) {
      if (r.round >= r.settings.rounds) {
        r.phase = "finished";
        r.deadline = 0;
        publish(r);
        return;
      }
      r.round++;
      r.queue = connected.map((p) => p.id);
      for (let i = r.queue.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [r.queue[i], r.queue[j]] = [r.queue[j], r.queue[i]];
      }
    }
    r.drawer = r.queue.shift();
    r.turnId = randomUUID();
    r.phase = "choosing";
    r.started = null;
    r.word = null;
    r.events = [];
    r.seq = 0;
    r.seen = new Set();
    r.guessed = [];
    r.eligible = connected.filter((p) => p.id !== r.drawer).map((p) => p.id);
    const pool = [...r.settings.words];
    r.choices = [];
    for (let i = 0; i < 3; i++)
      r.choices.push(pool.splice(randomInt(pool.length), 1)[0]);
    r.deadline = Date.now() + 15000;
    publish(r);
  }
  function select(r, word) {
    r.word = word;
    r.choices = [];
    r.phase = "drawing";
    r.started = Date.now();
    r.deadline = r.started + r.settings.duration * 1000;
    r.hintOrder = Array.from(word, (_, i) => i).filter((i) => word[i] !== " ");
    for (let i = r.hintOrder.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [r.hintOrder[i], r.hintOrder[j]] = [r.hintOrder[j], r.hintOrder[i]];
    }
    publish(r);
  }
  function end(r) {
    if (r.phase !== "drawing" && r.phase !== "choosing") return;
    archiveTurn(r);
    r.phase = "results";
    r.deadline = Date.now() + 5000;
    message(r, `The word was ${r.word || "not selected"}.`);
    publish(r);
  }
  function start(r) {
    r.players.forEach((p) => (p.score = 0));
    r.round = 0;
    r.queue = [];
    r.replays = [];
    next(r);
  }
  function tick(r) {
    if (Date.now() >= r.deadline && r.deadline) {
      if (r.phase === "choosing") select(r, r.choices[0]);
      else if (r.phase === "drawing") end(r);
      else if (r.phase === "results") next(r);
    } else if (r.deadline) publish(r);
  }
  return { publish, message, next, select, end, start, tick };
}
