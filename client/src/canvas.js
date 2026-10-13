export const W = 1000,
  H = 650;
export function visibleEvents(events) {
  const actions = [];
  for (const event of events) {
    if (event.type !== "undo") {
      actions.push(event);
      continue;
    }
    const last = actions.at(-1);
    if (!last) continue;
    actions.pop();
    // Undo one entire pointer gesture, not just its final network batch.
    if (last.type === "stroke")
      while (last.gesture && actions.at(-1)?.gesture === last.gesture)
        actions.pop();
  }
  const lastClear = actions.findLastIndex((event) => event.type === "clear");
  return actions.slice(lastClear + 1);
}
export function render(canvas, events) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const visible = visibleEvents(events);
  for (const e of visible) {
    ctx.strokeStyle = e.color;
    ctx.fillStyle = e.color;
    ctx.lineWidth = e.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (e.type === "fill") {
      fill(ctx, e.points[0], e.color);
      continue;
    }
    ctx.beginPath();
    e.points.forEach(([x, y], i) =>
      i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H),
    );
    if (e.points.length === 1) {
      ctx.arc(
        e.points[0][0] * W,
        e.points[0][1] * H,
        e.size / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else ctx.stroke();
  }
}
function fill(ctx, [nx, ny], color) {
  const image = ctx.getImageData(0, 0, W, H),
    d = image.data,
    x = Math.min(W - 1, Math.floor(nx * W)),
    y = Math.min(H - 1, Math.floor(ny * H)),
    start = (y * W + x) * 4,
    target = Array.from(d.slice(start, start + 4)),
    rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  if (rgb.every((n, i) => n === target[i])) return;
  const seen = new Uint8Array(W * H),
    stack = [y * W + x];
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!target.every((n, j) => Math.abs(d[i + j] - n) < 20)) continue;
    d[i] = rgb[0];
    d[i + 1] = rgb[1];
    d[i + 2] = rgb[2];
    d[i + 3] = 255;
    const px = p % W;
    if (px > 0) stack.push(p - 1);
    if (px < W - 1) stack.push(p + 1);
    if (p >= W) stack.push(p - W);
    if (p < W * (H - 1)) stack.push(p + W);
  }
  ctx.putImageData(image, 0, 0);
}
