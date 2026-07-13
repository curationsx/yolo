import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import test from "node:test";

import {
  MAX_REQUEST_BODY_BYTES,
  RequestBodyTooLargeError,
  nodeRequestToFetchRequest,
  readBoundedBody,
  requestTooLargeResponse,
  sendFetchResponse,
} from "../src/platform/azure/http-adapter.ts";

async function withIncomingRequest(handler, requestOptions, body) {
  const server = createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      res.writeHead(500);
      res.end(String(error));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const payload = body ?? "";
    const response = await new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          host: "127.0.0.1",
          port: server.address().port,
          path: "/test",
          method: "POST",
          headers: { "content-length": Buffer.byteLength(payload), ...requestOptions?.headers },
          ...requestOptions,
        },
        async (res) => {
          const chunks = [];
          for await (const chunk of res) chunks.push(chunk);
          resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") });
        },
      );
      req.on("error", reject);
      req.end(payload);
    });
    return response;
  } finally {
    server.close();
  }
}

test("nodeRequestToFetchRequest converts method, headers, url, and body", async () => {
  let captured;
  await withIncomingRequest(
    async (req, res) => {
      const fetchRequest = await nodeRequestToFetchRequest(req);
      captured = {
        method: fetchRequest.method,
        url: fetchRequest.url,
        contentType: fetchRequest.headers.get("content-type"),
        body: await fetchRequest.text(),
      };
      res.writeHead(200);
      res.end("ok");
    },
    { headers: { "content-type": "application/json", host: "api.curations.dev" } },
    JSON.stringify({ hello: "world" }),
  );
  assert.equal(captured.method, "POST");
  assert.equal(captured.url, "https://api.curations.dev/test");
  assert.equal(captured.contentType, "application/json");
  assert.equal(captured.body, JSON.stringify({ hello: "world" }));
});

test("nodeRequestToFetchRequest trusts x-forwarded-proto for the resolved URL scheme", async () => {
  let capturedUrl;
  await withIncomingRequest(
    async (req, res) => {
      const fetchRequest = await nodeRequestToFetchRequest(req);
      capturedUrl = fetchRequest.url;
      res.writeHead(200);
      res.end("ok");
    },
    { headers: { host: "api.curations.dev", "x-forwarded-proto": "http" } },
    "",
  );
  assert.equal(capturedUrl, "http://api.curations.dev/test");
});

test("nodeRequestToFetchRequest folds repeated headers with append", async () => {
  let combined;
  await withIncomingRequest(
    async (req, res) => {
      req.headers["x-custom-header"] = ["a=1", "b=2"];
      const fetchRequest = await nodeRequestToFetchRequest(req);
      combined = fetchRequest.headers.get("x-custom-header");
      res.writeHead(200);
      res.end("ok");
    },
    {},
    "",
  );
  assert.equal(combined, "a=1, b=2");
});

test("nodeRequestToFetchRequest skips header entries with an undefined value", async () => {
  let hasHeader;
  await withIncomingRequest(
    async (req, res) => {
      req.headers["x-maybe-missing"] = undefined;
      const fetchRequest = await nodeRequestToFetchRequest(req);
      hasHeader = fetchRequest.headers.has("x-maybe-missing");
      res.writeHead(200);
      res.end("ok");
    },
    {},
    "",
  );
  assert.equal(hasHeader, false);
});

test("readBoundedBody returns undefined for a request with no body bytes", async () => {
  let body;
  await withIncomingRequest(
    async (req, res) => {
      body = await readBoundedBody(req);
      res.writeHead(200);
      res.end("ok");
    },
    { headers: { "content-length": "0" } },
    "",
  );
  assert.equal(body, undefined);
});


test("readBoundedBody returns undefined for GET/HEAD requests", async () => {
  await withIncomingRequest(
    async (req, res) => {
      req.method = "GET";
      const body = await readBoundedBody(req);
      res.writeHead(200);
      res.end(String(body));
    },
    { method: "GET" },
    "",
  );
});

test("readBoundedBody treats a request with no method as GET (no body read)", async () => {
  let body;
  await withIncomingRequest(
    async (req, res) => {
      req.method = undefined;
      body = await readBoundedBody(req);
      res.writeHead(200);
      res.end("ok");
    },
    {},
    "",
  );
  assert.equal(body, undefined);
});

test("readBoundedBody returns undefined for a HEAD request specifically", async () => {
  let body = "not-set";
  await withIncomingRequest(
    async (req, res) => {
      req.method = "HEAD";
      body = await readBoundedBody(req);
      res.writeHead(200);
      res.end("ok");
    },
    {},
    "",
  );
  assert.equal(body, undefined);
});

test("nodeRequestToFetchRequest falls back to localhost when the Host header is missing", async () => {
  let capturedUrl;
  await withIncomingRequest(
    async (req, res) => {
      delete req.headers.host;
      const fetchRequest = await nodeRequestToFetchRequest(req);
      capturedUrl = fetchRequest.url;
      res.writeHead(200);
      res.end("ok");
    },
    {},
    "",
  );
  assert.match(capturedUrl, /^https:\/\/localhost\//);
});

test("nodeRequestToFetchRequest falls back to / when the request URL is missing", async () => {
  let capturedUrl;
  await withIncomingRequest(
    async (req, res) => {
      req.url = undefined;
      const fetchRequest = await nodeRequestToFetchRequest(req);
      capturedUrl = fetchRequest.url;
      res.writeHead(200);
      res.end("ok");
    },
    {},
    "",
  );
  assert.match(capturedUrl, /\/$/);
});

test("nodeRequestToFetchRequest defaults to GET when the request has no method", async () => {
  let capturedMethod;
  await withIncomingRequest(
    async (req, res) => {
      req.method = undefined;
      const fetchRequest = await nodeRequestToFetchRequest(req);
      capturedMethod = fetchRequest.method;
      res.writeHead(200);
      res.end("ok");
    },
    {},
    "",
  );
  assert.equal(capturedMethod, "GET");
});

test("readBoundedBody rejects a body whose declared content-length exceeds the limit", async () => {
  const server = createServer((req, res) => {
    Promise.resolve()
      .then(() => readBoundedBody(req, 10))
      .then(() => {
        res.writeHead(200);
        res.end("should not reach here");
      })
      .catch((error) => {
        res.writeHead(error instanceof RequestBodyTooLargeError ? 413 : 500);
        res.end();
      });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const payload = "x".repeat(1000);
    const response = await new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          host: "127.0.0.1",
          port: server.address().port,
          path: "/test",
          method: "POST",
          headers: { "content-length": Buffer.byteLength(payload) },
        },
        (res) => resolve({ status: res.statusCode }),
      );
      req.on("error", reject);
      req.end(payload);
    });
    assert.equal(response.status, 413);
  } finally {
    server.close();
  }
});

test("readBoundedBody rejects a body that exceeds the limit without a declared content-length", async () => {
  const server = createServer((req, res) => {
    req.headers["content-length"] = undefined;
    Promise.resolve()
      .then(() => readBoundedBody(req, 5))
      .then(() => {
        res.writeHead(200);
        res.end();
      })
      .catch((error) => {
        res.writeHead(error instanceof RequestBodyTooLargeError ? 413 : 500);
        res.end();
      });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await new Promise((resolve, reject) => {
      const req = httpRequest(
        { host: "127.0.0.1", port: server.address().port, path: "/test", method: "POST" },
        (res) => resolve({ status: res.statusCode }),
      );
      req.on("error", reject);
      req.write("chunk-one-");
      req.write("chunk-two-");
      req.end();
    });
    assert.equal(response.status, 413);
  } finally {
    server.close();
  }
});

test("readBoundedBody accepts a small body under the configured limit", async () => {
  let captured;
  await withIncomingRequest(
    async (req, res) => {
      captured = (await readBoundedBody(req, MAX_REQUEST_BODY_BYTES)).toString("utf8");
      res.writeHead(200);
      res.end("ok");
    },
    { headers: {} },
    "small body",
  );
  assert.equal(captured, "small body");
});

test("sendFetchResponse writes status, headers, and a buffered body", async () => {
  const chunks = [];
  const headers = {};
  const fakeRes = {
    writeHead: (status, hdrs) => {
      fakeRes.statusCode = status;
      Object.assign(headers, hdrs);
    },
    end: (buffer) => {
      if (buffer) chunks.push(buffer);
    },
  };
  const response = new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
  await sendFetchResponse(response, fakeRes);
  assert.equal(fakeRes.statusCode, 201);
  assert.equal(headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString("utf8")), { ok: true });
});

test("sendFetchResponse handles a bodyless response", async () => {
  let ended = false;
  const fakeRes = {
    writeHead: () => {},
    end: () => {
      ended = true;
    },
  };
  await sendFetchResponse(new Response(null, { status: 204 }), fakeRes);
  assert.equal(ended, true);
});

test("requestTooLargeResponse returns a typed 413 payload", async () => {
  const response = requestTooLargeResponse({ "access-control-allow-origin": "https://curations.dev" });
  assert.equal(response.status, 413);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://curations.dev");
  const body = await response.json();
  assert.equal(body.code, "payload_too_large");
});
