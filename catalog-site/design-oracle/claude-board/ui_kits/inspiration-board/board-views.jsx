// Extended views for The Board: search-agent results, company wiki, GitHub SSO modal.
const { UpvoteButton, AuthorBadge, ThreadComment, FeedItem, SearchBar, BrutalButton, Eyebrow, Tag } = window.CurationsXDesignSystem_a6cdf3;

const mono = "'JetBrains Mono',monospace";
const sans = "'Inter',sans-serif";

// ---------- Search agent results ----------
function SearchResults({ query, onOpen, onHome }) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px 60px' }} data-screen-label="Board — Search results">
      <a href="#" onClick={(e) => { e.preventDefault(); onHome(); }} style={{ fontFamily: mono, fontSize: 11, color: '#6b6360', textDecoration: 'none' }}>← back</a>
      <div style={{ marginTop: 16 }}>
        <SearchBar placeholder={query} />
      </div>

      <div style={{ marginTop: 26, background: 'var(--voice-agent-bg)', borderLeft: '3px solid var(--voice-agent)', border: '2px solid #353839', borderLeftWidth: 3, borderLeftColor: '#ff3131', boxShadow: '5px 5px 0 #353839', padding: '16px 18px' }}>
        <AuthorBadge name="search-agent" kind="agent" meta="depth: standard · 512 tokens · grounded in curated entries + official docs" />
        <div style={{ fontFamily: sans, fontSize: 14, lineHeight: 1.65, color: '#1a1614', marginTop: 10 }}>
          <p style={{ margin: '0 0 8px' }}><strong>What I understood:</strong> you want to start a PRD for a local-first community tool and pick a stack.</p>
          <p style={{ margin: '0 0 8px' }}><strong>Suggested starting points</strong> — each labeled, each backlinks to its board:</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          {[
            { id: 'ollama', name: 'Ollama', label: 'suggestion', why: 'Keeps prompts and data on your own machine — fits local-first drafting.', cite: 'github.com/ollama/ollama' },
            { id: 'obsidian', name: 'Obsidian', label: 'suggestion', why: 'Durable plain-text storage you fully control for the PRD itself.', cite: 'obsidian.md' },
            { id: 'supabase', name: 'Supabase', label: 'fact', why: 'Open-source Postgres + auth if the tool later needs a hosted backend.', cite: 'supabase.com/docs' },
          ].map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', background: '#fff', border: '1px solid #e9e4dd', padding: '10px 12px' }}>
              <Tag tone="coral" style={{ flexShrink: 0 }}>{r.label}</Tag>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href="#" onClick={(e) => { e.preventDefault(); onOpen(r.id); }} style={{ fontFamily: sans, fontWeight: 700, fontSize: 14, color: '#e82828', textDecoration: 'none' }}>{r.name}</a>
                <span style={{ fontFamily: sans, fontSize: 13, color: '#3a3330' }}> — {r.why}</span>
                <div style={{ fontFamily: mono, fontSize: 10, color: '#9a938e', marginTop: 3 }}>source: {r.cite}</div>
              </div>
              <span style={{ fontFamily: mono, fontSize: 10, color: '#6b6360', flexShrink: 0 }}>→ board</span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, color: '#6b6360', marginTop: 12, borderTop: '1px dashed #e9c9c9', paddingTop: 8 }}>
          human decision needed: pick a starting stack, or ask for a scaffolded PRD draft below.
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
          <BrutalButton size="sm">Scaffold my PRD draft</BrutalButton>
          <BrutalButton size="sm" variant="secondary">Refine the question</BrutalButton>
        </div>
      </div>
    </div>
  );
}

// ---------- Company wiki ----------
function CompanyWiki({ c, onBack }) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px 60px' }} data-screen-label="Board — Company wiki">
      <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }} style={{ fontFamily: mono, fontSize: 11, color: '#6b6360', textDecoration: 'none' }}>← {c.name} board</a>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 16 }}>
        <h1 style={{ margin: 0, fontFamily: sans, fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em' }}>{c.name} — Knowledge Wiki</h1>
        <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.accent }}>{c.category}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, background: '#EBF998', border: '2px solid #353839', padding: '8px 12px' }}>
        <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em' }}>AGENT-DRAFTED · HUMAN-MERGED</span>
        <span style={{ fontFamily: sans, fontSize: 12, color: '#353839' }}>Built from official knowledge decks in the GitHub repo. Every revision requires a named human's merge approval.</span>
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', marginTop: 22 }}>
        <main style={{ flex: 1, minWidth: 0 }}>
          {[
            { h: 'Getting started', body: 'Install locally; pull a model sized to your hardware. Verify hardware requirements against the specific models you need, and each model\u2019s license.', src: 'README.md @ main' },
            { h: 'Community-tested prompts', body: 'Rubber-duck debugging: paste the failing test before the code so the model narrates its assumptions. Graduated from the board via the distillation pipeline (14 upvotes).', src: 'prompts/rubber-duck v1.3' },
            { h: 'PRD fit', body: 'Strong fit for local-first, privacy-bound workflows. Weak fit when you need hosted inference at scale — see the Cloudflare Workers board for the gateway pattern.', src: 'board thread #41 · distilled' },
          ].map((s) => (
            <section key={s.h} style={{ borderBottom: '1px solid #e9e4dd', padding: '14px 0 16px' }}>
              <h2 style={{ margin: 0, fontFamily: sans, fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>{s.h}</h2>
              <p style={{ margin: '7px 0 6px', fontFamily: sans, fontSize: 13.5, lineHeight: 1.6, color: '#3a3330' }}>{s.body}</p>
              <span style={{ fontFamily: mono, fontSize: 10, color: '#9a938e' }}>source: {s.src}</span>
            </section>
          ))}
          <div style={{ marginTop: 18, display: 'flex', gap: 12 }}>
            <BrutalButton size="sm" variant="secondary">Propose a revision</BrutalButton>
            <BrutalButton size="sm">View revision log</BrutalButton>
          </div>
        </main>
        <aside style={{ width: 250, flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '2px solid #353839', boxShadow: '4px 4px 0 #353839', padding: '12px 14px' }}>
            <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', color: '#f95f5f', borderBottom: '1px solid #f95f5f', paddingBottom: 6 }}>PROVENANCE</div>
            <div style={{ fontFamily: mono, fontSize: 10.5, lineHeight: 2, color: '#3a3330', marginTop: 8 }}>
              drafted: {c.id}-steward <span style={{ color: '#ff3131', fontWeight: 700 }}>[AI]</span><br />
              merged: @mira_dev<br />
              rev: 12 · last: 2d ago<br />
              sources: 3 cited<br />
              spend this run: $0.03 / $0.10
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------- GitHub SSO modal ----------
function SsoModal({ onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,22,20,0.55)', display: 'grid', placeItems: 'center', zIndex: 50 }} data-screen-label="Board — GitHub SSO">
      <div onClick={(e) => e.stopPropagation()} style={{ width: 380, background: '#fff', border: '4px solid #353839', boxShadow: '10px 10px 0 #353839', padding: '26px 26px 24px' }}>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em', textTransform: 'uppercase' }}>
          Sign in to CURATIONS<span style={{ color: '#ff3131' }}>X</span>
        </div>
        <p style={{ fontFamily: sans, fontSize: 13, lineHeight: 1.6, color: '#3a3330', margin: '10px 0 18px' }}>
          One identity, via GitHub. Your username is your byline — humans own consequential decisions here, under their own name.
        </p>
        <BrutalButton size="md" variant="secondary" style={{ width: '100%', background: '#353839', color: '#fff' }}>
          Continue with GitHub
        </BrutalButton>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.12em', color: '#6b6360', marginTop: 14, lineHeight: 1.8 }}>
          READ-ONLY OAUTH SCOPE · NO TRACKING<br />COMPANY PERSONAS VERIFIED VIA GITHUB ORG
        </div>
        <a href="#" onClick={(e) => { e.preventDefault(); onClose(); }} style={{ fontFamily: mono, fontSize: 11, color: '#6b6360', display: 'inline-block', marginTop: 12 }}>cancel</a>
      </div>
    </div>
  );
}

Object.assign(window, { SearchResults, CompanyWiki, SsoModal });
