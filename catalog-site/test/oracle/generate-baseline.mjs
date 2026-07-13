// @ts-check
/**
 * One-off generator for the checked-in marker geometry baseline
 * (`test/oracle/markers.reference.json`).
 *
 * This is intentionally NOT part of the Playwright test run — the suite only
 * ever *reads* the checked-in baseline. Regenerate and re-commit deliberately
 * (after a genuine, approved Board layout change) by running:
 *
 *   npm run dev -- --host 127.0.0.1 --port 4321   (in one terminal, with
 *     PUBLIC_BOARD_FIXTURES=true and PUBLIC_AGENT_API=https://agent-api.fixture.invalid)
 *   node test/oracle/generate-baseline.mjs          (in another terminal)
 *
 * or simply:
 *
 *   npm run test:visual:generate-markers
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFERENCE_VIEWPORT, installDeterministicNetwork } from '../support/constants.mjs';
import { measureMarkers } from '../support/markers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, 'markers.reference.json');
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4321';

async function main() {
  const browser = await chromium.launch({
    args: [
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--disable-font-subpixel-positioning',
      '--force-color-profile=srgb',
    ],
  });
  try {
    const page = await browser.newPage({
      viewport: REFERENCE_VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: 'light',
      locale: 'en-US',
      timezoneId: 'UTC',
      reducedMotion: 'reduce',
    });
    await installDeterministicNetwork(page);
    await page.goto(BASE_URL);
    await page.evaluate(() => document.fonts.ready);
    const markers = await measureMarkers(page);
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(markers, null, 2)}\n`);
    console.log(`Wrote ${OUTPUT_PATH}`);
    console.log(JSON.stringify(markers, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
