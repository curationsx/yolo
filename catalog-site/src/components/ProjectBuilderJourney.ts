type BuilderControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Project builder is missing required element: ${selector}`);
  }
  return element;
}

function requireField<T extends BuilderControl>(
  form: HTMLFormElement,
  name: string,
): T {
  const field = form.elements.namedItem(name);
  if (
    !(field instanceof HTMLInputElement) &&
    !(field instanceof HTMLSelectElement) &&
    !(field instanceof HTMLTextAreaElement)
  ) {
    throw new Error(`Project builder is missing required field: ${name}`);
  }
  return field as T;
}

function selectedPlanSource(form: HTMLFormElement): 'existing' | 'reverse' {
  const value = new FormData(form).get('plan_source');
  return value === 'reverse' ? 'reverse' : 'existing';
}

function normalizedRepositoryUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const segments = url.pathname.split('/').filter(Boolean);
  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== 'github.com' ||
    segments.length !== 2 ||
    segments.some((segment) => segment.endsWith('.git')) ||
    url.search ||
    url.hash
  ) {
    return null;
  }
  return `https://github.com/${segments[0]}/${segments[1]}`;
}

function validPlanPath(value: string): boolean {
  const path = value.trim();
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.split('/').includes('..') &&
    /\.mdx?$/i.test(path)
  );
}

function githubPlanUrl(repositoryUrl: string, planPath: string): string {
  const encodedPath = planPath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${repositoryUrl}/blob/main/${encodedPath}`;
}

function text(root: ParentNode, selector: string, value: string): void {
  for (const element of root.querySelectorAll<HTMLElement>(selector)) {
    element.textContent = value;
  }
}

function selectedOptionText(select: HTMLSelectElement): string {
  return select.selectedOptions[0]?.textContent?.trim() ?? select.value;
}

function setProjectStage(root: ParentNode, value: string, label: string): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-project-stage]')) {
    for (const className of [...element.classList]) {
      if (className.startsWith('project-stage-')) {
        element.classList.remove(className);
      }
    }
    element.classList.add(`project-stage-${value}`);
    element.textContent = label;
  }
}

function checkedValues(form: HTMLFormElement, name: string): string[] {
  return new FormData(form).getAll(name).map(String);
}

export function initProjectBuilderJourneys(): void {
  for (const shell of document.querySelectorAll<HTMLElement>('[data-project-builder]')) {
    if (shell.dataset.initialized === 'true') continue;
    shell.dataset.initialized = 'true';

    const form = requireElement<HTMLFormElement>(shell, '[data-project-builder-form]');
    const steps = Array.from(shell.querySelectorAll<HTMLElement>('[data-builder-step]'));
    const indicators = Array.from(
      shell.querySelectorAll<HTMLElement>('[data-builder-step-indicator]'),
    );
    const back = requireElement<HTMLButtonElement>(shell, '[data-builder-back]');
    const next = requireElement<HTMLButtonElement>(shell, '[data-builder-next]');
    const confirm = requireElement<HTMLButtonElement>(shell, '[data-builder-confirm]');
    const pending = requireElement<HTMLElement>(shell, '[data-builder-pending]');
    const reverseMaterials = requireElement<HTMLElement>(shell, '[data-reverse-materials]');
    const planPathCopy = requireElement<HTMLElement>(shell, '[data-plan-path-copy]');

    const repositoryField = requireField<HTMLInputElement>(form, 'repository_url');
    const projectNameField = requireField<HTMLInputElement>(form, 'project_name');
    const planPathField = requireField<HTMLInputElement>(form, 'plan_path');
    const summaryField = requireField<HTMLTextAreaElement>(form, 'summary');
    const questionField = requireField<HTMLTextAreaElement>(form, 'feedback_question');
    const categoryField = requireField<HTMLSelectElement>(form, 'category');
    const stageField = requireField<HTMLSelectElement>(form, 'stage');
    const shareSummaryField = requireField<HTMLInputElement>(form, 'share_summary');
    const sharePlanField = requireField<HTMLInputElement>(form, 'share_plan');
    const shareStackField = requireField<HTMLInputElement>(form, 'share_stack');
    const consentField = requireField<HTMLInputElement>(form, 'publication_consent');
    const pathInputs = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="plan_source"]'),
    );
    const stackInputs = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="stack"]'),
    );
    const basePath = shell.dataset.basePath ?? '/';
    let currentStep = 0;

    const invalidateConsent = (): void => {
      consentField.checked = false;
      pending.hidden = true;
      confirm.disabled = false;
      confirm.textContent = 'Send to maintainer review';
    };

    const render = (): void => {
      const repositoryUrl =
        normalizedRepositoryUrl(repositoryField.value) ??
        'https://github.com/curationsx/yolo';
      const projectName = projectNameField.value.trim() || 'Untitled Project';
      const planPath = planPathField.value.trim();
      const summary = summaryField.value.trim();
      const question = questionField.value.trim();
      const category = selectedOptionText(categoryField);
      const stage = selectedOptionText(stageField);
      const hasPlanPath = validPlanPath(planPath);
      const planUrl = hasPlanPath
        ? githubPlanUrl(repositoryUrl, planPath)
        : repositoryUrl;
      const selectedStacks = new Set(checkedValues(form, 'stack'));
      const hasStackSelection = selectedStacks.size > 0;
      const showPlan = sharePlanField.checked && hasPlanPath;

      text(shell, '[data-project-name]', `${projectName} ↗`);
      text(shell, '[data-project-question]', `“${question}”`);
      text(shell, '[data-project-summary]', summary);
      text(shell, '[data-project-category]', category);
      text(shell, '[data-project-plan-path]', hasPlanPath ? planPath : 'Not provided yet');
      text(shell, '[data-review-project]', projectName);
      text(shell, '[data-review-summary]', summary);
      text(shell, '[data-review-question]', question);
      text(
        shell,
        '[data-review-source]',
        hasPlanPath ? `${repositoryUrl} · ${planPath}` : repositoryUrl,
      );
      setProjectStage(shell, stageField.value, stage);

      sharePlanField.disabled = !hasPlanPath;
      if (!hasPlanPath) {
        sharePlanField.checked = false;
      }

      for (const link of shell.querySelectorAll<HTMLAnchorElement>(
        '[data-project-repository]',
      )) {
        link.href = repositoryUrl;
        link.setAttribute(
          'aria-label',
          `${projectName} public GitHub repository`,
        );
      }
      for (const link of shell.querySelectorAll<HTMLAnchorElement>(
        '[data-project-plan-link]',
      )) {
        link.href = planUrl;
      }
      for (const link of shell.querySelectorAll<HTMLAnchorElement>(
        '[data-project-category-link]',
      )) {
        link.href = `${basePath}projects/types/${categoryField.value}/`;
      }
      for (const stack of shell.querySelectorAll<HTMLElement>('[data-stack-slug]')) {
        stack.hidden =
          !shareStackField.checked ||
          !selectedStacks.has(stack.dataset.stackSlug ?? '');
      }
      for (const element of shell.querySelectorAll<HTMLElement>('[data-public-summary]')) {
        element.hidden = !shareSummaryField.checked;
      }
      for (const element of shell.querySelectorAll<HTMLElement>('[data-public-plan]')) {
        element.hidden = !showPlan;
      }
      for (const element of shell.querySelectorAll<HTMLElement>('[data-public-stack]')) {
        element.hidden = !shareStackField.checked || !hasStackSelection;
      }
      for (const context of shell.querySelectorAll<HTMLElement>('[data-project-context]')) {
        context.hidden = !showPlan && (!shareStackField.checked || !hasStackSelection);
      }

      const planSource = selectedPlanSource(form);
      text(
        shell,
        '[data-review-observation]',
        planSource === 'existing'
          ? hasPlanPath
            ? `Existing plan path selected at ${planPath}. No repository request occurred in this preview.`
            : 'No working plan path has been added yet. No repository request occurred in this preview.'
          : 'A live file picker would let you choose exact repository files for inspiration. No repository request occurred in this preview.',
      );
    };

    const updatePathChoice = (): void => {
      const reverse = selectedPlanSource(form) === 'reverse';
      reverseMaterials.hidden = !reverse;
      planPathCopy.textContent = reverse
        ? 'Preferred destination for generated working plan (optional)'
        : 'Working plan file path (optional)';
    };

    const validateCurrentStep = (): boolean => {
      for (const control of steps[currentStep].querySelectorAll<BuilderControl>(
        'input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
      )) {
        if (!control.reportValidity()) return false;
      }

      if (currentStep !== 1) return true;

      const repositoryUrl = normalizedRepositoryUrl(repositoryField.value);
      if (!repositoryUrl) {
        repositoryField.setCustomValidity(
          'Use an HTTPS GitHub repository root such as https://github.com/owner/repository.',
        );
        repositoryField.reportValidity();
        return false;
      }
      repositoryField.setCustomValidity('');
      repositoryField.value = repositoryUrl;

      planPathField.setCustomValidity(
        planPathField.value.trim().length === 0 || validPlanPath(planPathField.value)
          ? ''
          : 'Use a relative Markdown path ending in .md or .mdx.',
      );
      if (!planPathField.reportValidity()) return false;

      return true;
    };

    const showStep = (index: number): void => {
      currentStep = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach((step, stepIndex) => {
        step.hidden = stepIndex !== currentStep;
      });
      indicators.forEach((indicator, stepIndex) => {
        if (stepIndex === currentStep) {
          indicator.setAttribute('aria-current', 'step');
        } else {
          indicator.removeAttribute('aria-current');
        }
        indicator.classList.toggle('is-complete', stepIndex < currentStep);
      });
      back.hidden = currentStep === 0;
      next.hidden = currentStep === steps.length - 1;
      if (currentStep >= 2) render();
      shell.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    form.addEventListener('submit', (event) => event.preventDefault());
    form.addEventListener('input', (event) => {
      repositoryField.setCustomValidity('');
      planPathField.setCustomValidity('');
      if (event.target !== consentField) {
        invalidateConsent();
      }
    });
    for (const input of pathInputs) {
      input.addEventListener('change', updatePathChoice);
    }
    next.addEventListener('click', () => {
      if (validateCurrentStep()) showStep(currentStep + 1);
    });
    back.addEventListener('click', () => {
      if (currentStep === steps.length - 1) {
        invalidateConsent();
      }
      showStep(currentStep - 1);
    });
    consentField.addEventListener('change', () => {
      if (!consentField.checked) {
        invalidateConsent();
      }
    });
    confirm.addEventListener('click', () => {
      if (!consentField.reportValidity()) return;
      render();
      pending.hidden = false;
      confirm.disabled = true;
      confirm.textContent = 'Sent to review (preview)';
    });

    updatePathChoice();
    showStep(0);
  }
}
