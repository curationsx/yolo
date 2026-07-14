import React from 'react';

export function SearchBar({ placeholder = 'Ask the search agent — "Where do I start on my PRD?"', onSubmit, hint = 'AI-ASSISTED · RESULTS CITE SOURCES' }) {
  const [q, setQ] = React.useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (onSubmit) onSubmit(q); }} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', border: '3px solid #353839', background: '#fff', boxShadow: '6px 6px 0 #353839' }}>
        <span style={{ display: 'grid', placeItems: 'center', padding: '0 12px', fontFamily: "'JetBrains Mono',monospace", fontSize: 15, color: '#ff3131' }}>⌕</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
          style={{ flex: 1, border: 'none', outline: 'none', padding: '14px 4px', fontFamily: "'Inter',sans-serif", fontSize: 15, background: 'transparent', color: '#1a1614' }} />
        <button type="submit" style={{ fontFamily: "'Fira Sans',sans-serif", fontWeight: 900, textTransform: 'uppercase', fontSize: 13, letterSpacing: '0.5px', border: 'none', borderLeft: '3px solid #353839', background: '#EBF998', color: '#353839', padding: '0 20px', cursor: 'pointer' }}>Search</button>
      </div>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '0.15em', color: '#6b6360' }}>{hint}</span>
    </form>
  );
}
