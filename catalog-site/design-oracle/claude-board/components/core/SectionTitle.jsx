import React from 'react';

/** Renders *word* segments as coral Fraunces italics. */
export function SectionTitle({ children, as = 'h2', size, style }) {
  const Tag = as;
  // Unwrap instrumentation wrappers (e.g. <span> around a single string child)
  let text = children;
  while (text && typeof text === 'object' && !Array.isArray(text) && text.props && text.props.children != null) {
    text = text.props.children;
  }
  const parts = typeof text === 'string' ? text.split(/\*(.+?)\*/g) : null;
  return (
    <Tag style={{
      fontFamily: "'Inter','Helvetica Neue',sans-serif",
      fontSize: size || 'clamp(2.3rem, 4vw, 3.75rem)', lineHeight: 0.98,
      letterSpacing: '-0.04em', fontWeight: 700, margin: 0, ...style,
    }}>
      {parts
        ? parts.map((p, i) => i % 2 === 1
          ? <em key={i} style={{ color: 'var(--editorial-coral)', fontStyle: 'italic', fontWeight: 600, fontFamily: "'Fraunces',serif", fontOpticalSizing: 'auto' }}>{p}</em>
          : <React.Fragment key={i}>{p}</React.Fragment>)
        : children}
    </Tag>
  );
}
