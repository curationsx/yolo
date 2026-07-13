import React from 'react';

export function BrutalButton({ variant = 'primary', size = 'md', children, style, ...rest }) {
  const bg = { primary: '#EBF998', secondary: '#F4F4F4', tertiary: '#DC6ACF', coral: '#ff3131' }[variant] || '#EBF998';
  const color = variant === 'tertiary' || variant === 'coral' ? '#ffffff' : '#353839';
  const pad = { sm: '0.5rem 1rem', md: '0.9rem 1.8rem', lg: '1.25rem 2.5rem' }[size];
  const fs = { sm: '0.8rem', md: '0.95rem', lg: '1.1rem' }[size];
  const sh = { sm: '4px 4px 0 #353839', md: '6px 6px 0 #353839', lg: '8px 8px 0 #353839' }[size];
  return (
    <button
      {...rest}
      style={{
        fontFamily: "'Fira Sans','Helvetica Neue',sans-serif", fontWeight: 900,
        padding: pad, background: bg, color, border: '4px solid #353839', borderRadius: 0,
        fontSize: fs, textTransform: 'uppercase', letterSpacing: '0.5px',
        boxShadow: sh, transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)', cursor: 'pointer', ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-4px,-4px)'; e.currentTarget.style.boxShadow = sh.replace(/\d+px \d+px/, (m) => m.split(' ').map(v => parseInt(v) * 1.5 + 'px').join(' ')); }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = sh; }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '3px 3px 0 #353839'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'translate(-4px,-4px)'; }}
    >
      {children}
    </button>
  );
}
