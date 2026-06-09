import assert from "node:assert/strict";
import test from "node:test";
import { splitTelegramChunks } from "./proposal-archive-worker.mjs";

test("splitTelegramChunks returns one empty chunk for empty input", () => {
  assert.deepEqual(splitTelegramChunks("", 10), [""]);
});

test("splitTelegramChunks keeps chunks within the limit", () => {
  const chunks = splitTelegramChunks(["alpha", "beta", "gamma"].join("\n"), 10);

  assert.ok(chunks.length > 1);
  assert.equal(chunks.every((chunk) => chunk.length <= 10), true);
});

test("splitTelegramChunks slices long lines", () => {
  const chunks = splitTelegramChunks("x".repeat(25), 10);

  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    [10, 10, 5],
  );
});
