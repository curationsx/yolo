// @ts-check
import { test, expect } from '@playwright/test';
import { installDeterministicNetwork } from './support/constants.mjs';

test.beforeEach(async ({ page }) => {
  await installDeterministicNetwork(page);
});

test('community views replace one server-rendered conversation region', async ({
  page,
}) => {
  await page.goto('/community/new/');

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex,follow',
  );
  await expect(
    page.getByRole('link', { name: 'New', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.locator('#community-conversations .board-list-heading h2'),
  ).toHaveText('New this week');
  await expect(
    page.locator('.board-stack-column .board-list-section'),
  ).toHaveCount(1);
  await expect(page.getByText('LedgerLight', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Needs feedback', exact: true }).click();
  await expect(page).toHaveURL(/\/community\/needs-feedback\/$/);
  await expect(
    page.locator('#community-conversations .board-list-heading h2'),
  ).toHaveText('Needs feedback');
  await expect(
    page.locator('.board-stack-column .board-list-section'),
  ).toHaveCount(1);
});

test('builder journey keeps both onboarding paths explicit and private', async ({
  page,
}) => {
  await page.goto('/projects/new/');

  await expect(
    page.getByRole('group', { name: 'How do you want to begin?' }),
  ).toBeVisible();
  await expect(page.locator('[data-reverse-materials]')).toBeHidden();
  await expect(page.getByRole('button', { name: '← Back' })).toBeHidden();

  await page.getByLabel('Inspire new ideas for my project').check();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await expect(page.locator('[data-reverse-materials]')).toBeVisible();
  await expect(page.locator('[data-reverse-materials]')).toContainText(
    'File picker appears after repository sync.',
  );

  await expect(
    page.getByText('Preferred destination for generated working plan (optional)'),
  ).toBeVisible();
});

test('existing-plan fixture reaches an exact pending public preview without API calls', async ({
  page,
}) => {
  const productApiRequests = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/') && pathname !== '/api/auth/config') {
      productApiRequests.push(request.url());
    }
  });

  await page.goto('/projects/new/');
  await page.getByRole('button', { name: 'Continue →' }).click();

  await page
    .getByLabel(/Link to GitHub project/i)
    .fill('https://github.com/curationsx/yolo');
  await page.getByLabel('Project name').fill('Signal Garden');
  await page
    .getByLabel('Working plan file path (optional)')
    .fill('docs/PRD-curations-community.md');
  await page
    .getByLabel('Details of project')
    .fill('A public workspace that helps small teams turn open questions into testable plan revisions.');
  await page
    .getByLabel('I would like feedback and new ideas on...')
    .fill('Does this review make the next decision clear enough to test with one builder?');
  await page.getByLabel('TypeScript').uncheck();
  await page.getByRole('button', { name: 'Continue →' }).click();

  await expect(
    page.getByRole('group', { name: 'Your private Project Review' }),
  ).toBeVisible();
  await expect(page.locator('[data-review-project]')).toHaveText('Signal Garden');
  await expect(page.locator('[data-review-observation]')).toContainText(
    'No repository request occurred in this preview.',
  );
  await expect(page.getByLabel(/Invite a disclosed AI guide/)).not.toBeChecked();
  await page
    .getByRole('checkbox', { name: 'Working-plan path', exact: true })
    .uncheck();

  await page.getByRole('button', { name: 'Continue →' }).click();
  await expect(
    page.getByRole('group', {
      name: 'Preview exactly what would become public.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue →' })).toBeHidden();
  await expect(page.locator('[data-project-name]').first()).toContainText(
    'Signal Garden',
  );
  await expect(page.locator('[data-project-question]').first()).toContainText(
    'Does this review make the next decision clear enough to test with one builder?',
  );
  await expect(
    page.locator('[data-project-repository]').first(),
  ).toHaveAttribute('href', 'https://github.com/curationsx/yolo');
  await expect(
    page.locator('[data-project-plan-link]').first(),
  ).toHaveAttribute(
    'href',
    'https://github.com/curationsx/yolo/blob/main/docs/PRD-curations-community.md',
  );
  const hiddenTypeScriptPills = page.locator(
    '.project-public-preview [data-stack-slug="typescript"]',
  );
  await expect(hiddenTypeScriptPills).toHaveCount(2);
  await expect(hiddenTypeScriptPills.nth(0)).toBeHidden();
  await expect(hiddenTypeScriptPills.nth(1)).toBeHidden();
  const hiddenPlanDetails = page.locator('[data-public-plan]');
  await expect(hiddenPlanDetails).toHaveCount(2);
  await expect(hiddenPlanDetails.nth(0)).toBeHidden();
  await expect(hiddenPlanDetails.nth(1)).toBeHidden();
  await expect(page.locator('[data-builder-pending]')).toBeHidden();

  const consent = page.getByLabel(/I reviewed this exact preview/);
  await consent.check();
  await page.getByRole('button', { name: '← Back' }).click();
  await page.getByRole('button', { name: '← Back' }).click();
  await page.getByLabel('Project name').fill('Signal Garden Revised');
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await expect(consent).not.toBeChecked();
  await expect(page.locator('[data-project-name]').first()).toContainText(
    'Signal Garden Revised',
  );

  await consent.check();
  await page
    .getByRole('button', { name: 'Send to maintainer review' })
    .click();
  await expect(page.locator('[data-builder-pending]')).toBeVisible();
  await expect(page.locator('[data-builder-pending]')).toContainText(
    'This preview does not submit data yet.',
  );
  expect(productApiRequests).toEqual([]);
});
