/**
 * Gateway -> internal Copilot runtime transport on Azure. The runtime
 * Container App has internal-only ingress; the gateway additionally proves
 * itself with an independent shared bearer secret so a misdirected request
 * inside the Container Apps environment cannot spend a user's Copilot
 * entitlement. Requests are bounded by an explicit timeout and never log
 * the delegated GitHub token or the prompt body.
 */

import { GatewayErrors } from "./errors.ts";
import type { CopilotRunPayload, CopilotRunResult, CopilotRuntimeClient } from "../contracts.ts";

export interface AzureCopilotRuntimeConfig {
  url: string;
  sharedSecret: string;
}

export function createAzureCopilotRuntimeClient(config: AzureCopilotRuntimeConfig): CopilotRuntimeClient {
  return {
    async run(payload: CopilotRunPayload, timeoutMs: number): Promise<CopilotRunResult> {
      let response: Response;
      try {
        response = await fetch(new URL("/run", config.url), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-copilot-runtime-secret": config.sharedSecret,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "TimeoutError") {
          throw GatewayErrors.copilotRuntimeTimeout();
        }
        throw GatewayErrors.copilotRuntimeUnavailable();
      }

      let body: CopilotRunResult["body"] = null;
      try {
        body = (await response.json()) as CopilotRunResult["body"];
      } catch {
        body = null;
      }
      return { status: response.status, ok: response.ok, body };
    },
  };
}
