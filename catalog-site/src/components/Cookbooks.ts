import {
  STACKS,
  buildCopilotCommand,
  buildEmbeddedPromptPath,
  buildPromptPath,
  stackDefinition,
  versionLabel,
  type StackId,
} from '../lib/cookbooks';
import {
  authHeaders,
  beginGithubSignIn,
  clearCopilotNotice,
  consumeOAuthResult,
  getSessionToken,
} from '../lib/browser-auth';

interface CardData {
  id: string;
  title: string;
  version: string;
  category: string;
  base: string;
  strongFit: StackId[];
  code: Record<StackId, string[]>;
  fitNote: Record<StackId, string>;
}

function parseCard(root: HTMLElement): CardData {
  return {
    id: root.dataset.cookbookId ?? '',
    title: root.dataset.cookbookTitle ?? '',
    version: root.dataset.cookbookVersion ?? '',
    category: root.dataset.cookbookCategory ?? '',
    base: root.dataset.basePath ?? '',
    strongFit: JSON.parse(root.dataset.strongFit ?? '[]') as StackId[],
    code: JSON.parse(root.dataset.code ?? '{}') as Record<StackId, string[]>,
    fitNote: JSON.parse(root.dataset.fitNote ?? '{}') as Record<StackId, string>,
  };
}

function replaceCodeLines(target: HTMLElement, lines: string[]): void {
  target.replaceChildren(
    ...lines.map((line) => {
      const span = document.createElement('span');
      span.textContent = line;
      return span;
    }),
  );
}

function promptUrl(data: CardData, stackId: StackId): string {
  const path = buildPromptPath(data.base, data.id, data.version, stackId);
  return new URL(path, window.location.origin).toString();
}

function initCards(dialog: HTMLDialogElement): void {
  const api = dialog.dataset.api ?? '';
  const modalTitle = dialog.querySelector<HTMLElement>('[data-handoff-title]')!;
  const modalMeta = dialog.querySelector<HTMLElement>('[data-handoff-meta]')!;
  const modalCommand = dialog.querySelector<HTMLElement>('[data-handoff-command]')!;
  const promptLink = dialog.querySelector<HTMLAnchorElement>('[data-handoff-prompt]')!;
  const copyButton = dialog.querySelector<HTMLButtonElement>('[data-handoff-copy]')!;
  const copyStatus = dialog.querySelector<HTMLElement>('[data-handoff-status]')!;
  const modeButtons = [
    ...dialog.querySelectorAll<HTMLButtonElement>('[data-handoff-mode]'),
  ];
  const modePanels = [
    ...dialog.querySelectorAll<HTMLElement>('[data-handoff-panel]'),
  ];
  const connectButton =
    dialog.querySelector<HTMLButtonElement>('[data-copilot-connect]')!;
  const runButton = dialog.querySelector<HTMLButtonElement>('[data-copilot-run]')!;
  const copilotStatus = dialog.querySelector<HTMLElement>('[data-copilot-status]')!;
  const focus = dialog.querySelector<HTMLTextAreaElement>('[data-copilot-focus]')!;
  const responseRoot = dialog.querySelector<HTMLElement>('[data-copilot-response-root]')!;
  const responseMeta = dialog.querySelector<HTMLElement>('[data-copilot-response-meta]')!;
  const responseText = dialog.querySelector<HTMLElement>('[data-copilot-response]')!;
  let activeRun: { data: CardData; stackId: StackId } | null = null;

  const selectMode = (mode: string): void => {
    for (const button of modeButtons) {
      const selected = button.dataset.handoffMode === mode;
      button.setAttribute('aria-selected', String(selected));
    }
    for (const panel of modePanels) {
      panel.hidden = panel.dataset.handoffPanel !== mode;
    }
  };

  const returnToForRun = (): string => {
    const url = new URL(window.location.href);
    if (activeRun) {
      url.searchParams.set('run', activeRun.data.id);
      url.searchParams.set('stack', activeRun.stackId);
      url.searchParams.set('mode', 'copilot');
    }
    return url.toString();
  };

  const refreshCopilot = async (): Promise<void> => {
    runButton.hidden = true;
    connectButton.disabled = false;
    if (!api) {
      connectButton.disabled = true;
      copilotStatus.textContent = 'Embedded Copilot gateway unavailable.';
      return;
    }
    if (!getSessionToken()) {
      connectButton.textContent = 'Sign in to use my Copilot';
      copilotStatus.textContent =
        'GitHub sign-in establishes identity first. No Copilot token is retained yet.';
      return;
    }
    try {
      const response = await fetch(`${api}/api/copilot/status`, {
        headers: authHeaders(),
      });
      const body = (await response.json()) as {
        configured?: boolean;
        connected?: boolean;
        expires_at?: string | null;
      };
      if (response.status === 401) {
        connectButton.textContent = 'Sign in to use my Copilot';
        copilotStatus.textContent = 'Your CURATIONS GitHub session expired.';
        return;
      }
      if (!body.configured) {
        connectButton.disabled = true;
        connectButton.textContent = 'Use My Copilot unavailable';
        copilotStatus.textContent =
          'The embedded runtime is not configured. Run in your terminal instead.';
        return;
      }
      connectButton.textContent = body.connected
        ? 'Replace one-run connection'
        : 'Connect my GitHub Copilot';
      runButton.hidden = !body.connected;
      copilotStatus.textContent = body.connected
        ? `One run authorized until ${new Date(body.expires_at ?? '').toLocaleTimeString()}.`
        : 'Connect for one run. The encrypted authorization expires within 10 minutes.';
    } catch {
      connectButton.disabled = true;
      copilotStatus.textContent = 'Embedded Copilot status is temporarily unavailable.';
    }
  };

  for (const root of document.querySelectorAll<HTMLElement>('[data-cookbook-card]')) {
    const data = parseCard(root);
    const select = root.querySelector<HTMLSelectElement>('[data-stack-select]')!;
    const stackMark = root.querySelector<HTMLElement>('[data-stack-mark]')!;
    const code = root.querySelector<HTMLElement>('[data-tailored-code]')!;
    const fitBadge = root.querySelector<HTMLElement>('[data-fit-badge]')!;
    const fitText = root.querySelector<HTMLElement>('[data-fit-note]')!;
    const boardLink = root.querySelector<HTMLAnchorElement>('[data-stack-board]')!;
    const handoff = root.querySelector<HTMLButtonElement>('[data-handoff-open]')!;

    const render = (): void => {
      const stackId = select.value as StackId;
      const stack = stackDefinition(stackId);
      const strong = data.strongFit.includes(stackId);
      root.style.setProperty('--cookbook-stack', stack.color);
      stackMark.textContent = stack.glyph;
      stackMark.setAttribute('aria-label', stack.name);
      replaceCodeLines(code, data.code[stackId]);
      fitBadge.textContent = strong ? 'STRONG FIT' : 'PARTIAL FIT';
      fitBadge.classList.toggle('is-partial', !strong);
      fitText.textContent = data.fitNote[stackId];
      boardLink.href = `${data.base}/software/${stackId}/#company-board`;
      boardLink.textContent = `Ask the ${stack.name} steward on its board ->`;
    };

    select.addEventListener('change', render);
    handoff.addEventListener('click', () => {
      const stackId = select.value as StackId;
      const stack = stackDefinition(stackId);
      const url = promptUrl(data, stackId);
      modalTitle.textContent = data.title;
      modalMeta.textContent = `${versionLabel(data.version)} · ${stack.name} · human review required`;
      modalCommand.textContent = buildCopilotCommand(url, data.id, data.version, stackId);
      promptLink.href = url;
      copyStatus.textContent = '';
      activeRun = { data, stackId };
      focus.value = '';
      responseRoot.hidden = true;
      responseMeta.textContent = '';
      responseText.textContent = '';
      selectMode('copilot');
      dialog.showModal();
      void refreshCopilot();
    });
    render();
  }

  copyButton.addEventListener('click', async () => {
    const command = modalCommand.textContent ?? '';
    try {
      await navigator.clipboard.writeText(command);
      copyStatus.textContent = 'Command copied.';
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(modalCommand);
      selection?.removeAllRanges();
      selection?.addRange(range);
      copyStatus.textContent = 'Clipboard unavailable; command selected for manual copy.';
    }
  });

  for (const button of modeButtons) {
    button.addEventListener('click', () => selectMode(button.dataset.handoffMode ?? 'copilot'));
  }

  connectButton.addEventListener('click', async () => {
    if (!api || !activeRun) return;
    const returnTo = returnToForRun();
    if (!getSessionToken()) {
      beginGithubSignIn(api, returnTo);
      return;
    }
    connectButton.disabled = true;
    copilotStatus.textContent = 'Opening GitHub for a one-run Copilot authorization...';
    try {
      const response = await fetch(`${api}/api/copilot/connect`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ return_to: returnTo }),
      });
      const body = (await response.json()) as { authorize_url?: string; error?: string };
      if (!response.ok || !body.authorize_url) {
        throw new Error(body.error ?? 'Copilot connection could not begin.');
      }
      window.location.assign(body.authorize_url);
    } catch (error) {
      connectButton.disabled = false;
      copilotStatus.textContent =
        error instanceof Error ? error.message : 'Copilot connection could not begin.';
    }
  });

  runButton.addEventListener('click', async () => {
    if (!api || !activeRun) return;
    runButton.disabled = true;
    connectButton.disabled = true;
    responseRoot.hidden = true;
    copilotStatus.textContent =
      'One-run authorization consumed. GitHub Copilot is reviewing the cookbook...';
    try {
      const promptPath = buildEmbeddedPromptPath(
        '',
        activeRun.data.id,
        activeRun.data.version,
        activeRun.stackId,
      );
      const response = await fetch(`${api}/api/copilot/run`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          prompt_path: promptPath,
          instruction: focus.value,
          run_id: crypto.randomUUID(),
        }),
      });
      const body = (await response.json()) as {
        content?: string;
        error?: string;
        code?: string;
        model?: string;
        max_ai_credits?: number;
      };
      if (!response.ok || !body.content) {
        throw new Error(body.error ?? 'GitHub Copilot could not complete this run.');
      }
      responseMeta.textContent = `AI · GITHUB COPILOT · ${body.model ?? 'user plan'} · cap ${
        body.max_ai_credits ?? 10
      } AI Credits`;
      responseText.textContent = body.content;
      responseRoot.hidden = false;
      copilotStatus.textContent =
        'Run complete. The one-run GitHub authorization has been deleted.';
    } catch (error) {
      copilotStatus.textContent =
        error instanceof Error ? error.message : 'GitHub Copilot could not complete this run.';
    } finally {
      runButton.disabled = false;
      connectButton.disabled = false;
      await refreshCopilot();
    }
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.addEventListener('curations:auth', () => {
    if (dialog.open) void refreshCopilot();
  });

  const oauth = consumeOAuthResult();
  const requestedId = new URLSearchParams(window.location.search).get('run');
  const requestedStack = new URLSearchParams(window.location.search).get('stack');
  if (requestedId) {
    const root = [...document.querySelectorAll<HTMLElement>('[data-cookbook-card]')].find(
      (card) => card.dataset.cookbookId === requestedId,
    );
    if (root) {
      const select = root.querySelector<HTMLSelectElement>('[data-stack-select]')!;
      if (requestedStack && STACKS.some((stack) => stack.id === requestedStack)) {
        select.value = requestedStack;
        select.dispatchEvent(new Event('change'));
      }
      root.querySelector<HTMLButtonElement>('[data-handoff-open]')?.click();
      if (oauth.copilotConnected) {
        copilotStatus.textContent =
          'One run authorized. Review the focus, then run with your GitHub Copilot plan.';
      } else if (oauth.copilotError) {
        copilotStatus.textContent =
          'GitHub Copilot authorization was not completed. You can reconnect or use your terminal.';
      }
    }
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('run');
    cleanUrl.searchParams.delete('stack');
    cleanUrl.searchParams.delete('mode');
    window.history.replaceState({}, document.title, cleanUrl);
  }
  clearCopilotNotice();
}

function initFilters(): void {
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-cookbook-filter]'),
  ];
  const cards = [...document.querySelectorAll<HTMLElement>('[data-cookbook-card]')];
  const count = document.querySelector<HTMLElement>('[data-cookbook-count]');

  const filter = (category: string): void => {
    let visible = 0;
    for (const card of cards) {
      const show = category === 'all' || card.dataset.cookbookCategory === category;
      card.hidden = !show;
      if (show) visible += 1;
    }
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.cookbookFilter === category));
    }
    if (count) count.textContent = `${visible} cookbook${visible === 1 ? '' : 's'}`;
  };

  for (const button of buttons) {
    button.addEventListener('click', () => filter(button.dataset.cookbookFilter ?? 'all'));
  }
}

export function initCookbooks(): void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-handoff-dialog]');
  if (!dialog) return;
  initCards(dialog);
  initFilters();
}
