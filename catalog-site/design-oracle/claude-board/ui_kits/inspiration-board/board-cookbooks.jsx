// Cookbooks tab for The Board: universal prompt cookbooks-as-code, stack tailoring, Copilot CLI handoff.
const { AuthorBadge, BrutalButton, Tag, UpvoteButton } = window.CurationsXDesignSystem_a6cdf3;

const ckMono = "'JetBrains Mono',monospace";
const ckSans = "'Inter',sans-serif";

const COOKBOOK_STACKS = [
  { id: 'ollama', name: 'Ollama', accent: '#ff3131', runtime: 'local model · offline', fit: { 'rubber-duck': 'strong', 'source-synthesis': 'partial', 'sop-drafting': 'strong', 'pre-mortem': 'strong' } },
  { id: 'supabase', name: 'Supabase', accent: '#02A9EA', runtime: 'postgres · edge functions', fit: { 'rubber-duck': 'strong', 'source-synthesis': 'strong', 'sop-drafting': 'partial', 'pre-mortem': 'strong' } },
  { id: 'cloudflare', name: 'Cloudflare Workers', accent: '#F254B8', runtime: 'edge · capped gateway', fit: { 'rubber-duck': 'strong', 'source-synthesis': 'partial', 'sop-drafting': 'strong', 'pre-mortem': 'strong' } },
  { id: 'n8n', name: 'n8n', accent: '#DC6ACF', runtime: 'workflow nodes · self-host', fit: { 'rubber-duck': 'partial', 'source-synthesis': 'strong', 'sop-drafting': 'strong', 'pre-mortem': 'partial' } },
  { id: 'langfuse', name: 'Langfuse', accent: '#0496ff', runtime: 'tracing · evals', fit: { 'rubber-duck': 'partial', 'source-synthesis': 'strong', 'sop-drafting': 'partial', 'pre-mortem': 'strong' } },
  { id: 'obsidian', name: 'Obsidian', accent: '#C5D86D', runtime: 'markdown vault · local', fit: { 'rubber-duck': 'partial', 'source-synthesis': 'strong', 'sop-drafting': 'strong', 'pre-mortem': 'partial' } },
];

const COOKBOOKS = [
  {
    id: 'rubber-duck', category: 'engineering', title: 'Rubber-duck debugging', votes: 34, version: 'v1.3',
    desc: 'Paste the failing test before the code so the model narrates assumptions instead of guessing.',
    code: (s) => [
      `# cookbook: rubber-duck-debugging ${''}`,
      `# graduated from the board · 14 upvotes → prompts/rubber-duck v1.3`,
      `stack: ${s ? s.name.toLowerCase().replace(/ /g, '-') : '<pick a stack>'}`,
      s ? `runtime: ${s.runtime}` : `runtime: <universal>`,
      ``,
      `steps:`,
      `  - paste: failing_test        # BEFORE the implementation`,
      `  - paste: implementation`,
      `  - ask: "narrate your assumptions before proposing a fix"`,
      s && s.id === 'ollama' ? `  - run: ollama run qwen3:7b   # offline, license-checked` : `  - run: <model of choice>`,
      `checkpoint: human reviews narrated assumptions   # non-negotiable`,
    ].filter(Boolean).join('\n'),
  },
  {
    id: 'source-synthesis', category: 'research', title: 'Source synthesis', votes: 27, version: 'v1.1',
    desc: 'Merge multiple sources into one evidence-labeled brief; every claim keeps its citation.',
    code: (s) => [
      `# cookbook: research-source-synthesis`,
      `stack: ${s ? s.name.toLowerCase().replace(/ /g, '-') : '<pick a stack>'}`,
      ``,
      `inputs:`,
      `  sources: [urls | files]      # only material you may make public`,
      `steps:`,
      `  - extract: claims_per_source`,
      `  - label: fact | assumption | conflict`,
      s && s.id === 'supabase' ? `  - store: postgres table w/ RLS per reviewer` : `  - store: <evidence table>`,
      s && s.id === 'obsidian' ? `  - write: vault note w/ backlinks per source` : null,
      `  - draft: brief with inline citations`,
      `checkpoint: human verifies each conflict before publish`,
    ].filter(Boolean).join('\n'),
  },
  {
    id: 'sop-drafting', category: 'operations', title: 'SOP drafting', votes: 19, version: 'v1.0',
    desc: 'Turn a messy process description into a stepwise SOP with rollback and failure modes.',
    code: (s) => [
      `# cookbook: operations-sop-drafting`,
      `stack: ${s ? s.name.toLowerCase().replace(/ /g, '-') : '<pick a stack>'}`,
      ``,
      `steps:`,
      `  - describe: current_process   # plain words, warts included`,
      `  - ask: "draft SOP; flag every judgment point"`,
      s && s.id === 'n8n' ? `  - map: SOP steps → n8n workflow nodes` : `  - map: SOP steps → your runner`,
      `  - require: rollback per step`,
      `checkpoint: process owner signs the SOP by name`,
    ].filter(Boolean).join('\n'),
  },
  {
    id: 'pre-mortem', category: 'safety', title: 'Safety pre-mortem', votes: 22, version: 'v1.2',
    desc: 'Assume the launch failed; work backwards to name the failure modes before they happen.',
    code: (s) => [
      `# cookbook: safety-pre-mortem`,
      `stack: ${s ? s.name.toLowerCase().replace(/ /g, '-') : '<pick a stack>'}`,
      ``,
      `steps:`,
      `  - state: "it is 6 months later and this failed"`,
      `  - list: failure modes, ranked by likelihood x damage`,
      s && s.id === 'langfuse' ? `  - wire: trace + eval per failure mode` : `  - wire: <observability of choice>`,
      s && s.id === 'cloudflare' ? `  - cap: spend + rate kill-switch (KV)` : null,
      `  - assign: named human owner per mitigation`,
      `checkpoint: owner accepts, adapts, declines, or defers`,
    ].filter(Boolean).join('\n'),
  },
];

const FIT_COPY = {
  strong: { label: 'STRONG FIT', bg: '#EBF998', note: 'Runs on this stack as written — tailored lines below are grounded in the stack\u2019s official docs.' },
  partial: { label: 'PARTIAL FIT', bg: '#ffb3b3', note: 'Core steps work; some steps need a companion tool. See the stack\u2019s board for community pairings.' },
};

function StackSelect({ value, onChange }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} style={{
      fontFamily: ckMono, fontSize: 12, fontWeight: 600, padding: '8px 10px', background: '#fff',
      border: '2px solid #353839', boxShadow: '3px 3px 0 #353839', cursor: 'pointer', color: '#1a1614', outline: 'none',
    }}>
      <option value="">universal — all stacks</option>
      {COOKBOOK_STACKS.map((s) => <option key={s.id} value={s.id}>tailor → {s.name}</option>)}
    </select>
  );
}

function HandoffModal({ book, stack, onClose }) {
  const cmd = [
    `# handoff → GitHub Copilot CLI · engine: fable5max`,
    `copilot --agent fable5max \\`,
    `  --cookbook curationsx/${book.id}@${book.version} \\`,
    stack ? `  --stack ${stack.id} \\` : `  --stack universal \\`,
    `  --checkpoint human-review \\`,
    `  --budget 0.10 --max-requests 10`,
  ].join('\n');
  const [copied, setCopied] = React.useState(false);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,22,20,0.55)', display: 'grid', placeItems: 'center', zIndex: 50 }} data-screen-label="Board — Copilot handoff">
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, background: '#fff', border: '4px solid #353839', boxShadow: '10px 10px 0 #353839', padding: '22px 24px' }}>
        <div style={{ fontFamily: ckSans, fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
          Handoff — Copilot CLI <span style={{ color: '#ff3131' }}>· fable5max</span>
        </div>
        <p style={{ fontFamily: ckSans, fontSize: 12.5, lineHeight: 1.6, color: '#3a3330', margin: '8px 0 12px' }}>
          Runs the cookbook in your terminal through the fable5max engine. Spend caps and the human checkpoint travel with the handoff — they are not optional flags.
        </p>
        <pre style={{ margin: 0, background: '#1a1614', color: '#EBF998', fontFamily: ckMono, fontSize: 11.5, lineHeight: 1.7, padding: '14px 16px', overflowX: 'auto' }}>{cmd}</pre>
        <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center' }}>
          <BrutalButton size="sm" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(cmd); setCopied(true); }}>{copied ? 'Copied ✓' : 'Copy command'}</BrutalButton>
          <BrutalButton size="sm" variant="secondary" onClick={onClose}>Close</BrutalButton>
          <span style={{ fontFamily: ckMono, fontSize: 9, letterSpacing: '0.12em', color: '#6b6360' }}>AI RUNS DISCLOSED · $0.10 / RUN CAP</span>
        </div>
      </div>
    </div>
  );
}

function CookbookCard({ book, onOpenStack }) {
  const [stackId, setStackId] = React.useState(null);
  const [handoff, setHandoff] = React.useState(false);
  const stack = COOKBOOK_STACKS.find((s) => s.id === stackId) || null;
  const fit = stack ? FIT_COPY[stack.fit[book.id]] : null;
  return (
    <div style={{ background: '#fff', border: '2px solid #353839', boxShadow: stack ? `6px 6px 0 ${stack.accent}` : '5px 5px 0 #353839', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'box-shadow 0.2s cubic-bezier(0.4,0,0.2,1)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: ckSans, fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>{book.title}</span>
        <Tag tone="coral">{book.category}</Tag>
        <span style={{ fontFamily: ckMono, fontSize: 10, color: '#9a938e' }}>{book.version} · schema-validated</span>
        <div style={{ marginLeft: 'auto' }}><UpvoteButton count={book.votes} size="sm" /></div>
      </div>
      <p style={{ margin: 0, fontFamily: ckSans, fontSize: 13, lineHeight: 1.55, color: '#3a3330' }}>{book.desc}</p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <StackSelect value={stackId} onChange={setStackId} />
        {stack && (
          <span style={{ fontFamily: ckMono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', background: fit.bg, border: '1px solid #353839', padding: '3px 8px' }}>{fit.label} · {stack.name.toUpperCase()}</span>
        )}
      </div>
      <pre style={{ margin: 0, background: '#1a1614', color: '#f7f7ff', fontFamily: ckMono, fontSize: 11.5, lineHeight: 1.7, padding: '14px 16px', overflowX: 'auto' }}>{book.code(stack)}</pre>
      {stack && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--voice-agent-bg)', borderLeft: '3px solid var(--voice-agent)', padding: '8px 12px' }}>
          <div style={{ flex: 1 }}>
            <AuthorBadge name={`${stack.id}-steward`} kind="agent" verified meta="fit check · depth: focused" />
            <div style={{ fontFamily: ckSans, fontSize: 12.5, lineHeight: 1.55, color: '#1a1614', marginTop: 4 }}>[{stack.fit[book.id] === 'strong' ? 'fact' : 'assumption'}] {fit.note} <a href="#" onClick={(e) => { e.preventDefault(); onOpenStack(stack.id); }} style={{ color: '#e82828' }}>→ {stack.name} board</a></div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <BrutalButton size="sm" onClick={() => setHandoff(true)}>Handoff → Copilot CLI</BrutalButton>
        <BrutalButton size="sm" variant="secondary">Fork this cookbook</BrutalButton>
      </div>
      {handoff && <HandoffModal book={book} stack={stack} onClose={() => setHandoff(false)} />}
    </div>
  );
}

function CookbooksView({ onOpenStack, onHome }) {
  const [cat, setCat] = React.useState('all');
  const cats = ['all', 'engineering', 'research', 'operations', 'safety'];
  const books = COOKBOOKS.filter((b) => cat === 'all' || b.category === cat);
  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '28px 24px 60px' }} data-screen-label="Board — Cookbooks">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '3px solid #353839', paddingBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontFamily: ckSans, fontWeight: 800, fontSize: 15, textTransform: 'uppercase' }}>Cookbooks — prompts as code</span>
        <span style={{ fontFamily: ckMono, fontSize: 10, color: '#6b6360' }}>universal by default · tailor to any stack · handoff to your terminal</span>
      </div>
      <div style={{ display: 'flex', gap: 8, margin: '14px 0 20px' }}>
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} style={{
            fontFamily: ckMono, fontSize: 11, fontWeight: 600, padding: '4px 10px', cursor: 'pointer',
            background: cat === c ? '#353839' : '#fff', color: cat === c ? '#EBF998' : '#353839',
            border: '2px solid #353839',
          }}>{c}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {books.map((b) => <CookbookCard key={b.id} book={b} onOpenStack={onOpenStack} />)}
      </div>
    </div>
  );
}

Object.assign(window, { CookbooksView });
