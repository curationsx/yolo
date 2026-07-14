/** Human-readable labels shared across pages and components. */

export const CATEGORY_LABELS: Record<string, string> = {
  research: 'Research',
  'model-access': 'Model access',
  automation: 'Automation',
  'observability-evaluation': 'Observability & evaluation',
  'knowledge-data': 'Knowledge & data',
  development: 'Development',
  'design-content': 'Design & content',
  'community-documentation': 'Community & documentation',
};

export const DEPLOYMENT_LABELS: Record<string, string> = {
  local: 'Local',
  'self-hosted': 'Self-hosted',
  cloud: 'Cloud',
  hybrid: 'Hybrid',
};

export const LICENSE_LABELS: Record<string, string> = {
  'open-source': 'Open source',
  'source-available': 'Source available',
  'open-weight': 'Open-weight access',
  'proprietary-free-tier': 'Proprietary · free tier',
  proprietary: 'Proprietary',
  mixed: 'Mixed licensing',
};

const STACK_ACCENTS: Record<string, string> = {
  ollama: '#ff3131',
  supabase: '#02a9ea',
  cloudflare: '#f254b8',
  n8n: '#dc6acf',
  langfuse: '#0496ff',
  obsidian: '#c5d86d',
};

const CATEGORY_ACCENTS: Record<string, string> = {
  research: '#c5d86d',
  'model-access': '#ff3131',
  automation: '#dc6acf',
  'observability-evaluation': '#0496ff',
  'knowledge-data': '#02a9ea',
  development: '#353839',
  'design-content': '#f254b8',
  'community-documentation': '#e82828',
};

export function stackAccent(id: string, category: string): string {
  return STACK_ACCENTS[id] ?? CATEGORY_ACCENTS[category] ?? '#ff3131';
}

export function boardCategoryLabel(category: string): string {
  return (CATEGORY_LABELS[category] ?? category)
    .toLowerCase()
    .replaceAll(' & ', '-')
    .replaceAll(' ', '-');
}

/** Prefix an internal path with the configured base (GitHub Pages subpath). */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export const REPO_URL = 'https://github.com/curationsx/yolo';
export const ENTRIES_URL = `${REPO_URL}/blob/main/software/entries.json`;
export const SUBMIT_URL = `${REPO_URL}/blob/main/software/SUBMIT.md`;
export const METHODOLOGY_SOURCE_URL = `${REPO_URL}/blob/main/software/README.md`;

export function correctionUrl(name: string): string {
  const title = encodeURIComponent(`software: correction for ${name}`);
  const body = encodeURIComponent(
    `**Entry:** ${name}\n**Field(s) affected:**\n**What is wrong or stale:**\n**Evidence (official source URL):**\n`,
  );
  return `${REPO_URL}/issues/new?title=${title}&body=${body}`;
}
