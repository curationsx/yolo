const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+$/;
const MAX_FILE_BYTES = 128_000;

interface Marker {
  path: string;
  label: string;
  pattern: RegExp;
}

const STACK_MARKERS: Record<string, Marker[]> = {
  ollama: [
    { path: "Modelfile", label: "Ollama Modelfile", pattern: /^\s*FROM\s+\S+/m },
    { path: "docker-compose.yml", label: "Docker Compose references Ollama", pattern: /\bollama\b/i },
    { path: "docker-compose.yaml", label: "Docker Compose references Ollama", pattern: /\bollama\b/i },
    { path: "package.json", label: "JavaScript Ollama dependency", pattern: /"(?:ollama|@langchain\/ollama)"\s*:/i },
    { path: "pyproject.toml", label: "Python Ollama dependency", pattern: /\bollama\b/i },
  ],
  supabase: [
    { path: "supabase/config.toml", label: "Supabase local configuration", pattern: /\[api\]|\[db\]|\[auth\]/i },
    { path: "package.json", label: "Supabase JavaScript client", pattern: /"@supabase\/supabase-js"\s*:/i },
    { path: "requirements.txt", label: "Supabase Python client", pattern: /^\s*supabase(?:[<=>~!]|$)/im },
    { path: "pyproject.toml", label: "Supabase Python client", pattern: /\bsupabase\b/i },
  ],
  cloudflare: [
    { path: "wrangler.toml", label: "Wrangler configuration", pattern: /^\s*(?:name|main|compatibility_date)\s*=/m },
    { path: "wrangler.jsonc", label: "Wrangler configuration", pattern: /"(?:name|main|compatibility_date)"\s*:/i },
    { path: "wrangler.json", label: "Wrangler configuration", pattern: /"(?:name|main|compatibility_date)"\s*:/i },
    {
      path: "package.json",
      label: "Cloudflare Workers package",
      pattern: /"name"\s*:\s*"wrangler"|"(?:wrangler|@cloudflare\/workers-types)"\s*:/i,
    },
  ],
  n8n: [
    { path: "docker-compose.yml", label: "Docker Compose runs n8n", pattern: /n8nio\/n8n|\bn8n\b/i },
    { path: "docker-compose.yaml", label: "Docker Compose runs n8n", pattern: /n8nio\/n8n|\bn8n\b/i },
    {
      path: "package.json",
      label: "n8n package",
      pattern: /"name"\s*:\s*"n8n"|"(?:n8n|n8n-workflow|n8n-core)"\s*:/i,
    },
    { path: "workflow.json", label: "Exported n8n workflow", pattern: /"nodes"\s*:|"n8n-nodes-base\./i },
  ],
  langfuse: [
    {
      path: "package.json",
      label: "Langfuse JavaScript package",
      pattern: /"name"\s*:\s*"langfuse"|"(?:langfuse|@langfuse\/[^"]+)"\s*:/i,
    },
    { path: "requirements.txt", label: "Langfuse Python dependency", pattern: /^\s*langfuse(?:[<=>~!]|$)/im },
    { path: "pyproject.toml", label: "Langfuse Python dependency", pattern: /\blangfuse\b/i },
    { path: "docker-compose.yml", label: "Self-hosted Langfuse service", pattern: /\blangfuse\b/i },
  ],
  obsidian: [
    { path: ".obsidian/app.json", label: "Obsidian vault configuration", pattern: /^\s*\{/ },
    { path: ".obsidian/community-plugins.json", label: "Obsidian community plugin manifest", pattern: /^\s*\[/ },
    { path: "manifest.json", label: "Obsidian plugin manifest", pattern: /"minAppVersion"\s*:|"isDesktopOnly"\s*:/i },
    { path: "package.json", label: "Obsidian plugin API dependency", pattern: /"obsidian"\s*:/i },
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
  default_branch?: string;
  stargazers_count?: number;
  description?: string | null;
  archived?: boolean;
  fork?: boolean;
  private?: boolean;
}

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

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "curations.dev stack verifier" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_FILE_BYTES) return null;
    const text = await response.text();
    return text.slice(0, MAX_FILE_BYTES);
  } catch {
    return null;
  }
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
