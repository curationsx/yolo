export const STACKS = [
  { id: 'ollama', name: 'Ollama', glyph: 'OL', color: '#ff3131' },
  { id: 'supabase', name: 'Supabase', glyph: 'SB', color: '#3ecf8e' },
  { id: 'cloudflare', name: 'Cloudflare Workers', glyph: 'CF', color: '#f38020' },
  { id: 'n8n', name: 'n8n', glyph: 'N8', color: '#ff6d5a' },
  { id: 'langfuse', name: 'Langfuse', glyph: 'LF', color: '#6e56cf' },
  { id: 'obsidian', name: 'Obsidian', glyph: 'OB', color: '#8b5cf6' },
] as const;

export type StackId = (typeof STACKS)[number]['id'];
export type CookbookCategory = 'engineering' | 'research' | 'operations' | 'safety';

export interface CookbookData {
  id: string;
  title: string;
  category: CookbookCategory;
  version: string;
  release_status: 'preview' | 'stable' | 'retired';
  description: string;
  source_prompt: string;
  source_prompt_id: string;
  source_version: string;
  source_status: 'draft' | 'tested' | 'stable' | 'retired';
  strong_fit: StackId[];
  partial_fit: StackId[];
}

interface CookbookPresentation {
  glyph: string;
  accent: string;
  code: Record<StackId, string[]>;
  fitNote: Record<StackId, string>;
}

export const COOKBOOK_CATEGORY_LABELS: Record<CookbookCategory, string> = {
  engineering: 'Engineering',
  research: 'Research',
  operations: 'Operations',
  safety: 'Safety',
};

const PRESENTATION: Record<string, CookbookPresentation> = {
  'rubber-duck': {
    glyph: 'RD',
    accent: '#ff3131',
    code: {
      ollama: [
        'ollama run llama3.2:3b',
        '>>> Explain the bug aloud.',
        '>>> What did you expect?',
        '>>> What actually happened?',
      ],
      supabase: [
        'SELECT event_message,',
        '  metadata->>\'request_id\'',
        'FROM edge_logs',
        'ORDER BY timestamp DESC LIMIT 20;',
      ],
      cloudflare: [
        'wrangler tail --format pretty',
        '# Reproduce once.',
        '# Narrate expected vs actual.',
        '# Follow the first divergent trace.',
      ],
      n8n: [
        'Webhook node: capture failing payload',
        'Set node: expected / actual / tried',
        'AI node: ask one question at a time',
        'Stop before proposing a fix',
      ],
      langfuse: [
        'trace = langfuse.trace(name="duck")',
        'trace.span(name="expected")',
        'trace.span(name="actual")',
        'trace.span(name="first divergence")',
      ],
      obsidian: [
        'Template: Debug duck',
        '- Expected',
        '- Actual',
        '- Evidence',
        '- Cheapest next experiment',
      ],
    },
    fitNote: {
      ollama: 'A local model keeps sensitive debugging context on-device while the cookbook stays deliberately Socratic.',
      supabase: 'Database and edge-function evidence make the expectation-versus-reality gap concrete and queryable.',
      cloudflare: 'Worker traces and Wrangler tailing give the duck a narrow, observable failure path to question.',
      n8n: 'Node execution data is useful, but branching workflows can hide state outside the visible failing node.',
      langfuse: 'Traces are excellent evidence, though the cookbook may need application context beyond model spans.',
      obsidian: 'A durable debug journal preserves reasoning, but it cannot inspect the live system by itself.',
    },
  },
  'source-synthesis': {
    glyph: 'SS',
    accent: '#02a9ea',
    code: {
      ollama: [
        'ollama run qwen2.5:7b',
        '>>> Sources are labeled S1, S2, S3.',
        '>>> Cite every claim.',
        '>>> Mark disagreements explicitly.',
      ],
      supabase: [
        'SELECT source_id, title, excerpt',
        'FROM research_sources',
        'WHERE project_id = $1',
        'ORDER BY captured_at;',
      ],
      cloudflare: [
        'export default { async fetch(req, env) {',
        '  const sources = await env.DB.prepare(',
        '    "SELECT * FROM sources WHERE project = ?"',
        '  ).bind(projectId).all();',
      ],
      n8n: [
        'HTTP Request: collect allowlisted sources',
        'Code node: assign S1, S2, S3 labels',
        'AI node: synthesize with citations',
        'Human node: verify sampled claims',
      ],
      langfuse: [
        'trace = langfuse.trace(name="synthesis")',
        'trace.update(metadata={"sources": ids})',
        '# Score citation coverage',
        '# Score unsupported claims',
      ],
      obsidian: [
        'Dataview: query #source notes',
        'Canvas: map agreements / conflicts',
        'Note: synthesis with [[source links]]',
        'Checklist: verify 3 sampled claims',
      ],
    },
    fitNote: {
      ollama: 'Local inference supports private source sets, with quality depending heavily on model context and citation discipline.',
      supabase: 'Structured source rows, provenance metadata, and access controls make synthesis inputs auditable.',
      cloudflare: 'Workers can gather and normalize sources, but long documents must be bounded before edge execution.',
      n8n: 'Source collection, labeling, synthesis, and human verification map cleanly onto an explicit workflow.',
      langfuse: 'Trace-level source metadata and evaluation scores make unsupported claims easier to catch.',
      obsidian: 'Linked notes and Canvas views provide a strong human-readable provenance and disagreement map.',
    },
  },
  'sop-drafting': {
    glyph: 'SOP',
    accent: '#dc6acf',
    code: {
      ollama: [
        'ollama run llama3.2:3b',
        '>>> Describe the process as performed.',
        '>>> Mark every unknown [OWNER: clarify].',
        '>>> End with a human walkthrough.',
      ],
      supabase: [
        'CREATE TABLE sop_steps (',
        '  position int, actor text, action text,',
        '  done_when text, rollback text',
        ');',
      ],
      cloudflare: [
        'export const steps = [',
        '  { actor, action, doneWhen, rollback },',
        '];',
        '// Keep execution outside the draft.',
      ],
      n8n: [
        'Trigger: approved SOP revision',
        'Execute documented steps',
        'Error branch: follow rollback',
        'Human approval before activation',
      ],
      langfuse: [
        'trace = langfuse.trace(name="sop-draft")',
        'trace.score(name="owner-gaps", value=count)',
        'trace.score(name="rollback-present", value=1)',
        'trace.score(name="walkthrough-passed", value=0)',
      ],
      obsidian: [
        'Template: SOP draft',
        'Properties: owner / status / reviewed',
        'Callouts: [!warning] rollback',
        'Task: second performer walkthrough',
      ],
    },
    fitNote: {
      ollama: 'Local drafting is useful for sensitive process notes, provided the process owner still performs the walkthrough.',
      supabase: 'Structured steps, actors, and completion conditions support versioned operational records.',
      cloudflare: 'Worker code can express small procedures, but the SOP must remain distinct from automated execution.',
      n8n: 'Visual steps and explicit error branches closely match an SOP, with human activation kept separate.',
      langfuse: 'Evaluation scores can expose missing owners and rollback sections, but Langfuse is not the procedure store.',
      obsidian: 'Templates, properties, callouts, and backlinks make a practical human-owned SOP knowledge base.',
    },
  },
  'pre-mortem': {
    glyph: 'PM',
    accent: '#353839',
    code: {
      ollama: [
        'ollama run llama3.2:3b',
        '>>> Assume the plan failed.',
        '>>> Generate distinct failure stories.',
        '>>> Rank by earliest warning signal.',
      ],
      supabase: [
        'SELECT risk, warning_signal, mitigation',
        'FROM pre_mortem',
        'WHERE plan_id = $1',
        'ORDER BY signal_lead_time DESC;',
      ],
      cloudflare: [
        'wrangler versions list',
        'wrangler deployments status',
        '# Define rollback before rollout.',
        '# Name the first observable warning.',
      ],
      n8n: [
        'Schedule: weekly signal review',
        'IF: warning threshold crossed',
        'Notify named human owner',
        'Never auto-close the decision',
      ],
      langfuse: [
        'trace = langfuse.trace(name="pre-mortem")',
        'trace.score(name="distinct-risks", value=count)',
        'trace.score(name="signals-actionable", value=ratio)',
        'trace.score(name="human-reviewed", value=0)',
      ],
      obsidian: [
        'Canvas: plan -> failures -> signals',
        'Dataview: open mitigations by owner',
        'Review note: accepted / adapted / deferred',
        'Link final decision record',
      ],
    },
    fitNote: {
      ollama: 'Private local facilitation supports candid risk discovery without sending the plan to a hosted model.',
      supabase: 'Risks, owners, signals, and mitigations become queryable evidence rather than a forgotten workshop note.',
      cloudflare: 'Versions, deployments, and rollback primitives make operational failure stories concrete before launch.',
      n8n: 'Monitoring and escalation workflows fit well, but no workflow should make the final risk decision automatically.',
      langfuse: 'Evaluation traces reveal model-quality failure modes and weak signals before an AI feature scales.',
      obsidian: 'Canvas and linked decision notes keep failure narratives connected to owners and later outcomes.',
    },
  },
};

export function cookbookPresentation(id: string): CookbookPresentation {
  const presentation = PRESENTATION[id];
  if (!presentation) throw new Error(`Unknown cookbook presentation: ${id}`);
  return presentation;
}

export function stackDefinition(id: StackId) {
  return STACKS.find((stack) => stack.id === id) ?? STACKS[0];
}

export function versionLabel(version: string): string {
  const [major, minor, patch] = version.split('.');
  return patch === '0' ? `v${major}.${minor}` : `v${version}`;
}

export function buildPromptPath(
  basePath: string,
  cookbookId: string,
  version: string,
  stackId: StackId,
): string {
  const base = basePath.replace(/\/$/, '');
  return `${base}/cookbooks/${cookbookId}/${versionLabel(version)}/${stackId}/`;
}

export function buildEmbeddedPromptPath(
  basePath: string,
  cookbookId: string,
  version: string,
  stackId: StackId,
): string {
  const base = basePath.replace(/\/$/, '');
  return `${base}/copilot/${cookbookId}/${versionLabel(version)}/${stackId}.txt`;
}

export function buildCopilotCommand(
  promptUrl: string,
  cookbookId: string,
  version: string,
  stackId: StackId,
): string {
  const sessionName = `curationsx-${cookbookId}-${versionLabel(version)}-${stackId}`;
  return [
    `CURATIONSX_PROMPT="$(curl -fsSL '${promptUrl}')" && \\`,
    `copilot --name "${sessionName}" -i "$CURATIONSX_PROMPT"`,
  ].join('\n');
}
