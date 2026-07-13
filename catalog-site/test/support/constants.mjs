// @ts-check
import fs from 'node:fs';
import { test, expect } from '@playwright/test';

/**
 * Shared constants for the Visual Oracle verification lane. Imported by both
 * `playwright.config.mjs` (to configure the local dev webServer) and the spec
 * files (to know which network calls to intercept and which assertions are
 * safe to run against an external, already-deployed BASE_URL).
 */

/** Reference viewport from ACCEPTANCE.md — full desktop Board layout. */
export const REFERENCE_VIEWPORT = { width: 1280, height: 800 };

/** Narrow viewport from ACCEPTANCE.md — universal feed drops below content. */
export const NARROW_VIEWPORT = { width: 390, height: 844 };

/**
 * Additional widths swept for the "no horizontal scroll" acceptance check.
 * Covers common device widths, every CSS breakpoint declared in
 * `src/styles/global.css` (40rem/47rem/48rem/56rem/64rem @ 16px root), the
 * ACCEPTANCE.md reference width, and a large desktop width above it.
 */
export const RESPONSIVE_SWEEP_WIDTHS = [
  320, 375, NARROW_VIEWPORT.width, 430, 640, 752, 768, 896, 1024,
  REFERENCE_VIEWPORT.width, 1536, 1920,
];

/** Marker geometry tolerance, in fraction of the relevant viewport axis. */
export const MARKER_TOLERANCE_RATIO = 0.005; // 0.5%

/** Header/content left-edge alignment tolerance, in CSS pixels. */
export const HEADER_ALIGNMENT_TOLERANCE_PX = 12;

/**
 * Sentinel, unreachable-by-design API origin. Sets the built site's "agent
 * API is configured" code paths to their truthy branch — this is what makes
 * the fixture score rails / thread counts / universal feed render — while
 * every request against it is intercepted and fulfilled deterministically by
 * `installDeterministicNetwork()` below. It is never dialed over real
 * network and is not a production origin.
 */
export const FIXTURE_AGENT_API = 'https://agent-api.fixture.invalid';

/**
 * Installs deterministic, offline route handling for the one live network
 * call the Board oracle surface makes on first paint with fixtures enabled:
 * `AuthButton`'s `${api}/api/auth/config` check. Every other fixture-mode
 * code path (`BoardActivityFeed`, `SoftwareVotes`) short-circuits on the
 * checked-in `board-fixtures.ts` data before any fetch happens.
 *
 * Also defensively intercepts any other `FIXTURE_AGENT_API` call (e.g. the
 * Community Board's discussion/PRD endpoints on stack detail pages) with a
 * fast, deterministic "unavailable" response instead of letting the request
 * hang or hit a real network, so every page stays fully offline and
 * reproducible under the same 1280x800 / 390x844 acceptance viewports.
 *
 * Must be called before `page.goto()`.
 */
export async function installDeterministicNetwork(page) {
  await page.route(`${FIXTURE_AGENT_API}/**`, async (route) => {
    const url = route.request().url();
    if (url.endsWith('/api/auth/config')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ github: true }),
      });
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'fixture network is intentionally offline' }),
    });
  });
}

/**
 * Guards `expect(page).toHaveScreenshot(name, options)` against Playwright's
 * default "no baseline yet" behavior: when the platform-specific snapshot
 * file (e.g. `*-darwin.png` vs `*-linux.png`) doesn't exist, Playwright's
 * default `updateSnapshots` mode *silently writes the current render as the
 * new baseline and passes the test* — with no human review. On a platform
 * that has never had a reviewed baseline committed (a fresh Linux CI runner,
 * for example, when only a macOS baseline exists in the repo), that would
 * quietly turn whatever that first render happens to look like into the
 * accepted "ground truth", defeating the point of the 0.01 pixel-diff
 * contract instead of just weakening its threshold.
 *
 * This skips (loudly, with the exact fix) instead of silently accepting a
 * never-reviewed render as truth. Once a baseline is deliberately captured
 * and committed for a platform (`npm run test:visual:update`, reviewed by a
 * human, then committed), this becomes a normal strict comparison again.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {string} name
 * @param {Parameters<import('@playwright/test').PageAssertions['toHaveScreenshot']>[1]} [options]
 */
export async function assertOracleScreenshot(page, testInfo, name, options) {
  const expectedPath = testInfo.snapshotPath(name);
  test.skip(
    !fs.existsSync(expectedPath),
    `No reviewed baseline for this platform/project yet at ${expectedPath}. ` +
      'Generate one deliberately with "npm run test:visual:update", have a human ' +
      'review the resulting PNG, and commit it — never let this test silently ' +
      'accept an unreviewed first render as the new oracle truth.',
  );
  await expect(page).toHaveScreenshot(name, options);
}

