export function validateDrawing(event) {
  if (
    !event ||
    typeof event.id !== "string" ||
    event.id.length > 80 ||
    !["stroke", "fill", "undo", "clear"].includes(event.type)
  )
    return false;
  if (event.type === "undo" || event.type === "clear") return true;
  if (
    event.type === "stroke" &&
    (typeof event.gesture !== "string" || event.gesture.length > 80)
  )
    return false;
  if (
    !/^#[0-9a-f]{6}$/i.test(event.color) ||
    !Number.isFinite(event.size) ||
    event.size < 1 ||
    event.size > 40
  )
    return false;
  if (
    !Array.isArray(event.points) ||
    !event.points.length ||
    event.points.length > 64
  )
    return false;
  return (
    event.points.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((n) => Number.isFinite(n) && n >= 0 && n <= 1),
    ) &&
    (event.type !== "fill" || event.points.length === 1)
  );
}
