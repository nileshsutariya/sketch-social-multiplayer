import { io } from "socket.io-client";
const roomCount = Number(process.env.ROOMS || 10),
  url = process.env.SERVER_URL || "http://localhost:3001",
  sockets = [],
  latencies = [];
const request = (s, e, d) =>
  new Promise((resolve, reject) => {
    const started = performance.now();
    s.timeout(5000).emit(e, d, (err, r) => {
      if (err || r?.error) reject(err || new Error(r.error));
      else {
        latencies.push(performance.now() - started);
        resolve(r);
      }
    });
  });
const connect = () =>
  new Promise((resolve, reject) => {
    const s = io(url, { forceNew: true, reconnection: false });
    sockets.push(s);
    s.once("connect", () => resolve(s));
    s.once("connect_error", reject);
  });
try {
  for (let i = 0; i < roomCount; i++) {
    const a = await connect(),
      b = await connect(),
      c = await connect();
    const r = await request(a, "join", { create: true, name: "Load A" });
    await request(b, "join", { room: r.room, name: "Load B" });
    await request(c, "join", { room: r.room, name: "Load C" });
    await request(a, "configure", {
      rounds: 1,
      duration: 20,
      words: ["cat", "dog", "sun"],
    });
    for (const s of [a, b, c])
      s.on("state", (state) => {
        if (state.phase === "choosing" && state.choices.length)
          request(s, "choose", {
            turnId: state.turnId,
            word: state.choices[0],
          }).catch(() => {});
      });
    await request(a, "start", {});
    for (const s of [a, b, c]) {
      const timer = setInterval(() => {
        s.emit("sync");
      }, 1000);
      s.on("disconnect", () => clearInterval(timer));
    }
    let turn = null;
    for (const s of [a, b, c])
      s.on("state", (state) => {
        if (state.phase === "drawing" && state.word && turn !== state.turnId) {
          turn = state.turnId;
          let n = 0;
          const timer = setInterval(() => {
            request(s, "draw", {
              turnId: state.turnId,
              event: {
                id: `${turn}-${n}`,
                gesture: `${turn}-g`,
                type: "stroke",
                color: "#000000",
                size: 3,
                points: [
                  [(n % 100) / 100, 0.2],
                  [((n + 1) % 100) / 100, 0.3],
                ],
              },
            }).catch(() => {});
            if (++n >= 200) clearInterval(timer);
          }, 50);
          s.on("disconnect", () => clearInterval(timer));
        }
      });
  }
  await new Promise((resolve) => setTimeout(resolve, 25000));
  latencies.sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        rooms: roomCount,
        clients: sockets.length,
        ackSamples: latencies.length,
        p50Ms: latencies[Math.floor(latencies.length * 0.5)],
        p95Ms: latencies[Math.floor(latencies.length * 0.95)],
        note: "Client-side acknowledgement latency on this host; does not establish production capacity.",
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  sockets.forEach((s) => s.disconnect());
}
