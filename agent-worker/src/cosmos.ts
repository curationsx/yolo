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
export type CosmosParameterValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[];

export interface CosmosSessionResult<T> {
  value: T;
  sessionToken: string | null;
}

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
  verb: "GET" | "POST" | "DELETE",
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

function sessionHeaders(sessionToken?: string): Record<string, string> {
  return sessionToken ? { "x-ms-session-token": sessionToken } : {};
}

function responseSessionToken(res: Response, current?: string): string | null {
  return res.headers.get("x-ms-session-token") ?? current ?? null;
}

/** Insert one document into the engagements container. */
export async function createDocumentWithSession(
  cfg: CosmosConfig,
  doc: object,
  partitionKey: string,
  sessionToken?: string,
): Promise<string | null> {
  const link = `dbs/${cfg.database}/colls/${cfg.container}`;
  const res = await cosmosFetch(cfg, "POST", "docs", link, `/${link}/docs`, doc, {
    "x-ms-documentdb-partitionkey": JSON.stringify([partitionKey]),
    ...sessionHeaders(sessionToken),
  });
  if (!res.ok) {
    throw new Error(`cosmos create failed: ${res.status} ${await res.text()}`);
  }
  return responseSessionToken(res, sessionToken);
}

export async function createDocument(
  cfg: CosmosConfig,
  doc: object,
  partitionKey: string,
): Promise<void> {
  await createDocumentWithSession(cfg, doc, partitionKey);
}

/** Insert or replace one document, keyed by its id + partition key. */
export async function upsertDocument(
  cfg: CosmosConfig,
  doc: object,
  partitionKey: string,
): Promise<void> {
  const link = `dbs/${cfg.database}/colls/${cfg.container}`;
  const res = await cosmosFetch(cfg, "POST", "docs", link, `/${link}/docs`, doc, {
    "x-ms-documentdb-partitionkey": JSON.stringify([partitionKey]),
    "x-ms-documentdb-is-upsert": "true",
  });
  if (!res.ok) {
    throw new Error(`cosmos upsert failed: ${res.status} ${await res.text()}`);
  }
}

/** Read one document by id within its logical partition. */
export async function readDocumentWithSession<T>(
  cfg: CosmosConfig,
  id: string,
  partitionKey: string,
  sessionToken?: string,
): Promise<CosmosSessionResult<T | null>> {
  const link = `dbs/${cfg.database}/colls/${cfg.container}/docs/${encodeURIComponent(id)}`;
  const res = await cosmosFetch(cfg, "GET", "docs", link, `/${link}`, undefined, {
    "x-ms-documentdb-partitionkey": JSON.stringify([partitionKey]),
    ...sessionHeaders(sessionToken),
  });
  const nextSessionToken = responseSessionToken(res, sessionToken);
  if (res.status === 404) return { value: null, sessionToken: nextSessionToken };
  if (!res.ok) {
    throw new Error(`cosmos read failed: ${res.status} ${await res.text()}`);
  }
  return { value: (await res.json()) as T, sessionToken: nextSessionToken };
}

export async function readDocument<T>(
  cfg: CosmosConfig,
  id: string,
  partitionKey: string,
): Promise<T | null> {
  return (await readDocumentWithSession<T>(cfg, id, partitionKey)).value;
}

/** Delete one document by id within its logical partition. */
export async function deleteDocumentWithSession(
  cfg: CosmosConfig,
  id: string,
  partitionKey: string,
  sessionToken?: string,
): Promise<string | null> {
  const link = `dbs/${cfg.database}/colls/${cfg.container}/docs/${encodeURIComponent(id)}`;
  const res = await cosmosFetch(cfg, "DELETE", "docs", link, `/${link}`, undefined, {
    "x-ms-documentdb-partitionkey": JSON.stringify([partitionKey]),
    ...sessionHeaders(sessionToken),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`cosmos delete failed: ${res.status} ${await res.text()}`);
  }
  return responseSessionToken(res, sessionToken);
}

export async function deleteDocument(
  cfg: CosmosConfig,
  id: string,
  partitionKey: string,
): Promise<void> {
  await deleteDocumentWithSession(cfg, id, partitionKey);
}

/** Query documents within a single logical partition. */
export async function queryDocumentsWithSession<T>(
  cfg: CosmosConfig,
  query: string,
  parameters: { name: string; value: CosmosParameterValue }[],
  partitionKey: string,
  sessionToken?: string,
): Promise<CosmosSessionResult<T[]>> {
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
      ...sessionHeaders(sessionToken),
    },
  );
  if (!res.ok) {
    throw new Error(`cosmos query failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { Documents?: T[] };
  return {
    value: data.Documents ?? [],
    sessionToken: responseSessionToken(res, sessionToken),
  };
}

export async function queryDocuments<T>(
  cfg: CosmosConfig,
  query: string,
  parameters: { name: string; value: CosmosParameterValue }[],
  partitionKey: string,
): Promise<T[]> {
  return (await queryDocumentsWithSession<T>(cfg, query, parameters, partitionKey)).value;
}

/** Query across logical partitions. Use sparingly and always keep result sets bounded. */
export async function queryDocumentsCrossPartition<T>(
  cfg: CosmosConfig,
  query: string,
  parameters: { name: string; value: CosmosParameterValue }[],
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
      "x-ms-documentdb-query-enablecrosspartition": "true",
    },
  );
  if (!res.ok) {
    throw new Error(`cosmos cross-partition query failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { Documents?: T[] };
  return data.Documents ?? [];
}
