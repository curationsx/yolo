export interface StackFixture {
  slug: string;
  name: string;
  role: string;
  description: string;
  officialUrl: string;
  directoryId?: string;
}

export interface ProjectFixture {
  slug: string;
  score: number;
  question: string;
  project: string;
  author: string;
  stage: string;
  stageClass: string;
  category: string;
  categorySlug: string;
  attributes: string[];
  summary: string;
  stackSlugs: string[];
  comments: number;
  people: number;
  age: string;
  agent?: string;
  plan: {
    problem: string;
    audience: string;
    nextDecision: string;
  };
}

export interface ProjectCategoryFixture {
  slug: string;
  name: string;
  description: string;
  projectCount: number;
  activityCount: number;
}

export interface StackRoleFixture {
  slug: string;
  name: string;
  description: string;
  stackSlugs: string[];
}

export interface StackCombinationFixture {
  slug: string;
  name: string;
  description: string;
  stackSlugs: string[];
  projectCount: number;
  conversationCount: number;
}

export interface LibraryFixture {
  slug: string;
  score: number;
  title: string;
  description: string;
  type: 'Review' | 'Skill' | 'Cookbook';
  version: string;
  updated: string;
  outcome: string;
  stackSlugs: string[];
}

export const stackFixtures: Record<string, StackFixture> = {
  nextjs: {
    slug: 'nextjs',
    name: 'Next.js',
    role: 'Application Framework',
    description: 'A React framework for full-stack web applications.',
    officialUrl: 'https://nextjs.org',
  },
  supabase: {
    slug: 'supabase',
    name: 'Supabase',
    role: 'Data & Storage',
    description: 'Postgres, authentication, storage, and edge functions.',
    officialUrl: 'https://supabase.com',
    directoryId: 'supabase',
  },
  stripe: {
    slug: 'stripe',
    name: 'Stripe',
    role: 'Identity & Payments',
    description: 'Payment APIs and financial infrastructure for internet businesses.',
    officialUrl: 'https://stripe.com',
  },
  python: {
    slug: 'python',
    name: 'Python',
    role: 'Application Framework',
    description: 'A general-purpose programming language used across data and AI projects.',
    officialUrl: 'https://www.python.org',
  },
  ollama: {
    slug: 'ollama',
    name: 'Ollama',
    role: 'AI Models & Runtimes',
    description: 'A local runtime for open-weight language models.',
    officialUrl: 'https://ollama.com',
    directoryId: 'ollama',
  },
  obsidian: {
    slug: 'obsidian',
    name: 'Obsidian',
    role: 'Data & Storage',
    description: 'A local-first Markdown knowledge workspace.',
    officialUrl: 'https://obsidian.md',
    directoryId: 'obsidian',
  },
  astro: {
    slug: 'astro',
    name: 'Astro',
    role: 'Application Framework',
    description: 'A web framework optimized for content-focused sites.',
    officialUrl: 'https://astro.build',
  },
  n8n: {
    slug: 'n8n',
    name: 'n8n',
    role: 'Automation & Integration',
    description: 'A source-available workflow automation platform.',
    officialUrl: 'https://n8n.io',
    directoryId: 'n8n',
  },
  cloudflare: {
    slug: 'cloudflare',
    name: 'Cloudflare',
    role: 'Hosting & Deployment',
    description: 'Edge compute, delivery, storage, and application services.',
    officialUrl: 'https://www.cloudflare.com',
    directoryId: 'cloudflare',
  },
  typescript: {
    slug: 'typescript',
    name: 'TypeScript',
    role: 'Application Framework',
    description: 'JavaScript with static type checking.',
    officialUrl: 'https://www.typescriptlang.org',
  },
  langfuse: {
    slug: 'langfuse',
    name: 'Langfuse',
    role: 'Observability & Evaluation',
    description: 'Tracing, prompt management, and evaluation for AI applications.',
    officialUrl: 'https://langfuse.com',
    directoryId: 'langfuse',
  },
  github: {
    slug: 'github',
    name: 'GitHub Actions',
    role: 'Automation & Integration',
    description: 'Repository-native automation for building, testing, and deployment.',
    officialUrl: 'https://github.com/features/actions',
    directoryId: 'github',
  },
  sqlite: {
    slug: 'sqlite',
    name: 'SQLite',
    role: 'Data & Storage',
    description: 'A small, embedded relational database.',
    officialUrl: 'https://sqlite.org',
    directoryId: 'sqlite',
  },
  tauri: {
    slug: 'tauri',
    name: 'Tauri',
    role: 'Application Framework',
    description: 'A toolkit for small desktop applications using web frontends.',
    officialUrl: 'https://tauri.app',
  },
  svelte: {
    slug: 'svelte',
    name: 'Svelte',
    role: 'Application Framework',
    description: 'A compiler-based framework for interactive web interfaces.',
    officialUrl: 'https://svelte.dev',
  },
};

export const activeProjects: ProjectFixture[] = [
  {
    slug: 'backstage',
    score: 31,
    question: 'I’m building a lightweight CRM for independent venues. What am I missing?',
    project: 'Backstage',
    author: '@maya',
    stage: 'Building',
    stageClass: 'building',
    category: 'CRM',
    categorySlug: 'crm-and-operations',
    attributes: ['small-team', 'community'],
    summary: 'Bookings, contacts, and follow-ups in one place for small venue teams.',
    stackSlugs: ['nextjs', 'supabase', 'stripe'],
    comments: 18,
    people: 4,
    age: '2h ago',
    agent: 'AI Guide replied',
    plan: {
      problem: 'Small venue teams track bookings, relationships, and follow-ups across disconnected tools.',
      audience: 'Independent venues and the small teams coordinating their calendars and partners.',
      nextDecision: 'Decide how permissions and duplicate contacts should work before inviting collaborators.',
    },
  },
  {
    slug: 'papertrail',
    score: 24,
    question: 'Can this research assistant cite sources without becoming too complex?',
    project: 'PaperTrail',
    author: '@devon',
    stage: 'Needs feedback',
    stageClass: 'feedback',
    category: 'Research assistant',
    categorySlug: 'research-and-knowledge',
    attributes: ['local-first', 'source-linked'],
    summary: 'A local workspace that turns saved papers into linked notes with source trails.',
    stackSlugs: ['python', 'ollama', 'obsidian'],
    comments: 11,
    people: 3,
    age: '4h ago',
    agent: 'AI Curator replied',
    plan: {
      problem: 'Research notes lose their relationship to the original paper and supporting passage.',
      audience: 'Independent researchers, students, and writers working from saved academic sources.',
      nextDecision: 'Choose whether citations are generated during capture or only when a note is published.',
    },
  },
  {
    slug: 'sidecar',
    score: 19,
    question: 'Where should human approval live in this event-planning workflow?',
    project: 'Sidecar',
    author: '@anika',
    stage: 'Building',
    stageClass: 'building',
    category: 'Automation',
    categorySlug: 'community-and-events',
    attributes: ['human-checkpoints', 'automation'],
    summary: 'Turns an event idea into a checklist, outreach queue, and publish-ready page.',
    stackSlugs: ['astro', 'n8n', 'cloudflare'],
    comments: 9,
    people: 5,
    age: '6h ago',
    plan: {
      problem: 'Small event teams repeat the same planning and outreach work without a shared flow.',
      audience: 'Community organizers and independent event producers.',
      nextDecision: 'Place explicit approval before outreach messages or public event details are released.',
    },
  },
  {
    slug: 'relay',
    score: 14,
    question: 'I can ship the app, but my project plan doesn’t explain failure states.',
    project: 'Relay',
    author: '@tomasz',
    stage: 'Needs feedback',
    stageClass: 'feedback',
    category: 'Developer tool',
    categorySlug: 'developer-tools',
    attributes: ['observability', 'release-workflow'],
    summary: 'A small release assistant that summarizes changes and watches deployment health.',
    stackSlugs: ['typescript', 'langfuse', 'github'],
    comments: 7,
    people: 3,
    age: '9h ago',
    agent: 'AI Guide replied',
    plan: {
      problem: 'Release context is spread across commits, CI runs, and deployment dashboards.',
      audience: 'Small engineering teams without a dedicated release manager.',
      nextDecision: 'Define what Relay does when deployment data is missing or conflicting.',
    },
  },
];

export const newProjects: ProjectFixture[] = [
  {
    slug: 'ledgerlight',
    score: 8,
    question: 'Starting from a repo, not a plan: what have I actually built?',
    project: 'LedgerLight',
    author: '@rin',
    stage: 'Idea',
    stageClass: 'idea',
    category: 'Finance tool',
    categorySlug: 'commerce-and-finance',
    attributes: ['small-business', 'simple'],
    summary: 'Simple invoicing and payment reminders for independent creative studios.',
    stackSlugs: ['astro', 'sqlite', 'cloudflare'],
    comments: 3,
    people: 2,
    age: '1h ago',
    plan: {
      problem: 'Independent studios lose time tracking invoices and writing repeated payment reminders.',
      audience: 'Small creative studios and solo operators.',
      nextDecision: 'Confirm whether payments stay outside the product or become part of the first release.',
    },
  },
  {
    slug: 'locallens',
    score: 6,
    question: 'Does this local-first photo organizer need a database at all?',
    project: 'LocalLens',
    author: '@sam',
    stage: 'Idea',
    stageClass: 'idea',
    category: 'Creative tool',
    categorySlug: 'creative-tools',
    attributes: ['local-first', 'privacy-focused'],
    summary: 'Sorts personal photo libraries with local descriptions and no cloud upload.',
    stackSlugs: ['tauri', 'sqlite', 'ollama'],
    comments: 2,
    people: 2,
    age: '3h ago',
    plan: {
      problem: 'Personal photo libraries are difficult to search without uploading them to a cloud service.',
      audience: 'Photographers and families who prefer local storage.',
      nextDecision: 'Choose between a generated index file and an embedded database.',
    },
  },
  {
    slug: 'formflow',
    score: 4,
    question: 'How should I describe privacy without making promises I can’t prove?',
    project: 'FormFlow',
    author: '@lee',
    stage: 'Needs feedback',
    stageClass: 'feedback',
    category: 'Forms',
    categorySlug: 'crm-and-operations',
    attributes: ['privacy-focused', 'community'],
    summary: 'A reusable intake form for small community organizations and volunteer teams.',
    stackSlugs: ['nextjs', 'supabase'],
    comments: 1,
    people: 1,
    age: '5h ago',
    plan: {
      problem: 'Volunteer organizations collect sensitive intake information through improvised forms.',
      audience: 'Small community organizations and volunteer teams.',
      nextDecision: 'State a narrow retention promise that the implementation can actually enforce.',
    },
  },
];

export const allProjects = [...activeProjects, ...newProjects];

export const projectCategories: ProjectCategoryFixture[] = [
  {
    slug: 'crm-and-operations',
    name: 'CRM & Operations',
    description: 'Projects organizing contacts, requests, follow-ups, and recurring operational work.',
    projectCount: 2,
    activityCount: 19,
  },
  {
    slug: 'research-and-knowledge',
    name: 'Research & Knowledge',
    description: 'Tools for collecting sources, making sense of information, and preserving context.',
    projectCount: 1,
    activityCount: 11,
  },
  {
    slug: 'creative-tools',
    name: 'Creative Tools',
    description: 'Projects supporting visual, editorial, audio, and other creative work.',
    projectCount: 1,
    activityCount: 2,
  },
  {
    slug: 'commerce-and-finance',
    name: 'Commerce & Finance',
    description: 'Payments, invoicing, storefronts, and practical financial operations.',
    projectCount: 1,
    activityCount: 3,
  },
  {
    slug: 'community-and-events',
    name: 'Community & Events',
    description: 'Tools for gatherings, groups, outreach, publishing, and shared participation.',
    projectCount: 1,
    activityCount: 9,
  },
  {
    slug: 'developer-tools',
    name: 'Developer Tools',
    description: 'Projects improving planning, building, reviewing, releasing, and operating software.',
    projectCount: 1,
    activityCount: 7,
  },
];

export const stackRoles: StackRoleFixture[] = [
  {
    slug: 'application-frameworks',
    name: 'Application Frameworks',
    description: 'The primary languages and frameworks shaping an application.',
    stackSlugs: ['nextjs', 'astro', 'svelte', 'typescript', 'python', 'tauri'],
  },
  {
    slug: 'data-and-storage',
    name: 'Data & Storage',
    description: 'Databases, object storage, and knowledge systems.',
    stackSlugs: ['supabase', 'sqlite', 'obsidian'],
  },
  {
    slug: 'hosting-and-deployment',
    name: 'Hosting & Deployment',
    description: 'Infrastructure used to publish and operate a Project.',
    stackSlugs: ['cloudflare'],
  },
  {
    slug: 'automation-and-integration',
    name: 'Automation & Integration',
    description: 'Workflow engines and repository-native automation.',
    stackSlugs: ['n8n', 'github'],
  },
  {
    slug: 'ai-models-and-runtimes',
    name: 'AI Models & Runtimes',
    description: 'Model runtimes and the systems that call them.',
    stackSlugs: ['ollama'],
  },
  {
    slug: 'observability-and-evaluation',
    name: 'Observability & Evaluation',
    description: 'Tracing, evaluation, and operational feedback.',
    stackSlugs: ['langfuse'],
  },
];

export const stackCombinations: StackCombinationFixture[] = [
  {
    slug: 'supabase-nextjs',
    name: 'Supabase + Next.js',
    description: 'A full-stack web pattern pairing a React framework with Postgres, auth, and storage.',
    stackSlugs: ['supabase', 'nextjs'],
    projectCount: 2,
    conversationCount: 19,
  },
  {
    slug: 'cloudflare-astro',
    name: 'Cloudflare + Astro',
    description: 'Content-focused applications published through edge hosting and services.',
    stackSlugs: ['cloudflare', 'astro'],
    projectCount: 2,
    conversationCount: 12,
  },
  {
    slug: 'ollama-obsidian',
    name: 'Ollama + Obsidian',
    description: 'Local model workflows paired with Markdown-based personal knowledge.',
    stackSlugs: ['ollama', 'obsidian'],
    projectCount: 1,
    conversationCount: 11,
  },
];

export const libraryFixtures: LibraryFixture[] = [
  {
    slug: 'project-plan-gap-review',
    score: 42,
    title: 'Project-plan gap review',
    description: 'Finds missing decisions, unclear users, and assumptions that still need a test.',
    type: 'Review',
    version: 'v1.2',
    updated: '3d ago',
    outcome: 'Illustrative outcome notes',
    stackSlugs: [],
  },
  {
    slug: 'schema-first-planning',
    score: 35,
    title: 'Schema-first planning',
    description: 'Turns important records and relationships into a clearer implementation plan.',
    type: 'Skill',
    version: 'v1.1',
    updated: '5d ago',
    outcome: 'Illustrative adaptation notes',
    stackSlugs: ['supabase', 'sqlite'],
  },
  {
    slug: 'security-pre-mortem',
    score: 31,
    title: 'Security pre-mortem',
    description: 'Imagines how a Project failed before launch and works backward to prevent it.',
    type: 'Cookbook',
    version: 'v1.2',
    updated: '1w ago',
    outcome: 'Illustrative Project reviews',
    stackSlugs: [],
  },
  {
    slug: 'reverse-project-plan',
    score: 27,
    title: 'Create a plan from an existing repo',
    description: 'Builds an editable first draft from public structure, manifests, and selected docs.',
    type: 'Review',
    version: 'draft',
    updated: '2d ago',
    outcome: 'Illustrative draft reviews',
    stackSlugs: ['github'],
  },
  {
    slug: 'rubber-duck-debugging',
    score: 24,
    title: 'Rubber-duck debugging',
    description: 'Explains a failure plainly before changing code, exposing assumptions and missing facts.',
    type: 'Cookbook',
    version: 'v1.3',
    updated: '4d ago',
    outcome: 'Illustrative usefulness reports',
    stackSlugs: [],
  },
  {
    slug: 'source-synthesis',
    score: 20,
    title: 'Source-linked synthesis',
    description: 'Combines research without losing the claims, limitations, and original sources.',
    type: 'Skill',
    version: 'v1.1',
    updated: '6d ago',
    outcome: 'Illustrative adaptation notes',
    stackSlugs: ['obsidian'],
  },
];

export function projectsForCategory(categorySlug: string): ProjectFixture[] {
  return allProjects.filter((project) => project.categorySlug === categorySlug);
}

export function projectsForCombination(combination: StackCombinationFixture): ProjectFixture[] {
  return allProjects.filter((project) =>
    combination.stackSlugs.every((stackSlug) => project.stackSlugs.includes(stackSlug)),
  );
}

export function projectsForStack(stackSlug: string): ProjectFixture[] {
  return allProjects.filter((project) => project.stackSlugs.includes(stackSlug));
}
