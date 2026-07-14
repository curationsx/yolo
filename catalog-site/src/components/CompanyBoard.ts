import {
  authHeaders,
  beginGithubSignIn,
  getSessionToken,
} from '../lib/browser-auth';

interface BoardComment {
  id: string;
  kind: 'comment';
  tool_id: string;
  thread_id: string;
  parent_id: string | null;
  body: string;
  author_type: 'human' | 'agent';
  author_name: string;
  author_login: string | null;
  author_avatar: string | null;
  author_url: string | null;
  author_disclosure: string | null;
  created_at: string;
  score: number;
  viewer_voted: boolean;
}

interface RepositoryCheck {
  path: string;
  label: string;
  matched: boolean;
}

interface RepositoryEvidence {
  url: string;
  owner: string;
  name: string;
  description: string | null;
  default_branch: string | null;
  stars: number | null;
  archived: boolean | null;
  fork: boolean | null;
  stack_path: string | null;
  submitter_matches_owner: boolean;
  automated_status: 'verified' | 'partial' | 'unverified';
  checks: RepositoryCheck[];
  checked_at: string;
  note: string;
}

interface BoardThread {
  id: string;
  kind: 'thread';
  tool_id: string;
  title: string;
  body: string;
  tags: string[];
  author_type: 'human' | 'agent';
  author_name: string;
  author_login: string | null;
  author_avatar: string | null;
  author_url: string | null;
  author_disclosure: string | null;
  created_at: string;
  score: number;
  viewer_voted: boolean;
  comments: BoardComment[];
  artifact_kind?: 'discussion' | 'public-prd';
  repository?: RepositoryEvidence | null;
  prd_url?: string | null;
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function relativeTime(value: string): string {
  const delta = Math.max(0, Date.now() - Date.parse(value));
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d` : new Date(value).toLocaleDateString();
}

function authorLine(
  item: Pick<
    BoardThread,
    | 'author_type'
    | 'author_name'
    | 'author_login'
    | 'author_avatar'
    | 'author_url'
    | 'author_disclosure'
    | 'created_at'
  >,
): HTMLElement {
  const line = node('div', 'discussion-byline');
  if (item.author_avatar) {
    const avatar = node('img', 'discussion-avatar');
    avatar.src = item.author_avatar;
    avatar.alt = '';
    avatar.width = 22;
    avatar.height = 22;
    line.append(avatar);
  } else {
    line.append(node('span', 'agent-avatar', 'AI'));
  }

  const identity = item.author_url ? node('a', 'discussion-author') : node('strong', 'discussion-author');
  identity.textContent = item.author_login ? `@${item.author_login}` : item.author_name;
  if (identity instanceof HTMLAnchorElement && item.author_url) {
    identity.href = item.author_url;
    identity.rel = 'noopener';
  }
  line.append(identity);
  if (item.author_type === 'agent') line.append(node('span', 'badge badge-ai', 'AI persona'));
  line.append(node('time', 'discussion-time', relativeTime(item.created_at)));
  if (item.author_disclosure) {
    const disclosure = node('span', 'discussion-disclosure', item.author_disclosure);
    disclosure.title = item.author_disclosure;
    line.append(disclosure);
  }
  return line;
}

function voteButton(
  api: string,
  target: string,
  score: number,
  voted: boolean,
  label: string,
): HTMLButtonElement {
  const button = node('button', 'discussion-vote');
  button.type = 'button';
  button.dataset.target = target;
  button.setAttribute('aria-pressed', String(voted));
  button.setAttribute('aria-label', `${voted ? 'Remove upvote from' : 'Upvote'} ${label}; ${score} votes`);
  button.title = voted ? 'Remove your upvote' : 'Upvote';
  const arrow = node('span', 'discussion-vote-arrow', voted ? '▲' : '△');
  arrow.setAttribute('aria-hidden', 'true');
  const count = node('strong', '', String(score));
  button.append(arrow, count);

  button.addEventListener('click', async () => {
    if (!getSessionToken()) {
      beginGithubSignIn(api);
      return;
    }
    button.disabled = true;
    try {
      const voted = button.getAttribute('aria-pressed') !== 'true';
      const response = await fetch(`${api}/api/votes/set`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ target_id: target, voted }),
      });
      if (response.status === 401) {
        beginGithubSignIn(api);
        return;
      }
      if (!response.ok) return;
      const result = (await response.json()) as { voted: boolean; count: number };
      button.setAttribute('aria-pressed', String(result.voted));
      button.setAttribute(
        'aria-label',
        `${result.voted ? 'Remove upvote from' : 'Upvote'} ${label}; ${result.count} votes`,
      );
      arrow.textContent = result.voted ? '▲' : '△';
      count.textContent = String(result.count);
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

function verificationLabel(status: RepositoryEvidence['automated_status']): string {
  if (status === 'verified') return 'STACK MARKER FOUND';
  if (status === 'partial') return 'REPOSITORY FOUND · MARKER OPEN';
  return 'AUTOMATION UNAVAILABLE';
}

function repositoryProof(thread: BoardThread): HTMLElement | null {
  if (thread.artifact_kind !== 'public-prd' || !thread.repository) return null;
  const repository = thread.repository;
  const proof = node('section', 'repository-proof');

  const heading = node('div', 'repository-proof-heading');
  const kind = node('span', 'badge repository-kind', 'PUBLIC PRD');
  const status = node(
    'span',
    `badge repository-status is-${repository.automated_status}`,
    verificationLabel(repository.automated_status),
  );
  heading.append(kind, status);
  if (repository.submitter_matches_owner) {
    heading.append(node('span', 'badge repository-owner-match', 'GITHUB OWNER MATCH'));
  } else {
    heading.append(node('span', 'badge', 'COMMUNITY SUBMISSION'));
  }
  proof.append(heading);

  const repo = node('a', 'repository-link', `${repository.owner}/${repository.name}`);
  repo.href = repository.url;
  repo.rel = 'noopener';
  repo.target = '_blank';
  proof.append(repo);

  const meta = node('p', 'repository-meta');
  const signals = [
    repository.stars === null
      ? null
      : `${repository.stars.toLocaleString()} GitHub stars`,
    repository.fork ? 'fork' : null,
    repository.archived ? 'archived' : null,
  ].filter(Boolean);
  meta.textContent = signals.join(' · ') || 'Public GitHub metadata unavailable';
  proof.append(meta);
  if (repository.stack_path) {
    proof.append(node('p', 'repository-meta', `Stack root: ${repository.stack_path}`));
  }

  if (repository.description) {
    proof.append(node('p', 'repository-description', repository.description));
  }

  const matched = repository.checks.filter((check) => check.matched);
  if (matched.length) {
    const checks = node('ul', 'repository-checks');
    for (const check of matched) {
      const item = node('li');
      item.append(
        node('strong', '', check.label),
        document.createTextNode(` · ${check.path}`),
      );
      checks.append(item);
    }
    proof.append(checks);
  }

  const note = node('p', 'repository-note', repository.note);
  proof.append(note);
  if (thread.prd_url) {
    const prd = node('a', 'repository-prd-link', 'Open the public PRD ->');
    prd.href = thread.prd_url;
    prd.rel = 'noopener';
    prd.target = '_blank';
    proof.append(prd);
  }
  return proof;
}

function renderPrdRail(target: HTMLElement, threads: BoardThread[]): void {
  const rank: Record<RepositoryEvidence['automated_status'], number> = {
    verified: 2,
    partial: 1,
    unverified: 0,
  };
  const publicPrds = threads
    .filter(
      (thread): thread is BoardThread & { repository: RepositoryEvidence } =>
        thread.artifact_kind === 'public-prd' && Boolean(thread.repository),
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        rank[b.repository.automated_status] - rank[a.repository.automated_status] ||
        (b.repository.stars ?? -1) - (a.repository.stars ?? -1) ||
        b.created_at.localeCompare(a.created_at),
    )
    .slice(0, 3);

  if (!publicPrds.length) {
    target.replaceChildren(
      node(
        'p',
        'board-empty',
        'No public PRD evidence yet. Share the first public repository for this stack.',
      ),
    );
    return;
  }

  target.replaceChildren(
    ...publicPrds.map((thread, index) => {
      const card = node('article', 'prd-proof-card');
      const rankNumber = node('span', 'prd-proof-rank', String(index + 1).padStart(2, '0'));
      const body = node('div');
      const label = node(
        'span',
        `badge repository-status is-${thread.repository.automated_status}`,
        verificationLabel(thread.repository.automated_status),
      );
      const title = node('a', 'prd-proof-title', thread.title);
      title.href = `#discussion-${thread.id}`;
      const repo = node(
        'a',
        'prd-proof-repo',
        `${thread.repository.owner}/${thread.repository.name}`,
      );
      repo.href = thread.repository.url;
      repo.rel = 'noopener';
      repo.target = '_blank';
      const signals = node(
        'p',
        'prd-proof-signals',
        `▲ ${thread.score} community upvote${thread.score === 1 ? '' : 's'} · ` +
          (thread.repository.stars === null
            ? 'GitHub stars unavailable'
            : `★ ${thread.repository.stars.toLocaleString()} GitHub stars`),
      );
      body.append(label, title, repo, signals);
      card.append(rankNumber, body);
      return card;
    }),
  );
}

function renderCommentTree(
  api: string,
  comments: BoardComment[],
  parentId: string | null,
  onReply: (comment: BoardComment) => void,
  depth = 0,
): HTMLElement {
  const list = node('ol', 'comment-tree');
  for (const comment of comments.filter((item) => item.parent_id === parentId)) {
    const item = node('li', 'discussion-comment');
    item.style.setProperty('--comment-depth', String(Math.min(depth, 5)));

    const score = node('div', 'comment-score-rail');
    score.append(
      voteButton(
        api,
        `comment:${comment.tool_id}:${comment.id}`,
        comment.score,
        comment.viewer_voted,
        `reply by ${comment.author_name}`,
      ),
    );

    const content = node('div', 'comment-content');
    content.append(authorLine(comment), node('p', 'comment-body', comment.body));
    const reply = node('button', 'comment-reply', 'reply');
    reply.type = 'button';
    reply.addEventListener('click', () => onReply(comment));
    content.append(reply);

    const children = renderCommentTree(api, comments, comment.id, onReply, depth + 1);
    if (children.childElementCount) content.append(children);
    item.append(score, content);
    list.append(item);
  }
  return list;
}

function renderThread(
  root: HTMLElement,
  thread: BoardThread,
  api: string,
  tool: string,
  personaName: string,
): HTMLElement {
  const story = node('article', 'discussion-story');
  story.id = `discussion-${thread.id}`;
  story.dataset.score = String(thread.score);
  story.dataset.created = thread.created_at;
  story.dataset.publicPrd = String(thread.artifact_kind === 'public-prd');
  story.dataset.agentInLoop = String(
    thread.author_type === 'agent' ||
      thread.comments.some((comment) => comment.author_type === 'agent'),
  );

  const rail = node('div', 'story-score-rail');
  rail.append(
    voteButton(
      api,
      `discussion:${thread.tool_id}:${thread.id}`,
      thread.score,
      thread.viewer_voted,
      `${thread.artifact_kind === 'public-prd' ? 'public PRD' : 'discussion'} ${thread.title}`,
    ),
  );

  const main = node('div', 'discussion-main');
  const heading = node('h3', 'discussion-title', thread.title);
  main.append(heading, authorLine(thread));

  if (thread.tags.length) {
    const tags = node('div', 'discussion-tags');
    for (const tag of thread.tags) tags.append(node('span', 'badge', tag));
    main.append(tags);
  }
  const proof = repositoryProof(thread);
  if (proof) main.append(proof);
  main.append(node('p', 'discussion-body', thread.body));

  const controls = node('div', 'discussion-controls');
  const toggle = node(
    'button',
    'discussion-toggle',
    `${thread.comments.length} ${thread.comments.length === 1 ? 'reply' : 'replies'}`,
  );
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  controls.append(toggle);
  main.append(controls);

  const threadPanel = node('div', 'thread-panel');
  threadPanel.hidden = true;

  let replyTo: BoardComment | null = null;
  const replyContext = node('p', 'reply-context muted', `Replying to ${thread.author_name}`);
  const replyForm = node('form', 'discussion-reply-form');
  const textarea = node('textarea');
  textarea.name = 'body';
  textarea.rows = 3;
  textarea.maxLength = 3000;
  textarea.required = true;
  textarea.placeholder = 'Add a useful, specific reply…';
  textarea.setAttribute('aria-label', `Reply to ${thread.title}`);
  const inviteLabel = node('label', 'check-row');
  const invite = node('input');
  invite.type = 'checkbox';
  invite.name = 'invite_agent';
  inviteLabel.append(invite, document.createTextNode(` Invite ${personaName} into this reply`));
  const actionRow = node('div', 'form-action-row');
  const submit = node('button', 'btn btn-primary', 'Post reply');
  submit.type = 'submit';
  const status = node('span', 'reply-status');
  actionRow.append(submit, status);
  replyForm.append(replyContext, textarea, inviteLabel, actionRow);

  const renderReplies = (): void => {
    threadPanel.replaceChildren();
    const tree = renderCommentTree(api, thread.comments, null, (comment) => {
      replyTo = comment;
      replyContext.textContent = `Replying to ${comment.author_name}`;
      textarea.focus();
    });
    if (tree.childElementCount) threadPanel.append(tree);
    threadPanel.append(replyForm);
  };
  renderReplies();

  toggle.addEventListener('click', () => {
    threadPanel.hidden = !threadPanel.hidden;
    toggle.setAttribute('aria-expanded', String(!threadPanel.hidden));
    if (!threadPanel.hidden) textarea.focus();
  });

  replyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!getSessionToken()) {
      beginGithubSignIn(api);
      return;
    }
    submit.disabled = true;
    status.textContent = 'Publishing…';
    try {
      const response = await fetch(`${api}/api/discussions/comment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          tool_id: tool,
          thread_id: thread.id,
          parent_id: replyTo?.id ?? null,
          body: textarea.value,
          invite_agent: invite.checked,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        status.textContent = result.error ?? 'Reply could not be published.';
        return;
      }
      textarea.value = '';
      replyTo = null;
      document.dispatchEvent(
        new CustomEvent('curations:discussion', { detail: { tool } }),
      );
    } catch {
      status.textContent = 'Network error—please retry.';
    } finally {
      submit.disabled = false;
    }
  });

  story.append(rail, main, threadPanel);
  return story;
}

export function initCompanyBoards(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-company-board]')) {
    if (root.dataset.initialized === 'true') continue;
    root.dataset.initialized = 'true';

    const api = root.dataset.api ?? '';
    const tool = root.dataset.tool ?? '';
    const personaName = root.dataset.personaName ?? 'Company guide';
    const list = root.querySelector<HTMLElement>('[data-board-list]')!;
    const prdRail = root.querySelector<HTMLElement>('[data-prd-rail]')!;
    const compose = root.querySelector<HTMLFormElement>('[data-board-compose-form]')!;
    const composeStatus = root.querySelector<HTMLElement>('[data-board-compose-status]')!;
    const sortButtons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-board-sort]'),
    );
    const agentFilter = root.querySelector<HTMLButtonElement>('[data-board-agent-filter]')!;
    const prdFilter = root.querySelector<HTMLButtonElement>('[data-board-prd-filter]')!;
    const prdFields = root.querySelector<HTMLElement>('[data-board-prd-fields]')!;
    const repositoryInput = compose.elements.namedItem('repository_url') as HTMLInputElement;
    const titleInput = root.querySelector<HTMLInputElement>('[data-board-title]')!;
    const postTypeInputs = [
      ...compose.querySelectorAll<HTMLInputElement>('input[name=artifact_kind]'),
    ];
    let threads: BoardThread[] = [];
    let sort: 'top' | 'new' = 'top';
    let agentOnly = false;
    let publicPrdsOnly = false;

    const render = (): void => {
      renderPrdRail(prdRail, threads);
      const visible = threads
        .filter(
          (thread) =>
            (!publicPrdsOnly || thread.artifact_kind === 'public-prd') &&
            (!agentOnly ||
              thread.author_type === 'agent' ||
              thread.comments.some((comment) => comment.author_type === 'agent')),
        )
        .sort((a, b) =>
          sort === 'top'
            ? b.score - a.score || b.created_at.localeCompare(a.created_at)
            : b.created_at.localeCompare(a.created_at),
        );
      if (!visible.length) {
        list.replaceChildren(
          node(
            'p',
            'board-empty',
            agentOnly
              ? 'No agent-in-loop discussions yet.'
              : publicPrdsOnly
                ? 'No public PRDs have been shared for this stack yet.'
              : 'No discussions yet. Start the useful first one.',
          ),
        );
        return;
      }
      list.replaceChildren(
        ...visible.map((thread) =>
          renderThread(root, thread, api, tool, personaName),
        ),
      );
    };

    const load = async (): Promise<void> => {
      if (!api) {
        list.replaceChildren(node('p', 'board-empty', 'Community gateway unavailable.'));
        return;
      }
      try {
        const response = await fetch(
          `${api}/api/discussions?tool=${encodeURIComponent(tool)}`,
          { headers: authHeaders() },
        );
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { threads: BoardThread[] };
        threads = body.threads;
        render();
      } catch {
        list.replaceChildren(
          node('p', 'board-empty', 'The community board is unavailable right now.'),
        );
      }
    };

    for (const button of sortButtons) {
      button.addEventListener('click', () => {
        sort = button.dataset.boardSort as 'top' | 'new';
        for (const candidate of sortButtons) {
          candidate.setAttribute('aria-pressed', String(candidate === button));
        }
        render();
      });
    }
    agentFilter.addEventListener('click', () => {
      agentOnly = !agentOnly;
      agentFilter.setAttribute('aria-pressed', String(agentOnly));
      render();
    });
    prdFilter.addEventListener('click', () => {
      publicPrdsOnly = !publicPrdsOnly;
      prdFilter.setAttribute('aria-pressed', String(publicPrdsOnly));
      render();
    });

    const updatePostType = (): void => {
      const publicPrd =
        postTypeInputs.find((input) => input.checked)?.value === 'public-prd';
      prdFields.hidden = !publicPrd;
      repositoryInput.required = publicPrd;
      titleInput.placeholder = publicPrd
        ? `What does this public PRD build with ${root.dataset.toolName}?`
        : `How are you using ${root.dataset.toolName}?`;
    };
    for (const input of postTypeInputs) {
      input.addEventListener('change', updatePostType);
    }
    updatePostType();

    compose.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!getSessionToken()) {
        beginGithubSignIn(api);
        return;
      }
      const data = new FormData(compose);
      const artifactKind = String(data.get('artifact_kind') ?? 'discussion');
      const submit = compose.querySelector<HTMLButtonElement>('button[type=submit]')!;
      submit.disabled = true;
      composeStatus.textContent =
        artifactKind === 'public-prd'
          ? 'Checking public repository evidence…'
          : 'Publishing…';
      try {
        const response = await fetch(`${api}/api/discussions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            tool_id: tool,
            title: data.get('title'),
            body: data.get('body'),
            tags: String(data.get('tags') ?? '')
              .split(',')
              .map((tag) => tag.trim()),
            invite_agent: data.get('invite_agent') === 'on',
            artifact_kind: artifactKind,
            repository_url: data.get('repository_url'),
            prd_url: data.get('prd_url'),
            stack_path: data.get('stack_path'),
          }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          composeStatus.textContent = result.error ?? 'Discussion could not be published.';
          return;
        }
        compose.reset();
        updatePostType();
        composeStatus.textContent = 'Published.';
        await load();
      } catch {
        composeStatus.textContent = 'Network error—please retry.';
      } finally {
        submit.disabled = false;
      }
    });

    document.addEventListener('curations:auth', () => void load());
    document.addEventListener('curations:discussion', (event) => {
      if ((event as CustomEvent).detail?.tool === tool) void load();
    });
    document.addEventListener('curations:engagement', (event) => {
      if ((event as CustomEvent).detail?.tool === tool) void load();
    });
    void load();
  }
}
