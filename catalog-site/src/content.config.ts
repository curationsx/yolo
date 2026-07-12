import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

// One authoritative dataset: the repository's software/entries.json.
// The site never copies it — the build reads and validates it in place.
const software = defineCollection({
  loader: file('../software/entries.json', {
    parser: (text) => JSON.parse(text).entries,
  }),
  schema: z.object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    name: z.string().min(1),
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
  }),
});

export const collections = { software };
