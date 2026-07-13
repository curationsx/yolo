/**
 * Azure `/api/ready` probe — bounded, non-billable dependency checks.
 * Cosmos connectivity is verified with a single point read (a 404 still
 * proves managed-identity auth and network reachability); Foundry access is
 * verified by minting a managed-identity token without calling the
 * completions endpoint, so readiness never spends model budget or wakes a
 * scaled-to-zero dependency unnecessarily.
 */

import type { TokenCredential } from "@azure/identity";
import type { ReadinessCheckResult, ReadinessProbe } from "../contracts.ts";
import type { CosmosContainerLike } from "./cosmos-types.ts";

const FOUNDRY_SCOPE = "https://cognitiveservices.azure.com/.default";

export interface AzureReadinessDeps {
  gatewayStateContainer: CosmosContainerLike;
  credential: TokenCredential;
  configured: Record<string, boolean>;
}

export function createAzureReadinessProbe(deps: AzureReadinessDeps): ReadinessProbe {
  return {
    async check(): Promise<ReadinessCheckResult> {
      const checks: Record<string, "ok" | "error"> = {};
      let ready = true;

      for (const [name, value] of Object.entries(deps.configured)) {
        checks[name] = value ? "ok" : "error";
        if (!value) ready = false;
      }

      try {
        await deps.gatewayStateContainer.item("readiness-probe", "kv").read();
        checks.cosmos = "ok";
      } catch {
        checks.cosmos = "error";
        ready = false;
      }

      try {
        const token = await deps.credential.getToken(FOUNDRY_SCOPE);
        checks.foundry = token ? "ok" : "error";
        if (!token) ready = false;
      } catch {
        checks.foundry = "error";
        ready = false;
      }

      return { ready, checks };
    },
  };
}
