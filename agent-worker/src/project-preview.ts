import type { ProjectPreviewStore } from "./platform/contracts.ts";

interface ProjectPreviewEnv {
  PROJECT_PREVIEW: DurableObjectNamespace;
}

const PREVIEW_KEY = "preview";
const PREVIEW_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/;
const MAX_PREVIEW_BYTES = 128_000;
const MAX_TTL_SECONDS = 30 * 60;

interface StoredPreview {
  value: string;
  expires_at: string;
}

function validStoredPreview(value: unknown): value is StoredPreview {
  if (!value || typeof value !== "object") return false;
  const preview = value as Partial<StoredPreview>;
  return (
    typeof preview.value === "string" &&
    new TextEncoder().encode(preview.value).byteLength <= MAX_PREVIEW_BYTES &&
    typeof preview.expires_at === "string" &&
    Number.isFinite(Date.parse(preview.expires_at))
  );
}

export class ProjectPreviewGuard {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname;
    if (path === "/put" && req.method === "POST") {
      let preview: unknown;
      try {
        preview = await req.json();
      } catch {
        return Response.json({ error: "invalid Project preview" }, { status: 400 });
      }
      if (!validStoredPreview(preview) || Date.parse(preview.expires_at) <= Date.now()) {
        return Response.json({ error: "invalid Project preview" }, { status: 400 });
      }
      await this.state.storage.put(PREVIEW_KEY, preview);
      await this.state.storage.setAlarm(Date.parse(preview.expires_at));
      return Response.json({ ok: true });
    }
    if (path === "/get" && req.method === "GET") {
      const preview = await this.state.storage.get<StoredPreview>(PREVIEW_KEY);
      if (
        !preview ||
        !validStoredPreview(preview) ||
        Date.parse(preview.expires_at) <= Date.now()
      ) {
        if (preview) await this.state.storage.delete(PREVIEW_KEY);
        return Response.json({ error: "Project preview not found" }, { status: 404 });
      }
      return Response.json({ value: preview.value });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }
}

function previewNamespace(env: ProjectPreviewEnv, previewVersion: string) {
  if (!PREVIEW_VERSION_PATTERN.test(previewVersion)) {
    throw new Error("invalid Project preview version");
  }
  return env.PROJECT_PREVIEW.get(env.PROJECT_PREVIEW.idFromName(previewVersion));
}

export function createCloudflareProjectPreviewStore(
  namespace: DurableObjectNamespace,
): ProjectPreviewStore {
  const env = { PROJECT_PREVIEW: namespace };
  return {
    async put(previewVersion, value, ttlSeconds) {
      if (
        !Number.isSafeInteger(ttlSeconds) ||
        ttlSeconds < 1 ||
        ttlSeconds > MAX_TTL_SECONDS
      ) {
        throw new Error("invalid Project preview TTL");
      }
      const response = await previewNamespace(env, previewVersion).fetch(
        "https://project-preview.internal/put",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            value,
            expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Project preview store failed: ${response.status}`);
      }
      return "durable-object-v1";
    },
    async get(previewVersion, consistencyToken) {
      if (consistencyToken !== "durable-object-v1") return null;
      const response = await previewNamespace(env, previewVersion).fetch(
        "https://project-preview.internal/get",
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Project preview store failed: ${response.status}`);
      }
      const body = (await response.json()) as { value?: unknown };
      return typeof body.value === "string" ? body.value : null;
    },
  };
}
