const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+$/;
const MAX_FILE_BYTES = 128_000;

interface Marker {
  rule_id: string;
  rule_version: "1.0.0";
  path: string;
  label: string;
  pattern: RegExp;
  limitation: string;
}

const OBSERVATION_LIMITATION =
  "A matching public file at this commit is a literal configuration signal only; it does not prove runtime use, production use, quality, or effectiveness.";

function marker(
  ruleId: string,
  path: string,
  label: string,
  pattern: RegExp,
): Marker {
  return {
    rule_id: ruleId,
    rule_version: "1.0.0",
    path,
    label,
    pattern,
    limitation: OBSERVATION_LIMITATION,
  };
}

const STACK_MARKERS: Record<string, Marker[]> = {
  ollama: [
    marker("ollama.modelfile", "Modelfile", "Ollama Modelfile", /^\s*FROM\s+\S+/m),
    marker("ollama.compose-yml", "docker-compose.yml", "Docker Compose references Ollama", /\bollama\b/i),
    marker("ollama.compose-yaml", "docker-compose.yaml", "Docker Compose references Ollama", /\bollama\b/i),
    marker("ollama.javascript-dependency", "package.json", "JavaScript Ollama dependency", /"(?:ollama|@langchain\/ollama)"\s*:/i),
    marker("ollama.python-dependency", "pyproject.toml", "Python Ollama dependency", /\bollama\b/i),
  ],
  supabase: [
    marker("supabase.local-config", "supabase/config.toml", "Supabase local configuration", /\[api\]|\[db\]|\[auth\]/i),
    marker("supabase.javascript-client", "package.json", "Supabase JavaScript client", /"@supabase\/supabase-js"\s*:/i),
    marker("supabase.requirements-client", "requirements.txt", "Supabase Python client", /^\s*supabase(?:[<=>~!]|$)/im),
    marker("supabase.pyproject-client", "pyproject.toml", "Supabase Python client", /\bsupabase\b/i),
  ],
  cloudflare: [
    marker("cloudflare.wrangler-toml", "wrangler.toml", "Wrangler configuration", /^\s*(?:name|main|compatibility_date)\s*=/m),
    marker("cloudflare.wrangler-jsonc", "wrangler.jsonc", "Wrangler configuration", /"(?:name|main|compatibility_date)"\s*:/i),
    marker("cloudflare.wrangler-json", "wrangler.json", "Wrangler configuration", /"(?:name|main|compatibility_date)"\s*:/i),
    marker("cloudflare.workers-package", "package.json", "Cloudflare Workers package", /"name"\s*:\s*"wrangler"|"(?:wrangler|@cloudflare\/workers-types)"\s*:/i),
  ],
  n8n: [
    marker("n8n.compose-yml", "docker-compose.yml", "Docker Compose runs n8n", /n8nio\/n8n|\bn8n\b/i),
    marker("n8n.compose-yaml", "docker-compose.yaml", "Docker Compose runs n8n", /n8nio\/n8n|\bn8n\b/i),
    marker("n8n.javascript-package", "package.json", "n8n package", /"name"\s*:\s*"n8n"|"(?:n8n|n8n-workflow|n8n-core)"\s*:/i),
    marker("n8n.exported-workflow", "workflow.json", "Exported n8n workflow", /"nodes"\s*:|"n8n-nodes-base\./i),
  ],
  langfuse: [
    marker("langfuse.javascript-package", "package.json", "Langfuse JavaScript package", /"name"\s*:\s*"langfuse"|"(?:langfuse|@langfuse\/[^"]+)"\s*:/i),
    marker("langfuse.requirements-dependency", "requirements.txt", "Langfuse Python dependency", /^\s*langfuse(?:[<=>~!]|$)/im),
    marker("langfuse.pyproject-dependency", "pyproject.toml", "Langfuse Python dependency", /\blangfuse\b/i),
    marker("langfuse.compose-service", "docker-compose.yml", "Self-hosted Langfuse service", /\blangfuse\b/i),
  ],
  obsidian: [
    marker("obsidian.vault-config", ".obsidian/app.json", "Obsidian vault configuration", /^\s*\{/),
    marker("obsidian.community-plugins", ".obsidian/community-plugins.json", "Obsidian community plugin manifest", /^\s*\[/),
    marker("obsidian.plugin-manifest", "manifest.json", "Obsidian plugin manifest", /"minAppVersion"\s*:|"isDesktopOnly"\s*:/i),
    marker("obsidian.javascript-api", "package.json", "Obsidian plugin API dependency", /"obsidian"\s*:/i),
  ],
};

export interface RepositoryCheck {
  path: string;
  label: string;
  matched: boolean;
}

export interface RepositoryEvidence {
  url: string;
  owner: string;
  name: string;
  description: string | null;
  default_branch: string | null;
  stars: number | null;
  archived: boolean | null;
  fork: boolean | null;
  stack_path: string | null;
  submitter_matches_owner: boolean;
  automated_status: "verified" | "partial" | "unverified";
  checks: RepositoryCheck[];
  checked_at: string;
  note: string;
}

export type RepositoryVerificationResult =
  | { ok: true; evidence: RepositoryEvidence; prdUrl: string | null }
  | { ok: false; status: number; error: string };

interface GitHubRepository {
  owner: string;
  name: string;
  url: string;
}

interface GitHubMetadata {
  id?: number;
  default_branch?: string;
  stargazers_count?: number;
  description?: string | null;
  archived?: boolean;
  fork?: boolean;
  private?: boolean;
  owner?: {
    id?: number;
    login?: string;
    type?: string;
  };
}

interface GitHubCommit {
  sha?: string;
}

interface GitHubContent {
  type?: string;
  encoding?: string;
  content?: string;
  sha?: string;
  size?: number;
}

export interface ProjectToolInput {
  tool_id: string;
  declared_use: string;
  declared_in_prd: boolean;
  stack_path: string;
}

export interface ProjectObservation {
  rule_id: string;
  rule_version: "1.0.0";
  path: string;
  label: string;
  matched: boolean;
  limitation: string;
}

export interface ProjectToolClaim {
  tool_id: string;
  declared_use: string;
  declared_in_prd: boolean;
  stack_path: string | null;
  observations: ProjectObservation[];
}

export interface ProjectRepositoryInspection {
  repository: {
    github_id: number;
    owner: string;
    name: string;
    url: string;
    fork: false;
    archived: false;
    default_branch: string;
    commit_sha: string;
  };
  prd: {
    path: string;
    blob_sha: string;
    content_sha256: string;
    source_url: string;
  };
  claims: ProjectToolClaim[];
  checker_version: "project-evidence/0.1.0";
  checked_at: string;
  fresh_until: string;
}

export type ProjectInspectionResult =
  | { ok: true; inspection: ProjectRepositoryInspection }
  | { ok: false; status: number; error: string };

function parseRepository(raw: string): GitHubRepository | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
    const parts = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
    if (
      parts.length !== 2 ||
      !parts.every((part) => GITHUB_REPOSITORY_PATTERN.test(part))
    ) {
      return null;
    }
    const [owner, name] = parts;
    return { owner, name, url: `https://github.com/${owner}/${name}` };
  } catch {
    return null;
  }
}

function normalizePrdUrl(raw: string, repository: GitHubRepository): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname === "github.com") {
      if (
        parts.length < 5 ||
        parts[0].toLowerCase() !== repository.owner.toLowerCase() ||
        parts[1].toLowerCase() !== repository.name.toLowerCase() ||
        parts[2] !== "blob"
      ) {
        return null;
      }
      return url.toString();
    }
    if (url.hostname === "raw.githubusercontent.com") {
      if (
        parts.length < 4 ||
        parts[0].toLowerCase() !== repository.owner.toLowerCase() ||
        parts[1].toLowerCase() !== repository.name.toLowerCase()
      ) {
        return null;
      }
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeStackPath(raw: string): string | null | undefined {
  if (!raw.trim()) return null;
  const parts = raw
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/");
  if (
    !parts.length ||
    parts.some(
      (part) =>
        part === "." ||
        part === ".." ||
        !GITHUB_REPOSITORY_PATTERN.test(part),
    )
  ) {
    return undefined;
  }
  return parts.join("/");
}

  function normalizeProjectPath(raw: string): string | null {
    const value = raw.trim().replace(/^\/+/, "");
    if (!value || value.length > 240 || !/\.mdx?$/i.test(value)) return null;
    const parts = value.split("/");
    if (
      parts.some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          !/^[A-Za-z0-9_. -]+$/.test(part),
      )
    ) {
      return null;
    }
    return parts.join("/");
  }

  function githubHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "user-agent": "curations.dev project verifier",
      "x-github-api-version": "2022-11-28",
    };
    if (token) headers.authorization = `Bearer ${token}`;
    return headers;
  }

  async function fetchGithubJson<T>(
    url: string,
    token?: string,
  ): Promise<{ ok: true; value: T } | { ok: false; status: number }> {
    try {
      const response = await fetch(url, {
        headers: githubHeaders(token),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return { ok: false, status: response.status };
      return { ok: true, value: (await response.json()) as T };
    } catch {
      return { ok: false, status: 0 };
    }
  }

  function decodeGithubContent(content: GitHubContent): string | null {
    if (
      content.type !== "file" ||
      content.encoding !== "base64" ||
      typeof content.content !== "string" ||
      typeof content.size !== "number" ||
      content.size < 1 ||
      content.size > MAX_FILE_BYTES
    ) {
      return null;
    }
    try {
      const binary = atob(content.content.replace(/\s+/g, ""));
      if (binary.length > MAX_FILE_BYTES) return null;
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
    } catch {
      return null;
    }
  }

  async function sha256Hex(value: string): Promise<string> {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function encodedPath(path: string): string {
    return path
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  export async function inspectProjectRepository(
    repositoryUrl: string,
    prdPath: string,
      approvedExcerpt: string,
      tools: ProjectToolInput[],
    submitterLogin: string,
      submitterUserId: string,
      token?: string,
  ): Promise<ProjectInspectionResult> {
    const repository = parseRepository(repositoryUrl);
    if (!repository) {
      return {
        ok: false,
        status: 400,
        error: "repository_url must be a public GitHub repository root",
      };
    }
    const normalizedPrdPath = normalizeProjectPath(prdPath);
    if (!normalizedPrdPath) {
      return {
        ok: false,
        status: 400,
        error: "prd_path must be a relative Markdown file path",
      };
    }
    if (!Array.isArray(tools) || tools.length < 1 || tools.length > 6) {
      return {
        ok: false,
        status: 400,
        error: "tools must contain 1-6 declarations",
      };
    }

    const normalizedTools: ProjectToolInput[] = [];
    const seenTools = new Set<string>();
    for (const tool of tools) {
      const toolId =
        typeof tool?.tool_id === "string" ? tool.tool_id.trim().toLowerCase() : "";
      const declaredUse =
        typeof tool?.declared_use === "string" ? tool.declared_use.trim() : "";
      const declaredInPrd = tool?.declared_in_prd;
      const stackPath =
        typeof tool?.stack_path === "string" ? tool.stack_path.trim() : "";
      const normalizedStackPath = normalizeStackPath(stackPath);
      if (
        !/^[a-z0-9][a-z0-9-]{0,63}$/.test(toolId) ||
        seenTools.has(toolId) ||
        declaredUse.length < 8 ||
        declaredUse.length > 300 ||
        typeof declaredInPrd !== "boolean" ||
        normalizedStackPath === undefined
      ) {
        return {
          ok: false,
          status: 400,
          error: "each tool requires a unique id, bounded declared use, and safe stack path",
        };
      }
      seenTools.add(toolId);
      normalizedTools.push({
        tool_id: toolId,
        declared_use: declaredUse,
        declared_in_prd: declaredInPrd,
        stack_path: normalizedStackPath ?? "",
      });
    }

    const metadataResult = await fetchGithubJson<GitHubMetadata>(
      `https://api.github.com/repos/${repository.owner}/${repository.name}`,
      token,
    );
    if (!metadataResult.ok) {
      return {
        ok: false,
        status: metadataResult.status === 404 ? 400 : 502,
        error:
          metadataResult.status === 404
            ? "repository must be publicly readable"
            : "repository metadata could not be verified",
      };
    }
    const metadata = metadataResult.value;
    if (
      metadata.private !== false ||
      metadata.archived !== false ||
      metadata.fork !== false ||
      metadata.owner?.type !== "User" ||
      typeof metadata.owner.id !== "number" ||
      !Number.isSafeInteger(metadata.owner.id) ||
      typeof metadata.id !== "number" ||
      !Number.isSafeInteger(metadata.id) ||
      metadata.id <= 0 ||
      typeof metadata.default_branch !== "string" ||
      !metadata.default_branch
    ) {
      return {
        ok: false,
        status: 400,
        error: "pilot requires an active, non-fork personal public repository",
      };
    }
    const ownerLogin = metadata.owner.login ?? repository.owner;
    if (
      ownerLogin.toLowerCase() !== repository.owner.toLowerCase() ||
      ownerLogin.toLowerCase() !== submitterLogin.toLowerCase() ||
      String(metadata.owner.id) !== submitterUserId
    ) {
      return {
        ok: false,
        status: 403,
        error: "authenticated GitHub login must match the repository owner",
      };
    }

    const commitResult = await fetchGithubJson<GitHubCommit>(
      `https://api.github.com/repos/${repository.owner}/${repository.name}/commits/${encodeURIComponent(metadata.default_branch)}`,
      token,
    );
    const commitSha = commitResult.ok ? commitResult.value.sha ?? "" : "";
    if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
      return {
        ok: false,
        status: 502,
        error: "repository commit could not be resolved",
      };
    }

    const contentResult = await fetchGithubJson<GitHubContent>(
      `https://api.github.com/repos/${repository.owner}/${repository.name}/contents/${encodedPath(normalizedPrdPath)}?ref=${commitSha}`,
      token,
    );
    if (!contentResult.ok) {
      return {
        ok: false,
        status: contentResult.status === 404 ? 400 : 502,
        error:
          contentResult.status === 404
            ? "prd_path must identify a public file at the resolved commit"
            : "PRD content could not be verified",
      };
    }
    const prdContent = decodeGithubContent(contentResult.value);
    const blobSha = contentResult.value.sha ?? "";
    if (!prdContent || !/^[0-9a-f]{40}$/i.test(blobSha)) {
      return {
        ok: false,
        status: 400,
        error: "PRD must be a bounded UTF-8 Markdown file",
      };
    }
    if (approvedExcerpt && !prdContent.includes(approvedExcerpt)) {
      return {
        ok: false,
        status: 400,
        error: "approved_excerpt must be exact text from the selected PRD revision",
      };
    }

    const claims: ProjectToolClaim[] = [];
    for (const tool of normalizedTools) {
        const stackPath = normalizeStackPath(tool.stack_path) ?? null;
        const markers = STACK_MARKERS[tool.tool_id] ?? [];
        const observations: ProjectObservation[] = [];
        for (const marker of markers) {
          const path = stackPath ? `${stackPath}/${marker.path}` : marker.path;
          const result = await fetchBoundedText(
            `https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${commitSha}/${encodedPath(path)}`,
          );
          if (result.kind === "unavailable") {
            return {
              ok: false,
              status: result.status === 413 ? 400 : result.status === 429 ? 503 : 502,
              error:
                result.status === 413
                  ? `evidence file exceeds the ${MAX_FILE_BYTES}-byte limit: ${path}`
                  : "repository evidence paths are temporarily unavailable",
            };
          }
          observations.push({
            rule_id: marker.rule_id,
            rule_version: marker.rule_version,
            path,
            label: marker.label,
            matched: result.kind === "ok" ? marker.pattern.test(result.text) : false,
            limitation: marker.limitation,
          });
        }
        claims.push({
          tool_id: tool.tool_id,
          declared_use: tool.declared_use,
          declared_in_prd: tool.declared_in_prd,
          stack_path: stackPath,
          observations,
        });
    }

    const checkedAt = new Date();
    const freshUntil = new Date(checkedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      ok: true,
      inspection: {
        repository: {
          github_id: metadata.id,
          owner: ownerLogin,
          name: repository.name,
          url: repository.url,
          fork: false,
          archived: false,
          default_branch: metadata.default_branch,
          commit_sha: commitSha.toLowerCase(),
        },
        prd: {
          path: normalizedPrdPath,
          blob_sha: blobSha.toLowerCase(),
          content_sha256: await sha256Hex(prdContent),
          source_url:
            `https://github.com/${repository.owner}/${repository.name}/blob/` +
            `${commitSha.toLowerCase()}/${encodedPath(normalizedPrdPath)}`,
        },
        claims,
        checker_version: "project-evidence/0.1.0",
        checked_at: checkedAt.toISOString(),
        fresh_until: freshUntil.toISOString(),
      },
    };
  }
type BoundedTextResult =
  | { kind: "ok"; text: string }
  | { kind: "missing" }
  | { kind: "unavailable"; status: number };

async function fetchBoundedText(url: string): Promise<BoundedTextResult> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "curations.dev stack verifier" },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 404) return { kind: "missing" };
    if (!response.ok) return { kind: "unavailable", status: response.status };
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_FILE_BYTES) {
      await response.body?.cancel();
      return { kind: "unavailable", status: 413 };
    }
    if (!response.body) return { kind: "unavailable", status: 502 };
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_FILE_BYTES) {
        await reader.cancel();
        return { kind: "unavailable", status: 413 };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      kind: "ok",
      text: new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: false,
      }).decode(bytes),
    };
  } catch {
    return { kind: "unavailable", status: 502 };
  }
}

async function fetchText(url: string): Promise<string | null> {
  const result = await fetchBoundedText(url);
  return result.kind === "ok" ? result.text : null;
}

export async function verifyPublicRepository(
  toolId: string,
  repositoryUrl: string,
  prdUrl: string,
  stackPath: string,
  submitterLogin: string,
  token?: string,
): Promise<RepositoryVerificationResult> {
  const repository = parseRepository(repositoryUrl);
  if (!repository) {
    return {
      ok: false,
      status: 400,
      error: "repository_url must be a public GitHub repository root",
    };
  }
  const normalizedPrd = normalizePrdUrl(prdUrl, repository);
  if (prdUrl && !normalizedPrd) {
    return {
      ok: false,
      status: 400,
      error: "prd_url must be a public file inside the submitted GitHub repository",
    };
  }
  const normalizedStackPath = normalizeStackPath(stackPath);
  if (normalizedStackPath === undefined) {
    return {
      ok: false,
      status: 400,
      error: "stack_path must be a relative directory inside the repository",
    };
  }

  let metadata: GitHubMetadata;
  try {
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "user-agent": "curations.dev stack verifier",
      "x-github-api-version": "2022-11-28",
    };
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(
      `https://api.github.com/repos/${repository.owner}/${repository.name}`,
      { headers, signal: AbortSignal.timeout(5000) },
    );
    if (response.status === 404) {
      return {
        ok: false,
        status: 400,
        error: "repository must be publicly readable",
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        error: "repository visibility could not be verified",
      };
    }
    const candidate = (await response.json()) as GitHubMetadata;
    if (candidate.private === true) {
      return {
        ok: false,
        status: 400,
        error: "repository must be publicly readable",
      };
    }
    if (candidate.private !== false) {
      return {
        ok: false,
        status: 502,
        error: "repository visibility could not be verified",
      };
    }
    metadata = candidate;
  } catch {
    return {
      ok: false,
      status: 502,
      error: "repository visibility could not be verified",
    };
  }

  const branch = metadata.default_branch ?? "main";
  const markers = STACK_MARKERS[toolId] ?? [];
  const checks = await Promise.all(
    markers.map(async (marker): Promise<RepositoryCheck> => {
      const repositoryPath = normalizedStackPath
        ? `${normalizedStackPath}/${marker.path}`
        : marker.path;
      const encodedPath = repositoryPath
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
      const content = await fetchText(
        `https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${encodeURIComponent(branch)}/${encodedPath}`,
      );
      return {
        path: repositoryPath,
        label: marker.label,
        matched: content ? marker.pattern.test(content) : false,
      };
    }),
  );
  const matched = checks.filter((check) => check.matched);
  const automatedStatus = matched.length ? "verified" : "partial";
  const note =
    automatedStatus === "verified"
      ? `Found ${matched.length} stack marker${matched.length === 1 ? "" : "s"}${normalizedStackPath ? ` under ${normalizedStackPath}` : " at the repository root"}.`
      : `The public repository exists, but no supported stack marker was found${normalizedStackPath ? ` under ${normalizedStackPath}` : " at the repository root"}.`;

  return {
    ok: true,
    prdUrl: normalizedPrd,
    evidence: {
      url: repository.url,
      owner: repository.owner,
      name: repository.name,
      description: metadata.description ?? null,
      default_branch: metadata.default_branch ?? null,
      stars:
        typeof metadata.stargazers_count === "number"
          ? metadata.stargazers_count
          : null,
      archived: typeof metadata.archived === "boolean" ? metadata.archived : null,
      fork: typeof metadata.fork === "boolean" ? metadata.fork : null,
      stack_path: normalizedStackPath,
      submitter_matches_owner:
        repository.owner.toLowerCase() === submitterLogin.toLowerCase(),
      automated_status: automatedStatus,
      checks,
      checked_at: new Date().toISOString(),
      note,
    },
  };
}
