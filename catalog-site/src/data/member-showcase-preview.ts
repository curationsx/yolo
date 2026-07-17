export interface MemberFixture {
  githubId: string;
  login: string;
  displayName: string;
  avatarUrl: string;
  githubUrl: string;
  bio: string;
  website: string;
  location: string;
  joined: string;
}

export interface ShowcaseBreakdownFixture {
  purpose: string;
  problem: string;
  audience: string;
  product: string;
  decisions: string[];
  nonGoals: string[];
  openDecisions: string[];
  promptVersion: string;
  generatedAt: string;
  approvedAt: string;
}

export interface RoastFixture {
  author: string;
  whatHoldsUp: string;
  whatQuacks: string;
  hiddenAssumption: string;
  expensiveAmbiguity: string;
  falsificationTest: string;
  nextQuestion: string;
}

export interface ShowcaseFixture {
  slug: string;
  score: number;
  title: string;
  question: string;
  purpose: string;
  prdUrl: string;
  sourceRevision: string;
  author: MemberFixture;
  stackSlugs: string[];
  reviewMode: string;
  roastOpen: boolean;
  roastCount: number;
  comments: number;
  people: number;
  age: string;
  recentlyRevised: boolean;
  improvedFromFeedback: boolean;
  breakdown: ShowcaseBreakdownFixture;
  roast: RoastFixture;
}

export interface MemberNotificationFixture {
  id: string;
  type: 'reply' | 'review' | 'mention' | 'revision' | 'match';
  title: string;
  detail: string;
  href: string;
  age: string;
  unread: boolean;
}

export type MemberSettingsSection =
  | 'profile'
  | 'contact'
  | 'account'
  | 'notifications'
  | 'privacy'
  | 'ai-and-execution';

export interface MemberSettingsSectionFixture {
  section: MemberSettingsSection;
  label: string;
  description: string;
}

export const memberFixture: MemberFixture = {
  githubId: '219447171',
  login: 'CurationsLA',
  displayName: 'CurationsLA',
  avatarUrl: 'https://avatars.githubusercontent.com/u/219447171?v=4',
  githubUrl: 'https://github.com/CurationsLA',
  bio: 'Building public, accountable ways for people and AI to make stronger creative and software decisions.',
  website: 'https://curations.dev',
  location: 'Los Angeles',
  joined: 'July 2026',
};

export const showcaseFixture: ShowcaseFixture = {
  slug: 'member-profiles-and-prd-showcase',
  score: 17,
  title: 'Member Profiles and PRD Showcase',
  question:
    'Does this make PRD self-promotion useful without turning the Board into a pitch feed?',
  purpose:
    'Give builders a low-friction, source-linked way to promote and discuss a public product plan before entering a deeper Project improvement loop.',
  prdUrl:
    'https://github.com/CurationsLA/prd-showcase-fixture/blob/4dccc0179b14c32f05be976a4d02ab4757a02d20/docs/member-profiles-and-prd-showcase.md',
  sourceRevision: '4dccc0179b14c32f05be976a4d02ab4757a02d20',
  author: memberFixture,
  stackSlugs: ['astro', 'typescript', 'github'],
  reviewMode: 'Discussion',
  roastOpen: true,
  roastCount: 1,
  comments: 7,
  people: 3,
  age: '24m ago',
  recentlyRevised: false,
  improvedFromFeedback: false,
  breakdown: {
    purpose:
      'Give builders a low-friction, source-linked way to promote and discuss a public product plan before entering a deeper Project improvement loop.',
    problem:
      'Project intake supports durable improvement, but builders also need a simple, accountable place to explain a plan, ask one useful question, and invite artifact-focused critique. A bare promotional link does not provide enough context for a useful conversation.',
    audience:
      'Builders sharing public product plans, reviewers offering scoped and actionable critique, and readers researching how other people frame software decisions.',
    product:
      'A CURATIONS-native member profile, PRD Showcase discovery and detail, a builder-approved Copilot CLI purpose breakdown, optional Rubber Duck Roast, and a scoped Inbox.',
    decisions: [
      'GitHub proves identity; CURATIONS owns the member experience.',
      'Showcase can exist without full Project intake.',
      'The human discussion question remains the social front door.',
      'The Copilot CLI breakdown is author-approved context, not verification.',
      'Roast consent never invites a hosted agent.',
    ],
    nonGoals: [
      'Repository crawling or hosted code execution.',
      'Automatic publication.',
      'Unrestricted private messages.',
      'Follower counts or composite reputation scores.',
      'Treating votes or Roast status as a quality grade.',
    ],
    openDecisions: [
      'What is the smallest useful persisted member profile?',
      'When should a Showcase graduate into a full Project?',
      'Which safety controls must be proven before a real public Roast?',
    ],
    promptVersion: 'prd-showcase-purpose/0.1',
    generatedAt: '2026-07-16T21:38:00Z',
    approvedAt: '2026-07-16T21:41:00Z',
  },
  roast: {
    author: '@devon',
    whatHoldsUp:
      'The Showcase and Project lanes have different jobs, and the plan finally says that plainly.',
    whatQuacks:
      'The first version still risks asking a new member to understand too many states before sharing one useful question.',
    hiddenAssumption:
      'That every builder already has Copilot CLI access and knows how to produce a structured breakdown.',
    expensiveAmbiguity:
      'Whether the public profile is a read model or an editable social identity once persistence arrives.',
    falsificationTest:
      'Give five builders only the Showcase entry screen and see whether they can reach an exact preview in five minutes.',
    nextQuestion:
      'What is the smallest profile state that makes the Showcase feel owned without delaying publication?',
  },
};

export const showcaseFixtures = [showcaseFixture];

export const memberFeedbackFixture = {
  title: 'Keep the human question as the social front door.',
  context: 'Member Profiles and PRD Showcase',
  outcome: 'Accepted',
  age: '18m ago',
};

export const memberLibraryFixture = {
  title: 'Project-plan gap review',
  type: 'Review',
  outcome: 'Worked after adaptation',
  version: 'v0.1',
};

export const memberNotifications: MemberNotificationFixture[] = [
  {
    id: 'new-reviewed-match',
    type: 'match',
    title: 'New reviewed Skill match available',
    detail: 'Schema-first planning now matches your approved PRD context.',
    href: '/me/matches/',
    age: '4m',
    unread: true,
  },
  {
    id: 'roast-reply',
    type: 'reply',
    title: 'New Rubber Duck Roast on your PRD Showcase',
    detail: '@devon challenged the Copilot CLI access assumption.',
    href: '/showcase/member-profiles-and-prd-showcase/#roast',
    age: '8m',
    unread: true,
  },
  {
    id: 'maintainer-review',
    type: 'review',
    title: 'Project fixture review is ready',
    detail: 'The exact public preview remains private until you decide.',
    href: '/projects/new/',
    age: '31m',
    unread: true,
  },
  {
    id: 'showcase-revision',
    type: 'revision',
    title: 'Showcase source revision recorded',
    detail: 'The public PRD still points to draft PR #17.',
    href: '/showcase/member-profiles-and-prd-showcase/',
    age: '1h',
    unread: false,
  },
];

export const memberSettingsSections: MemberSettingsSectionFixture[] = [
  {
    section: 'profile',
    label: 'Profile',
    description: 'Member-controlled public CURATIONS identity.',
  },
  {
    section: 'contact',
    label: 'Contact',
    description: 'Separately verified, default-private contact visibility.',
  },
  {
    section: 'account',
    label: 'Account',
    description: 'GitHub identity, sessions, export, and deletion.',
  },
  {
    section: 'notifications',
    label: 'Notifications',
    description: 'Inbox, thread, and optional email preferences.',
  },
  {
    section: 'privacy',
    label: 'Privacy & safety',
    description: 'Visibility, blocks, mutes, reports, and Roast defaults.',
  },
  {
    section: 'ai-and-execution',
    label: 'AI & execution',
    description: 'Default-off AI participation and separate user-funded lanes.',
  },
];
