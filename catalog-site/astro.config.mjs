// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// Production defaults target the curations.dev custom domain. Overridable via
// ASTRO_SITE/ASTRO_BASE for local dev, staging, and the generated Azure
// Static Web Apps hostname used for post-deploy verification.
export default defineConfig({
  site: process.env.ASTRO_SITE ?? 'https://curations.dev',
  base: process.env.ASTRO_BASE ?? '/',
  trailingSlash: 'always',
  devToolbar: {
    enabled: process.env.PUBLIC_COMMUNITY_PREVIEW !== 'true',
  },
  integrations: [sitemap()],
});