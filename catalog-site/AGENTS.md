## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Product source of truth

Read `../docs/PRD-curations-community.md` before changing public claims, Project
submission, community surfaces, tool-page Project rails, personas, Cookbooks, or
execution handoffs. Read `../docs/PRD-project-evidence-registry.md` before
changing repository intake or evidence. The Visual Oracle controls presentation;
the Community PRD controls product meaning and public language.

## Visual Oracle

The epiphany, operationalized. Claude Design's Board render is the Visual Oracle
and the production acceptance contract. Cloud integration may ADD reliability —
it may not simplify the artifact.

Canonical reference files live in:

```
catalog-site/design-oracle/claude-board/
```

For the stack directory, company boards, public proof rails, feed, GitHub identity,
and cookbooks:

- Follow `ui_kits/inspiration-board/board-app.jsx`,
  `board-views.jsx`, and `board-cookbooks.jsx`.
- Preserve the dense Lobste.rs-style hierarchy: compact rows, score rails, mono
  metadata, tabs, thread indentation, feed rail, and disclosed agent blocks.
- Use Inter for Board display/body hierarchy and JetBrains Mono for metadata/code.
- Use opaque white/paper surfaces, zero radius, hairline separators, `2px` primary
  borders, and hard offset shadows with no blur.
- Humans use blue identity language. Agents use coral identity language and are
  always explicitly labeled.
- Do not replace Board surfaces with editorial-scale heroes, card grids, or
  simplified mobile summaries.

The copied oracle is immutable reference material. Update it only by replacing it
from the approved Claude Design package and regenerating `SHA256SUMS`.

The oracle's mocked `fable5max` and unsupported Copilot CLI flags are not production
behavior requirements. Production handoff must remain truthful while preserving
the approved visual structure.

## Cookbook execution contract

Cookbooks must preserve the Board oracle while presenting two visibly distinct,
truthful paths:

- **Use My Copilot:** one response through the official GitHub Copilot SDK, paid
  by the authenticated user's Copilot plan. The browser must disclose that
  CURATIONS receives the prompt and returned response.
- **Run in My Terminal:** copy the versioned handoff prompt. The browser must
  disclose that CURATIONS receives neither the local prompt nor the local result.

Do not merge the trust language, hide billing, expose repository/tool permissions,
or add a CURATIONS-funded fallback. Embedded prompt artifacts under `/copilot/`
are immutable build outputs for a specific cookbook version and stack.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
