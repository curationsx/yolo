// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// Deployed to GitHub Pages at https://curationsx.github.io/yolo/ by default.
// For curations.dev (Cloudflare Pages): ASTRO_SITE=https://curations.dev ASTRO_BASE=/
export default defineConfig({
  site: process.env.ASTRO_SITE ?? 'https://curationsx.github.io',
  base: process.env.ASTRO_BASE ?? '/yolo',
  trailingSlash: 'always',
  integrations: [sitemap()],
});