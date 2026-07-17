import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, test } from "node:test";

import { deleteDocument, readDocument } from "../src/cosmos.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function expectedAuthorization(key, verb, resourceLink, date) {
  const payload =
    `${verb.toLowerCase()}\ndocs\n${resourceLink}\n${date.toLowerCase()}\n\n`;
  const signature = createHmac("sha256", Buffer.from(key, "base64"))
    .update(payload)
    .digest("base64");
  return encodeURIComponent(`type=master&ver=1.0&sig=${signature}`);
}

test("Cosmos point reads encode colon IDs in the URL but sign the raw resource ID", async () => {
  const key = Buffer.from("cosmos-test-key").toString("base64");
  const config = {
    endpoint: "https://cosmos.example",
    key,
    database: "curations",
    container: "engagements",
  };
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), headers: init.headers };
    return new Response(null, { status: 404 });
  };

  assert.equal(await readDocument(config, "github-repository:987654", "partition"), null);
  assert.equal(
    captured.url,
    "https://cosmos.example/dbs/curations/colls/engagements/docs/github-repository%3A987654",
  );
  assert.equal(
    captured.headers.authorization,
    expectedAuthorization(
      key,
      "GET",
      "dbs/curations/colls/engagements/docs/github-repository:987654",
      captured.headers["x-ms-date"],
    ),
  );
});

test("Cosmos point deletes use the same raw-ID signing rule", async () => {
  const key = Buffer.from("cosmos-test-key").toString("base64");
  const config = {
    endpoint: "https://cosmos.example",
    key,
    database: "curations",
    container: "engagements",
  };
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), headers: init.headers };
    return new Response(null, { status: 204 });
  };

  await deleteDocument(config, "snapshot:project:abc", "partition");
  assert.match(captured.url, /snapshot%3Aproject%3Aabc$/);
  assert.equal(
    captured.headers.authorization,
    expectedAuthorization(
      key,
      "DELETE",
      "dbs/curations/colls/engagements/docs/snapshot:project:abc",
      captured.headers["x-ms-date"],
    ),
  );
});

