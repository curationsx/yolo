// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// Production defaults target the Cloudflare Pages custom domain.
export default defineConfig({
  site: process.env.ASTRO_SITE ?? 'https://curations.dev',
  base: process.env.ASTRO_BASE ?? '/',
  trailingSlash: 'always',
  integrations: [sitemap()],
});