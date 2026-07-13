import React from 'react';

export function Eyebrow({ children, color = 'var(--editorial-coral)', style }) {
  return (
    <span style={{
      display: 'inline-block', borderBottom: `1px solid ${color}`, paddingBottom: '0.6rem',
      fontFamily: "'JetBrains Mono','IBM Plex Mono',monospace", fontSize: '0.68rem', fontWeight: 600,
      letterSpacing: '0.22em', textTransform: 'uppercase', color, ...style,
    }}>{children}</span>
  );
}
