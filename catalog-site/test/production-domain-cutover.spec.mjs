// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Production custom-domain cutover gate — NOT part of the deterministic local
 * / CI Visual Oracle suite. This test dials the real `curations.dev` and
 * `www.curations.dev` hostnames over the live network and only makes sense
 * to run once, by a human, right after the Azure Static Web Apps custom
 * domain cutover step below has actually been performed.
 *
 * ## Why this can't be automated end-to-end
 *
 * Azure Static Web Apps serves `www.curations.dev` -> `curations.dev` (301)
 * automatically once `curations.dev` is set as the app's *default* custom
 * domain — every other bound domain (including the generated
 * `*.azurestaticapps.net` hostname) then redirects to it. As of this writing
 * the Azure CLI has no documented `az staticwebapp hostname set-default`
 * (or equivalent) command, so marking `curations.dev` as default is a
 * **manual Azure Portal step**:
 *
 *   Static Web App resource -> Custom domains -> select `curations.dev`
 *   -> "Set as default"
 *
 * This must happen strictly after both `curations.dev` and
 * `www.curations.dev` are already validated and bound (see
 * `.azure/deployment-plan.md`'s DNS cutover steps — out of scope here), and
 * strictly before this test is expected to pass.
 *
 * Do NOT try to fake or pre-empt this redirect with a host-conditioned
 * `routes`/`redirect` rule in `staticwebapp.config.json`. Azure Static Web
 * Apps' route matching does not evaluate `Host`, so any such rule would
 * silently do nothing for real traffic while giving a false sense that the
 * redirect is "handled" in config. The default-domain mechanism above is the
 * only correct way to get this 301, and this test is the correct way to
 * verify it actually happened.
 *
 * ## Running this gate
 *
 *   VERIFY_PRODUCTION_DOMAIN_REDIRECT=1 npm run test:cutover-gate
 *
 * Left unset (the default), every test below is skipped — this file never
 * meaningfully runs as part of `npm test` / `npm run test:visual` / CI (it is
 * still collected, since it lives under `testDir`, but every test inside
 * short-circuits to "skipped" in that case, so it can never gate or fail a
 * normal run).
 */

const GATE_ENV_VAR = 'VERIFY_PRODUCTION_DOMAIN_REDIRECT';
const APEX_ORIGIN = 'https://curations.dev';
const WWW_ORIGIN = 'https://www.curations.dev';

test.describe('Azure custom-domain cutover gate (manual, post-cutover only)', () => {
  test.skip(
    !process.env[GATE_ENV_VAR],
    `Human-gated post-cutover check. Set ${GATE_ENV_VAR}=1 to run this after ` +
      'marking curations.dev as the default custom domain in the Azure Portal.',
  );

  test('www.curations.dev redirects 301 to the curations.dev default domain', async ({
    request,
  }) => {
    const response = await request.get(`${WWW_ORIGIN}/`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(301);
    const location = response.headers()['location'];
    expect(location).toBeTruthy();
    expect(new URL(location, WWW_ORIGIN).origin).toBe(APEX_ORIGIN);
  });

  test('curations.dev (default domain) serves the Board directly with 200', async ({
    request,
  }) => {
    const response = await request.get(`${APEX_ORIGIN}/`, { failOnStatusCode: false });
    expect(response.status()).toBe(200);
  });

  test('the redirect survives on a deep path, not just "/"', async ({ request }) => {
    const response = await request.get(`${WWW_ORIGIN}/cookbooks/`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(301);
    const location = response.headers()['location'];
    expect(new URL(location, WWW_ORIGIN).origin).toBe(APEX_ORIGIN);
  });
});
