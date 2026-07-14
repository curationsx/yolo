import { Container } from "@cloudflare/containers";

export class CopilotRuntime extends Container {
  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "15m";
  enableInternet = true;
  envVars = {
    NODE_ENV: "production",
    PORT: "8080",
    HOME: "/tmp/curations-home",
    COPILOT_HOME: "/tmp/curations-copilot",
  };

  override onError(error: unknown): never {
    console.error(
      "Copilot runtime failed",
      error instanceof Error ? error.message : "unknown runtime error",
    );
    throw error;
  }
}
