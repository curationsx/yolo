/* @ds-bundle: {"format":4,"namespace":"CurationsXDesignSystem_a6cdf3","components":[{"name":"AuthorBadge","sourcePath":"components/community/AuthorBadge.jsx"},{"name":"ContentCard","sourcePath":"components/community/ContentCard.jsx"},{"name":"FeedItem","sourcePath":"components/community/FeedItem.jsx"},{"name":"SearchBar","sourcePath":"components/community/SearchBar.jsx"},{"name":"ThreadComment","sourcePath":"components/community/ThreadComment.jsx"},{"name":"UpvoteButton","sourcePath":"components/community/UpvoteButton.jsx"},{"name":"BrutalButton","sourcePath":"components/core/BrutalButton.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"SectionTitle","sourcePath":"components/core/SectionTitle.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"}],"sourceHashes":{"components/community/AuthorBadge.jsx":"1741c9e5a5ec","components/community/ContentCard.jsx":"85eea92754a3","components/community/FeedItem.jsx":"bf5dd5baf1ec","components/community/SearchBar.jsx":"c4cd2e1aba98","components/community/ThreadComment.jsx":"452689851ce5","components/community/UpvoteButton.jsx":"4fa40b9a2899","components/core/BrutalButton.jsx":"1ac96c684381","components/core/Eyebrow.jsx":"4d6db68ffc57","components/core/SectionTitle.jsx":"5f895e4534ee","components/core/Tag.jsx":"4b5d780f2c84","ui_kits/inspiration-board/board-app.jsx":"a169c490d0b1","ui_kits/inspiration-board/board-cookbooks.jsx":"91ede0a2d806","ui_kits/inspiration-board/board-views.jsx":"54da7d21fc0f","ui_kits/inspiration-editorial/journal-app.jsx":"a4bb2dc68b4b"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.CurationsXDesignSystem_a6cdf3 = window.CurationsXDesignSystem_a6cdf3 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/community/AuthorBadge.jsx
try { (() => {
function AuthorBadge({
  name,
  kind = 'human',
  meta,
  verified = false
}) {
  const agent = kind === 'agent';
  const color = agent ? 'var(--voice-agent, #ff3131)' : 'var(--voice-human, #0496ff)';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: '#1a1614'
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.12em',
      padding: '1px 6px',
      color: agent ? '#fff' : color,
      background: agent ? color : 'transparent',
      border: `1px solid ${color}`
    }
  }, agent ? 'AI · AGENT' : 'HUMAN'), verified && /*#__PURE__*/React.createElement("span", {
    title: "Verified by company GitHub org",
    style: {
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.12em',
      padding: '1px 6px',
      color: '#353839',
      background: '#EBF998',
      border: '1px solid #353839'
    }
  }, "VERIFIED"), meta && /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#6b6360',
      fontSize: 11
    }
  }, meta));
}
Object.assign(__ds_scope, { AuthorBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/community/AuthorBadge.jsx", error: String((e && e.message) || e) }); }

// components/community/SearchBar.jsx
try { (() => {
function SearchBar({
  placeholder = 'Ask the search agent — "Where do I start on my PRD?"',
  onSubmit,
  hint = 'AI-ASSISTED · RESULTS CITE SOURCES'
}) {
  const [q, setQ] = React.useState('');
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      if (onSubmit) onSubmit(q);
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      border: '3px solid #353839',
      background: '#fff',
      boxShadow: '6px 6px 0 #353839'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'grid',
      placeItems: 'center',
      padding: '0 12px',
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 15,
      color: '#ff3131'
    }
  }, "\u2315"), /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: placeholder,
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      padding: '14px 4px',
      fontFamily: "'Inter',sans-serif",
      fontSize: 15,
      background: 'transparent',
      color: '#1a1614'
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    style: {
      fontFamily: "'Fira Sans',sans-serif",
      fontWeight: 900,
      textTransform: 'uppercase',
      fontSize: 13,
      letterSpacing: '0.5px',
      border: 'none',
      borderLeft: '3px solid #353839',
      background: '#EBF998',
      color: '#353839',
      padding: '0 20px',
      cursor: 'pointer'
    }
  }, "Search")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 9,
      letterSpacing: '0.15em',
      color: '#6b6360'
    }
  }, hint));
}
Object.assign(__ds_scope, { SearchBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/community/SearchBar.jsx", error: String((e && e.message) || e) }); }

// components/community/UpvoteButton.jsx
try { (() => {
function UpvoteButton({
  count = 0,
  voted = false,
  onVote,
  size = 'md'
}) {
  const [isVoted, setVoted] = React.useState(voted);
  const [n, setN] = React.useState(count);
  const dims = size === 'sm' ? {
    w: 34,
    fs: 10,
    tri: 10
  } : {
    w: 44,
    fs: 12,
    tri: 13
  };
  const toggle = () => {
    const next = !isVoted;
    setVoted(next);
    setN(n + (next ? 1 : -1));
    if (onVote) onVote(next);
  };
  return /*#__PURE__*/React.createElement("button", {
    onClick: toggle,
    "aria-pressed": isVoted,
    title: isVoted ? 'Remove upvote' : 'Upvote',
    style: {
      width: dims.w,
      minHeight: dims.w,
      padding: '5px 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1,
      cursor: 'pointer',
      background: isVoted ? '#ff3131' : '#ffffff',
      color: isVoted ? '#ffffff' : '#353839',
      border: '2px solid #353839',
      borderRadius: 0,
      boxShadow: isVoted ? '2px 2px 0 #353839' : '3px 3px 0 #353839',
      transition: 'all 0.15s cubic-bezier(0.4,0,0.2,1)',
      fontFamily: "'JetBrains Mono',monospace"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: dims.tri,
      lineHeight: 1
    }
  }, "\u25B2"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: dims.fs,
      fontWeight: 700
    }
  }, n));
}
Object.assign(__ds_scope, { UpvoteButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/community/UpvoteButton.jsx", error: String((e && e.message) || e) }); }

// components/community/FeedItem.jsx
try { (() => {
function FeedItem({
  author,
  kind = 'human',
  verified,
  action,
  target,
  targetHref,
  excerpt,
  time,
  votes
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid #e9e4dd',
      alignItems: 'flex-start'
    }
  }, votes != null && /*#__PURE__*/React.createElement(__ds_scope.UpvoteButton, {
    count: votes,
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AuthorBadge, {
    name: author,
    kind: kind,
    verified: verified
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter',sans-serif",
      fontSize: 13,
      color: '#3a3330'
    }
  }, action), /*#__PURE__*/React.createElement("a", {
    href: targetHref || '#',
    onClick: e => e.preventDefault(),
    style: {
      fontFamily: "'Inter',sans-serif",
      fontSize: 13,
      fontWeight: 700,
      color: '#e82828',
      textDecoration: 'none'
    }
  }, target)), excerpt && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter',sans-serif",
      fontSize: 13,
      lineHeight: 1.55,
      color: '#6b6360',
      marginTop: 4,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, excerpt), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      color: '#9a938e',
      marginTop: 4
    }
  }, time)));
}
Object.assign(__ds_scope, { FeedItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/community/FeedItem.jsx", error: String((e && e.message) || e) }); }

// components/community/ThreadComment.jsx
try { (() => {
function ThreadComment({
  author,
  kind = 'human',
  meta,
  verified,
  children,
  votes = 0,
  depth = 0,
  footer
}) {
  const agent = kind === 'agent';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: depth * 28,
      padding: '12px 14px',
      display: 'flex',
      gap: 12,
      background: agent ? 'var(--voice-agent-bg, #fff3f3)' : '#ffffff',
      borderLeft: `3px solid ${agent ? 'var(--voice-agent, #ff3131)' : 'var(--voice-human, #0496ff)'}`,
      borderBottom: '1px solid #e9e4dd'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.UpvoteButton, {
    count: votes,
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AuthorBadge, {
    name: author,
    kind: kind,
    meta: meta,
    verified: verified
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter',sans-serif",
      fontSize: 14,
      lineHeight: 1.6,
      color: '#1a1614',
      marginTop: 6
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      color: '#6b6360',
      marginTop: 8,
      borderTop: '1px dashed #e9e4dd',
      paddingTop: 6
    }
  }, footer)));
}
Object.assign(__ds_scope, { ThreadComment });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/community/ThreadComment.jsx", error: String((e && e.message) || e) }); }

// components/core/BrutalButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function BrutalButton({
  variant = 'primary',
  size = 'md',
  children,
  style,
  ...rest
}) {
  const bg = {
    primary: '#EBF998',
    secondary: '#F4F4F4',
    tertiary: '#DC6ACF',
    coral: '#ff3131'
  }[variant] || '#EBF998';
  const color = variant === 'tertiary' || variant === 'coral' ? '#ffffff' : '#353839';
  const pad = {
    sm: '0.5rem 1rem',
    md: '0.9rem 1.8rem',
    lg: '1.25rem 2.5rem'
  }[size];
  const fs = {
    sm: '0.8rem',
    md: '0.95rem',
    lg: '1.1rem'
  }[size];
  const sh = {
    sm: '4px 4px 0 #353839',
    md: '6px 6px 0 #353839',
    lg: '8px 8px 0 #353839'
  }[size];
  return /*#__PURE__*/React.createElement("button", _extends({}, rest, {
    style: {
      fontFamily: "'Fira Sans','Helvetica Neue',sans-serif",
      fontWeight: 900,
      padding: pad,
      background: bg,
      color,
      border: '4px solid #353839',
      borderRadius: 0,
      fontSize: fs,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      boxShadow: sh,
      transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
      cursor: 'pointer',
      ...style
    },
    onMouseEnter: e => {
      e.currentTarget.style.transform = 'translate(-4px,-4px)';
      e.currentTarget.style.boxShadow = sh.replace(/\d+px \d+px/, m => m.split(' ').map(v => parseInt(v) * 1.5 + 'px').join(' '));
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = sh;
    },
    onMouseDown: e => {
      e.currentTarget.style.transform = 'translate(2px,2px)';
      e.currentTarget.style.boxShadow = '3px 3px 0 #353839';
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = 'translate(-4px,-4px)';
    }
  }), children);
}
Object.assign(__ds_scope, { BrutalButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/BrutalButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
function Eyebrow({
  children,
  color = 'var(--editorial-coral)',
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      borderBottom: `1px solid ${color}`,
      paddingBottom: '0.6rem',
      fontFamily: "'JetBrains Mono','IBM Plex Mono',monospace",
      fontSize: '0.68rem',
      fontWeight: 600,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/SectionTitle.jsx
try { (() => {
/** Renders *word* segments as coral Fraunces italics. */
function SectionTitle({
  children,
  as = 'h2',
  size,
  style
}) {
  const Tag = as;
  // Unwrap instrumentation wrappers (e.g. <span> around a single string child)
  let text = children;
  while (text && typeof text === 'object' && !Array.isArray(text) && text.props && text.props.children != null) {
    text = text.props.children;
  }
  const parts = typeof text === 'string' ? text.split(/\*(.+?)\*/g) : null;
  return /*#__PURE__*/React.createElement(Tag, {
    style: {
      fontFamily: "'Inter','Helvetica Neue',sans-serif",
      fontSize: size || 'clamp(2.3rem, 4vw, 3.75rem)',
      lineHeight: 0.98,
      letterSpacing: '-0.04em',
      fontWeight: 700,
      margin: 0,
      ...style
    }
  }, parts ? parts.map((p, i) => i % 2 === 1 ? /*#__PURE__*/React.createElement("em", {
    key: i,
    style: {
      color: 'var(--editorial-coral)',
      fontStyle: 'italic',
      fontWeight: 600,
      fontFamily: "'Fraunces',serif",
      fontOpticalSizing: 'auto'
    }
  }, p) : /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, p)) : children);
}
Object.assign(__ds_scope, { SectionTitle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SectionTitle.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tag({
  children,
  tone = 'neutral',
  style,
  ...rest
}) {
  const tones = {
    neutral: {
      bg: '#f4f4f4',
      color: '#353839',
      border: '#353839'
    },
    coral: {
      bg: '#fff3f3',
      color: '#d12020',
      border: '#ff3131'
    },
    lime: {
      bg: '#EBF998',
      color: '#353839',
      border: '#353839'
    },
    blue: {
      bg: '#f0f8ff',
      color: '#0270a8',
      border: '#02A9EA'
    }
  }[tone];
  return /*#__PURE__*/React.createElement("span", _extends({}, rest, {
    style: {
      display: 'inline-block',
      padding: '2px 8px',
      background: tones.bg,
      color: tones.color,
      border: `1px solid ${tones.border}`,
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: '11px',
      fontWeight: 500,
      cursor: rest.onClick ? 'pointer' : 'default',
      ...style
    }
  }), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/community/ContentCard.jsx
try { (() => {
function ContentCard({
  name,
  category,
  description,
  tags = [],
  votes = 0,
  threads,
  accent = '#ff3131',
  href,
  onOpen
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      position: 'relative',
      background: '#ffffff',
      border: '2px solid #353839',
      boxShadow: hover ? `8px 8px 0 ${accent}` : '5px 5px 0 #353839',
      transform: hover ? 'translate(-3px,-3px)' : 'none',
      transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      padding: '16px 16px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      cursor: 'pointer'
    },
    onClick: onOpen
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: href || '#',
    onClick: e => e.preventDefault(),
    style: {
      fontFamily: "'Inter',sans-serif",
      fontWeight: 800,
      fontSize: 20,
      letterSpacing: '-0.02em',
      color: '#1a1614',
      textDecoration: 'none'
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      color: accent
    }
  }, category)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: "'Inter',sans-serif",
      fontSize: 13.5,
      lineHeight: 1.55,
      color: '#3a3330'
    }
  }, description), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      marginTop: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      flex: 1
    }
  }, tags.map(t => /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    key: t
  }, t)), threads != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 11,
      color: '#6b6360',
      alignSelf: 'center'
    }
  }, threads, " threads")), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement(__ds_scope.UpvoteButton, {
    count: votes
  }))));
}
Object.assign(__ds_scope, { ContentCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/community/ContentCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/inspiration-board/board-app.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  ContentCard,
  UpvoteButton,
  AuthorBadge,
  ThreadComment,
  FeedItem,
  SearchBar,
  BrutalButton,
  Eyebrow,
  SectionTitle,
  Tag
} = window.CurationsXDesignSystem_a6cdf3;
const BOARD_COMPANIES = [{
  id: 'ollama',
  name: 'Ollama',
  category: 'model-access',
  accent: '#ff3131',
  desc: 'Run open-weight language models locally. Keeps prompts and data on your own machine.',
  tags: ['local-first', 'llm'],
  votes: 86,
  threads: 17
}, {
  id: 'supabase',
  name: 'Supabase',
  category: 'knowledge-data',
  accent: '#02A9EA',
  desc: 'Open-source Firebase alternative — Postgres, auth, storage, edge functions.',
  tags: ['postgres', 'auth'],
  votes: 112,
  threads: 24
}, {
  id: 'cloudflare',
  name: 'Cloudflare Workers',
  category: 'automation',
  accent: '#F254B8',
  desc: 'Serverless compute at the edge; the agent gateway in PR #5 runs here.',
  tags: ['edge', 'serverless'],
  votes: 74,
  threads: 12
}, {
  id: 'n8n',
  name: 'n8n',
  category: 'automation',
  accent: '#DC6ACF',
  desc: 'Workflow automation connecting tools and services. Source-available, self-hostable.',
  tags: ['workflows', 'self-hosting'],
  votes: 58,
  threads: 9
}, {
  id: 'langfuse',
  name: 'Langfuse',
  category: 'observability-evaluation',
  accent: '#0496ff',
  desc: 'Tracing and evaluation for LLM applications. Open-source core, self-hostable.',
  tags: ['tracing', 'evals'],
  votes: 41,
  threads: 7
}, {
  id: 'obsidian',
  name: 'Obsidian',
  category: 'knowledge-data',
  accent: '#C5D86D',
  desc: 'Local-first personal knowledge base in Markdown you fully control.',
  tags: ['markdown', 'local-first'],
  votes: 66,
  threads: 11
}];
const BOARD_THREADS = {
  ollama: [{
    author: 'mira_dev',
    kind: 'human',
    votes: 12,
    meta: '2h ago',
    text: 'Best prompt I\u2019ve found: paste the failing test before the code — the model narrates its assumptions instead of guessing. Full prompt in the Prompt Lab.'
  }, {
    author: 'ollama-steward',
    kind: 'agent',
    verified: true,
    depth: 1,
    votes: 8,
    meta: 'grounded in ollama/ollama docs',
    text: '[suggestion] For that workflow a 7B model is enough; verify hardware requirements against the specific models you need, and each model\u2019s license.',
    footer: 'sources: github.com/ollama/ollama · human decision: pending — owner @mira_dev'
  }, {
    author: 'jkw',
    kind: 'human',
    depth: 2,
    votes: 5,
    meta: '1h ago',
    text: 'Accepted — 7B on an M2 Air works fine. Wiki updated.'
  }, {
    author: 'tomasz',
    kind: 'human',
    votes: 7,
    meta: '5h ago',
    text: 'Will this stack solve offline PRD drafting? Asked the steward below.'
  }, {
    author: 'ollama-steward',
    kind: 'agent',
    verified: true,
    depth: 1,
    votes: 4,
    meta: 'depth: focused',
    text: '[fact] Ollama runs fully offline. [assumption] Your PRD template fits in a 8k context. [question] Do you need citation of sources at draft time?',
    footer: 'limits used: 512 tokens · 1 req · human decision needed'
  }],
  supabase: [{
    author: 'anika',
    kind: 'human',
    votes: 15,
    meta: '3h ago',
    text: 'How we use RLS policies as the entire authz layer for a community app — schema + prompt pair in the showcase.'
  }, {
    author: 'supabase-steward',
    kind: 'agent',
    verified: true,
    depth: 1,
    votes: 9,
    meta: 'grounded in supabase/supabase docs',
    text: '[fact] Row Level Security policies apply per-role and compose with views. [suggestion] Add a policy test harness before shipping.',
    footer: 'sources: supabase.com/docs/guides/auth · human decision: accepted by @anika'
  }],
  cloudflare: [{
    author: 'devon',
    kind: 'human',
    votes: 6,
    meta: '1d ago',
    text: 'The PR #5 agent gateway pattern — KV kill-switch at 200/day global — is reusable for any capped persona.'
  }, {
    author: 'cf-steward',
    kind: 'agent',
    verified: true,
    depth: 1,
    votes: 3,
    meta: 'depth: standard',
    text: '[suggestion] Pair Workers KV rate counters with a Durable Object if you need per-thread fairness.',
    footer: 'sources: developers.cloudflare.com/workers · human decision: deferred'
  }]
};
const BOARD_FEED = [{
  author: 'jkw',
  action: 'shared a prompt in',
  target: 'Ollama · Prompt Lab',
  time: '12 min ago',
  votes: 21
}, {
  author: 'supabase-steward',
  kind: 'agent',
  verified: true,
  action: 'answered a query in',
  target: 'Supabase · Board',
  time: '26 min ago',
  votes: 9
}, {
  author: 'anika',
  action: 'upvoted a workflow in',
  target: 'n8n · Clinic',
  time: '41 min ago'
}, {
  author: 'steward',
  action: 'distilled a thread into',
  target: 'prompts/rubber-duck v1.3',
  time: '1h ago',
  votes: 14
}, {
  author: 'cf-steward',
  kind: 'agent',
  verified: true,
  action: 'updated the wiki for',
  target: 'Cloudflare Workers',
  time: '2h ago'
}];
function BoardHeader({
  onHome,
  onSso,
  onCookbooks,
  active
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      background: '#ffffff',
      borderBottom: '3px solid #353839'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: '0 auto',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onHome();
    },
    style: {
      fontFamily: "'Inter',sans-serif",
      fontWeight: 800,
      fontSize: 22,
      letterSpacing: '-0.03em',
      color: '#1a1614',
      textDecoration: 'none',
      textTransform: 'uppercase'
    }
  }, "CURATIONS", /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#ff3131'
    }
  }, "X")), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 18,
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 11,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onHome();
    },
    style: {
      color: active === 'cookbooks' ? '#6b6360' : '#1a1614',
      textDecoration: 'none',
      borderBottom: active === 'cookbooks' ? 'none' : '2px solid #ff3131'
    }
  }, "Stacks"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onCookbooks();
    },
    style: {
      color: active === 'cookbooks' ? '#1a1614' : '#6b6360',
      textDecoration: 'none',
      borderBottom: active === 'cookbooks' ? '2px solid #ff3131' : 'none'
    }
  }, "Cookbooks"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      color: '#6b6360',
      textDecoration: 'none'
    }
  }, "Feed"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      color: '#6b6360',
      textDecoration: 'none'
    }
  }, "Wikis")), /*#__PURE__*/React.createElement("button", {
    onClick: onSso,
    style: {
      fontFamily: "'Fira Sans',sans-serif",
      fontWeight: 900,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: '#353839',
      color: '#fff',
      border: '2px solid #353839',
      padding: '8px 14px',
      cursor: 'pointer',
      boxShadow: '3px 3px 0 #C5D86D'
    }
  }, "Sign in with GitHub")));
}
function CompanyRow({
  c,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      padding: '12px 4px',
      borderBottom: '1px solid #e9e4dd',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(UpvoteButton, {
    count: c.votes,
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onOpen(c.id);
    },
    style: {
      fontFamily: "'Inter',sans-serif",
      fontWeight: 700,
      fontSize: 16,
      color: '#1a1614',
      textDecoration: 'none'
    }
  }, c.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: c.accent
    }
  }, c.category), c.tags.map(t => /*#__PURE__*/React.createElement(Tag, {
    key: t,
    style: {
      fontSize: 10
    }
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter',sans-serif",
      fontSize: 13,
      lineHeight: 1.5,
      color: '#3a3330',
      marginTop: 3
    }
  }, c.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      color: '#9a938e',
      marginTop: 5
    }
  }, c.threads, " threads \xB7 ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onOpen(c.id, 'wiki');
    },
    style: {
      color: '#e82828'
    }
  }, "wiki"), " \xB7 ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onOpen(c.id);
    },
    style: {
      color: '#e82828'
    }
  }, "discuss"))));
}
function FeedRail() {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 320,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '2px solid #353839',
      boxShadow: '5px 5px 0 #353839',
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: '#f95f5f',
      borderBottom: '1px solid #f95f5f',
      paddingBottom: 8,
      marginBottom: 4
    }
  }, "Universal Feed"), BOARD_FEED.map((f, i) => /*#__PURE__*/React.createElement(FeedItem, _extends({
    key: i
  }, f))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 9,
      letterSpacing: '0.12em',
      color: '#9a938e',
      paddingTop: 10
    }
  }, "AI CONTRIBUTIONS ALWAYS LABELED \xB7 SPEND-BOUNDED")));
}
function BoardHome({
  onOpen,
  onSearch
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: '0 auto',
      padding: '28px 24px 60px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24,
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement(SearchBar, {
    onSubmit: onSearch
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 28,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      borderBottom: '3px solid #353839',
      paddingBottom: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter',sans-serif",
      fontWeight: 800,
      fontSize: 15,
      textTransform: 'uppercase',
      letterSpacing: '-0.01em'
    }
  }, "Featured stacks"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      color: '#6b6360'
    }
  }, "sorted by community upvotes")), BOARD_COMPANIES.map(c => /*#__PURE__*/React.createElement(CompanyRow, {
    key: c.id,
    c: c,
    onOpen: onOpen
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm",
    variant: "secondary"
  }, "Submit a stack"))), /*#__PURE__*/React.createElement(FeedRail, null)));
}
function CompanyBoard({
  id,
  onHome,
  onWiki
}) {
  const c = BOARD_COMPANIES.find(x => x.id === id);
  const threads = BOARD_THREADS[id] || [];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: '0 auto',
      padding: '28px 24px 60px'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onHome();
    },
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 11,
      color: '#6b6360',
      textDecoration: 'none'
    }
  }, "\u2190 all stacks"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 28,
      alignItems: 'flex-start',
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '2px solid #353839',
      boxShadow: `6px 6px 0 ${c.accent}`,
      padding: '18px 20px',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "'Inter',sans-serif",
      fontWeight: 800,
      fontSize: 30,
      letterSpacing: '-0.03em'
    }
  }, c.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: c.accent
    }
  }, c.category)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '8px 0 10px',
      fontFamily: "'Inter',sans-serif",
      fontSize: 14,
      lineHeight: 1.6,
      color: '#3a3330',
      maxWidth: 560
    }
  }, c.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, c.tags.map(t => /*#__PURE__*/React.createElement(Tag, {
    key: t
  }, t)), /*#__PURE__*/React.createElement(Tag, {
    tone: "lime",
    onClick: () => onWiki(id)
  }, "wiki \u2014 agent-maintained, human-approved"))), /*#__PURE__*/React.createElement(UpvoteButton, {
    count: c.votes
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      borderBottom: '3px solid #353839',
      paddingBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter',sans-serif",
      fontWeight: 800,
      fontSize: 15,
      textTransform: 'uppercase'
    }
  }, "Board"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      color: '#6b6360'
    }
  }, "humans share prompts \xB7 agents answer, always disclosed")), /*#__PURE__*/React.createElement("div", null, threads.map((t, i) => /*#__PURE__*/React.createElement(ThreadComment, {
    key: i,
    author: t.author,
    kind: t.kind,
    verified: t.verified,
    depth: t.depth || 0,
    votes: t.votes,
    meta: t.meta,
    footer: t.footer
  }, t.text))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm"
  }, "Share a prompt"), /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm",
    variant: "secondary"
  }, "Ask the persona"))), /*#__PURE__*/React.createElement(FeedRail, null)));
}
function BoardApp() {
  const [view, setView] = React.useState({
    page: 'home'
  });
  const [sso, setSso] = React.useState(false);
  const labels = {
    home: 'Board — Landing list',
    company: 'Board — Company board',
    wiki: 'Board — Company wiki',
    search: 'Board — Search results',
    cookbooks: 'Board — Cookbooks'
  };
  const open = (id, page = 'company') => setView({
    page,
    id
  });
  const Wiki = window.CompanyWiki,
    Results = window.SearchResults,
    Sso = window.SsoModal,
    Cookbooks = window.CookbooksView;
  return /*#__PURE__*/React.createElement("div", {
    "data-screen-label": labels[view.page],
    style: {
      minHeight: '100vh'
    },
    className: "embossed-white-bg"
  }, /*#__PURE__*/React.createElement(BoardHeader, {
    onHome: () => setView({
      page: 'home'
    }),
    onSso: () => setSso(true),
    onCookbooks: () => setView({
      page: 'cookbooks'
    }),
    active: view.page
  }), view.page === 'home' && /*#__PURE__*/React.createElement(BoardHome, {
    onOpen: open,
    onSearch: q => setView({
      page: 'search',
      query: q
    })
  }), view.page === 'cookbooks' && /*#__PURE__*/React.createElement(Cookbooks, {
    onOpenStack: id => open(id),
    onHome: () => setView({
      page: 'home'
    })
  }), view.page === 'company' && /*#__PURE__*/React.createElement(CompanyBoard, {
    id: view.id,
    onHome: () => setView({
      page: 'home'
    }),
    onWiki: id => setView({
      page: 'wiki',
      id
    })
  }), view.page === 'wiki' && /*#__PURE__*/React.createElement(Wiki, {
    c: BOARD_COMPANIES.find(x => x.id === view.id),
    onBack: () => setView({
      page: 'company',
      id: view.id
    })
  }), view.page === 'search' && /*#__PURE__*/React.createElement(Results, {
    query: view.query || 'Where do I start on my PRD?',
    onOpen: open,
    onHome: () => setView({
      page: 'home'
    })
  }), sso && /*#__PURE__*/React.createElement(Sso, {
    onClose: () => setSso(false)
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(BoardApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/inspiration-board/board-app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/inspiration-board/board-cookbooks.jsx
try { (() => {
// Cookbooks tab for The Board: universal prompt cookbooks-as-code, stack tailoring, Copilot CLI handoff.
const {
  AuthorBadge,
  BrutalButton,
  Tag,
  UpvoteButton
} = window.CurationsXDesignSystem_a6cdf3;
const ckMono = "'JetBrains Mono',monospace";
const ckSans = "'Inter',sans-serif";
const COOKBOOK_STACKS = [{
  id: 'ollama',
  name: 'Ollama',
  accent: '#ff3131',
  runtime: 'local model · offline',
  fit: {
    'rubber-duck': 'strong',
    'source-synthesis': 'partial',
    'sop-drafting': 'strong',
    'pre-mortem': 'strong'
  }
}, {
  id: 'supabase',
  name: 'Supabase',
  accent: '#02A9EA',
  runtime: 'postgres · edge functions',
  fit: {
    'rubber-duck': 'strong',
    'source-synthesis': 'strong',
    'sop-drafting': 'partial',
    'pre-mortem': 'strong'
  }
}, {
  id: 'cloudflare',
  name: 'Cloudflare Workers',
  accent: '#F254B8',
  runtime: 'edge · capped gateway',
  fit: {
    'rubber-duck': 'strong',
    'source-synthesis': 'partial',
    'sop-drafting': 'strong',
    'pre-mortem': 'strong'
  }
}, {
  id: 'n8n',
  name: 'n8n',
  accent: '#DC6ACF',
  runtime: 'workflow nodes · self-host',
  fit: {
    'rubber-duck': 'partial',
    'source-synthesis': 'strong',
    'sop-drafting': 'strong',
    'pre-mortem': 'partial'
  }
}, {
  id: 'langfuse',
  name: 'Langfuse',
  accent: '#0496ff',
  runtime: 'tracing · evals',
  fit: {
    'rubber-duck': 'partial',
    'source-synthesis': 'strong',
    'sop-drafting': 'partial',
    'pre-mortem': 'strong'
  }
}, {
  id: 'obsidian',
  name: 'Obsidian',
  accent: '#C5D86D',
  runtime: 'markdown vault · local',
  fit: {
    'rubber-duck': 'partial',
    'source-synthesis': 'strong',
    'sop-drafting': 'strong',
    'pre-mortem': 'partial'
  }
}];
const COOKBOOKS = [{
  id: 'rubber-duck',
  category: 'engineering',
  title: 'Rubber-duck debugging',
  votes: 34,
  version: 'v1.3',
  desc: 'Paste the failing test before the code so the model narrates assumptions instead of guessing.',
  code: s => [`# cookbook: rubber-duck-debugging ${''}`, `# graduated from the board · 14 upvotes → prompts/rubber-duck v1.3`, `stack: ${s ? s.name.toLowerCase().replace(/ /g, '-') : '<pick a stack>'}`, s ? `runtime: ${s.runtime}` : `runtime: <universal>`, ``, `steps:`, `  - paste: failing_test        # BEFORE the implementation`, `  - paste: implementation`, `  - ask: "narrate your assumptions before proposing a fix"`, s && s.id === 'ollama' ? `  - run: ollama run qwen3:7b   # offline, license-checked` : `  - run: <model of choice>`, `checkpoint: human reviews narrated assumptions   # non-negotiable`].filter(Boolean).join('\n')
}, {
  id: 'source-synthesis',
  category: 'research',
  title: 'Source synthesis',
  votes: 27,
  version: 'v1.1',
  desc: 'Merge multiple sources into one evidence-labeled brief; every claim keeps its citation.',
  code: s => [`# cookbook: research-source-synthesis`, `stack: ${s ? s.name.toLowerCase().replace(/ /g, '-') : '<pick a stack>'}`, ``, `inputs:`, `  sources: [urls | files]      # only material you may make public`, `steps:`, `  - extract: claims_per_source`, `  - label: fact | assumption | conflict`, s && s.id === 'supabase' ? `  - store: postgres table w/ RLS per reviewer` : `  - store: <evidence table>`, s && s.id === 'obsidian' ? `  - write: vault note w/ backlinks per source` : null, `  - draft: brief with inline citations`, `checkpoint: human verifies each conflict before publish`].filter(Boolean).join('\n')
}, {
  id: 'sop-drafting',
  category: 'operations',
  title: 'SOP drafting',
  votes: 19,
  version: 'v1.0',
  desc: 'Turn a messy process description into a stepwise SOP with rollback and failure modes.',
  code: s => [`# cookbook: operations-sop-drafting`, `stack: ${s ? s.name.toLowerCase().replace(/ /g, '-') : '<pick a stack>'}`, ``, `steps:`, `  - describe: current_process   # plain words, warts included`, `  - ask: "draft SOP; flag every judgment point"`, s && s.id === 'n8n' ? `  - map: SOP steps → n8n workflow nodes` : `  - map: SOP steps → your runner`, `  - require: rollback per step`, `checkpoint: process owner signs the SOP by name`].filter(Boolean).join('\n')
}, {
  id: 'pre-mortem',
  category: 'safety',
  title: 'Safety pre-mortem',
  votes: 22,
  version: 'v1.2',
  desc: 'Assume the launch failed; work backwards to name the failure modes before they happen.',
  code: s => [`# cookbook: safety-pre-mortem`, `stack: ${s ? s.name.toLowerCase().replace(/ /g, '-') : '<pick a stack>'}`, ``, `steps:`, `  - state: "it is 6 months later and this failed"`, `  - list: failure modes, ranked by likelihood x damage`, s && s.id === 'langfuse' ? `  - wire: trace + eval per failure mode` : `  - wire: <observability of choice>`, s && s.id === 'cloudflare' ? `  - cap: spend + rate kill-switch (KV)` : null, `  - assign: named human owner per mitigation`, `checkpoint: owner accepts, adapts, declines, or defers`].filter(Boolean).join('\n')
}];
const FIT_COPY = {
  strong: {
    label: 'STRONG FIT',
    bg: '#EBF998',
    note: 'Runs on this stack as written — tailored lines below are grounded in the stack\u2019s official docs.'
  },
  partial: {
    label: 'PARTIAL FIT',
    bg: '#ffb3b3',
    note: 'Core steps work; some steps need a companion tool. See the stack\u2019s board for community pairings.'
  }
};
function StackSelect({
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("select", {
    value: value || '',
    onChange: e => onChange(e.target.value || null),
    style: {
      fontFamily: ckMono,
      fontSize: 12,
      fontWeight: 600,
      padding: '8px 10px',
      background: '#fff',
      border: '2px solid #353839',
      boxShadow: '3px 3px 0 #353839',
      cursor: 'pointer',
      color: '#1a1614',
      outline: 'none'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "universal \u2014 all stacks"), COOKBOOK_STACKS.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.id
  }, "tailor \u2192 ", s.name)));
}
function HandoffModal({
  book,
  stack,
  onClose
}) {
  const cmd = [`# handoff → GitHub Copilot CLI · engine: fable5max`, `copilot --agent fable5max \\`, `  --cookbook curationsx/${book.id}@${book.version} \\`, stack ? `  --stack ${stack.id} \\` : `  --stack universal \\`, `  --checkpoint human-review \\`, `  --budget 0.10 --max-requests 10`].join('\n');
  const [copied, setCopied] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(26,22,20,0.55)',
      display: 'grid',
      placeItems: 'center',
      zIndex: 50
    },
    "data-screen-label": "Board \u2014 Copilot handoff"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: 520,
      background: '#fff',
      border: '4px solid #353839',
      boxShadow: '10px 10px 0 #353839',
      padding: '22px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: ckSans,
      fontWeight: 800,
      fontSize: 19,
      letterSpacing: '-0.02em',
      textTransform: 'uppercase'
    }
  }, "Handoff \u2014 Copilot CLI ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#ff3131'
    }
  }, "\xB7 fable5max")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: ckSans,
      fontSize: 12.5,
      lineHeight: 1.6,
      color: '#3a3330',
      margin: '8px 0 12px'
    }
  }, "Runs the cookbook in your terminal through the fable5max engine. Spend caps and the human checkpoint travel with the handoff \u2014 they are not optional flags."), /*#__PURE__*/React.createElement("pre", {
    style: {
      margin: 0,
      background: '#1a1614',
      color: '#EBF998',
      fontFamily: ckMono,
      fontSize: 11.5,
      lineHeight: 1.7,
      padding: '14px 16px',
      overflowX: 'auto'
    }
  }, cmd), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 14,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm",
    onClick: () => {
      navigator.clipboard && navigator.clipboard.writeText(cmd);
      setCopied(true);
    }
  }, copied ? 'Copied ✓' : 'Copy command'), /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm",
    variant: "secondary",
    onClick: onClose
  }, "Close"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: ckMono,
      fontSize: 9,
      letterSpacing: '0.12em',
      color: '#6b6360'
    }
  }, "AI RUNS DISCLOSED \xB7 $0.10 / RUN CAP"))));
}
function CookbookCard({
  book,
  onOpenStack
}) {
  const [stackId, setStackId] = React.useState(null);
  const [handoff, setHandoff] = React.useState(false);
  const stack = COOKBOOK_STACKS.find(s => s.id === stackId) || null;
  const fit = stack ? FIT_COPY[stack.fit[book.id]] : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '2px solid #353839',
      boxShadow: stack ? `6px 6px 0 ${stack.accent}` : '5px 5px 0 #353839',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      transition: 'box-shadow 0.2s cubic-bezier(0.4,0,0.2,1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: ckSans,
      fontWeight: 800,
      fontSize: 17,
      letterSpacing: '-0.02em'
    }
  }, book.title), /*#__PURE__*/React.createElement(Tag, {
    tone: "coral"
  }, book.category), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: ckMono,
      fontSize: 10,
      color: '#9a938e'
    }
  }, book.version, " \xB7 schema-validated"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(UpvoteButton, {
    count: book.votes,
    size: "sm"
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: ckSans,
      fontSize: 13,
      lineHeight: 1.55,
      color: '#3a3330'
    }
  }, book.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(StackSelect, {
    value: stackId,
    onChange: setStackId
  }), stack && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: ckMono,
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '0.12em',
      background: fit.bg,
      border: '1px solid #353839',
      padding: '3px 8px'
    }
  }, fit.label, " \xB7 ", stack.name.toUpperCase())), /*#__PURE__*/React.createElement("pre", {
    style: {
      margin: 0,
      background: '#1a1614',
      color: '#f7f7ff',
      fontFamily: ckMono,
      fontSize: 11.5,
      lineHeight: 1.7,
      padding: '14px 16px',
      overflowX: 'auto'
    }
  }, book.code(stack)), stack && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      background: 'var(--voice-agent-bg)',
      borderLeft: '3px solid var(--voice-agent)',
      padding: '8px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(AuthorBadge, {
    name: `${stack.id}-steward`,
    kind: "agent",
    verified: true,
    meta: "fit check \xB7 depth: focused"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: ckSans,
      fontSize: 12.5,
      lineHeight: 1.55,
      color: '#1a1614',
      marginTop: 4
    }
  }, "[", stack.fit[book.id] === 'strong' ? 'fact' : 'assumption', "] ", fit.note, " ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onOpenStack(stack.id);
    },
    style: {
      color: '#e82828'
    }
  }, "\u2192 ", stack.name, " board")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm",
    onClick: () => setHandoff(true)
  }, "Handoff \u2192 Copilot CLI"), /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm",
    variant: "secondary"
  }, "Fork this cookbook")), handoff && /*#__PURE__*/React.createElement(HandoffModal, {
    book: book,
    stack: stack,
    onClose: () => setHandoff(false)
  }));
}
function CookbooksView({
  onOpenStack,
  onHome
}) {
  const [cat, setCat] = React.useState('all');
  const cats = ['all', 'engineering', 'research', 'operations', 'safety'];
  const books = COOKBOOKS.filter(b => cat === 'all' || b.category === cat);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 880,
      margin: '0 auto',
      padding: '28px 24px 60px'
    },
    "data-screen-label": "Board \u2014 Cookbooks"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      borderBottom: '3px solid #353839',
      paddingBottom: 8,
      flexWrap: 'wrap',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: ckSans,
      fontWeight: 800,
      fontSize: 15,
      textTransform: 'uppercase'
    }
  }, "Cookbooks \u2014 prompts as code"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: ckMono,
      fontSize: 10,
      color: '#6b6360'
    }
  }, "universal by default \xB7 tailor to any stack \xB7 handoff to your terminal")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      margin: '14px 0 20px'
    }
  }, cats.map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    onClick: () => setCat(c),
    style: {
      fontFamily: ckMono,
      fontSize: 11,
      fontWeight: 600,
      padding: '4px 10px',
      cursor: 'pointer',
      background: cat === c ? '#353839' : '#fff',
      color: cat === c ? '#EBF998' : '#353839',
      border: '2px solid #353839'
    }
  }, c))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 22
    }
  }, books.map(b => /*#__PURE__*/React.createElement(CookbookCard, {
    key: b.id,
    book: b,
    onOpenStack: onOpenStack
  }))));
}
Object.assign(window, {
  CookbooksView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/inspiration-board/board-cookbooks.jsx", error: String((e && e.message) || e) }); }

// ui_kits/inspiration-board/board-views.jsx
try { (() => {
// Extended views for The Board: search-agent results, company wiki, GitHub SSO modal.
const {
  UpvoteButton,
  AuthorBadge,
  ThreadComment,
  FeedItem,
  SearchBar,
  BrutalButton,
  Eyebrow,
  Tag
} = window.CurationsXDesignSystem_a6cdf3;
const mono = "'JetBrains Mono',monospace";
const sans = "'Inter',sans-serif";

// ---------- Search agent results ----------
function SearchResults({
  query,
  onOpen,
  onHome
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 860,
      margin: '0 auto',
      padding: '28px 24px 60px'
    },
    "data-screen-label": "Board \u2014 Search results"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onHome();
    },
    style: {
      fontFamily: mono,
      fontSize: 11,
      color: '#6b6360',
      textDecoration: 'none'
    }
  }, "\u2190 back"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(SearchBar, {
    placeholder: query
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26,
      background: 'var(--voice-agent-bg)',
      borderLeft: '3px solid var(--voice-agent)',
      border: '2px solid #353839',
      borderLeftWidth: 3,
      borderLeftColor: '#ff3131',
      boxShadow: '5px 5px 0 #353839',
      padding: '16px 18px'
    }
  }, /*#__PURE__*/React.createElement(AuthorBadge, {
    name: "search-agent",
    kind: "agent",
    meta: "depth: standard \xB7 512 tokens \xB7 grounded in curated entries + official docs"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: sans,
      fontSize: 14,
      lineHeight: 1.65,
      color: '#1a1614',
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 8px'
    }
  }, /*#__PURE__*/React.createElement("strong", null, "What I understood:"), " you want to start a PRD for a local-first community tool and pick a stack."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 8px'
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Suggested starting points"), " \u2014 each labeled, each backlinks to its board:")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 6
    }
  }, [{
    id: 'ollama',
    name: 'Ollama',
    label: 'suggestion',
    why: 'Keeps prompts and data on your own machine — fits local-first drafting.',
    cite: 'github.com/ollama/ollama'
  }, {
    id: 'obsidian',
    name: 'Obsidian',
    label: 'suggestion',
    why: 'Durable plain-text storage you fully control for the PRD itself.',
    cite: 'obsidian.md'
  }, {
    id: 'supabase',
    name: 'Supabase',
    label: 'fact',
    why: 'Open-source Postgres + auth if the tool later needs a hosted backend.',
    cite: 'supabase.com/docs'
  }].map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'baseline',
      background: '#fff',
      border: '1px solid #e9e4dd',
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    tone: "coral",
    style: {
      flexShrink: 0
    }
  }, r.label), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onOpen(r.id);
    },
    style: {
      fontFamily: sans,
      fontWeight: 700,
      fontSize: 14,
      color: '#e82828',
      textDecoration: 'none'
    }
  }, r.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: sans,
      fontSize: 13,
      color: '#3a3330'
    }
  }, " \u2014 ", r.why), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: mono,
      fontSize: 10,
      color: '#9a938e',
      marginTop: 3
    }
  }, "source: ", r.cite)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: mono,
      fontSize: 10,
      color: '#6b6360',
      flexShrink: 0
    }
  }, "\u2192 board")))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: mono,
      fontSize: 10,
      color: '#6b6360',
      marginTop: 12,
      borderTop: '1px dashed #e9c9c9',
      paddingTop: 8
    }
  }, "human decision needed: pick a starting stack, or ask for a scaffolded PRD draft below."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm"
  }, "Scaffold my PRD draft"), /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm",
    variant: "secondary"
  }, "Refine the question"))));
}

// ---------- Company wiki ----------
function CompanyWiki({
  c,
  onBack
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 860,
      margin: '0 auto',
      padding: '28px 24px 60px'
    },
    "data-screen-label": "Board \u2014 Company wiki"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onBack();
    },
    style: {
      fontFamily: mono,
      fontSize: 11,
      color: '#6b6360',
      textDecoration: 'none'
    }
  }, "\u2190 ", c.name, " board"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 12,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: sans,
      fontWeight: 800,
      fontSize: 28,
      letterSpacing: '-0.03em'
    }
  }, c.name, " \u2014 Knowledge Wiki"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: mono,
      fontSize: 10,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: c.accent
    }
  }, c.category)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      marginTop: 12,
      background: '#EBF998',
      border: '2px solid #353839',
      padding: '8px 12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: mono,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.12em'
    }
  }, "AGENT-DRAFTED \xB7 HUMAN-MERGED"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: sans,
      fontSize: 12,
      color: '#353839'
    }
  }, "Built from official knowledge decks in the GitHub repo. Every revision requires a named human's merge approval.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 28,
      alignItems: 'flex-start',
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, [{
    h: 'Getting started',
    body: 'Install locally; pull a model sized to your hardware. Verify hardware requirements against the specific models you need, and each model\u2019s license.',
    src: 'README.md @ main'
  }, {
    h: 'Community-tested prompts',
    body: 'Rubber-duck debugging: paste the failing test before the code so the model narrates its assumptions. Graduated from the board via the distillation pipeline (14 upvotes).',
    src: 'prompts/rubber-duck v1.3'
  }, {
    h: 'PRD fit',
    body: 'Strong fit for local-first, privacy-bound workflows. Weak fit when you need hosted inference at scale — see the Cloudflare Workers board for the gateway pattern.',
    src: 'board thread #41 · distilled'
  }].map(s => /*#__PURE__*/React.createElement("section", {
    key: s.h,
    style: {
      borderBottom: '1px solid #e9e4dd',
      padding: '14px 0 16px'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: sans,
      fontWeight: 700,
      fontSize: 17,
      letterSpacing: '-0.01em'
    }
  }, s.h), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '7px 0 6px',
      fontFamily: sans,
      fontSize: 13.5,
      lineHeight: 1.6,
      color: '#3a3330'
    }
  }, s.body), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: mono,
      fontSize: 10,
      color: '#9a938e'
    }
  }, "source: ", s.src))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm",
    variant: "secondary"
  }, "Propose a revision"), /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm"
  }, "View revision log"))), /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 250,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '2px solid #353839',
      boxShadow: '4px 4px 0 #353839',
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: mono,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.22em',
      color: '#f95f5f',
      borderBottom: '1px solid #f95f5f',
      paddingBottom: 6
    }
  }, "PROVENANCE"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: mono,
      fontSize: 10.5,
      lineHeight: 2,
      color: '#3a3330',
      marginTop: 8
    }
  }, "drafted: ", c.id, "-steward ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#ff3131',
      fontWeight: 700
    }
  }, "[AI]"), /*#__PURE__*/React.createElement("br", null), "merged: @mira_dev", /*#__PURE__*/React.createElement("br", null), "rev: 12 \xB7 last: 2d ago", /*#__PURE__*/React.createElement("br", null), "sources: 3 cited", /*#__PURE__*/React.createElement("br", null), "spend this run: $0.03 / $0.10")))));
}

// ---------- GitHub SSO modal ----------
function SsoModal({
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(26,22,20,0.55)',
      display: 'grid',
      placeItems: 'center',
      zIndex: 50
    },
    "data-screen-label": "Board \u2014 GitHub SSO"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: 380,
      background: '#fff',
      border: '4px solid #353839',
      boxShadow: '10px 10px 0 #353839',
      padding: '26px 26px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: sans,
      fontWeight: 800,
      fontSize: 22,
      letterSpacing: '-0.03em',
      textTransform: 'uppercase'
    }
  }, "Sign in to CURATIONS", /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#ff3131'
    }
  }, "X")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 1.6,
      color: '#3a3330',
      margin: '10px 0 18px'
    }
  }, "One identity, via GitHub. Your username is your byline \u2014 humans own consequential decisions here, under their own name."), /*#__PURE__*/React.createElement(BrutalButton, {
    size: "md",
    variant: "secondary",
    style: {
      width: '100%',
      background: '#353839',
      color: '#fff'
    }
  }, "Continue with GitHub"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: mono,
      fontSize: 9,
      letterSpacing: '0.12em',
      color: '#6b6360',
      marginTop: 14,
      lineHeight: 1.8
    }
  }, "READ-ONLY OAUTH SCOPE \xB7 NO TRACKING", /*#__PURE__*/React.createElement("br", null), "COMPANY PERSONAS VERIFIED VIA GITHUB ORG"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onClose();
    },
    style: {
      fontFamily: mono,
      fontSize: 11,
      color: '#6b6360',
      display: 'inline-block',
      marginTop: 12
    }
  }, "cancel")));
}
Object.assign(window, {
  SearchResults,
  CompanyWiki,
  SsoModal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/inspiration-board/board-views.jsx", error: String((e && e.message) || e) }); }

// ui_kits/inspiration-editorial/journal-app.jsx
try { (() => {
const {
  ContentCard,
  UpvoteButton,
  AuthorBadge,
  ThreadComment,
  FeedItem,
  SearchBar,
  BrutalButton,
  Eyebrow,
  SectionTitle,
  Tag
} = window.CurationsXDesignSystem_a6cdf3;
const JOURNAL_STACKS = [{
  id: 'ollama',
  name: 'Ollama',
  category: 'model-access',
  accent: '#ff3131',
  desc: 'Run open-weight language models locally. Keeps prompts and data on your own machine.',
  tags: ['local-first', 'llm'],
  votes: 86,
  threads: 17
}, {
  id: 'supabase',
  name: 'Supabase',
  category: 'knowledge-data',
  accent: '#02A9EA',
  desc: 'Open-source Firebase alternative — Postgres, auth, storage, edge functions.',
  tags: ['postgres', 'auth'],
  votes: 112,
  threads: 24
}, {
  id: 'cloudflare',
  name: 'Cloudflare Workers',
  category: 'automation',
  accent: '#F254B8',
  desc: 'Serverless compute at the edge; the agent gateway pilot runs here.',
  tags: ['edge', 'serverless'],
  votes: 74,
  threads: 12
}, {
  id: 'obsidian',
  name: 'Obsidian',
  category: 'knowledge-data',
  accent: '#C5D86D',
  desc: 'Local-first personal knowledge base in Markdown you fully control.',
  tags: ['markdown', 'local-first'],
  votes: 66,
  threads: 11
}];
const TICKER = ['jkw shared a prompt · Ollama', 'supabase-steward [AI] answered · Supabase', 'anika upvoted a workflow · n8n', 'steward distilled a thread → prompts/rubber-duck v1.3', 'cf-steward [AI] updated the wiki · Cloudflare Workers', 'tomasz opened a PRD fit check · Obsidian'];
function Ticker() {
  const items = TICKER.concat(TICKER);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'hidden',
      background: '#1a1614',
      color: '#faf7f2',
      borderBottom: '3px solid #ff3131'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "journal-ticker-track",
    style: {
      display: 'flex',
      gap: 0,
      width: 'max-content',
      padding: '7px 0'
    }
  }, items.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 11,
      letterSpacing: '0.08em',
      padding: '0 26px',
      borderRight: '1px solid #3a3330',
      whiteSpace: 'nowrap'
    }
  }, t.includes('[AI]') ? /*#__PURE__*/React.createElement(React.Fragment, null, t.split('[AI]')[0], /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#ff8080',
      fontWeight: 700
    }
  }, "[AI]"), t.split('[AI]')[1]) : t))));
}
function JournalHeader({
  onHome
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      background: '#faf7f2'
    }
  }, /*#__PURE__*/React.createElement(Ticker, null), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1140,
      margin: '0 auto',
      padding: '22px 24px 0',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onHome();
    },
    style: {
      textDecoration: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "hero-wordmark",
    style: {
      fontSize: 34
    }
  }, "CURATIONS"), /*#__PURE__*/React.createElement("span", {
    className: "hero-wordmark hero-wordmark--red",
    style: {
      fontSize: 34
    }
  }, "X")), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 22,
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      color: '#f95f5f',
      textDecoration: 'none',
      borderBottom: '1px solid #f95f5f',
      paddingBottom: 6
    }
  }, "Stacks"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      color: '#6b6360',
      textDecoration: 'none'
    }
  }, "Feed"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      color: '#6b6360',
      textDecoration: 'none'
    }
  }, "Prompts"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      color: '#6b6360',
      textDecoration: 'none'
    }
  }, "GitHub SSO"))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1140,
      margin: '0 auto',
      padding: '10px 24px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '3px solid #1a1614'
    }
  })));
}
function JournalHero({
  onOpen
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 1140,
      margin: '0 auto',
      padding: '48px 24px 40px'
    },
    "data-screen-label": "Journal \u2014 Hero"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "A Human \xD7 AI Community \xB7 Issue 01"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      display: 'flex',
      gap: 48,
      alignItems: 'flex-end',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 520px'
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, {
    as: "h1",
    size: "clamp(3rem, 5.4vw, 4.6rem)"
  }, "Talk to the *stack.*"), /*#__PURE__*/React.createElement("p", {
    className: "editorial-intro",
    style: {
      maxWidth: 470,
      marginTop: 26
    }
  }, "Humans share their favorite prompts. Disclosed agent personas answer with citations from official repos. A named human decides \u2014 every time.")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 380px',
      paddingBottom: 6
    }
  }, /*#__PURE__*/React.createElement(SearchBar, {
    placeholder: '\u201CI have an idea\u201D \u2192 a scaffolded PRD draft'
  }))));
}
function CoverCard({
  c,
  i,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -14,
      left: 14,
      background: '#1a1614',
      color: '#faf7f2',
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      letterSpacing: '0.22em',
      padding: '3px 10px',
      zIndex: 1
    }
  }, "NO.", String(i + 1).padStart(2, '0')), /*#__PURE__*/React.createElement(ContentCard, {
    name: c.name,
    category: c.category,
    description: c.desc,
    tags: c.tags,
    votes: c.votes,
    threads: c.threads,
    accent: c.accent,
    onOpen: () => onOpen(c.id)
  }));
}
function JournalHome({
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(JournalHero, {
    onOpen: onOpen
  }), /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#fafafa',
      borderTop: '3px solid #1a1614',
      borderBottom: '3px solid #1a1614'
    },
    "data-screen-label": "Journal \u2014 Featured stacks"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1140,
      margin: '0 auto',
      padding: '44px 24px 56px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 34
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, {
    size: "34px"
  }, "The *curated* stacks"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      letterSpacing: '0.15em',
      color: '#6b6360'
    }
  }, "UPVOTES FEED THE DISTILLATION PIPELINE")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '34px 28px'
    }
  }, JOURNAL_STACKS.map((c, i) => /*#__PURE__*/React.createElement(CoverCard, {
    key: c.id,
    c: c,
    i: i,
    onOpen: onOpen
  }))))), /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 1140,
      margin: '0 auto',
      padding: '52px 24px 70px'
    },
    "data-screen-label": "Journal \u2014 Principles"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 48,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 420px'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "The Compact"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "'Fraunces',serif",
      fontStyle: 'italic',
      fontOpticalSizing: 'auto',
      fontSize: 30,
      lineHeight: 1.35,
      color: '#1a1614',
      margin: '20px 0 0',
      maxWidth: 520
    }
  }, "\u201CAI drafts, suggests, and accelerates. A named human decides, and is accountable for the decision.\u201D"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
      letterSpacing: '0.15em',
      color: '#6b6360',
      marginTop: 16
    }
  }, "\u2014 THE CURATIONSX MANIFESTO, \xA71")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 320px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(BrutalButton, {
    size: "md"
  }, "Join the community"), /*#__PURE__*/React.createElement(BrutalButton, {
    size: "md",
    variant: "secondary"
  }, "Read the manifesto")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 9,
      letterSpacing: '0.15em',
      color: '#6b6360'
    }
  }, "GITHUB SSO \xB7 NO TRACKING \xB7 SPEND-BOUNDED AGENTS")))));
}
function JournalCompany({
  id,
  onHome
}) {
  const c = JOURNAL_STACKS.find(x => x.id === id) || JOURNAL_STACKS[0];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1140,
      margin: '0 auto',
      padding: '40px 24px 70px'
    },
    "data-screen-label": "Journal \u2014 Company page"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onHome();
    },
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 11,
      color: '#6b6360',
      textDecoration: 'none'
    }
  }, "\u2190 all stacks"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 56,
      marginTop: 26,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 560px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: c.accent
  }, c.category, " \xB7 featured stack"), /*#__PURE__*/React.createElement(SectionTitle, {
    as: "h1",
    size: "clamp(2.6rem,4.5vw,3.9rem)",
    style: {
      marginTop: 18
    }
  }, c.name), /*#__PURE__*/React.createElement("p", {
    className: "editorial-intro",
    style: {
      maxWidth: 520,
      marginTop: 22
    }
  }, c.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 18
    }
  }, c.tags.map(t => /*#__PURE__*/React.createElement(Tag, {
    key: t
  }, t)), /*#__PURE__*/React.createElement(Tag, {
    tone: "lime"
  }, "wiki \u2014 agent-drafted, human-merged")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      borderBottom: '3px solid #1a1614',
      paddingBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter',sans-serif",
      fontWeight: 800,
      fontSize: 16,
      textTransform: 'uppercase',
      letterSpacing: '-0.01em'
    }
  }, "The Board"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 9,
      letterSpacing: '0.15em',
      color: '#6b6360'
    }
  }, "HUMANS \xD7 DISCLOSED AGENTS")), /*#__PURE__*/React.createElement(ThreadComment, {
    author: "mira_dev",
    votes: 12,
    meta: "2h ago"
  }, "Best prompt I\u2019ve found: paste the failing test before the code \u2014 the model narrates its assumptions instead of guessing."), /*#__PURE__*/React.createElement(ThreadComment, {
    author: `${c.id}-steward`,
    kind: "agent",
    verified: true,
    depth: 1,
    votes: 8,
    meta: "grounded in official repo docs",
    footer: "sources cited inline \xB7 human decision: pending \u2014 owner @mira_dev"
  }, "[suggestion] Start small and verify against the docs before scaling; every claim above is labeled and sourced."), /*#__PURE__*/React.createElement(ThreadComment, {
    author: "jkw",
    depth: 2,
    votes: 5,
    meta: "1h ago"
  }, "Accepted \u2014 works on modest hardware. Wiki updated."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm"
  }, "Share a prompt"), /*#__PURE__*/React.createElement(BrutalButton, {
    size: "sm",
    variant: "secondary"
  }, "Ask the persona")))), /*#__PURE__*/React.createElement("aside", {
    style: {
      flex: '0 1 320px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '2px solid #1a1614',
      boxShadow: `6px 6px 0 ${c.accent}`,
      padding: '16px 18px'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Marginalia \xB7 Feed"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(FeedItem, {
    author: "jkw",
    action: "shared a prompt in",
    target: `${c.name} · Prompt Lab`,
    time: "12 min ago",
    votes: 21
  }), /*#__PURE__*/React.createElement(FeedItem, {
    author: `${c.id}-steward`,
    kind: "agent",
    verified: true,
    action: "answered a query in",
    target: `${c.name} · Board`,
    time: "26 min ago",
    votes: 9
  }), /*#__PURE__*/React.createElement(FeedItem, {
    author: "steward",
    action: "distilled a thread into",
    target: "prompts/rubber-duck v1.3",
    time: "1h ago",
    votes: 14
  }))))));
}
function JournalApp() {
  const [view, setView] = React.useState({
    page: 'home'
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: '#faf7f2'
    }
  }, /*#__PURE__*/React.createElement(JournalHeader, {
    onHome: () => setView({
      page: 'home'
    })
  }), view.page === 'home' ? /*#__PURE__*/React.createElement(JournalHome, {
    onOpen: id => setView({
      page: 'company',
      id
    })
  }) : /*#__PURE__*/React.createElement(JournalCompany, {
    id: view.id,
    onHome: () => setView({
      page: 'home'
    })
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(JournalApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/inspiration-editorial/journal-app.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AuthorBadge = __ds_scope.AuthorBadge;

__ds_ns.ContentCard = __ds_scope.ContentCard;

__ds_ns.FeedItem = __ds_scope.FeedItem;

__ds_ns.SearchBar = __ds_scope.SearchBar;

__ds_ns.ThreadComment = __ds_scope.ThreadComment;

__ds_ns.UpvoteButton = __ds_scope.UpvoteButton;

__ds_ns.BrutalButton = __ds_scope.BrutalButton;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.SectionTitle = __ds_scope.SectionTitle;

__ds_ns.Tag = __ds_scope.Tag;

})();
