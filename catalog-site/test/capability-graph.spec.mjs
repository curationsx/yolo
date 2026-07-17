// @ts-check
import { test, expect } from '@playwright/test';
import { installDeterministicNetwork } from './support/constants.mjs';

const isExternalTarget = (testInfo) =>
  Boolean(testInfo.config.metadata?.isExternalTarget);

test.beforeEach(async ({ page }) => {
  await installDeterministicNetwork(page);
});

test('Skills master is job-first and shares Skill records with the Library', async ({
  page,
}) => {
  await page.goto('/skills/');

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex,follow',
  );
  await expect(page.getByRole('heading', { name: 'Find Skills' })).toBeVisible();
  await expect(page.locator('[data-skill-row]')).toHaveCount(5);
  for (const job of ['Plan', 'Design', 'Build', 'Review', 'Test', 'Ship', 'Grow']) {
    await expect(page.getByRole('link', { name: job, exact: true }).first()).toBeVisible();
  }
  await expect(page.locator('[data-capability-stamp="reviewed"]').first()).toBeVisible();
  await expect(
    page.locator('[data-capability-stamp="update-available"]'),
  ).toBeVisible();
  await expect(page.locator('[data-capability-stamp="stale"]')).toBeVisible();
  await expect(page.locator('[data-capability-stamp="retired"]')).toBeVisible();
  await expect(page.getByText(/popularity is not quality/)).toBeVisible();
  await expect(page.getByText('1 deferred', { exact: true })).toBeVisible();
  await expect(page.getByText('Submit my Skill')).toHaveCount(0);
  await expect(page.getByText('Nominate a public Skill')).toHaveCount(0);

  await page.goto('/library/');
  await expect(
    page.getByRole('link', { name: 'Schema-first planning', exact: true }),
  ).toHaveAttribute('href', '/skills/schema-first-planning/');
  await expect(
    page.getByRole('link', { name: 'Source-linked synthesis', exact: true }),
  ).toHaveAttribute('href', '/skills/source-synthesis/');
});

test('Skill detail separates trust, use outcomes, public examples, and local actions', async ({
  page,
}) => {
  const productRequests = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/') && pathname !== '/api/auth/config') {
      productRequests.push(request.url());
    }
  });

  await page.goto('/skills/release-rollback-rehearsal/');
  await expect(
    page.locator('[data-capability-stamp="update-available"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-capability-stamp="publicly-sourced"]').first(),
  ).toBeVisible();
  await expect(
    page.locator('[data-capability-stamp="ai-curated"]').first(),
  ).toBeVisible();
  await expect(page.getByText(/no external Skill imported/)).toBeVisible();

  const watch = page.getByRole('button', { name: /Watch/ });
  const save = page.getByRole('button', { name: /Save/ });
  const upvote = page.getByRole('button', { name: /Upvote/ });
  await watch.click();
  await save.click();
  await upvote.click();
  await expect(watch).toHaveAttribute('aria-pressed', 'true');
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  await expect(upvote).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-capability-action-status]')).toContainText(
    'Fixture only',
  );

  await page.goto('/skills/schema-first-planning/');
  await expect(
    page.locator('[data-capability-stamp="community-submitted"]').first(),
  ).toHaveAttribute(
    'aria-label',
    /authenticated owner identity and exact publication consent only; not a quality claim/,
  );
  await expect(
    page.getByRole('heading', { name: 'Explicit member reports' }),
  ).toBeVisible();
  const outcomeSection = page.locator('.project-detail-section').filter({
    has: page.getByRole('heading', { name: 'Explicit member reports' }),
  });
  await expect(outcomeSection.locator('.skill-outcome-marker')).toContainText(
    'SKILL OUTCOME',
  );
  await expect(
    outcomeSection.locator('[data-capability-stamp="community-submitted"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', {
      name: 'Cited examples remain separate from community outcomes',
    }),
  ).toBeVisible();
  expect(productRequests).toEqual([]);
});

test('private matches require identity and preserve explicit no-match behavior', async ({
  page,
  request,
}, testInfo) => {
  if (isExternalTarget(testInfo)) {
    const response = await request.get('/me/matches/');
    const html = await response.text();
    expect(response.ok()).toBe(true);
    expect(html).toContain('PRD matches persistence is not enabled.');
    expect(html).not.toContain('Schema-first planning now matches');
    return;
  }

  await page.goto('/me/matches/');
  await expect(page.getByText('Sign in with GitHub to continue.')).toBeVisible();
  await expect(page.locator('[data-member-private-content]')).toBeHidden();

  await page.evaluate(() => {
    window.localStorage.setItem('curations.github.session', 'fixture-session');
  });
  await page.reload();

  await expect(page.getByRole('heading', { name: 'PRD matches' })).toBeVisible();
  await expect(page.locator('[data-match-state]')).toHaveCount(3);
  await expect(page.locator('[data-match-state="strong-fit"]')).toContainText(
    'Schema-first planning',
  );
  await expect(page.locator('[data-match-state="possible-fit"]')).toContainText(
    'Source-linked synthesis',
  );
  await expect(page.locator('[data-match-state="no-match"]')).toContainText(
    'Nothing unreviewed substituted',
  );
  await expect(page.locator('[data-match-state="strong-fit"]')).toContainText(
    '4dccc0179b14c32f05be976a4d02ab4757a02d20',
  );
  await expect(page.locator('[data-match-state="strong-fit"]')).toContainText(
    '50103d669a49ed3c3695a76bc3d174a9030a51a5',
  );
  await expect(page.locator('[data-match-state="strong-fit"]')).toContainText(
    'capability-catalog-fixture/0.1',
  );
  await expect(page.locator('[data-match-state="strong-fit"]')).toContainText(
    'skill-match-fixture/0.1',
  );
  await page.getByRole('button', { name: 'Refresh matches' }).click();
  await expect(page.locator('[data-refresh-status]')).toContainText(
    'no fetch, repository read, or model call occurred',
  );

  await page.goto('/inbox/');
  await expect(
    page.getByRole('link', { name: /Unread: New reviewed Skill match available/ }),
  ).toBeVisible();

  await page.goto('/settings/contact/');
  await expect(
    page.getByRole('group', { name: 'Verified contact visibility' }),
  ).toBeVisible();
  await expect(page.getByLabel('Visibility')).toHaveValue('Private');
  await expect(page.getByText(/never imported from GitHub/)).toBeVisible();
});

test('no-match Skill Request remains member-started and sends no product request', async ({
  page,
  request,
}, testInfo) => {
  if (isExternalTarget(testInfo)) {
    const response = await request.get('/skills/request/');
    const html = await response.text();
    expect(response.ok()).toBe(true);
    expect(html).toContain('Skill Request persistence is not enabled.');
    expect(html).not.toContain('Send Skill Request');
    return;
  }

  const productRequests = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/') && pathname !== '/api/auth/config') {
      productRequests.push(request.url());
    }
  });

  await page.goto('/skills/request/');
  await expect(page.locator('[data-capability-stamp="no-match"]')).toBeVisible();
  await expect(page.getByText(/never auto-posts/)).toBeVisible();
  await expect(page.getByText('Sign in with GitHub to continue.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send Skill Request' })).toBeHidden();

  await page.goto('/skills/request/?fixture_auth=1');
  await expect(
    page.getByLabel('Watch this approved context for future reviewed matches.'),
  ).not.toBeChecked();
  const question = page.getByRole('textbox', { name: 'Human question' });
  const consent = page.getByLabel(/reviewed this exact fixture preview/);
  await page.getByLabel('Help intent').selectOption('Plan');
  await page.getByLabel('Host constraint').selectOption('Manual checklist');
  await question.fill('Which planning Skill preserves a zero-network boundary?');
  await expect(page.locator('[data-skill-request-question]')).toHaveText(
    'Which planning Skill preserves a zero-network boundary?',
  );
  await expect(page.locator('[data-skill-request-intent]')).toHaveText('Plan');
  await expect(page.locator('[data-skill-request-host]')).toHaveText(
    'Manual checklist',
  );
  await consent.check();
  await question.fill('Which planning Skill explains every match rule?');
  await expect(consent).not.toBeChecked();
  await consent.check();
  await page.getByRole('button', { name: 'Send Skill Request' }).click();
  await expect(page.locator('[data-skill-request-status]')).toContainText(
    'No thread, Watch, fetch, or model call occurred',
  );
  expect(productRequests).toEqual([]);
});

test('Toolkit keeps public Programs separate and makes Watch explicit', async ({
  page,
}) => {
  await page.goto('/toolkit/');
  await expect(page.getByRole('heading', { name: 'Startup Toolkit' })).toBeVisible();
  await expect(page.locator('[data-program-row]')).toHaveCount(3);
  await expect(page.getByText(/no paid placement/)).toBeVisible();

  await page.goto('/toolkit/product-hunt/');
  await expect(page.locator('[data-capability-stamp="program"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /Upvote/ })).toHaveCount(0);
  const watch = page.getByRole('button', { name: /Watch/ });
  const save = page.getByRole('button', { name: /Save/ });
  await watch.click();
  await save.click();
  await expect(watch).toHaveAttribute('aria-pressed', 'true');
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/Save does not enable notifications/)).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Visit Product Hunt/ }),
  ).toHaveAttribute('href', 'https://www.producthunt.com/');
});

test('public profile shows intentional Skill contribution without private interests', async ({
  page,
}) => {
  await page.goto('/members/curationsla/');
  await expect(
    page.getByRole('link', { name: /Schema-first planning/ }),
  ).toHaveAttribute('href', '/skills/schema-first-planning/');
  await expect(
    page.locator('[data-capability-stamp="community-submitted"]'),
  ).toBeVisible();
  await expect(page.getByText(/Intentional public Skill fixture contribution/)).toBeVisible();
  await expect(page.getByText('Explicit Stack follows')).toHaveCount(0);
  await expect(page.getByText(/Private Follows are not shown/)).toBeVisible();
  await expect(page.getByText(/Private eligibility notes/)).toHaveCount(0);
});
