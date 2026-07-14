# PR #5 Visual Oracle Proofs

These captures verify the production Astro implementation against
`catalog-site/design-oracle/claude-board/`.

- Desktop viewport: `1280x800`
- Mobile viewport: `390x844`
- Fixture mode: local development only, enabled with
  `PUBLIC_BOARD_FIXTURES=true`
- Fixture data writes: none

## Board home

![Board home at 1280x800](board-home-desktop.png)

![Board home at 390x844](board-home-mobile.png)

## Cookbooks

![Cookbooks at 1280x800](cookbooks-desktop.png)

## User-funded Cookbook lanes

The handoff captures use a `1280x1100` desktop viewport and `390x844` mobile
viewport. They verify that the Board hierarchy remains intact while the billing
and privacy boundaries stay visibly distinct.

![Use My Copilot at 1280x1100](copilot-lane-desktop.png)

![Use My Copilot at 390x844](copilot-lane-mobile.png)

![Run in My Terminal at 390x844](terminal-lane-mobile.png)

## Cloudflare company Board

![Cloudflare Board at 1280x800](cloudflare-board-desktop.png)

The computed-style acceptance pass confirms Inter hierarchy, JetBrains Mono
metadata, zero radius, hard zero-blur shadows, `1px` row separators, `2px`
primary borders, blue human identity, coral agent identity, a desktop feed
rail, and a retained mobile feed below the stack list.
