import { randomUUID, randomBytes } from "node:crypto";
export function newPlayer(name, socket) {
  return {
    id: randomUUID(),
    token: randomBytes(24).toString("hex"),
    name,
    score: 0,
    socket: socket.id,
    connected: true,
  };
}
export function restorePlayer(player, socket) {
  clearTimeout(player.expiry);
  player.connected = true;
  player.socket = socket.id;
}
