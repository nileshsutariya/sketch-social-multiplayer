export function archiveTurn(room) {
  // New turns replace events rather than mutating archived arrays.
  room.replays.push({
    turnId: room.turnId,
    round: room.round,
    drawer: room.players.find((p) => p.id === room.drawer)?.name,
    word: room.word,
    events: room.events,
    duration: Math.max(0, Date.now() - (room.started || Date.now())),
  });
}
