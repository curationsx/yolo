export const STORAGE_BATCH_LIMIT = 128;

export function chunkStorageItems<T>(
  items: T[],
  size = STORAGE_BATCH_LIMIT,
): T[][] {
  const result: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    result.push(items.slice(offset, offset + size));
  }
  return result;
}

export async function putStorageEntriesInBatches<T>(
  entries: ReadonlyArray<readonly [string, T]>,
  putBatch: (entries: Record<string, T>) => Promise<void>,
): Promise<void> {
  for (const batch of chunkStorageItems([...entries])) {
    const values: Record<string, T> = {};
    for (const [key, value] of batch) values[key] = value;
    await putBatch(values);
  }
}

export async function getStorageValuesInBatches<T>(
  keys: string[],
  getBatch: (keys: string[]) => Promise<Map<string, T>>,
): Promise<Map<string, T>> {
  const values = new Map<string, T>();
  for (const batch of chunkStorageItems(keys)) {
    const stored = await getBatch(batch);
    for (const [key, value] of stored) values.set(key, value);
  }
  return values;
}
