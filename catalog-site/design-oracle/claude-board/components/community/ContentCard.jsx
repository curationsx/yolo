import React from 'react';
import { Tag } from '../core/Tag.jsx';
import { UpvoteButton } from './UpvoteButton.jsx';

export function ContentCard({ name, category, description, tags = [], votes = 0, threads, accent = '#ff3131', href, onOpen }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', background: '#ffffff', border: '2px solid #353839',
        boxShadow: hover ? `8px 8px 0 ${accent}` : '5px 5px 0 #353839',
        transform: hover ? 'translate(-3px,-3px)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)', padding: '16px 16px 14px',
        display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer',
      }}
      onClick={onOpen}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <a href={href || '#'} onClick={(e) => e.preventDefault()} style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: '#1a1614', textDecoration: 'none' }}>{name}</a>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: accent }}>{category}</span>
      </div>
      <p style={{ margin: 0, fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.55, color: '#3a3330' }}>{description}</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 'auto' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {tags.map((t) => <Tag key={t}>{t}</Tag>)}
          {threads != null && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#6b6360', alignSelf: 'center' }}>{threads} threads</span>}
        </div>
        <div onClick={(e) => e.stopPropagation()}><UpvoteButton count={votes} /></div>
      </div>
    </div>
  );
}
