# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
| `npm run test:visual`     | Run the Visual Oracle / Azure SWA Playwright suite against a local fixture-filled dev server |
| `npm run test:visual:update` | Regenerate checked-in Playwright screenshot baselines (only after an approved Board change) |
| `npm run test:cutover-gate` | Manual, human-gated 301 check for the `www.curations.dev` -> `curations.dev` custom-domain cutover (see below) |
| `npm run playwright:install` | Install the pinned Chromium build Playwright needs |

## 🔭 Visual Oracle verification

`playwright.config.mjs` + `test/visual-oracle.spec.mjs` enforce
[`design-oracle/claude-board/ACCEPTANCE.md`](./design-oracle/claude-board/ACCEPTANCE.md):
pixel parity (`maxDiffPixelRatio <= 0.01`), marker geometry within 0.5% of the
viewport, 12px header alignment, and no horizontal scroll across a responsive
sweep. See the comments at the top of `playwright.config.mjs` for how the same
suite runs locally, in CI, and against a deployed Azure Static Web Apps
hostname (`BASE_URL=https://<swa-hostname> npm run test:visual`).

## 🚪 Custom-domain cutover gate (`www.curations.dev` -> `curations.dev`)

Production currently serves `https://www.curations.dev/` as a 301 to
`https://curations.dev/`. On Azure Static Web Apps this is a platform feature,
not app config: mark `curations.dev` as the Static Web App's **default custom
domain**, and every other bound domain (`www.curations.dev`, the generated
`*.azurestaticapps.net` hostname) redirects to it automatically. The Azure CLI
has no documented `set-default` command for this today, so it is a **manual
Azure Portal step**, done once, after both domains are already validated and
bound:

> Static Web App resource -> **Custom domains** -> select `curations.dev` ->
> **Set as default**

`public/staticwebapp.config.json` intentionally contains **no** host-conditioned
`redirect`/`routes` rule to reproduce this — Azure Static Web Apps route
matching doesn't evaluate `Host`, so such a rule would silently no-op for real
traffic while looking like it "handles" the redirect. The platform mechanism
above is the only correct source of the 301.

`test/production-domain-cutover.spec.mjs` is the post-cutover verification: it
is skipped by default (never runs as part of `npm test` / CI) and only dials
the real `curations.dev` / `www.curations.dev` hostnames when explicitly
enabled, after the manual Portal step above:

```sh
VERIFY_PRODUCTION_DOMAIN_REDIRECT=1 npm run test:cutover-gate
```

## 🌉 Two-stage gateway build (`azure-staging` -> `production`)

The same committed SHA is built **twice** ahead of DNS cutover, with
`PUBLIC_AGENT_API` pointed at a different origin each time (see
`.azure/deployment-plan.md`, out of scope here):

1. **`azure-staging`** — built with the generated `ca-yolo-gateway` Container
   Apps hostname, so the generated Azure Static Web Apps hostname exercises
   the real Azure gateway during Stage 2/3 verification instead of silently
   still hitting Cloudflare.
2. **`production`** — rebuilt from the same SHA with `PUBLIC_AGENT_API=https://api.curations.dev`
   immediately before DNS cutover.

The checked-in `public/staticwebapp.config.json` permits the production API.
After every Astro build, `scripts/configure-staticwebapp.mjs` reads
`PUBLIC_AGENT_API` and adds only that exact HTTPS origin to the deployed
`dist/staticwebapp.config.json`. Staging therefore reaches its generated Azure
gateway without granting browser connections to unrelated Container Apps.
`test/staticwebapp-config.spec.mjs` regression-guards this contract.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
