import test from "node:test";
import assert from "node:assert/strict";
import { io as client } from "socket.io-client";
import { createApp } from "../src/index.js";
import { rooms, publicState } from "../src/rooms.js";
import { closeGuess } from "../src/words.js";
import { validateDrawing } from "../src/drawing.js";
const request = (socket, event, data) =>
  new Promise((resolve, reject) =>
    socket
      .timeout(2000)
      .emit(event, data, (error, result) =>
        error ? reject(error) : resolve(result),
      ),
  );
const connect = (url) =>
  new Promise((resolve) => {
    const socket = client(url, { forceNew: true, reconnection: false });
    socket.once("connect", () => resolve(socket));
  });
test("guess distance and strict canvas payload validation", () => {
  assert.equal(closeGuess("castel", "castle"), false);
  assert.equal(closeGuess("castl", "castle"), true);
  assert.equal(
    validateDrawing({
      id: "a",
      type: "stroke",
      gesture: "g",
      color: "#000000",
      size: 5,
      points: [[0, 1]],
    }),
    true,
  );
  assert.equal(
    validateDrawing({
      id: "a",
      type: "stroke",
      gesture: "g",
      color: "#000000",
      size: 5,
      points: [[NaN, 1]],
    }),
    false,
  );
});
test("three clients: privacy, authority, scoring, replay, reconnect and timer transitions", async () => {
  const { server, io, engine } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const sockets = [];
  try {
    const a = await connect(url),
      b = await connect(url),
      c = await connect(url);
    sockets.push(a, b, c);
    const pa = await request(a, "join", { create: true, name: "Ada" });
    const pb = await request(b, "join", { room: pa.room, name: "Ben" });
    const pc = await request(c, "join", { room: pa.room, name: "Cy" });
    const r = rooms.get(pa.room);
    assert.ok((await request(a, "configure", null)).error);
    assert.ok(
      (
        await request(b, "configure", {
          rounds: 1,
          duration: 20,
          words: ["cat", "dog", "sun"],
        })
      ).error,
    );
    assert.ok(
      (
        await request(a, "configure", {
          rounds: 1,
          duration: 20,
          words: ["cat", "dog", "sun"],
        })
      ).ok,
    );
    assert.ok((await request(a, "start", {})).ok);
    assert.equal(r.choices.length, 3);
    const identities = [pa, pb, pc];
    let drawerIndex = identities.findIndex((p) => p.player === r.drawer);
    let drawer = sockets[drawerIndex];
    const guessers = sockets.filter((s) => s !== drawer);
    let word = r.choices[0];
    assert.deepEqual(
      publicState(
        r,
        r.players.find((p) => p.id !== r.drawer),
      ).choices,
      [],
    );
    assert.ok((await request(drawer, "choose", { turnId: r.turnId, word })).ok);
    assert.equal(
      publicState(
        r,
        r.players.find((p) => p.id !== r.drawer),
      ).word,
      null,
    );
    const event = {
      id: "stroke-1",
      gesture: "gesture-1",
      type: "stroke",
      color: "#000000",
      size: 5,
      points: [
        [0, 0],
        [1, 1],
      ],
    };
    assert.ok(
      (await request(guessers[0], "draw", { turnId: r.turnId, event })).error,
    );
    assert.ok(
      (await request(drawer, "draw", { turnId: "stale", event })).error,
    );
    assert.ok((await request(drawer, "draw", { turnId: r.turnId, event })).ok);
    assert.ok(
      (await request(drawer, "draw", { turnId: r.turnId, event })).duplicate,
    );
    assert.equal(r.events.length, 1);
    const d = await connect(url);
    sockets.push(d);
    const pd = await request(d, "join", { room: pa.room, name: "Late joiner" });
    const late = r.players.find((p) => p.id === pd.player);
    assert.equal(publicState(r, late).events.length, 1);
    assert.equal(publicState(r, late).word, null);
    assert.ok(
      (await request(d, "chat", { text: word, turnId: r.turnId })).error,
    );
    assert.equal(late.score, 0);
    let closeNotice = null;
    let otherNotice = null;
    guessers[0].once("notice", (value) => (closeNotice = value));
    guessers[1].once("notice", (value) => (otherNotice = value));
    await request(guessers[0], "chat", {
      text: word.slice(0, -1) + "x",
      turnId: r.turnId,
    });
    assert.equal(closeNotice, "Close!");
    assert.equal(otherNotice, null);
    assert.ok(
      (await request(guessers[0], "chat", { text: word, turnId: "stale" }))
        .error,
    );
    assert.ok(
      (
        await request(drawer, "chat", {
          text: "secret disclosure",
          turnId: r.turnId,
        })
      ).error,
    );
    await request(guessers[0], "chat", { text: word, turnId: r.turnId });
    const player = r.players.find((p) => p.socket === guessers[0].id),
      score = player.score;
    assert.ok(score >= 100);
    assert.ok(
      (
        await request(guessers[0], "chat", {
          text: "secret disclosure",
          turnId: r.turnId,
        })
      ).error,
    );
    await request(guessers[0], "chat", { text: word, turnId: r.turnId });
    assert.equal(player.score, score);
    assert.ok(!r.chat.some((m) => m.text === word));
    await request(guessers[1], "chat", { text: word, turnId: r.turnId });
    assert.equal(r.phase, "results");
    assert.equal(r.replays[0].events.length, 1);
    r.deadline = Date.now() - 1;
    engine.tick(r);
    assert.equal(r.phase, "choosing");
    engine.select(r, r.choices[0]);
    const oldPlayer = r.players.find((p) => p.id === pb.player);
    b.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(oldPlayer.connected, false);
    const reconnected = await connect(url);
    sockets.push(reconnected);
    const restored = await request(reconnected, "join", {
      room: pa.room,
      name: "Ben",
      token: pb.token,
    });
    assert.equal(restored.player, pb.player);
    assert.equal(
      r.players.find((p) => p.id === pb.player).score,
      oldPlayer.score,
    );
    for (let i = 0; i < 10 && r.phase !== "finished"; i++) {
      r.deadline = Date.now() - 1;
      engine.tick(r);
    }
    assert.equal(r.phase, "finished");
    assert.equal(r.round, 1);
    assert.equal(r.replays.length, 3);
  } finally {
    for (const s of sockets) s.disconnect();
    await new Promise((resolve) => io.close(resolve));
    for (const r of rooms.values())
      for (const p of r.players) clearTimeout(p.expiry);
    rooms.clear();
  }
});

test("drawer disconnect ends turn and host transfers, chat rate limits reject flood", async () => {
  const { server, io, engine } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const sockets = [];
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const a = await connect(url),
      b = await connect(url),
      c = await connect(url);
    sockets.push(a, b, c);
    const pa = await request(a, "join", { create: true, name: "A" });
    await request(b, "join", { room: pa.room, name: "B" });
    await request(c, "join", { room: pa.room, name: "C" });
    const r = rooms.get(pa.room);
    for (let i = 0; i < 5; i++)
      assert.ok((await request(b, "chat", { text: "Hello" })).ok);
    assert.ok((await request(b, "chat", { text: "Sixth message" })).error);
    assert.ok((await request(c, "chat", { text: "x".repeat(201) })).error);
    await request(a, "start", {});
    engine.select(r, r.choices[0]);
    const drawer = sockets.find(
      (s) => s.id === r.players.find((p) => p.id === r.drawer).socket,
    );
    drawer.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(r.phase, "results");
    if (drawer !== a) {
      a.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    assert.notEqual(r.host, pa.player);
    assert.ok(r.players.find((p) => p.id === r.host).connected);
  } finally {
    sockets.forEach((s) => s.disconnect());
    await new Promise((resolve) => io.close(resolve));
    for (const r of rooms.values())
      for (const p of r.players) clearTimeout(p.expiry);
    rooms.clear();
  }
});
