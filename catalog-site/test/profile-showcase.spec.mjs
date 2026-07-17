// @ts-check
import { test, expect } from '@playwright/test';
import { installDeterministicNetwork } from './support/constants.mjs';

const SHOWCASE_SOURCE_SHA = '4dccc0179b14c32f05be976a4d02ab4757a02d20';
const SHOWCASE_SOURCE_URL =
  `https://github.com/CurationsLA/prd-showcase-fixture/blob/${SHOWCASE_SOURCE_SHA}` +
  '/docs/member-profiles-and-prd-showcase.md';
const isExternalTarget = (testInfo) =>
  Boolean(testInfo.config.metadata?.isExternalTarget);

test.beforeEach(async ({ page }) => {
  await installDeterministicNetwork(page);
});

test('Showcase joins the shared Active feed without changing Community Pulse', async ({
  page,
}) => {
  await page.goto('/community/active/');

  await expect(page.getByRole('link', { name: 'Showcase', exact: true })).toBeVisible();
  await expect(page.locator('[data-showcase-row]')).toHaveCount(1);
  await expect(page.locator('[data-showcase-status="roasted"]')).toContainText(
    '🔥 ROASTED',
  );
  await expect(page.locator('.community-pulse-view-all')).toHaveCount(3);
  const pulseLinks = await page
    .locator('.community-pulse-view-all')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(pulseLinks.some((href) => href?.includes('/showcase/'))).toBe(false);
});

test('Showcase detail separates source, approved AI context, and human Roast', async ({
  page,
}) => {
  await page.goto('/showcase/member-profiles-and-prd-showcase/');

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex,follow',
  );
  await expect(
    page.getByRole('heading', { name: /Member Profiles and PRD Showcase/ }),
  ).toBeVisible();
  await expect(page.getByText(/not independent verification/)).toBeVisible();
  await expect(page.locator('.showcase-roast')).toContainText('What quacks');
  await expect(page.locator('.showcase-roast')).toContainText(
    'Biggest hidden assumption',
  );
  const roasted = page.locator('[data-showcase-status="roasted"]').first();
  await expect(roasted).toHaveCSS('background-color', 'rgb(109, 40, 217)');
  await expect(
    page.getByRole('link', { name: /Read source revision/ }),
  ).toHaveAttribute('href', SHOWCASE_SOURCE_URL);
  await expect(page.locator('[data-showcase-status="showcase"]').first()).toHaveCSS(
    'color',
    'rgb(26, 22, 20)',
  );
  await expect(page.locator('.showcase-breakdown-grid span').first()).toHaveCSS(
    'color',
    'rgb(65, 105, 225)',
  );
});

test('Showcase submission reaches an exact Roast preview without product API calls', async ({
  page,
}) => {
  const productApiRequests = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      pathname.startsWith('/api/') &&
      pathname !== '/api/auth/config'
    ) {
      productApiRequests.push(request.url());
    }
  });

  await page.goto('/showcase/new/');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
  await page.getByLabel(/personal GitHub account that owns/).check();
  await page.getByLabel(/removed secrets, personal data/).check();
  const sourceUrl = page.getByLabel('Exact public PRD URL');
  const sourceRevision = page.getByRole('textbox', {
    name: 'Source revision',
    exact: true,
  });
  await sourceUrl.fill(
    'https://github.com/curationsx/yolo/blob/' +
      'c55b7845d4e0d8949befa9de9047835c6fd78f2e/' +
      'plan/member-profiles-and-prd-showcase.md',
  );
  await sourceRevision.fill('c55b7845d4e0d8949befa9de9047835c6fd78f2e');
  await page.getByRole('button', { name: 'Continue →' }).click();
  await expect(sourceUrl).toHaveJSProperty(
    'validationMessage',
    'PRD repository owner must match the signed-in GitHub login @CurationsLA.',
  );
  await sourceUrl.fill(SHOWCASE_SOURCE_URL);
  await sourceRevision.fill(SHOWCASE_SOURCE_SHA);
  await page.getByRole('button', { name: 'Continue →' }).click();
  await expect(
    page.getByText('Create the required purpose breakdown.', { exact: true }),
  ).toBeFocused();
  await expect(page.locator('.showcase-cli-prompt code')).not.toContainText(
    'copilot --',
  );
  await expect(page.locator('.showcase-cli-prompt code')).toContainText(
    SHOWCASE_SOURCE_URL,
  );
  await expect(page.locator('.showcase-cli-prompt code')).toContainText(
    SHOWCASE_SOURCE_SHA,
  );
  const approvedBreakdown =
    'PRD title: Member Profiles and PRD Showcase\n' +
    'Purpose in one sentence: Let builders discuss a source-linked plan.\n' +
    'Problem: Bare promotional links do not give reviewers enough context.\n' +
    `Source PRD URL: ${SHOWCASE_SOURCE_URL}\n` +
    `Source revision: ${SHOWCASE_SOURCE_SHA}`;
  const breakdownOutput = page.getByLabel('Copilot CLI output');
  const breakdownApproval = page.getByLabel(
    /reviewed this AI-assisted breakdown/,
  );
  await breakdownOutput.fill(approvedBreakdown);
  await page.getByLabel('Author-approved purpose in one sentence').fill(
    'A public place for builders to promote and discuss one source-linked PRD.',
  );
  await breakdownApproval.check();
  await breakdownOutput.fill(`${approvedBreakdown}\nOpen decisions: Profile scope.`);
  await expect(breakdownApproval).not.toBeChecked();
  await breakdownApproval.check();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await expect(
    page.getByText('Ask one useful human question.', { exact: true }),
  ).toBeFocused();
  await page
    .getByRole('textbox', { name: 'Discussion question', exact: true })
    .fill('Does this explain the PRD before asking readers to critique it?');
  await page.getByRole('checkbox', { name: 'TypeScript', exact: true }).uncheck();
  const roastConsent = page.getByRole('checkbox', {
    name: 'Open this PRD to a Rubber Duck Roast',
  });
  await expect(roastConsent).not.toBeChecked();
  await roastConsent.check();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await expect(
    page.getByText('Preview exactly what would become public.', { exact: true }),
  ).toBeFocused();

  await expect(page.locator('[data-showcase-title]').first()).toContainText(
    'Member Profiles and PRD Showcase',
  );
  await expect(page.locator('[data-showcase-question]').first()).toContainText(
    'Does this explain the PRD before asking readers to critique it?',
  );
  await expect(
    page.locator('[data-showcase-status="open-roast"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-showcase-status="roasted"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('.showcase-public-preview [data-stack-slug="typescript"]'),
  ).toBeHidden();
  await expect(page.locator('[data-showcase-breakdown]')).toHaveText(
    `${approvedBreakdown}\nOpen decisions: Profile scope.`,
  );
  await expect(page.locator('[data-showcase-source-revision]')).toHaveText(
    SHOWCASE_SOURCE_SHA,
  );
  await expect(page.locator('[data-showcase-review-mode]')).toHaveText(
    'Discussion',
  );
  await expect(page.locator('[data-showcase-roast-summary]')).toHaveText(
    'Open for structured Roast',
  );
  await expect(
    page.getByRole('link', { name: 'Read commit-pinned PRD ↗' }),
  ).toHaveAttribute('href', SHOWCASE_SOURCE_URL);

  const consent = page.getByLabel(/I reviewed this exact Showcase preview/);
  await consent.check();
  await page.getByRole('button', { name: '← Back' }).click();
  await page
    .getByRole('textbox', { name: 'Discussion question', exact: true })
    .fill('What is the smallest useful PRD Showcase profile?');
  await page.getByRole('button', { name: 'Continue →' }).click();
  await expect(consent).not.toBeChecked();

  await consent.check();
  await page
    .getByRole('button', { name: 'Send to maintainer review' })
    .click();
  await expect(page.locator('[data-showcase-pending]')).toContainText(
    'No Showcase was created, no PRD was fetched, and no model was invoked.',
  );
  expect(productApiRequests).toEqual([]);
});

test('public member profile is Curations-native and links GitHub separately', async ({
  page,
}) => {
  await page.goto('/members/curationsla/');

  await expect(page.getByRole('heading', { name: 'CurationsLA' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View GitHub ↗' })).toHaveAttribute(
    'href',
    'https://github.com/CurationsLA',
  );
  await expect(page.getByRole('link', { name: 'Showcases' })).toBeVisible();
  await expect(page.locator('[data-showcase-row]')).toHaveCount(1);
  await expect(page.getByText('No public Projects yet.')).toBeVisible();
  await expect(page.getByText(/No follower count/)).toBeVisible();
  await expect(page.getByText(/private GitHub activity/)).toBeVisible();
});

test('private member routes require identity and expose fixture content only after sign-in', async ({
  page,
  request,
}, testInfo) => {
  if (isExternalTarget(testInfo)) {
    const response = await request.get('/me/');
    const html = await response.text();
    expect(response.ok()).toBe(true);
    expect(html).toContain('Member persistence is not enabled.');
    expect(html).not.toContain('Private member home · fixture');
    return;
  }

  await page.goto('/me/');
  await expect(page.getByText('Sign in with GitHub to continue.')).toBeVisible();
  await expect(page.locator('[data-member-private-content]')).toBeHidden();

  await page.evaluate(() => {
    window.localStorage.setItem('curations.github.session', 'fixture-session');
  });
  await page.reload();
  await expect(page.locator('[data-member-private-content]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My CURATIONS' })).toBeVisible();
  await expect(page.locator('[data-auth-profile]')).toHaveAttribute('href', '/me/');

  await page.goto('/inbox/');
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();
  await expect(page.getByText(/No unrestricted private DMs/)).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: /Unread: New Rubber Duck Roast on your PRD Showcase/,
    }),
  ).toBeVisible();
  await expect(page.locator('.member-notification-reply').first()).toHaveCSS(
    'background-color',
    'rgb(65, 105, 225)',
  );

  await page.goto('/settings/ai-and-execution/');
  await expect(
    page.getByRole('group', { name: 'AI and execution boundaries' }),
  ).toBeVisible();
  await expect(page.getByLabel('Invite hosted AI on new Projects')).not.toBeChecked();
  await expect(page.getByText(/User-run, local, explicit/)).toBeVisible();
});
