type ShowcaseControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface PublicPrdSource {
  owner: string;
  commit: string;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Showcase builder is missing ${selector}`);
  return element;
}

function field<T extends ShowcaseControl>(form: HTMLFormElement, name: string): T {
  const element = form.elements.namedItem(name);
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLSelectElement) &&
    !(element instanceof HTMLTextAreaElement)
  ) {
    throw new Error(`Showcase builder is missing field ${name}`);
  }
  return element as T;
}

function publicPrdSourceFromUrl(value: string): PublicPrdSource | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== 'github.com' ||
    url.search ||
    url.hash
  ) {
    return null;
  }
  const match = url.pathname.match(
    /^\/([^/]+)\/[^/]+\/blob\/([0-9a-f]{40})\/.+\.mdx?$/i,
  );
  const owner = match?.[1]?.toLowerCase();
  const commit = match?.[2]?.toLowerCase();
  return owner && commit ? { owner, commit } : null;
}

function setText(root: ParentNode, selector: string, value: string): void {
  for (const element of root.querySelectorAll<HTMLElement>(selector)) {
    element.textContent = value;
  }
}

export function initShowcaseBuilderJourneys(): void {
  for (const shell of document.querySelectorAll<HTMLElement>('[data-showcase-builder]')) {
    if (shell.dataset.initialized === 'true') continue;
    shell.dataset.initialized = 'true';

    const form = requireElement<HTMLFormElement>(shell, '[data-showcase-builder-form]');
    const expectedOwner = (shell.dataset.showcaseOwner ?? '').toLowerCase();
    const steps = Array.from(shell.querySelectorAll<HTMLElement>('[data-showcase-step]'));
    const indicators = Array.from(
      shell.querySelectorAll<HTMLElement>('[data-showcase-step-indicator]'),
    );
    const stepStatus = requireElement<HTMLElement>(shell, '[data-showcase-step-status]');
    const back = requireElement<HTMLButtonElement>(shell, '[data-showcase-back]');
    const next = requireElement<HTMLButtonElement>(shell, '[data-showcase-next]');
    const confirm = requireElement<HTMLButtonElement>(shell, '[data-showcase-confirm]');
    const pending = requireElement<HTMLElement>(shell, '[data-showcase-pending]');
    const copyPrompt = requireElement<HTMLButtonElement>(shell, '[data-copy-showcase-prompt]');
    const copyStatus = requireElement<HTMLElement>(shell, '[data-showcase-copy-status]');
    const promptCode = requireElement<HTMLElement>(shell, '[data-showcase-prompt-template]');
    const promptTemplate =
      promptCode.dataset.showcasePromptTemplate ?? promptCode.textContent ?? '';

    const urlField = field<HTMLInputElement>(form, 'prd_url');
    const revisionField = field<HTMLInputElement>(form, 'source_revision');
    const titleField = field<HTMLInputElement>(form, 'showcase_title');
    const breakdownField = field<HTMLTextAreaElement>(form, 'breakdown');
    const breakdownApprovalField = field<HTMLInputElement>(form, 'breakdown_approved');
    const purposeField = field<HTMLTextAreaElement>(form, 'purpose');
    const questionField = field<HTMLTextAreaElement>(form, 'question');
    const reviewModeField = field<HTMLSelectElement>(form, 'review_mode');
    const roastField = field<HTMLInputElement>(form, 'roast_open');
    const consentField = field<HTMLInputElement>(form, 'showcase_consent');
    const stackInputs = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="showcase_stack"]'),
    );
    const firstStack = stackInputs[0];
    if (!firstStack) throw new Error('Showcase builder requires Stack choices');
    let currentStep = 0;

    const invalidateConsent = (): void => {
      consentField.checked = false;
      pending.hidden = true;
      confirm.disabled = false;
      confirm.textContent = 'Send to maintainer review';
    };

    const renderPrompt = (): void => {
      promptCode.textContent = promptTemplate
        .replace('{{PRD_URL}}', urlField.value.trim())
        .replace('{{SOURCE_REVISION}}', revisionField.value.trim());
    };

    const render = (): void => {
      const title = titleField.value.trim() || 'Untitled PRD';
      const purpose = purposeField.value.trim();
      const question = questionField.value.trim();
      const source = urlField.value.trim();
      const stacks = new Set(new FormData(form).getAll('showcase_stack').map(String));

      setText(shell, '[data-showcase-title]', `${title} ↗`);
      setText(shell, '[data-showcase-purpose]', purpose);
      setText(shell, '[data-showcase-question]', `“${question}”`);
      setText(shell, '[data-showcase-breakdown]', breakdownField.value.trim());
      setText(shell, '[data-showcase-source-revision]', revisionField.value.trim());
      setText(shell, '[data-showcase-review-mode]', reviewModeField.value);
      setText(
        shell,
        '[data-showcase-roast-summary]',
        roastField.checked ? 'Open for structured Roast' : 'Not open for Roast',
      );
      for (const link of shell.querySelectorAll<HTMLAnchorElement>('[data-showcase-source]')) {
        link.href = source;
        if (link.hasAttribute('data-showcase-title')) {
          link.setAttribute('aria-label', `${title} public PRD`);
        }
      }
      for (const pill of shell.querySelectorAll<HTMLElement>('[data-stack-slug]')) {
        pill.hidden = !stacks.has(pill.dataset.stackSlug ?? '');
      }
      for (const status of shell.querySelectorAll<HTMLElement>(
        '[data-showcase-status="open-roast"]',
      )) {
        status.hidden = !roastField.checked;
      }
      for (const copy of shell.querySelectorAll<HTMLElement>('.showcase-roast-open-copy')) {
        copy.hidden = !roastField.checked;
      }
    };

    const validateCurrent = (): boolean => {
      for (const control of steps[currentStep].querySelectorAll<ShowcaseControl>(
        'input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
      )) {
        if (!control.reportValidity()) return false;
      }
      if (currentStep !== 0) {
        if (currentStep === 2) {
          firstStack.setCustomValidity(
            stackInputs.some((input) => input.checked)
              ? ''
              : 'Choose at least one Stack tool.',
          );
          if (!firstStack.reportValidity()) return false;
        }
        return true;
      }
      const source = publicPrdSourceFromUrl(urlField.value);
      urlField.setCustomValidity(
        !source
          ? 'Use an exact HTTPS GitHub Markdown blob URL pinned to a 40-character commit SHA.'
          : expectedOwner && source.owner !== expectedOwner
            ? `PRD repository owner must match the signed-in GitHub login @${shell.dataset.showcaseOwner}.`
            : '',
      );
      if (!urlField.reportValidity()) return false;
      revisionField.setCustomValidity(
        revisionField.value.trim().toLowerCase() === source?.commit
          ? ''
          : 'Source revision must match the 40-character commit SHA in the PRD URL.',
      );
      return revisionField.reportValidity();
    };

    const showStep = (index: number, moveFocus = true): void => {
      currentStep = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach((step, stepIndex) => {
        step.hidden = stepIndex !== currentStep;
      });
      indicators.forEach((indicator, stepIndex) => {
        if (stepIndex === currentStep) indicator.setAttribute('aria-current', 'step');
        else indicator.removeAttribute('aria-current');
        indicator.classList.toggle('is-complete', stepIndex < currentStep);
      });
      back.hidden = currentStep === 0;
      next.hidden = currentStep === steps.length - 1;
      if (currentStep === steps.length - 1) render();
      const stepTitle = requireElement<HTMLElement>(
        steps[currentStep],
        '[data-showcase-step-title]',
      );
      stepStatus.textContent =
        `Step ${currentStep + 1} of ${steps.length}: ${stepTitle.textContent?.trim() ?? ''}`;
      if (moveFocus) {
        const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth';
        shell.scrollIntoView({ behavior, block: 'start' });
        stepTitle.focus({ preventScroll: true });
      }
    };

    form.addEventListener('submit', (event) => event.preventDefault());
    form.addEventListener('input', (event) => {
      urlField.setCustomValidity('');
      revisionField.setCustomValidity('');
      firstStack.setCustomValidity('');
      renderPrompt();
      if (
        event.target === urlField ||
        event.target === revisionField ||
        event.target === titleField ||
        event.target === breakdownField
      ) {
        breakdownApprovalField.checked = false;
      }
      if (event.target !== consentField) invalidateConsent();
    });
    next.addEventListener('click', () => {
      if (validateCurrent()) showStep(currentStep + 1);
    });
    back.addEventListener('click', () => {
      if (currentStep === steps.length - 1) invalidateConsent();
      showStep(currentStep - 1);
    });
    consentField.addEventListener('change', () => {
      if (!consentField.checked) invalidateConsent();
    });
    copyPrompt.addEventListener('click', async () => {
      renderPrompt();
      const prompt = promptCode.textContent ?? '';
      try {
        await navigator.clipboard.writeText(prompt);
        copyStatus.textContent = 'Versioned prompt copied. Run it in your own Copilot CLI.';
      } catch {
        copyStatus.textContent = 'Copy failed. Select the prompt text manually.';
      }
    });
    confirm.addEventListener('click', () => {
      if (!consentField.reportValidity()) return;
      render();
      pending.hidden = false;
      confirm.disabled = true;
      confirm.textContent = 'Sent to review (fixture)';
    });

    renderPrompt();
    showStep(0, false);
  }
}
