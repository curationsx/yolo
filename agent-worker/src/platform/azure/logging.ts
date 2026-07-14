/**
 * Redacted structured request logging. Only route, status, latency,
 * dependency, correlation id, and run id are logged — never tokens, OAuth
 * codes, authorization headers, prompt bodies, discussion bodies, or model
 * responses. `assertNoSecretLeak` is a defensive check used by tests to
 * prove that a given log line never contains a known secret substring.
 */

export interface RequestLogFields {
  route: string;
  method: string;
  status: number;
  latencyMs: number;
  correlationId: string;
}

const REDACTED_HEADER_NAMES = new Set(["authorization", "cookie", "set-cookie", "x-copilot-runtime-secret"]);

export function redactHeaders(headers: Headers): Record<string, string> {
  const redacted: Record<string, string> = {};
  headers.forEach((value, key) => {
    redacted[key] = REDACTED_HEADER_NAMES.has(key.toLowerCase()) ? "[redacted]" : value;
  });
  return redacted;
}

export function logRequest(fields: RequestLogFields): void {
  console.log(
    JSON.stringify({
      level: "info",
      route: fields.route,
      method: fields.method,
      status: fields.status,
      latency_ms: fields.latencyMs,
      correlation_id: fields.correlationId,
    }),
  );
}

export function logError(route: string, correlationId: string, error: unknown): void {
  console.error(
    JSON.stringify({
      level: "error",
      route,
      correlation_id: correlationId,
      message: error instanceof Error ? error.message : "unknown error",
    }),
  );
}

/** Returns `true` when `haystack` does not contain any of `secrets` — used
 * by tests to assert no token/prompt leakage into logs. */
export function assertNoSecretLeak(haystack: string, secrets: string[]): boolean {
  return secrets.every((secret) => !secret || !haystack.includes(secret));
}
