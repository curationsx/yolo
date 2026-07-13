# CURATIONS agent gateway

Cloudflare Worker for `api.curations.dev`.

It is the only write gateway for the static Astro site and owns:

- GitHub OAuth identity (`read:user` only),
- Azure OpenAI persona calls,
- server-side model/rate limits,
- Cosmos DB discussions and votes,
- read-only public GitHub repository marker checks,
- opaque CURATIONS sessions in KV.

## Secrets

Set with Wrangler; never commit values:

```bash
npx wrangler secret put AZURE_OPENAI_API_KEY
npx wrangler secret put COSMOS_KEY
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

`GITHUB_REPOSITORY_TOKEN` is optional. Without it, public repository metadata
uses GitHub's anonymous API allowance. If one is added later, it must be a
read-only token used only for public metadata checks; never reuse a contributor's
OAuth access token or the OAuth app client secret.

Repository verification is deliberately narrow: the Worker reads public
metadata and a small allowlist of marker files at a user-selected stack root.
It does not clone, execute, modify, or deploy community repositories. A marker
is evidence of setup, not an audit or endorsement.

## One-time GitHub OAuth app

GitHub does not expose OAuth app registration through its API. Create the app
under the `curationsx` organization (or the approved CURATIONS owner) with:

- **Application name:** `CURATIONS.DEV Community`
- **Homepage URL:** `https://curations.dev`
- **Authorization callback URL:** `https://api.curations.dev/api/auth/github/callback`
- **Device flow:** disabled

The Worker uses state + PKCE, requests only `read:user`, verifies the profile,
then discards GitHub's access token. Only an opaque CURATIONS session remains.

## Local checks

```bash
npm ci
npm run check
```

The Azure deployment must remain mini-tier and pay-as-you-go. Do not add PTU,
reserved model capacity, or a prepaid monthly token package.
