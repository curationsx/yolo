#!/usr/bin/env node
/**
 * Wiki build step (G7) — renders the repository's docs/ directory into
 * catalog-site/dist/wiki via docmd (pinned exact version; see the
 * capability audit of 2026-07-18 in docs/audits/).
 *
 * Runs after `astro build` (which wipes dist/), from catalog-site/ as cwd.
 * The docmd config lives at the repository root (docmd.config.json) so the
 * wiki always renders the repo's docs truth — never a stale copy.
 *
 * Falsifying proof honoured here: docmd regenerates the whole tree each
 * run, so a deleted docs/ file cannot survive into the next build.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const outDir = resolve(repoRoot, 'catalog-site/dist/wiki');
const docmdBin = resolve(here, '../node_modules/.bin/docmd');

if (!existsSync(docmdBin)) {
  console.error('build-wiki: docmd binary not found — run npm ci in catalog-site first.');
  process.exit(1);
}

execFileSync(docmdBin, ['build'], { cwd: repoRoot, stdio: 'inherit' });

// docs/ has no index.md by design (START-HERE.md is the entry point), so
// docmd emits no /wiki/ root page. Provide an honest redirect, not a page.
const rootIndex = resolve(outDir, 'index.html');
if (!existsSync(rootIndex)) {
  writeFileSync(
    rootIndex,
    '<!doctype html><meta charset="utf-8">' +
      '<meta http-equiv="refresh" content="0; url=/wiki/START-HERE/">' +
      '<title>CURATIONS.DEV Wiki</title>' +
      '<a href="/wiki/START-HERE/">Start here</a>\n',
  );
}

const pages = readdirSync(outDir).length;
console.log(`build-wiki: /wiki ready (${pages} top-level entries).`);
