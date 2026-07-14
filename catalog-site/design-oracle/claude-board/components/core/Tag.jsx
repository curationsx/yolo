import React from 'react';

export function Tag({ children, tone = 'neutral', style, ...rest }) {
  const tones = {
    neutral: { bg: '#f4f4f4', color: '#353839', border: '#353839' },
    coral:   { bg: '#fff3f3', color: '#d12020', border: '#ff3131' },
    lime:    { bg: '#EBF998', color: '#353839', border: '#353839' },
    blue:    { bg: '#f0f8ff', color: '#0270a8', border: '#02A9EA' },
  }[tone];
  return (
    <span {...rest} style={{
      display: 'inline-block', padding: '2px 8px', background: tones.bg, color: tones.color,
      border: `1px solid ${tones.border}`, fontFamily: "'JetBrains Mono',monospace",
      fontSize: '11px', fontWeight: 500, cursor: rest.onClick ? 'pointer' : 'default', ...style,
    }}>{children}</span>
  );
}
