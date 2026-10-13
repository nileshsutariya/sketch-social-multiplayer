import { rooms } from "./rooms.js";
export function disconnectPlayer(room, player, engine) {
  player.connected = false;
  engine.message(
    room,
    `${player.name} disconnected (30 second reconnect window).`,
  );
  if (room.host === player.id)
    room.host = room.players.find((p) => p.connected)?.id || player.id;
  // Never wait for a disconnected artist; the preserved identity can join later.
  if (player.id === room.drawer && ["choosing", "drawing"].includes(room.phase))
    engine.end(room);
  else if (
    room.phase === "drawing" &&
    room.eligible.every(
      (id) =>
        room.guessed.includes(id) ||
        !room.players.some((p) => p.id === id && p.connected),
    )
  )
    engine.end(room);
  engine.publish(room);
  player.expiry = setTimeout(() => {
    room.players = room.players.filter((p) => p !== player);
    if (!room.players.length) rooms.delete(room.id);
    else {
      if (room.host === player.id)
        room.host =
          room.players.find((p) => p.connected)?.id || room.players[0].id;
      engine.publish(room);
    }
  }, 30000);
}
