// LAN HTTP pages lack crypto.randomUUID in some browsers. Drawing IDs only
// identify operations; authentication tokens are generated separately on server.
export function eventId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
