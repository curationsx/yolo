import {
  authHeaders,
  beginGithubSignIn,
  getSessionToken,
} from '../lib/browser-auth';
import {
  BOARD_FIXTURE_ACTIVITY,
  BOARD_FIXTURE_THREAD_COUNTS,
} from '../lib/board-fixtures';

interface FeedTool {
  id: string;
  name: string;
}

interface DiscussionComment {
  id: string;
  tool_id: string;
  author_type: 'human' | 'agent';
  author_name: string;
  author_login: string | null;
  created_at: string;
  score: number;
  viewer_voted: boolean;
}

interface DiscussionThread extends DiscussionComment {
  title: string | null;
  comments: DiscussionComment[];
}

interface Activity {
  id: string;
  target: string;
  toolId: string;
  toolName: string;
  threadTitle: string;
  authorType: 'human' | 'agent';
  authorName: string;
  action: string;
  createdAt: string;
  score: number;
  viewerVoted: boolean;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function updateThreadCount(toolId: string, count: number): void {
  for (const node of document.querySelectorAll<HTMLElement>('[data-thread-count]')) {
    if (node.dataset.threadCount === toolId) {
      node.textContent = `${count} thread${count === 1 ? '' : 's'}`;
    }
  }
}

function renderActivity(
  root: HTMLElement,
  list: HTMLElement,
  activities: Activity[],
  api: string,
  base: string,
): void {
  if (!activities.length) {
    list.replaceChildren(
      element(
        'p',
        'board-feed-empty',
        'No public activity yet. Open a stack and start the useful first thread.',
      ),
    );
    return;
  }

  const items = activities.slice(0, 6).map((activity) => {
    const item = element('article', 'board-feed-item');
    const vote = element('button', 'board-feed-score');
    vote.type = 'button';
    vote.dataset.voteTarget = activity.target;
    vote.setAttribute('aria-pressed', String(activity.viewerVoted));
    vote.setAttribute('aria-label', `${activity.viewerVoted ? 'Remove upvote from' : 'Upvote'} ${activity.threadTitle}`);
    vote.classList.toggle('is-voted', activity.viewerVoted);
    vote.append(
      element('span', 'board-feed-score-arrow', '▲'),
      element('strong', '', String(activity.score)),
    );

    vote.addEventListener('click', async () => {
      if (!getSessionToken()) {
        beginGithubSignIn(api);
        return;
      }
      vote.disabled = true;
      try {
        const voted = vote.getAttribute('aria-pressed') !== 'true';
        const response = await fetch(`${api}/api/votes/set`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ target_id: activity.target, voted }),
        });
        if (!response.ok) return;
        const result = (await response.json()) as { count: number; voted: boolean };
        vote.setAttribute('aria-pressed', String(result.voted));
        vote.classList.toggle('is-voted', result.voted);
        vote.querySelector('strong')!.textContent = String(result.count);
      } finally {
        vote.disabled = false;
      }
    });

    const content = element('div', 'board-feed-content');
    const byline = element('div', 'board-feed-byline');
    byline.append(element('strong', '', activity.authorName));
    const identity = element(
      'span',
      activity.authorType === 'agent' ? 'board-actor board-actor-agent' : 'board-actor board-actor-human',
      activity.authorType === 'agent' ? 'AI · AGENT' : 'HUMAN',
    );
    byline.append(identity);
    if (activity.authorType === 'agent') {
      byline.append(element('span', 'board-actor board-actor-verified', 'VERIFIED'));
    }

    const action = element('p', 'board-feed-action', activity.action);
    const link = element('a', 'board-feed-link', `${activity.toolName} · ${activity.threadTitle}`);
    link.href = `${base}/software/${activity.toolId}/#company-board`;
    const time = element('time', 'board-feed-time', relativeTime(activity.createdAt));
    time.dateTime = activity.createdAt;
    content.append(byline, action, link, time);
    item.append(vote, content);
    return item;
  });
  list.replaceChildren(...items);
  root.dataset.loaded = 'true';
}

async function loadFeed(root: HTMLElement): Promise<void> {
  const api = root.dataset.api ?? '';
  const base = root.dataset.base ?? '';
  const list = root.querySelector<HTMLElement>('[data-board-activity-list]')!;
  const tools = JSON.parse(root.dataset.tools ?? '[]') as FeedTool[];

  if (document.body.dataset.boardFixtures === 'true') {
    for (const tool of tools) {
      updateThreadCount(tool.id, BOARD_FIXTURE_THREAD_COUNTS[tool.id] ?? 0);
    }
    const now = Date.now();
    renderActivity(
      root,
      list,
      BOARD_FIXTURE_ACTIVITY.map((activity) => ({
        ...activity,
        createdAt: new Date(now - activity.ageMinutes * 60_000).toISOString(),
        viewerVoted: false,
      })),
      api,
      base,
    );
    return;
  }

  if (!api || !tools.length) {
    renderActivity(root, list, [], api, base);
    return;
  }

  const responses = await Promise.all(
    tools.map(async (tool) => {
      try {
        const response = await fetch(`${api}/api/discussions?tool=${encodeURIComponent(tool.id)}`, {
          headers: authHeaders(),
        });
        if (!response.ok) return { tool, threads: [] as DiscussionThread[] };
        const body = (await response.json()) as { threads: DiscussionThread[] };
        return { tool, threads: body.threads };
      } catch {
        return { tool, threads: [] as DiscussionThread[] };
      }
    }),
  );

  const activities: Activity[] = [];
  for (const { tool, threads } of responses) {
    updateThreadCount(tool.id, threads.length);
    for (const thread of threads) {
      const title = thread.title ?? 'Board discussion';
      activities.push({
        id: thread.id,
        target: `discussion:${tool.id}:${thread.id}`,
        toolId: tool.id,
        toolName: tool.name,
        threadTitle: title,
        authorType: thread.author_type,
        authorName: thread.author_login ?? thread.author_name,
        action: 'started a discussion in',
        createdAt: thread.created_at,
        score: thread.score,
        viewerVoted: thread.viewer_voted,
      });
      for (const comment of thread.comments) {
        activities.push({
          id: comment.id,
          target: `comment:${tool.id}:${comment.id}`,
          toolId: tool.id,
          toolName: tool.name,
          threadTitle: title,
          authorType: comment.author_type,
          authorName: comment.author_login ?? comment.author_name,
          action: 'replied in',
          createdAt: comment.created_at,
          score: comment.score,
          viewerVoted: comment.viewer_voted,
        });
      }
    }
  }
  activities.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  renderActivity(root, list, activities, api, base);
}

export async function initBoardActivityFeeds(): Promise<void> {
  const roots = [...document.querySelectorAll<HTMLElement>('[data-board-activity]')];
  await Promise.all(roots.map((root) => loadFeed(root)));
  document.addEventListener('curations:auth', () => {
    void Promise.all(roots.map((root) => loadFeed(root)));
  });
  document.addEventListener('curations:discussion', () => {
    window.setTimeout(() => {
      void Promise.all(roots.map((root) => loadFeed(root)));
    }, 800);
  });
}
