// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureAgentOrigin } from '../scripts/configure-staticwebapp.mjs';

/**
 * Static assertions against `staticwebapp.config.json` itself — no server
 * needed. Astro's own dev/preview servers never read this file (it's an
 * Azure Static Web Apps platform config, not an Astro concept), so this is
 * the only way to regression-test its contents pre-deploy.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'public', 'staticwebapp.config.json');

/** @type {any} */
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const csp = config.globalHeaders?.['Content-Security-Policy'] ?? '';

function directive(name) {
  const match = csp.match(new RegExp(`${name}\\s+([^;]+)`));
  return match ? match[1].trim().split(/\s+/) : [];
}

test.describe('staticwebapp.config.json — caching + security contract', () => {
  test('is present and schema-shaped JSON', () => {
    expect(CONFIG_PATH).toContain(`${path.sep}public${path.sep}`);
    expect(config.globalHeaders).toBeTruthy();
    expect(Array.isArray(config.routes)).toBe(true);
  });

  test('hashed Astro assets get immutable, one-year caching', () => {
    const route = config.routes.find((r) => r.route === '/_astro/*');
    expect(route?.headers?.['cache-control']).toMatch(/immutable/);
    expect(route?.headers?.['cache-control']).toMatch(/max-age=31536000/);
  });

  test('keeps Astro asset URLs exact so relative ESM imports remain loadable', () => {
    expect(config.trailingSlash).toBe('auto');
  });

  test('versioned /copilot/ and /cookbooks/ prompt artifacts get immutable caching', () => {
    const copilot = config.routes.find((r) => r.route === '/copilot/*');
    const cookbooks = config.routes.find((r) => r.route === '/cookbooks/*');
    for (const route of [copilot, cookbooks]) {
      expect(route?.headers?.['cache-control']).toMatch(/immutable/);
    }
  });

  test('HTML and the cookbooks index revalidate instead of caching immutably', () => {
    const catchAll = config.routes.find((r) => r.route === '/*');
    const cookbooksIndexes = ['/cookbooks/', '/cookbooks/index.html'].map((path) =>
      config.routes.find((r) => r.route === path),
    );
    for (const route of [catchAll, ...cookbooksIndexes]) {
      expect(route?.headers?.['cache-control']).toMatch(/must-revalidate/);
      expect(route?.headers?.['cache-control']).not.toMatch(/immutable/);
    }
  });

  test('route and fallback patterns use at most one Azure Static Web Apps wildcard', () => {
    const patterns = [
      ...config.routes.map((route) => route.route),
      ...(config.navigationFallback?.exclude ?? []),
    ];
    for (const pattern of patterns) {
      expect(pattern.match(/\*/g) ?? []).toHaveLength(pattern.includes('*') ? 1 : 0);
    }
  });

  test('both exact cookbooks index request forms precede the immutable wildcard rule', () => {
    const indexRules = ['/cookbooks/', '/cookbooks/index.html'].map((path) =>
      config.routes.findIndex((r) => r.route === path),
    );
    const artifactRule = config.routes.findIndex((r) => r.route === '/cookbooks/*');
    for (const indexRule of indexRules) {
      expect(indexRule).toBeGreaterThanOrEqual(0);
      expect(artifactRule).toBeGreaterThan(indexRule);
    }
  });

  test('security headers are present (CSP/HSTS/frame/MIME/referrer)', () => {
    const headers = config.globalHeaders;
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=\d+/);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBeTruthy();
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });

  test('CSP connect-src permits production api.curations.dev', () => {
    expect(directive('connect-src')).toContain('https://api.curations.dev');
  });

  test('build configuration permits only the exact generated Azure gateway origin', () => {
    const stagingOrigin =
      'https://ca-yolo-gateway.example-environment.eastus2.azurecontainerapps.io';
    const configured = configureAgentOrigin(config, stagingOrigin);
    const configuredCsp = configured.globalHeaders['Content-Security-Policy'];
    expect(configuredCsp).toContain(stagingOrigin);
    expect(configuredCsp).not.toContain('*.azurecontainerapps.io');
    expect(csp).not.toContain('*.azurecontainerapps.io');
  });

  test('build configuration rejects non-HTTPS or credential-bearing API URLs', () => {
    expect(() => configureAgentOrigin(config, 'http://example.com')).toThrow(/HTTPS origin/);
    expect(() => configureAgentOrigin(config, 'https://user:pass@example.com')).toThrow(
      /without credentials/,
    );
  });

  test('CSP does not weaken font/style sources needed by the Visual Oracle', () => {
    expect(directive('font-src')).toContain('https://fonts.gstatic.com');
    expect(directive('style-src')).toContain('https://fonts.googleapis.com');
    expect(csp).toContain("default-src 'self'");
  });
});
