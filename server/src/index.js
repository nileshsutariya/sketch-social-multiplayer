import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { fileURLToPath } from "node:url";
import { rooms } from "./rooms.js";
import { gameEngine } from "./game.js";
import { connections } from "./connections.js";
export function createApp() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
    maxHttpBufferSize: 20000,
  });
  app.get("/health", (_, res) => res.json({ ok: true, rooms: rooms.size }));
  app.use(
    express.static(
      fileURLToPath(new URL("../../client/dist/", import.meta.url)),
    ),
  );
  const engine = gameEngine(io);
  connections(io, engine);
  const timer = setInterval(() => {
    for (const r of rooms.values()) engine.tick(r);
  }, 1000);
  server.on("close", () => clearInterval(timer));
  return { server, io, engine };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server } = createApp();
  server.listen(process.env.PORT || 3001, process.env.HOST || "0.0.0.0", () =>
    console.log(
      "Sketch Social server listening on port " + (process.env.PORT || 3001),
    ),
  );
}
