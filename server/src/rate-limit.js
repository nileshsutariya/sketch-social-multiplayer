export function allow(socket, key, limit, window = 1000) {
  const now = Date.now();
  socket.data.rates ??= {};
  let bucket = socket.data.rates[key];
  if (!bucket || now - bucket.start >= window)
    bucket = socket.data.rates[key] = { start: now, count: 0 };
  return ++bucket.count <= limit;
}
