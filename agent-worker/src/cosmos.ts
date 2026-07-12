/**
 * Minimal Azure Cosmos DB (SQL API) REST client for Cloudflare Workers.
 * Zero dependencies — signs requests with the master key via Web Crypto.
 * Only implements what the gateway needs: create document + query documents.
 */

export interface CosmosConfig {
  endpoint: string; // https://{account}.documents.azure.com
  key: string; // primary key (base64)
  database: string;
  container: string;
}

const COSMOS_API_VERSION = "2018-12-31";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64(bytes: ArrayBuffer): string {
  let bin = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
  return btoa(bin);
}

async function authHeader(
  key: string,
  verb: string,
  resourceType: string,
  resourceLink: string,
  date: string,
): Promise<string> {
  const payload =
    `${verb.toLowerCase()}\n${resourceType.toLowerCase()}\n${resourceLink}\n` +
    `${date.toLowerCase()}\n\n`;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    b64ToBytes(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = bytesToB64(
    await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload)),
  );
  return encodeURIComponent(`type=master&ver=1.0&sig=${sig}`);
}

async function cosmosFetch(
  cfg: CosmosConfig,
  verb: "GET" | "POST",
  resourceType: string,
  resourceLink: string,
  path: string,
  body: unknown,
  extraHeaders: Record<string, string>,
): Promise<Response> {
  const date = new Date().toUTCString().toLowerCase();
  const auth = await authHeader(cfg.key, verb, resourceType, resourceLink, date);
  return fetch(`${cfg.endpoint}${path}`, {
    method: verb,
    headers: {
      authorization: auth,
      "x-ms-date": date,
      "x-ms-version": COSMOS_API_VERSION,
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Insert one document into the engagements container. */
export async function createDocument(
  cfg: CosmosConfig,
  doc: Record<string, unknown>,
  partitionKey: string,
): Promise<void> {
  const link = `dbs/${cfg.database}/colls/${cfg.container}`;
  const res = await cosmosFetch(cfg, "POST", "docs", link, `/${link}/docs`, doc, {
    "x-ms-documentdb-partitionkey": JSON.stringify([partitionKey]),
  });
  if (!res.ok) {
    throw new Error(`cosmos create failed: ${res.status} ${await res.text()}`);
  }
}

/** Query documents within a single partition (tool_id). */
export async function queryDocuments<T>(
  cfg: CosmosConfig,
  query: string,
  parameters: { name: string; value: string | number }[],
  partitionKey: string,
): Promise<T[]> {
  const link = `dbs/${cfg.database}/colls/${cfg.container}`;
  const res = await cosmosFetch(
    cfg,
    "POST",
    "docs",
    link,
    `/${link}/docs`,
    { query, parameters },
    {
      "content-type": "application/query+json",
      "x-ms-documentdb-isquery": "true",
      "x-ms-documentdb-partitionkey": JSON.stringify([partitionKey]),
    },
  );
  if (!res.ok) {
    throw new Error(`cosmos query failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { Documents?: T[] };
  return data.Documents ?? [];
}
