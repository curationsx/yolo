// @ts-check
import { defineConfig, devices } from '@playwright/test';
import { FIXTURE_AGENT_API, REFERENCE_VIEWPORT } from './test/support/constants.mjs';

/**
 * Azure Static Web Apps + Visual Oracle verification lane.
 *
 * Three spec files, one config:
 *   - test/visual-oracle.spec.mjs           — ACCEPTANCE.md pixel/geometry/
 *     structural checks (see below).
 *   - test/staticwebapp-config.spec.mjs     — static assertions against
 *     public/staticwebapp.config.json itself (caching + CSP/security headers).
 *     Needs no server; regression-guards the Stage 2/3 CSP `connect-src`
 *     entries below. The postbuild script narrows staging to the exact
 *     generated Container Apps gateway origin.
 *   - test/production-domain-cutover.spec.mjs — human-gated, skipped unless
 *     VERIFY_PRODUCTION_DOMAIN_REDIRECT=1 (see that file / README).
 *
 * test/visual-oracle.spec.mjs enforces `design-oracle/claude-board/ACCEPTANCE.md`:
 *   - reference viewport 1280x800 @ device scale factor 1 (narrow: 390x844)
 *   - maxDiffPixelRatio <= 0.01 against a checked-in, deterministic baseline
 *   - marker geometry within 0.5% of viewport size
 *   - header/main alignment within 12px
 *   - no horizontal scroll at the responsive widths swept in the spec
 *
 * The same spec file runs two ways:
 *   1. Locally / in CI against a fixture-filled `astro dev` server (default,
 *      no BASE_URL set) — this is the only mode that runs the strict
 *      pixel-diff + marker-geometry oracle assertions, because it is the
 *      only mode with deterministic, checked-in fixture content.
 *   2. Post-deploy against a real hostname via
 *      `BASE_URL=https://<swa-hostname> npm run test:visual`. That build
 *      serves live (non-fixture) data, so the suite automatically narrows
 *      itself to content-agnostic structural + geometry + security-header
 *      checks and skips the pixel/marker assertions — the same file is safe
 *      to run against the generated Azure Static Web Apps hostname without
 *      ever regenerating the oracle from live production output.
 *
 * Font rasterization is only bit-identical across machines that share the
 * same OS font stack. To keep `maxDiffPixelRatio <= 0.01` meaningful (rather
 * than weakening the threshold), run this suite inside the pinned
 * `mcr.microsoft.com/playwright:v1.61.1-jammy` image — matching the
 * `@playwright/test` version pinned in package.json — via
 * `npm run test:visual:ci`, so the checked-in baseline PNGs are always
 * compared against renders produced by that same deterministic image.
 * Locally, on a different OS, the screenshot assertions use a
 * platform-suffixed snapshot file (Playwright's default behavior) and may
 * need `npm run test:visual:update` once per platform; geometry/marker/
 * no-scroll checks are platform-independent and always run.
 *
 * IMPORTANT — do not rely on Playwright's own default for a missing
 * baseline: out of the box it silently *writes whatever just rendered as the
 * new baseline and passes*, with no human review. On a platform with no
 * reviewed baseline yet (e.g. the first Linux CI run, when only a macOS
 * baseline is checked in), that would quietly accept an unreviewed render as
 * the oracle's new ground truth. `test/visual-oracle.spec.mjs` calls
 * `assertOracleScreenshot()` (see `test/support/constants.mjs`) instead of
 * `expect(page).toHaveScreenshot()` directly — it skips loudly, with the
 * exact fix, when a platform's baseline doesn't exist yet, and only performs
 * the strict 0.01 comparison once a human has deliberately generated and
 * committed that platform's baseline.
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4321);
const HOST = process.env.PLAYWRIGHT_HOST ?? '127.0.0.1';
const EXTERNAL_BASE_URL = process.env.BASE_URL;
const BASE_URL = EXTERNAL_BASE_URL ?? `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: './test',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    baseURL: BASE_URL,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    forcedColors: 'none',
    deviceScaleFactor: 1,
    viewport: REFERENCE_VIEWPORT,
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
    launchOptions: {
      args: [
        '--font-render-hinting=none',
        '--disable-lcd-text',
        '--disable-font-subpixel-positioning',
        '--force-color-profile=srgb',
        '--disable-partial-raster',
        '--disable-skia-runtime-opts',
        '--hide-scrollbars',
        '--disable-gpu',
      ],
    },
  },
  projects: [
    {
      name: 'chromium-oracle',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: EXTERNAL_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --host ${HOST} --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          PUBLIC_BOARD_FIXTURES: 'true',
          PUBLIC_AGENT_API: FIXTURE_AGENT_API,
        },
      },
  metadata: {
    isExternalTarget: Boolean(EXTERNAL_BASE_URL),
  },
});
