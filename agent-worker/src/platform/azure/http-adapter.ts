/**
 * Node HTTP <-> Fetch API adapter.
 *
 * Converts a Node `IncomingMessage`/`ServerResponse` pair into a Fetch API
 * `Request`, and writes a Fetch API `Response` back onto the Node
 * response — without changing any route semantics. This is what lets the
 * shared router (`../../router.ts`) run unmodified on both Cloudflare
 * Workers and this Node/Azure gateway.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export const MAX_REQUEST_BODY_BYTES = 300_000;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("request body exceeds the allowed size");
  }
}

/** Reads the full request body into a buffer, aborting once the size limit
 * is exceeded (declared `content-length` or actual bytes streamed). GET/HEAD
 * requests and bodyless methods return `undefined`. */
export async function readBoundedBody(
  req: IncomingMessage,
  limit = MAX_REQUEST_BODY_BYTES,
): Promise<Buffer | undefined> {
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;

  const declared = Number.parseInt(String(req.headers["content-length"] ?? "0"), 10);
  if (Number.isFinite(declared) && declared > limit) {
    req.resume(); // drain to let the socket close cleanly
    throw new RequestBodyTooLargeError();
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > limit) {
      throw new RequestBodyTooLargeError();
    }
    chunks.push(buffer);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function resolveRequestUrl(req: IncomingMessage): string {
  const host = req.headers.host ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  return new URL(req.url ?? "/", `${proto}://${host}`).toString();
}

/** Converts one Node request into a Fetch API `Request`. Throws
 * `RequestBodyTooLargeError` for oversized bodies — callers should respond
 * `413` and close the connection. */
export async function nodeRequestToFetchRequest(req: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(key, entry);
    } else {
      headers.set(key, value);
    }
  }

  const body = await readBoundedBody(req);
  return new Request(resolveRequestUrl(req), {
    method: req.method ?? "GET",
    headers,
    body,
  });
}

/** Writes a Fetch API `Response` onto a Node `ServerResponse`, streaming the
 * body when present. */
export async function sendFetchResponse(response: Response, res: ServerResponse): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  if (!response.body) {
    res.end();
    return;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

/** Standard 413 response for oversized request bodies. */
export function requestTooLargeResponse(cors: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ error: "request body exceeds the allowed size", code: "payload_too_large" }),
    {
      status: 413,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors },
    },
  );
}
