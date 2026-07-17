import { libraryFixtures } from './community-preview';
import { showcaseFixture } from './member-showcase-preview';

export type CapabilityJobSlug =
  | 'plan'
  | 'design'
  | 'build'
  | 'review'
  | 'test'
  | 'ship'
  | 'grow';

export type SkillLifecycle = 'reviewed' | 'update-available' | 'stale' | 'retired';

export type CapabilityProvenance =
  | 'community-submitted'
  | 'owner-claimed'
  | 'publicly-sourced'
  | 'ai-curated';

export interface CapabilityJobFixture {
  slug: CapabilityJobSlug;
  label: string;
  description: string;
}

export interface SkillOutcomeCounts {
  worked: number;
  adapted: number;
  didNotFit: number;
  deferred: number;
}

export interface SkillUseFixture {
  title: string;
  detail: string;
  sourceLabel: string;
}

export interface SkillFixture {
  slug: string;
  score: number;
  title: string;
  purpose: string;
  jobs: CapabilityJobSlug[];
  lifecycle: SkillLifecycle;
  provenance: CapabilityProvenance[];
  version: string;
  sourceUrl: string;
  sourceRevision: string;
  sourceLabel: string;
  license: string;
  lastReviewed: string;
  supportedHosts: string[];
  permissions: string[];
  risk: string;
  projectTypes: string[];
  stackSlugs: string[];
  outcomeCounts: SkillOutcomeCounts;
  discussions: number;
  fitReason: string;
  fitConstraints: string[];
  communityOutcomes: SkillUseFixture[];
  publicExamples: SkillUseFixture[];
}

export type MatchState = 'strong-fit' | 'possible-fit' | 'no-match';

export interface SkillMatchFixture {
  id: string;
  state: MatchState;
  project: string;
  prdRevision: string;
  skillRevision?: string;
  catalogRevision: string;
  matchingRuleVersion: string;
  matchedRuleIds: string[];
  requestedJob: string;
  skillSlug?: string;
  explanation: string;
  constraints: string[];
  watched: boolean;
}

export interface ProgramFixture {
  slug: string;
  name: string;
  type: string;
  purpose: string;
  officialUrl: string;
  geography: string;
  eligibility: string;
  terms: string;
  lastReviewed: string;
  disclosure: string;
}

const PLAN_REVISION = '50103d669a49ed3c3695a76bc3d174a9030a51a5';
const PLAN_SOURCE =
  `https://github.com/curationsx/yolo/blob/${PLAN_REVISION}` +
  '/plan/skills-and-prd-capability-graph.md';

function librarySkill(slug: string) {
  const resource = libraryFixtures.find(
    (candidate) => candidate.slug === slug && candidate.type === 'Skill',
  );
  if (!resource) throw new Error(`Missing Library Skill fixture: ${slug}`);
  return resource;
}

const schemaFirstPlanning = librarySkill('schema-first-planning');
const sourceSynthesis = librarySkill('source-synthesis');

export const capabilityJobs: CapabilityJobFixture[] = [
  {
    slug: 'plan',
    label: 'Plan',
    description: 'Frame the problem, requirements, priorities, and open decisions.',
  },
  {
    slug: 'design',
    label: 'Design',
    description: 'Shape information, interaction, accessibility, and visual systems.',
  },
  {
    slug: 'build',
    label: 'Build',
    description: 'Implement data, integrations, migrations, and application behavior.',
  },
  {
    slug: 'review',
    label: 'Review',
    description: 'Pressure-test product, architecture, code, security, and evidence.',
  },
  {
    slug: 'test',
    label: 'Test',
    description: 'Exercise QA, evaluation, falsification, and performance.',
  },
  {
    slug: 'ship',
    label: 'Ship',
    description: 'Prepare release, operations, observability, and rollback.',
  },
  {
    slug: 'grow',
    label: 'Grow',
    description: 'Plan launch, community, distribution, and Startup Toolkit pathways.',
  },
];

export const skillFixtures: SkillFixture[] = [
  {
    slug: schemaFirstPlanning.slug,
    score: schemaFirstPlanning.score,
    title: schemaFirstPlanning.title,
    purpose: schemaFirstPlanning.description,
    jobs: ['plan', 'design'],
    lifecycle: 'reviewed',
    provenance: ['community-submitted'],
    version: schemaFirstPlanning.version,
    sourceUrl: PLAN_SOURCE,
    sourceRevision: PLAN_REVISION,
    sourceLabel: 'Illustrative CURATIONS contract fixture',
    license: 'Fixture only - no distributable Skill',
    lastReviewed: 'fixture review - 2026-07-17',
    supportedHosts: ['GitHub Copilot CLI', 'Claude Code'],
    permissions: ['Approved PRD text', 'No shell', 'No network'],
    risk: 'Low fixture risk; no executable Artifact exists.',
    projectTypes: ['CRM & Operations', 'Developer Tools'],
    stackSlugs: schemaFirstPlanning.stackSlugs,
    outcomeCounts: { worked: 8, adapted: 3, didNotFit: 1, deferred: 2 },
    discussions: 4,
    fitReason:
      'The approved PRD names several records and relationships but leaves ownership and lifecycle decisions open.',
    fitConstraints: [
      'Uses only the approved PRD revision.',
      'Does not inspect repository files.',
      'Returns a schema discussion prompt, not generated code.',
    ],
    communityOutcomes: [
      {
        title: 'Worked after adaptation',
        detail:
          'A builder kept the record map but replaced the suggested status names before revising the PRD.',
        sourceLabel: 'Illustrative member-reported outcome',
      },
    ],
    publicExamples: [
      {
        title: 'Public plan structure example',
        detail:
          'The fixture plan demonstrates separate Project type, stage, Stack, and outcome objects.',
        sourceLabel: 'PUBLICLY SOURCED - fixture contract',
      },
    ],
  },
  {
    slug: sourceSynthesis.slug,
    score: sourceSynthesis.score,
    title: sourceSynthesis.title,
    purpose: sourceSynthesis.description,
    jobs: ['plan', 'review'],
    lifecycle: 'reviewed',
    provenance: ['owner-claimed'],
    version: sourceSynthesis.version,
    sourceUrl: PLAN_SOURCE,
    sourceRevision: PLAN_REVISION,
    sourceLabel: 'Illustrative owner-claimed fixture',
    license: 'Fixture only - no distributable Skill',
    lastReviewed: 'fixture review - 2026-07-17',
    supportedHosts: ['GitHub Copilot CLI'],
    permissions: ['Approved public sources', 'No shell', 'Network only when user runs locally'],
    risk: 'Medium fixture risk because real source retrieval would require network access.',
    projectTypes: ['Research & Knowledge', 'AI Assistants'],
    stackSlugs: sourceSynthesis.stackSlugs,
    outcomeCounts: { worked: 4, adapted: 4, didNotFit: 0, deferred: 3 },
    discussions: 3,
    fitReason:
      'The PRD asks for publicly sourced examples while preserving exact provenance and claim limitations.',
    fitConstraints: [
      'Every claim needs an exact citation.',
      'Public Examples remain separate from Community Outcomes.',
      'AI-curated copy requires a later explicit lane.',
    ],
    communityOutcomes: [
      {
        title: 'Worked',
        detail:
          'The builder used the source table unchanged and linked each public statement to its original record.',
        sourceLabel: 'Illustrative member-reported outcome',
      },
    ],
    publicExamples: [
      {
        title: 'Capability graph source notes',
        detail:
          'The approved plan separates skills.sh, GitHub Search, gstack, and OWASP source roles.',
        sourceLabel: 'PUBLICLY SOURCED - exact plan revision',
      },
    ],
  },
  {
    slug: 'release-rollback-rehearsal',
    score: 13,
    title: 'Release rollback rehearsal',
    purpose:
      'Turns a release plan into explicit failure signals, rollback steps, and an owner checklist.',
    jobs: ['test', 'ship'],
    lifecycle: 'update-available',
    provenance: ['publicly-sourced', 'ai-curated'],
    version: 'fixture-v0.9',
    sourceUrl: PLAN_SOURCE,
    sourceRevision: PLAN_REVISION,
    sourceLabel: 'Illustrative public-source fixture',
    license: 'Fixture only - source license unresolved',
    lastReviewed: 'fixture review - update waiting',
    supportedHosts: ['GitHub Copilot CLI', 'Manual checklist'],
    permissions: ['Release plan text', 'No cloud credentials', 'No deployment access'],
    risk: 'Medium fixture risk; a real version must never execute deployment commands.',
    projectTypes: ['Developer Tools', 'Commerce & Finance'],
    stackSlugs: ['cloudflare', 'github'],
    outcomeCounts: { worked: 0, adapted: 0, didNotFit: 0, deferred: 1 },
    discussions: 2,
    fitReason:
      'The approved Project context names GitHub Actions and hosted infrastructure but has no persisted rollout contract.',
    fitConstraints: [
      'The reviewed pin remains the only eligible revision.',
      'The upstream update is not recommendable until review.',
      'No credential, deployment, or cloud action is permitted.',
    ],
    communityOutcomes: [],
    publicExamples: [
      {
        title: 'Documented rollback checklist',
        detail:
          'A public example may be cited after exact source and license review; no effectiveness claim is made.',
        sourceLabel: 'PUBLICLY SOURCED + AI-CURATED - illustrative only',
      },
    ],
  },
  {
    slug: 'privacy-boundary-review',
    score: 7,
    title: 'Privacy boundary review',
    purpose:
      'Demonstrates how an expired review remains inspectable but cannot be presented as current.',
    jobs: ['review', 'test'],
    lifecycle: 'stale',
    provenance: ['community-submitted'],
    version: 'fixture-v0.4',
    sourceUrl: PLAN_SOURCE,
    sourceRevision: PLAN_REVISION,
    sourceLabel: 'Illustrative stale fixture',
    license: 'Fixture only - review expired',
    lastReviewed: 'fixture review expired',
    supportedHosts: ['Manual checklist'],
    permissions: ['Approved public copy', 'No account data', 'No network'],
    risk: 'Stale because privacy and contact assumptions require a new review.',
    projectTypes: ['Community & Events', 'Developer Tools'],
    stackSlugs: ['github'],
    outcomeCounts: { worked: 1, adapted: 0, didNotFit: 0, deferred: 2 },
    discussions: 1,
    fitReason: 'STALE Skills are not eligible for a current match.',
    fitConstraints: [
      'Review window expired.',
      'Compatibility must be reconfirmed.',
      'Historical fixture outcomes retain the exact version.',
    ],
    communityOutcomes: [],
    publicExamples: [],
  },
  {
    slug: 'legacy-agent-bootstrap',
    score: 0,
    title: 'Legacy agent bootstrap',
    purpose:
      'Demonstrates how retired Skills remain inspectable without being recommended or executed.',
    jobs: ['build'],
    lifecycle: 'retired',
    provenance: ['publicly-sourced'],
    version: 'fixture-v0.3',
    sourceUrl: PLAN_SOURCE,
    sourceRevision: PLAN_REVISION,
    sourceLabel: 'Illustrative retired fixture',
    license: 'Fixture only - retired',
    lastReviewed: 'retired in fixture',
    supportedHosts: ['None'],
    permissions: ['Formerly requested broad shell and network access'],
    risk: 'Retired because the permission contract is broader than its value.',
    projectTypes: ['Developer Tools'],
    stackSlugs: ['github'],
    outcomeCounts: { worked: 0, adapted: 0, didNotFit: 2, deferred: 0 },
    discussions: 1,
    fitReason: 'Retired Skills are never eligible for a match.',
    fitConstraints: [
      'No Save-to-run action.',
      'No execution lane.',
      'Historical references retain this exact fixture version.',
    ],
    communityOutcomes: [
      {
        title: 'Did not fit',
        detail:
          'The requested permissions exceeded the narrow planning task, so the builder stopped before execution.',
        sourceLabel: 'Illustrative member-reported outcome',
      },
    ],
    publicExamples: [],
  },
];

export const skillFixtureBySlug = Object.fromEntries(
  skillFixtures.map((skill) => [skill.slug, skill]),
) as Record<string, SkillFixture>;

export const skillMatchFixtures: SkillMatchFixture[] = [
  {
    id: 'schema-strong-fit',
    state: 'strong-fit',
    project: 'Member Profiles and PRD Showcase',
    prdRevision: showcaseFixture.sourceRevision,
    skillRevision: PLAN_REVISION,
    catalogRevision: 'capability-catalog-fixture/0.1',
    matchingRuleVersion: 'skill-match-fixture/0.1',
    matchedRuleIds: ['job:plan', 'project-type:developer-tools', 'context:profile-state'],
    requestedJob: 'Plan',
    skillSlug: 'schema-first-planning',
    explanation:
      'Project type, open profile-state decision, and declared SQLite-style records satisfy three reviewed fixture rules.',
    constraints: ['No repository read', 'No model call', 'Approved PRD text only'],
    watched: false,
  },
  {
    id: 'synthesis-possible-fit',
    state: 'possible-fit',
    project: 'Member Profiles and PRD Showcase',
    prdRevision: showcaseFixture.sourceRevision,
    skillRevision: PLAN_REVISION,
    catalogRevision: 'capability-catalog-fixture/0.1',
    matchingRuleVersion: 'skill-match-fixture/0.1',
    matchedRuleIds: ['job:review', 'context:public-examples'],
    requestedJob: 'Review',
    skillSlug: 'source-synthesis',
    explanation:
      'The PRD needs sourced examples, but host compatibility and network boundaries remain a member decision.',
    constraints: ['Review source permissions', 'Confirm Copilot CLI host', 'Citations required'],
    watched: false,
  },
  {
    id: 'grow-no-match',
    state: 'no-match',
    project: 'Member Profiles and PRD Showcase',
    prdRevision: showcaseFixture.sourceRevision,
    catalogRevision: 'capability-catalog-fixture/0.1',
    matchingRuleVersion: 'skill-match-fixture/0.1',
    matchedRuleIds: ['job:grow', 'constraint:zero-network', 'result:none-reviewed'],
    requestedJob: 'Grow',
    explanation:
      'No reviewed fixture Skill satisfies the Grow request and zero-network constraint.',
    constraints: ['Nothing unreviewed substituted', 'Toolkit remains separate from Skills'],
    watched: true,
  },
];

export const programFixtures: ProgramFixture[] = [
  {
    slug: 'product-hunt',
    name: 'Product Hunt',
    type: 'Launch & discovery',
    purpose: 'A public product-discovery platform builders may evaluate for a launch.',
    officialUrl: 'https://www.producthunt.com/',
    geography: 'Global public platform; availability varies',
    eligibility: 'Review current official posting and account requirements.',
    terms: 'No acceptance, reach, or launch outcome is promised.',
    lastReviewed: 'illustrative fixture - verify official source',
    disclosure: 'No sponsorship, affiliate relationship, or paid placement.',
  },
  {
    slug: 'wefunder',
    name: 'Wefunder',
    type: 'Regulated crowdfunding',
    purpose:
      'An official crowdfunding platform founders may research after obtaining appropriate financial and legal guidance.',
    officialUrl: 'https://wefunder.com/',
    geography: 'Eligibility and offering rules vary by jurisdiction',
    eligibility: 'Review current official issuer and investor requirements.',
    terms: 'CURATIONS provides no investment, legal, or fundraising advice.',
    lastReviewed: 'illustrative fixture - verify official source',
    disclosure: 'No sponsorship, affiliate relationship, or paid placement.',
  },
  {
    slug: 'microsoft-for-startups',
    name: 'Microsoft for Startups Founders Hub',
    type: 'Startup program',
    purpose:
      'A public program builders may evaluate for current technical benefits and founder resources.',
    officialUrl: 'https://www.microsoft.com/en-us/startups',
    geography: 'Program availability and benefits vary',
    eligibility: 'Review the current official application and benefit terms.',
    terms: 'Benefits, approval, duration, and eligibility can change.',
    lastReviewed: 'illustrative fixture - verify official source',
    disclosure: 'No sponsorship, affiliate relationship, or paid placement.',
  },
];

export const programFixtureBySlug = Object.fromEntries(
  programFixtures.map((program) => [program.slug, program]),
) as Record<string, ProgramFixture>;

export const watchedCapabilityFixtures = [
  {
    type: 'Skill',
    title: 'Schema-first planning',
    detail: 'Reviewed fixture pin · update notifications on',
    href: '/skills/schema-first-planning/',
  },
  {
    type: 'Program',
    title: 'Product Hunt',
    detail: 'Private Watch · terms and availability updates',
    href: '/toolkit/product-hunt/',
  },
  {
    type: 'Showcase',
    title: 'Member Profiles and PRD Showcase',
    detail: '7 replies · open for Roast',
    href: '/showcase/member-profiles-and-prd-showcase/',
  },
];

export const followedCapabilityFixtures = [
  { type: 'Project type', title: 'Developer Tools', detail: '12 active conversations' },
  { type: 'Tool', title: 'Astro', detail: '3 illustrative Projects' },
  { type: 'Stack', title: 'Cloudflare + Astro', detail: '2 illustrative Projects' },
];

export const savedCapabilityFixtures = [
  {
    type: 'Skill',
    title: 'Source-linked synthesis',
    detail: 'Exact fixture revision · not installed or run',
    href: '/skills/source-synthesis/',
  },
  {
    type: 'Program',
    title: 'Microsoft for Startups Founders Hub',
    detail: 'Private eligibility notes · fixture only',
    href: '/toolkit/microsoft-for-startups/',
  },
];
