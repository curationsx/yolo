import {
  beginGithubSignIn,
  getSessionToken,
} from '../lib/browser-auth';

const DRAFT_KEY = 'curations.software-submission.draft';
const REPO_NEW_FILE_URL = 'https://github.com/curationsx/yolo/new/main';

interface SubmissionEntry {
  id: string;
  name: string;
  entity_type: string;
  category: string;
  primary_use: string;
  deployment: string;
  notable_strength: string;
  verify_before_use: string;
  reference: string;
  license: string;
  source_repository?: string;
  platforms?: string[];
  tags?: string[];
  last_reviewed: string;
  review_status: 'needs-review';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function values(form: HTMLFormElement): Record<string, string | string[]> {
  const data = new FormData(form);
  return {
    ...Object.fromEntries(
      [...data.entries()]
        .filter(([key]) => key !== 'platforms')
        .map(([key, value]) => [key, String(value)]),
    ),
    platforms: data.getAll('platforms').map(String),
  };
}

function saveDraft(form: HTMLFormElement): void {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values(form)));
}

function restoreDraft(form: HTMLFormElement): void {
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw) as Record<string, string | string[]>;
    for (const [name, value] of Object.entries(draft)) {
      if (Array.isArray(value)) {
        for (const input of form.querySelectorAll<HTMLInputElement>(`[name="${name}"]`)) {
          input.checked = value.includes(input.value);
        }
      } else {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
          field.value = value;
        }
      }
    }
  } catch {
    window.localStorage.removeItem(DRAFT_KEY);
  }
}

function entryFromForm(form: HTMLFormElement): SubmissionEntry {
  const data = new FormData(form);
  const source = String(data.get('source_repository') ?? '').trim();
  const platforms = data.getAll('platforms').map(String);
  const tags = [
    ...new Set(
      String(data.get('tags') ?? '')
        .split(',')
        .map((tag) => slugify(tag))
        .filter(Boolean),
    ),
  ].slice(0, 8);
  return {
    id: String(data.get('id') ?? ''),
    name: String(data.get('name') ?? ''),
    entity_type: String(data.get('entity_type') ?? 'tool'),
    category: String(data.get('category') ?? ''),
    primary_use: String(data.get('primary_use') ?? ''),
    deployment: String(data.get('deployment') ?? ''),
    notable_strength: String(data.get('notable_strength') ?? ''),
    verify_before_use: String(data.get('verify_before_use') ?? ''),
    reference: String(data.get('reference') ?? ''),
    license: String(data.get('license') ?? ''),
    ...(source ? { source_repository: source } : {}),
    ...(platforms.length ? { platforms } : {}),
    ...(tags.length ? { tags } : {}),
    last_reviewed: new Date().toISOString().slice(0, 10),
    review_status: 'needs-review',
  };
}

export function initSubmissionForms(): void {
  for (const shell of document.querySelectorAll<HTMLElement>('[data-submission-shell]')) {
    if (shell.dataset.initialized === 'true') continue;
    shell.dataset.initialized = 'true';

    const form = shell.querySelector<HTMLFormElement>('[data-submission-form]')!;
    const steps = Array.from(shell.querySelectorAll<HTMLElement>('[data-form-step]'));
    const indicators = Array.from(
      shell.querySelectorAll<HTMLElement>('[data-step-indicator]'),
    );
    const back = shell.querySelector<HTMLButtonElement>('[data-step-back]')!;
    const next = shell.querySelector<HTMLButtonElement>('[data-step-next]')!;
    const handoff = shell.querySelector<HTMLAnchorElement>('[data-github-handoff]')!;
    const copy = shell.querySelector<HTMLButtonElement>('[data-copy-submission]')!;
    const status = shell.querySelector<HTMLElement>('[data-submission-status]')!;
    const api = shell.dataset.api ?? '';
    const existingIds = new Set(JSON.parse(shell.dataset.existingIds ?? '[]') as string[]);
    const nameField = form.elements.namedItem('name') as HTMLInputElement;
    const idField = form.elements.namedItem('id') as HTMLInputElement;
    let idEdited = false;
    let current = 0;
    let submissionJson = '';

    restoreDraft(form);
    nameField.addEventListener('input', () => {
      if (!idEdited) idField.value = slugify(nameField.value);
    });
    idField.addEventListener('input', () => {
      idEdited = true;
      idField.value = slugify(idField.value);
    });
    form.addEventListener('input', () => saveDraft(form));

    const showStep = (index: number): void => {
      current = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach((step, stepIndex) => {
        step.hidden = stepIndex !== current;
      });
      indicators.forEach((indicator, stepIndex) => {
        if (stepIndex === current) indicator.setAttribute('aria-current', 'step');
        else indicator.removeAttribute('aria-current');
        indicator.classList.toggle('is-complete', stepIndex < current);
      });
      back.hidden = current === 0;
      next.hidden = current === steps.length - 1;
      if (current === steps.length - 1) renderPreview();
      shell.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const validateCurrent = (): boolean => {
      for (const field of steps[current].querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >('input, textarea, select')) {
        if (!field.reportValidity()) return false;
      }
      if (current === 0 && existingIds.has(idField.value)) {
        idField.setCustomValidity('That slug already exists in the directory.');
        idField.reportValidity();
        idField.setCustomValidity('');
        return false;
      }
      return true;
    };

    const renderPreview = (): void => {
      const entry = entryFromForm(form);
      submissionJson = `${JSON.stringify(entry, null, 2)}\n`;
      shell.querySelector<HTMLElement>('[data-preview-type]')!.textContent =
        entry.entity_type;
      shell.querySelector<HTMLElement>('[data-preview-name]')!.textContent = entry.name;
      shell.querySelector<HTMLElement>('[data-preview-use]')!.textContent =
        entry.primary_use;
      shell.querySelector<HTMLElement>('[data-preview-strength]')!.textContent =
        entry.notable_strength;
      shell.querySelector<HTMLElement>('[data-preview-verify]')!.textContent =
        `Verify before use: ${entry.verify_before_use}`;
      const tagRow = shell.querySelector<HTMLElement>('[data-preview-tags]')!;
      tagRow.replaceChildren(
        ...(entry.tags ?? []).map((tag) => {
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = tag;
          return badge;
        }),
      );
      const params = new URLSearchParams({
        filename: `software/submissions/${entry.id}.json`,
        value: submissionJson,
      });
      handoff.href = `${REPO_NEW_FILE_URL}?${params.toString()}`;
    };

    next.addEventListener('click', () => {
      if (validateCurrent()) showStep(current + 1);
    });
    back.addEventListener('click', () => showStep(current - 1));

    handoff.addEventListener('click', (event) => {
      saveDraft(form);
      if (!getSessionToken() && api) {
        event.preventDefault();
        status.textContent = 'Sign in with GitHub first; your form is saved on this device.';
        beginGithubSignIn(api);
      }
    });
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(submissionJson);
        status.textContent = 'Submission JSON copied.';
      } catch {
        status.textContent = 'Copy failed; continue to GitHub to view the generated file.';
      }
    });

    showStep(0);
  }
}
