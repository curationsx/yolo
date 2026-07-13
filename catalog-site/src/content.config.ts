import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

// One authoritative dataset: the repository's software/entries.json.
// The site never copies it — the build reads and validates it in place.
const softwareEntrySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    name: z.string().min(1),
    entity_type: z.enum(['tool', 'company', 'platform', 'project']).optional(),
    featured: z.boolean().optional(),
    category: z.enum([
      'research',
      'model-access',
      'automation',
      'observability-evaluation',
      'knowledge-data',
      'development',
      'design-content',
      'community-documentation',
    ]),
    primary_use: z.string().min(10),
    deployment: z.enum(['local', 'self-hosted', 'cloud', 'hybrid']),
    notable_strength: z.string().min(10),
    verify_before_use: z.string().min(10),
    reference: z.string().url().startsWith('https://'),
    license: z
      .enum([
        'open-source',
        'source-available',
        'open-weight',
        'proprietary-free-tier',
        'proprietary',
        'mixed',
      ])
      .optional(),
    source_repository: z.string().url().startsWith('https://').optional(),
    platforms: z
      .array(z.enum(['Linux', 'macOS', 'Windows', 'Web', 'iOS', 'Android']))
      .min(1)
      .optional(),
    last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    review_status: z.enum(['verified', 'needs-review']).optional(),
    tags: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).optional(),
    startup_credits: z
      .object({
        status: z.enum(['verified-offer', 'no-public-offer']),
        headline: z.string().min(6),
        details: z.string().min(10),
        eligibility: z.string().min(10),
        sources: z
          .array(
            z.object({
              label: z.string().min(2),
              url: z.string().url().startsWith('https://'),
            }),
          )
          .min(1),
        checked_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .optional(),
  })
  .superRefine((entry, context) => {
    if (entry.review_status === 'verified' && !entry.last_reviewed) {
      context.addIssue({
        code: 'custom',
        path: ['last_reviewed'],
        message: 'verified entries require last_reviewed',
      });
    }
    if (entry.startup_credits && entry.entity_type !== 'company') {
      context.addIssue({
        code: 'custom',
        path: ['startup_credits'],
        message: 'startup_credits are only valid for company entries',
      });
    }
  });

const software = defineCollection({
  loader: file('../software/entries.json', {
    parser: (text) => JSON.parse(text).entries,
  }),
  schema: softwareEntrySchema,
});

const cookbookStack = z.enum([
  'ollama',
  'supabase',
  'cloudflare',
  'n8n',
  'langfuse',
  'obsidian',
]);

const cookbookEntrySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    title: z.string().min(3),
    category: z.enum(['engineering', 'research', 'operations', 'safety']),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    release_status: z.enum(['preview', 'stable', 'retired']),
    description: z.string().min(20),
    source_prompt: z.string().regex(/^prompts\/[a-z0-9-]+\.md$/),
    source_prompt_id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    source_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    source_status: z.enum(['draft', 'tested', 'stable', 'retired']),
    strong_fit: z.array(cookbookStack).min(1),
    partial_fit: z.array(cookbookStack).min(1),
  })
  .superRefine((entry, context) => {
    const allStacks = new Set([
      'ollama',
      'supabase',
      'cloudflare',
      'n8n',
      'langfuse',
      'obsidian',
    ]);
    const strong = new Set(entry.strong_fit);
    const partial = new Set(entry.partial_fit);
    const overlap = [...strong].filter((stack) => partial.has(stack));
    if (overlap.length) {
      context.addIssue({
        code: 'custom',
        path: ['partial_fit'],
        message: `stack fit overlaps: ${overlap.join(', ')}`,
      });
    }
    const covered = new Set([...strong, ...partial]);
    const missing = [...allStacks].filter((stack) => !covered.has(stack));
    if (missing.length) {
      context.addIssue({
        code: 'custom',
        path: ['strong_fit'],
        message: `stack fit is missing: ${missing.join(', ')}`,
      });
    }
  });

const cookbooks = defineCollection({
  loader: file('../cookbooks/entries.json', {
    parser: (text) => JSON.parse(text).entries,
  }),
  schema: cookbookEntrySchema,
});

export const collections = { software, cookbooks };
