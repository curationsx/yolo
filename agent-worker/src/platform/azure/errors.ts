/**
 * Typed Azure gateway errors. Every failure mode in the deployment plan's
 * Error and Health Contract table maps to one of these codes, an HTTP
 * status, a safe public message, and a retryability flag. Handlers convert
 * these to JSON without ever leaking internal diagnostic detail.
 */

export type GatewayErrorCode =
  | "oauth_state_expired"
  | "session_expired"
  | "quota_reached"
  | "copilot_grant_consumed"
  | "dependency_throttled"
  | "agent_limit_reached"
  | "copilot_runtime_timeout"
  | "copilot_runtime_unavailable"
  | "config_invalid"
  | "invalid_request"
  | "not_found";

export interface GatewayErrorOptions {
  retryable?: boolean;
  retryAfterSeconds?: number;
  /** Redacted-safe diagnostic context — never tokens, prompts, or secrets. */
  context?: Record<string, unknown>;
  cause?: unknown;
}

export class GatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly context?: Record<string, unknown>;

  constructor(code: GatewayErrorCode, status: number, message: string, options: GatewayErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "GatewayError";
    this.code = code;
    this.status = status;
    this.retryable = options.retryable ?? false;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.context = options.context;
  }

  toJSON(): { error: string; code: GatewayErrorCode; retryable: boolean } {
    return { error: this.message, code: this.code, retryable: this.retryable };
  }

  toResponse(cors: Record<string, string> = {}): Response {
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cors,
    };
    if (this.retryAfterSeconds !== undefined) {
      headers["retry-after"] = String(this.retryAfterSeconds);
    }
    return new Response(JSON.stringify(this.toJSON()), { status: this.status, headers });
  }
}

export function isGatewayError(value: unknown): value is GatewayError {
  return value instanceof GatewayError;
}

export const GatewayErrors = {
  oauthStateExpired: () =>
    new GatewayError("oauth_state_expired", 400, "Sign-in expired. Please restart login."),
  sessionExpired: () =>
    new GatewayError("session_expired", 401, "Your session expired. Please sign in again."),
  quotaReached: (retryAfterSeconds?: number) =>
    new GatewayError("quota_reached", 429, "Daily capacity reached. Try again later.", {
      retryable: true,
      retryAfterSeconds,
    }),
  copilotGrantConsumed: () =>
    new GatewayError(
      "copilot_grant_consumed",
      409,
      "This Copilot connection was already used. Reconnect to run again.",
    ),
  dependencyThrottled: (retryAfterSeconds?: number, context?: Record<string, unknown>) =>
    new GatewayError("dependency_throttled", 503, "A dependency is temporarily throttled.", {
      retryable: true,
      retryAfterSeconds,
      context,
    }),
  agentLimitReached: () =>
    new GatewayError("agent_limit_reached", 429, "The agent has reached today's capacity.", {
      retryable: true,
    }),
  copilotRuntimeTimeout: () =>
    new GatewayError(
      "copilot_runtime_timeout",
      504,
      "GitHub Copilot did not finish before the run timed out. Reconnect before retrying.",
    ),
  copilotRuntimeUnavailable: () =>
    new GatewayError(
      "copilot_runtime_unavailable",
      502,
      "GitHub Copilot did not complete this run. Reconnect before trying again.",
    ),
  configInvalid: (context?: Record<string, unknown>) =>
    new GatewayError("config_invalid", 500, "The gateway configuration is invalid.", { context }),
  invalidRequest: (message = "invalid request") => new GatewayError("invalid_request", 400, message),
  notFound: (message = "not found") => new GatewayError("not_found", 404, message),
};
