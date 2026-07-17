import assert from "node:assert/strict";
import test from "node:test";

import {
  ProjectPreviewGuard,
  createCloudflareProjectPreviewStore,
} from "../src/project-preview.ts";
import { createAzureProjectPreviewStore } from "../src/platform/azure/state.ts";
import { FakeCosmosContainer } from "./helpers/fake-cosmos-container.mjs";

class MemoryStorage {
  values = new Map();
  alarm = null;

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

  async setAlarm(timestamp) {
    this.alarm = timestamp;
  }
}

class DoNamespace {
  guards = new Map();

  idFromName(name) {
    return name;
  }

  get(id) {
    if (!this.guards.has(id)) {
      this.guards.set(id, new ProjectPreviewGuard({ storage: new MemoryStorage() }));
    }
    const guard = this.guards.get(id);
    return {
      fetch: (input, init) =>
        guard.fetch(input instanceof Request ? input : new Request(input, init)),
    };
  }
}

test("Cloudflare Project previews are strongly consistent and isolated by digest", async () => {
  const namespace = new DoNamespace();
  const store = createCloudflareProjectPreviewStore(namespace);
  const first = `sha256:${"a".repeat(64)}`;
  const second = `sha256:${"b".repeat(64)}`;

  const token = await store.put(first, '{"project":"one"}', 900);
  assert.equal(await store.get(first, token), '{"project":"one"}');
  assert.equal(await store.get(first, "wrong-token"), null);
  assert.equal(await store.get(second, token), null);
});

test("Project preview guard removes expired records", async () => {
  const storage = new MemoryStorage();
  const guard = new ProjectPreviewGuard({ storage });
  await storage.put("preview", {
    value: '{"project":"expired"}',
    expires_at: new Date(Date.now() - 1_000).toISOString(),
  });

  const response = await guard.fetch(
    new Request("https://project-preview.internal/get"),
  );
  assert.equal(response.status, 404);
  assert.equal(storage.values.size, 0);
});

test("Azure Project previews use the strongly consistent gateway-state store", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureProjectPreviewStore(container);
  const version = `sha256:${"c".repeat(64)}`;
  const token = await store.put(version, '{"project":"azure"}', 900);
  assert.equal(token, "fake-session-token");
  assert.equal(await store.get(version, token), '{"project":"azure"}');
  assert.equal(container.documents.size, 1);
});

test("Azure Project preview reads forward the write session receipt", async () => {
  let readOptions;
  const document = {
    id: "preview",
    scope: "kv",
    value: '{"project":"consistent"}',
  };
  const container = {
    items: {
      async upsert() {
        return {
          resource: document,
          etag: "etag-1",
          statusCode: 200,
          headers: { "x-ms-session-token": "session-receipt" },
        };
      },
    },
    item() {
      return {
        async read(options) {
          readOptions = options;
          return {
            resource: document,
            etag: "etag-1",
            statusCode: 200,
          };
        },
      };
    },
  };
  const store = createAzureProjectPreviewStore(container);
  const version = `sha256:${"d".repeat(64)}`;
  const receipt = await store.put(version, document.value, 900);
  assert.equal(receipt, "session-receipt");
  assert.equal(await store.get(version, receipt), document.value);
  assert.deepEqual(readOptions, { sessionToken: "session-receipt" });
});
