import assert from "node:assert/strict";
import test from "node:test";

import {
  chunkStorageItems,
  getStorageValuesInBatches,
  putStorageEntriesInBatches,
  STORAGE_BATCH_LIMIT,
} from "../src/storage-batches.ts";

test("storage operations are split at the Durable Object 128-key limit", () => {
  const items = Array.from({ length: STORAGE_BATCH_LIMIT * 2 + 1 }, (_, index) => index);
  const chunks = chunkStorageItems(items);

  assert.deepEqual(chunks.map((chunk) => chunk.length), [128, 128, 1]);
  assert.deepEqual(chunks.flat(), items);
});

test("storage chunk size can be reduced for constrained operations", () => {
  assert.deepEqual(chunkStorageItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("Durable Object puts never exceed 128 keys", async () => {
  const entries = Array.from(
    { length: STORAGE_BATCH_LIMIT * 2 + 1 },
    (_, index) => [`vote:software:tool-${index}`, true],
  );
  const batchSizes = [];

  await putStorageEntriesInBatches(entries, async (batch) => {
    batchSizes.push(Object.keys(batch).length);
  });

  assert.deepEqual(batchSizes, [128, 128, 1]);
});

test("Durable Object gets never exceed 128 keys", async () => {
  const keys = Array.from(
    { length: STORAGE_BATCH_LIMIT * 2 + 1 },
    (_, index) => `vote:software:tool-${index}`,
  );
  const batchSizes = [];

  const values = await getStorageValuesInBatches(keys, async (batch) => {
    batchSizes.push(batch.length);
    return new Map(batch.map((key) => [key, true]));
  });

  assert.deepEqual(batchSizes, [128, 128, 1]);
  assert.equal(values.size, keys.length);
});
