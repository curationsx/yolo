import {
  authHeaders,
  beginGithubSignIn,
  getSessionToken,
} from '../lib/browser-auth';
import { BOARD_FIXTURE_SCORES } from '../lib/board-fixtures';

interface VoteSummary {
  counts: Record<string, number>;
  viewer_votes: string[];
}

function updateButton(button: HTMLButtonElement, count: number, voted: boolean): void {
  const name = button.getAttribute('aria-label')?.replace(/^Upvote |^Remove upvote from /, '').replace(/;.*$/, '') ?? 'entry';
  button.querySelector<HTMLElement>('[data-vote-count]')!.textContent = String(count);
  button.setAttribute('aria-pressed', String(voted));
  button.setAttribute(
    'aria-label',
    `${voted ? 'Remove upvote from' : 'Upvote'} ${name}; ${count} votes`,
  );
  button.classList.toggle('is-voted', voted);
  button.title = voted ? 'Remove your upvote' : 'Upvote this directory entry';
}

export async function initSoftwareVotes(): Promise<void> {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-software-vote]'),
  );
  const api = document.body.dataset.agentApi ?? '';
  if (!buttons.length || !api) return;

  const targets = [...new Set(buttons.map((button) => button.dataset.voteTarget!))];

  const load = async (): Promise<void> => {
    if (document.body.dataset.boardFixtures === 'true') {
      for (const button of buttons) {
        const target = button.dataset.voteTarget!;
        updateButton(button, BOARD_FIXTURE_SCORES[target] ?? 0, false);
      }
      return;
    }

    try {
      const response = await fetch(
        `${api}/api/votes?targets=${encodeURIComponent(targets.join(','))}`,
        { headers: authHeaders() },
      );
      if (!response.ok) return;
      const summary = (await response.json()) as VoteSummary;
      for (const button of buttons) {
        const target = button.dataset.voteTarget!;
        updateButton(
          button,
          summary.counts[target] ?? 0,
          summary.viewer_votes.includes(target),
        );
      }
    } catch {
      // Voting is progressive enhancement; directory browsing remains available.
    }
  };

  for (const button of buttons) {
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
          body: JSON.stringify({ target_id: button.dataset.voteTarget, voted }),
        });
        if (response.status === 401) {
          beginGithubSignIn(api);
          return;
        }
        if (!response.ok) return;
        const result = (await response.json()) as { count: number; voted: boolean };
        updateButton(button, result.count, result.voted);
      } finally {
        button.disabled = false;
      }
    });
  }

  document.addEventListener('curations:auth', () => void load());
  await load();
}
