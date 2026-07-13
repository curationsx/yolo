import assert from "node:assert/strict";
import test from "node:test";

import {
  CopilotGrantGuard,
  decryptCopilotToken,
  encryptCopilotToken,
} from "../src/copilot-grant.ts";

const encryptionKey = Buffer.alloc(32, 7).toString("base64url");
const token = `gho_${"A".repeat(36)}`;

class MemoryStorage {
  values = new Map();

  async get(key) {
    return this.values.get(key);
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    this.values.delete(key);
  }

  async deleteAll() {
    this.values.clear();
  }

  async setAlarm() {}

  async transaction(operation) {
    return operation(this);
  }
}

test("Copilot OAuth tokens are encrypted with user-bound authenticated data", async () => {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const grant = await encryptCopilotToken(token, "123", expiresAt, encryptionKey);

  assert.equal(grant.ciphertext.includes(token), false);
  assert.equal(await decryptCopilotToken(grant, encryptionKey), token);

  await assert.rejects(
    decryptCopilotToken({ ...grant, user_id: "456" }, encryptionKey),
  );
});

test("Copilot grants can be consumed only once", async () => {
  const guard = new CopilotGrantGuard({ storage: new MemoryStorage() });
  const grant = await encryptCopilotToken(
    token,
    "123",
    new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    encryptionKey,
  );

  const stored = await guard.fetch(
    new Request("https://copilot-grant.internal/put", {
      method: "POST",
      body: JSON.stringify(grant),
    }),
  );
  assert.equal(stored.status, 200);

  const first = await guard.fetch(
    new Request("https://copilot-grant.internal/consume", { method: "POST" }),
  );
  const second = await guard.fetch(
    new Request("https://copilot-grant.internal/consume", { method: "POST" }),
  );
  assert.equal(first.status, 200);
  assert.equal(second.status, 404);
});
