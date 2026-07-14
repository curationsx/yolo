// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REFERENCE_VIEWPORT,
  NARROW_VIEWPORT,
  RESPONSIVE_SWEEP_WIDTHS,
  MARKER_TOLERANCE_RATIO,
  HEADER_ALIGNMENT_TOLERANCE_PX,
  installDeterministicNetwork,
  assertOracleScreenshot,
} from './support/constants.mjs';
import { measureMarkers } from './support/markers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKERS_BASELINE_PATH = path.join(__dirname, 'oracle', 'markers.reference.json');

/**
 * `true` only when this run targets a real, already-deployed hostname
 * (`BASE_URL=https://...`). That build serves live data instead of the
 * checked-in fixtures, so pixel/marker assertions that depend on fixture
 * content are skipped there by design — see playwright.config.mjs.
 */
const isExternalTarget = (testInfo) => Boolean(testInfo.config.metadata?.isExternalTarget);

test.beforeEach(async ({ page }) => {
  await installDeterministicNetwork(page);
});

test.describe('Visual Oracle — Board homepage (reference viewport)', () => {
  test.use({ viewport: REFERENCE_VIEWPORT });

  test('matches the checked-in oracle baseline within maxDiffPixelRatio 0.01', async (
    { page },
    testInfo,
  ) => {
    test.skip(
      isExternalTarget(testInfo),
      'Pixel oracle only runs against the fixture-filled local/CI build; live deploys serve real data.',
    );
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await assertOracleScreenshot(page, testInfo, 'board-home-reference.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('narrow viewport keeps the universal feed below the primary content', async ({
    page,
  }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);

    const stackColumn = page.locator('.board-stack-column');
    const feed = page.locator('#universal-feed');
    const stackBox = await stackColumn.boundingBox();
    const feedBox = await feed.boundingBox();
    expect(stackBox).not.toBeNull();
    expect(feedBox).not.toBeNull();
    // ACCEPTANCE.md #8 — narrow layouts retain the feed *below* primary content.
    expect(feedBox.y).toBeGreaterThanOrEqual(stackBox.y + stackBox.height - 1);
  });

  test('narrow viewport matches its own checked-in oracle baseline', async (
    { page },
    testInfo,
  ) => {
    test.skip(
      isExternalTarget(testInfo),
      'Pixel oracle only runs against the fixture-filled local/CI build; live deploys serve real data.',
    );
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await assertOracleScreenshot(page, testInfo, 'board-home-narrow.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('desktop keeps the universal feed as a right rail beside content', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);

    const stackColumn = page.locator('.board-stack-column');
    const feed = page.locator('#universal-feed');
    const stackBox = await stackColumn.boundingBox();
    const feedBox = await feed.boundingBox();
    // ACCEPTANCE.md #7 — desktop includes the universal feed as a right rail.
    expect(feedBox.x).toBeGreaterThan(stackBox.x + stackBox.width - 1);
    expect(feedBox.y).toBeLessThan(stackBox.y + stackBox.height);
  });
});

test.describe('Marker geometry (ACCEPTANCE.md — within 0.5% of viewport)', () => {
  test.use({ viewport: REFERENCE_VIEWPORT });

  test('board markers stay within 0.5% of their checked-in reference position', async (
    { page },
    testInfo,
  ) => {
    test.skip(
      isExternalTarget(testInfo),
      'Marker baseline is captured from fixture content; live deploys serve real data.',
    );
    test.skip(
      !fs.existsSync(MARKERS_BASELINE_PATH),
      `No checked-in marker baseline at ${MARKERS_BASELINE_PATH}. Generate one with ` +
        `"node test/oracle/generate-baseline.mjs" and commit it before enabling this check.`,
    );
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const measured = await measureMarkers(page);
    const baseline = JSON.parse(fs.readFileSync(MARKERS_BASELINE_PATH, 'utf8'));

    for (const [name, position] of Object.entries(measured)) {
      const reference = baseline[name];
      expect(reference, `Marker "${name}" missing from checked-in baseline`).toBeTruthy();
      expect(
        Math.abs(position.x - reference.x),
        `Marker "${name}" X drifted beyond 0.5% of viewport width`,
      ).toBeLessThanOrEqual(MARKER_TOLERANCE_RATIO);
      expect(
        Math.abs(position.y - reference.y),
        `Marker "${name}" Y drifted beyond 0.5% of viewport height`,
      ).toBeLessThanOrEqual(MARKER_TOLERANCE_RATIO);
    }
  });
});

test.describe('Header alignment (ACCEPTANCE.md — 12px tolerance)', () => {
  test.use({ viewport: REFERENCE_VIEWPORT });

  test('header content shares the same left edge as the main content column', async ({
    page,
  }) => {
    await page.goto('/');
    const headerWrap = await page.locator('.site-header .wrap').boundingBox();
    const mainWrap = await page.locator('main.wrap').boundingBox();
    expect(headerWrap).not.toBeNull();
    expect(mainWrap).not.toBeNull();
    expect(Math.abs(headerWrap.x - mainWrap.x)).toBeLessThanOrEqual(
      HEADER_ALIGNMENT_TOLERANCE_PX,
    );
  });
});

test.describe('No horizontal scroll (responsive sweep)', () => {
  for (const width of RESPONSIVE_SWEEP_WIDTHS) {
    for (const routePath of ['/', '/cookbooks/', '/software/ollama/', '/methodology/']) {
      test(`${routePath} has no horizontal scroll at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(routePath);
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
      });
    }
  }
});

test.describe('Board typography + surface invariants (ACCEPTANCE.md #1-#4)', () => {
  test.use({ viewport: REFERENCE_VIEWPORT });

  test('headings and body resolve to Inter', async ({ page }) => {
    await page.goto('/');
    const family = await page
      .locator('#featured-stacks .board-list-heading h1')
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(/Inter/i);
  });

  test('metadata resolves to JetBrains Mono', async ({ page }) => {
    await page.goto('/');
    const family = await page
      .locator('.site-nav')
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(/JetBrains Mono/i);
  });

  test('every rendered element has border-radius 0', async ({ page }) => {
    await page.goto('/');
    const offenders = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        const style = getComputedStyle(el);
        if (
          style.borderRadius &&
          style.borderRadius !== '0px' &&
          style.display !== 'none'
        ) {
          bad.push(el.tagName + (el.className ? `.${String(el.className).split(' ')[0]}` : ''));
        }
      }
      return bad;
    });
    expect(offenders).toEqual([]);
  });

  test('board shadows have zero blur', async ({ page }) => {
    await page.goto('/');
    const offenders = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        const shadow = getComputedStyle(el).boxShadow;
        if (shadow && shadow !== 'none') {
          // boxShadow serializes as "rgb(...) Xpx Ypx BLURpx SPREADpx" (offset-x offset-y blur spread)
          const match = shadow.match(/(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px/);
          if (match && Number(match[3]) !== 0) {
            bad.push({ el: el.tagName, shadow });
          }
        }
      }
      return bad;
    });
    expect(offenders).toEqual([]);
  });
});

test.describe('Identity language (ACCEPTANCE.md #9-#10)', () => {
  test('human identity uses blue, agent identity uses coral + explicit AI label', async (
    { page },
    testInfo,
  ) => {
    test.skip(
      isExternalTarget(testInfo),
      'Universal feed activity is fixture content; live deploys with no activity yet have nothing to assert on.',
    );
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const human = page.locator('.board-actor-human').first();
    const agent = page.locator('.board-actor-agent').first();
    await expect(human).toBeVisible();
    await expect(agent).toBeVisible();
    await expect(agent).toContainText(/AI/i);

    const humanColor = await human.evaluate((el) => getComputedStyle(el).color);
    const agentColor = await agent.evaluate((el) => getComputedStyle(el).color);
    expect(humanColor).not.toBe(agentColor);
  });
});

test.describe('Public repository proof + cookbook inventory (ACCEPTANCE.md #11-#12)', () => {
  test('footer keeps public repository proof visible and read-only', async ({ page }) => {
    await page.goto('/');
    const repoLink = page.locator('.site-footer a[href*="github.com/curationsx/yolo"]').first();
    await expect(repoLink).toBeVisible();
    // "Read-only" here means a normal outbound link, never a form/button that
    // mutates the repository from the browser.
    await expect(repoLink).toHaveAttribute('href', /^https:\/\/github\.com\//);
  });

  test('cookbook cards retain category filters, stack tailoring, code, and handoff', async ({
    page,
  }) => {
    await page.goto('/cookbooks/');
    await expect(page.locator('[data-cookbook-filter]').first()).toBeVisible();
    const firstCard = page.locator('[data-cookbook-card]').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.locator('[data-stack-select]')).toBeAttached();
    await expect(firstCard.locator('.cookbook-code')).toBeVisible();
    await expect(firstCard.locator('[data-fit-badge]')).toBeVisible();
    await expect(firstCard.locator('[data-handoff-open]')).toBeVisible();
  });

  test('saturated cookbook markers keep white, heavy text', async ({ page }) => {
    await page.goto('/cookbooks/');
    const markers = page.locator('.cookbook-glyph, .cookbook-category');
    expect(await markers.count()).toBeGreaterThan(0);
    const styles = await markers.evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return { color: style.color, fontWeight: Number(style.fontWeight) };
      }),
    );
    for (const style of styles) {
      expect(style.color).toBe('rgb(255, 255, 255)');
      expect(style.fontWeight).toBeGreaterThanOrEqual(700);
    }
  });
});

test.describe('Client module health', () => {
  test('Astro JavaScript loads without redirects or HTTP failures', async ({ page }) => {
    const failedAssets = [];
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (
        url.pathname.includes('/_astro/') &&
        url.pathname.includes('.js') &&
        response.status() >= 300
      ) {
        failedAssets.push({ status: response.status(), url: response.url() });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(failedAssets).toEqual([]);
  });

  test('Sign in with GitHub starts the configured gateway OAuth route', async ({ page }) => {
    await page.goto('/');
    const auth = page.locator('[data-auth-control]');
    const signIn = auth.locator('[data-auth-sign-in]');
    const api = await auth.getAttribute('data-api');
    expect(api).toMatch(/^https:\/\//);
    await expect(signIn).toBeEnabled();

    const returnTo = page.url();
    const oauthRequest = page.waitForRequest(
      (request) => request.url().startsWith(`${api}/api/auth/github/start?`),
    );
    await page.route(`${api}/api/auth/github/start?*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>OAuth handoff captured</title>',
      });
    });
    await signIn.click();

    const requestUrl = new URL((await oauthRequest).url());
    expect(requestUrl.pathname).toBe('/api/auth/github/start');
    expect(requestUrl.searchParams.get('return_to')).toBe(returnTo);
  });
});
