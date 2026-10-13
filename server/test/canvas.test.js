import test from "node:test";
import assert from "node:assert/strict";
import { visibleEvents } from "../../client/src/canvas.js";

test("undo restores a cleared drawing, removes fill, and removes a whole batched gesture", () => {
  const stroke1 = { type: "stroke", gesture: "one", id: "a" },
    stroke2 = { type: "stroke", gesture: "one", id: "b" },
    fill = { type: "fill", id: "c" };
  const original = [stroke1, stroke2, fill];
  const history = [...original, { type: "clear" }];
  assert.deepEqual(visibleEvents(history), []);
  history.push({ type: "undo" });
  assert.deepEqual(visibleEvents(history), original);
  history.push({ type: "undo" });
  assert.deepEqual(visibleEvents(history), [stroke1, stroke2]);
  history.push({ type: "undo" });
  assert.deepEqual(visibleEvents(history), []);
  history.push({ type: "undo" });
  assert.deepEqual(visibleEvents(history), []);
  // Prefix replay preserves the exact state before clear is undone.
  assert.deepEqual(visibleEvents(history.slice(0, 4)), []);
  assert.deepEqual(visibleEvents(history.slice(0, 5)), original);
});
