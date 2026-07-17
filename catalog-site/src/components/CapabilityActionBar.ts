function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Capability action fixture is missing ${selector}`);
  return element;
}

export function initCapabilityActionBars(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-capability-actions]')) {
    if (root.dataset.initialized === 'true') continue;
    root.dataset.initialized = 'true';

    const status = required<HTMLElement>(root, '[data-capability-action-status]');
    const targetLabel = root.dataset.label ?? 'this item';

    for (const button of root.querySelectorAll<HTMLButtonElement>(
      '[data-capability-action]',
    )) {
      button.addEventListener('click', () => {
        const pressed = button.getAttribute('aria-pressed') !== 'true';
        const action = button.dataset.capabilityAction ?? '';
        button.setAttribute('aria-pressed', String(pressed));

        if (action === 'upvote') {
          const count = required<HTMLElement>(button, '[data-capability-upvotes]');
          const base = Number(count.textContent ?? 0);
          count.textContent = String(base + (pressed ? 1 : -1));
        } else {
          const label = required<HTMLElement>(button, '[data-capability-action-label]');
          label.textContent =
            action === 'watch'
              ? pressed
                ? '◉ Watching'
                : '◉ Watch'
              : pressed
                ? '✓ Saved'
                : '＋ Save';
        }

        status.textContent =
          `${pressed ? 'Selected' : 'Removed'} ${action} for ${targetLabel}. ` +
          'Fixture only; the live action requires GitHub sign-in and sends no request here.';
      });
    }
  }
}

