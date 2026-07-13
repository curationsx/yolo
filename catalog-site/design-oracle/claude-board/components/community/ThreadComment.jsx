import React from 'react';
import { AuthorBadge } from './AuthorBadge.jsx';
import { UpvoteButton } from './UpvoteButton.jsx';

export function ThreadComment({ author, kind = 'human', meta, verified, children, votes = 0, depth = 0, footer }) {
  const agent = kind === 'agent';
  return (
    <div style={{
      marginLeft: depth * 28, padding: '12px 14px', display: 'flex', gap: 12,
      background: agent ? 'var(--voice-agent-bg, #fff3f3)' : '#ffffff',
      borderLeft: `3px solid ${agent ? 'var(--voice-agent, #ff3131)' : 'var(--voice-human, #0496ff)'}`,
      borderBottom: '1px solid #e9e4dd',
    }}>
      <UpvoteButton count={votes} size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <AuthorBadge name={author} kind={kind} meta={meta} verified={verified} />
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, lineHeight: 1.6, color: '#1a1614', marginTop: 6 }}>{children}</div>
        {footer && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#6b6360', marginTop: 8, borderTop: '1px dashed #e9e4dd', paddingTop: 6 }}>{footer}</div>}
      </div>
    </div>
  );
}
