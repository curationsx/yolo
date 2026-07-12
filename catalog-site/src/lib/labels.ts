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
