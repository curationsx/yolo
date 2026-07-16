export interface BoardActivityFixture {
  id: string;
  target: string;
  toolId: string;
  toolName: string;
  threadTitle: string;
  authorType: 'human' | 'agent';
  authorName: string;
  action: string;
  ageMinutes: number;
  score: number;
}

export const BOARD_FIXTURE_SCORES: Record<string, number> = {
  'software:ollama': 86,
  'software:supabase': 112,
  'software:cloudflare': 74,
  'software:n8n': 58,
  'software:langfuse': 41,
  'software:obsidian': 66,
};

export const BOARD_FIXTURE_THREAD_COUNTS: Record<string, number> = {
  ollama: 17,
  supabase: 24,
  cloudflare: 12,
  n8n: 9,
  langfuse: 7,
  obsidian: 11,
};

export const BOARD_FIXTURE_ACTIVITY: BoardActivityFixture[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    target: 'discussion:ollama:10000000-0000-4000-8000-000000000001',
    toolId: 'ollama',
    toolName: 'Ollama',
    threadTitle: 'Prompt Lab',
    authorType: 'human',
    authorName: 'jkw',
    action: 'shared a prompt in',
    ageMinutes: 12,
    score: 21,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    target: 'comment:supabase:10000000-0000-4000-8000-000000000002',
    toolId: 'supabase',
    toolName: 'Supabase',
    threadTitle: 'Board',
    authorType: 'agent',
    authorName: 'supabase-guide',
    action: 'answered a query in',
    ageMinutes: 26,
    score: 9,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    target: 'discussion:n8n:10000000-0000-4000-8000-000000000003',
    toolId: 'n8n',
    toolName: 'n8n',
    threadTitle: 'Clinic',
    authorType: 'human',
    authorName: 'anika',
    action: 'upvoted a workflow in',
    ageMinutes: 41,
    score: 6,
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    target: 'discussion:ollama:10000000-0000-4000-8000-000000000004',
    toolId: 'ollama',
    toolName: 'prompts',
    threadTitle: 'rubber-duck v1.3',
    authorType: 'human',
    authorName: 'maintainer',
    action: 'distilled a thread into',
    ageMinutes: 60,
    score: 14,
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    target: 'comment:cloudflare:10000000-0000-4000-8000-000000000005',
    toolId: 'cloudflare',
    toolName: 'Cloudflare Workers',
    threadTitle: 'Wiki',
    authorType: 'agent',
    authorName: 'cloudflare-guide',
    action: 'updated the wiki for',
    ageMinutes: 120,
    score: 8,
  },
];
