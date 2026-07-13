import assert from "node:assert/strict";
import test from "node:test";

import {
  isAllowedOrigin,
  parseAllowedOrigins,
  resolvedAllowedOrigin,
} from "../src/auth.ts";

const configured =
  "https://curations.dev,https://curations-dev.pages.dev,http://localhost:4321";

test("configured and Cloudflare Pages branch origins are allowed", () => {
  assert.equal(isAllowedOrigin("https://curations.dev", configured), true);
  assert.equal(
    isAllowedOrigin("https://curations-dev.pages.dev", configured),
    true,
  );
  assert.equal(
    isAllowedOrigin(
      "https://feat-catalog-site.curations-dev.pages.dev",
      configured,
    ),
    true,
  );
  assert.equal(
    isAllowedOrigin("https://183afc1b.curations-dev.pages.dev", configured),
    true,
  );
  assert.equal(isAllowedOrigin("http://localhost:4321", configured), true);
});

test("lookalike and insecure preview origins are rejected", () => {
  assert.equal(
    isAllowedOrigin("https://evilcurations-dev.pages.dev", configured),
    false,
  );
  assert.equal(
    isAllowedOrigin("https://curations-dev.pages.dev.evil.example", configured),
    false,
  );
  assert.equal(
    isAllowedOrigin(
      "http://feat-catalog-site.curations-dev.pages.dev",
      configured,
    ),
    false,
  );
});

test("origin parsing normalizes values and resolution fails closed", () => {
  assert.deepEqual(
    parseAllowedOrigins(
      "https://curations.dev/, invalid, https://curations.dev",
    ),
    ["https://curations.dev"],
  );
  assert.equal(
    resolvedAllowedOrigin("https://evil.example", configured),
    "https://curations.dev",
  );
});
