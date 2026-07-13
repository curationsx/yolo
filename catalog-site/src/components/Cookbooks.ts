import {
  STACKS,
  buildCopilotCommand,
  buildPromptPath,
  stackDefinition,
  versionLabel,
  type StackId,
} from '../lib/cookbooks';

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
  const modalTitle = dialog.querySelector<HTMLElement>('[data-handoff-title]')!;
  const modalMeta = dialog.querySelector<HTMLElement>('[data-handoff-meta]')!;
  const modalCommand = dialog.querySelector<HTMLElement>('[data-handoff-command]')!;
  const promptLink = dialog.querySelector<HTMLAnchorElement>('[data-handoff-prompt]')!;
  const copyButton = dialog.querySelector<HTMLButtonElement>('[data-handoff-copy]')!;
  const copyStatus = dialog.querySelector<HTMLElement>('[data-handoff-status]')!;

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
      dialog.showModal();
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

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
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
