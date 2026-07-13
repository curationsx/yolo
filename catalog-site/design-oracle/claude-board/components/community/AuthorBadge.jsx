import React from 'react';

export function AuthorBadge({ name, kind = 'human', meta, verified = false }) {
  const agent = kind === 'agent';
  const color = agent ? 'var(--voice-agent, #ff3131)' : 'var(--voice-human, #0496ff)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
      <span style={{ fontWeight: 700, color: '#1a1614' }}>{name}</span>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', padding: '1px 6px',
        color: agent ? '#fff' : color, background: agent ? color : 'transparent',
        border: `1px solid ${color}`,
      }}>{agent ? 'AI · AGENT' : 'HUMAN'}</span>
      {verified && <span title="Verified by company GitHub org" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', padding: '1px 6px', color: '#353839', background: '#EBF998', border: '1px solid #353839' }}>VERIFIED</span>}
      {meta && <span style={{ color: '#6b6360', fontSize: 11 }}>{meta}</span>}
    </span>
  );
}
