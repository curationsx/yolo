import React from 'react';

export function UpvoteButton({ count = 0, voted = false, onVote, size = 'md' }) {
  const [isVoted, setVoted] = React.useState(voted);
  const [n, setN] = React.useState(count);
  const dims = size === 'sm' ? { w: 34, fs: 10, tri: 10 } : { w: 44, fs: 12, tri: 13 };
  const toggle = () => {
    const next = !isVoted;
    setVoted(next); setN(n + (next ? 1 : -1));
    if (onVote) onVote(next);
  };
  return (
    <button onClick={toggle} aria-pressed={isVoted} title={isVoted ? 'Remove upvote' : 'Upvote'} style={{
      width: dims.w, minHeight: dims.w, padding: '5px 0', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 1, cursor: 'pointer',
      background: isVoted ? '#ff3131' : '#ffffff', color: isVoted ? '#ffffff' : '#353839',
      border: '2px solid #353839', borderRadius: 0,
      boxShadow: isVoted ? '2px 2px 0 #353839' : '3px 3px 0 #353839',
      transition: 'all 0.15s cubic-bezier(0.4,0,0.2,1)',
      fontFamily: "'JetBrains Mono',monospace",
    }}>
      <span style={{ fontSize: dims.tri, lineHeight: 1 }}>▲</span>
      <span style={{ fontSize: dims.fs, fontWeight: 700 }}>{n}</span>
    </button>
  );
}
