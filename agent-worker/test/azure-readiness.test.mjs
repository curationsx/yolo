import assert from "node:assert/strict";
import test from "node:test";

import { createAzureReadinessProbe } from "../src/platform/azure/readiness.ts";
import { FakeCosmosContainer } from "./helpers/fake-cosmos-container.mjs";

function credential(token = { token: "t" }) {
  return {
    getToken: async () => token,
  };
}

test("readiness reports ready when configuration, Cosmos, and Foundry all check out", async () => {
  const probe = createAzureReadinessProbe({
    gatewayStateContainer: new FakeCosmosContainer("scope"),
    credential: credential(),
    configured: { github: true, copilot: true },
  });
  const result = await probe.check();
  assert.equal(result.ready, true);
  assert.deepEqual(result.checks, { github: "ok", copilot: "ok", cosmos: "ok", foundry: "ok" });
});

test("readiness fails when a required configuration flag is false", async () => {
  const probe = createAzureReadinessProbe({
    gatewayStateContainer: new FakeCosmosContainer("scope"),
    credential: credential(),
    configured: { github: false, copilot: true },
  });
  const result = await probe.check();
  assert.equal(result.ready, false);
  assert.equal(result.checks.github, "error");
});

test("readiness fails when Cosmos is unreachable", async () => {
  const container = new FakeCosmosContainer("scope");
  container.failNext("read", 503);
  const probe = createAzureReadinessProbe({
    gatewayStateContainer: container,
    credential: credential(),
    configured: {},
  });
  const result = await probe.check();
  assert.equal(result.ready, false);
  assert.equal(result.checks.cosmos, "error");
});

test("readiness treats a 404 point read as a healthy Cosmos connection", async () => {
  const probe = createAzureReadinessProbe({
    gatewayStateContainer: new FakeCosmosContainer("scope"),
    credential: credential(),
    configured: {},
  });
  const result = await probe.check();
  assert.equal(result.checks.cosmos, "ok");
});

test("readiness fails when managed identity cannot mint a Foundry token", async () => {
  const probe = createAzureReadinessProbe({
    gatewayStateContainer: new FakeCosmosContainer("scope"),
    credential: credential(null),
    configured: {},
  });
  const result = await probe.check();
  assert.equal(result.ready, false);
  assert.equal(result.checks.foundry, "error");
});

test("readiness fails when the credential throws", async () => {
  const probe = createAzureReadinessProbe({
    gatewayStateContainer: new FakeCosmosContainer("scope"),
    credential: { getToken: async () => { throw new Error("network down"); } },
    configured: {},
  });
  const result = await probe.check();
  assert.equal(result.ready, false);
  assert.equal(result.checks.foundry, "error");
});
