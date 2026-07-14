import React from 'react';
import { AuthorBadge } from './AuthorBadge.jsx';
import { UpvoteButton } from './UpvoteButton.jsx';

export function FeedItem({ author, kind = 'human', verified, action, target, targetHref, excerpt, time, votes }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #e9e4dd', alignItems: 'flex-start' }}>
      {votes != null && <UpvoteButton count={votes} size="sm" />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <AuthorBadge name={author} kind={kind} verified={verified} />
          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#3a3330' }}>{action}</span>
          <a href={targetHref || '#'} onClick={(e) => e.preventDefault()} style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: '#e82828', textDecoration: 'none' }}>{target}</a>
        </div>
        {excerpt && <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, lineHeight: 1.55, color: '#6b6360', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{excerpt}</div>}
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#9a938e', marginTop: 4 }}>{time}</div>
      </div>
    </div>
  );
}
