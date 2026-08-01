# Cloudflare credit options for curations.dev

**Date:** 2026-08-01
**Author:** Frank
**Status:** Recommendation only. No Cloudflare setting was changed to produce this document.

## Why this document exists

There is roughly $10,000 of Cloudflare startup credit on the account that already
holds `curations.dev`, and it has barely been touched. The repository walked away
from Cloudflare deliberately in July 2026, so the obvious question is whether
"use the credits" and "Azure is the sole production authority" are actually in
conflict.

They are not, and the reason is narrower than it first appears.

## What the mandate actually forbids

`docs/PRD-project-evidence-registry.md` section 12 says:

> Legacy Cloudflare deployment definitions remain in the repository from the
> completed cutover; Phase 0 must retire or hard-gate them so a routine push
> cannot recreate a second **production authority**.

The hazard named is a *deployment* authority: a `wrangler deploy` in CI quietly
standing up a second origin that serves `curations.dev`, so that two systems both
believe they are production and nobody can say which one a visitor hit. That is a
real and serious failure mode, and it is why `.github/workflows/azure-deploy.yml`
is the only path to production.

The mandate does not say "do not use Cloudflare." It says do not let anything
other than Azure be the origin.

## What is actually true today

Measured 2026-08-01 against zone `ec40491a5032ad2c157b21c2bdf02293`:

| Fact | Value |
|---|---|
| `curations.dev` nameservers | `decker.ns.cloudflare.com`, `daisy.ns.cloudflare.com` |
| Zone plan | **Free Website** |
| Account | `35d4cd8b7e16e06466013e4284554c62` (the account holding the credits) |
| `curations.dev` | CNAME to Azure Static Web Apps, **`proxied = false`** |
| `www.curations.dev` | CNAME to Azure Static Web Apps, **`proxied = false`** |
| `api.curations.dev` | CNAME to Azure Container Apps, **`proxied = false`** |
| Response headers | no `cf-ray`, no `cf-cache-status` |

So Cloudflare already owns DNS for the production domain, and does nothing else.
Every byte a visitor requests goes straight from their browser to Azure. There is
no CDN in front of it, no WAF, no bot filtering, no cache, no request analytics,
and no rate limiting at the edge.

The domain is also already validated by TXT (`_dnsauth.curations.dev` and
`_dnsauth.www.curations.dev` both exist), which is the method Azure Static Web
Apps requires and the method that survives proxying. That materially lowers the
risk of the first option below.

## Option 1 — Turn on the orange cloud

**Cost: nothing. Uses no credits. Reversible in one click.**

Proxy `curations.dev` and `www.curations.dev`. The origin stays Azure Static Web
Apps. Deploys still happen only through `azure-deploy.yml`. Nothing becomes a
second production authority, because nothing new serves content: Cloudflare
becomes a cache and a filter in front of the same single origin.

What it buys:

- A WAF and bot filtering in front of a site that is about to start accepting
  public repository submissions from strangers.
- Edge caching of the static Astro shell, which is most of the site.
- Request analytics. Right now there is no measurement of who visits
  `curations.dev` at all, which is an odd gap for a project whose entire thesis
  is verifiable measurement.
- Rate limiting at the edge, ahead of the gateway's own per-IP quotas rather
  than instead of them.

Honest caveats:

- Azure Static Web Apps already has its own CDN, so the raw latency win is
  modest. The real gains are the WAF, the analytics, and the rate limiting.
- Proxy first on `www` only, confirm certificate renewal survives a full cycle,
  and only then consider the apex. Azure validation is TXT-based here, which is
  the safe configuration, but certificate renewal under proxy is the thing to
  watch.
- Leave `api.curations.dev` unproxied for now. The gateway is the part with
  streaming and long-lived request behaviour, and it is the part where a
  surprise would be most expensive.

## Option 2 — Spend the unused Enterprise domain slot

**Cost: uses credit. Highest raw value per dollar.**

The startup grant includes three Enterprise domain slots. Two are in use by
CurationsLA properties. One is unused, and the grant runs out around July 2027,
so it is a use-it-or-lose-it asset rather than a saving.

`curations.dev` is currently on the Free plan. Putting the spare Enterprise slot
on it is the single largest capability jump available, and it changes nothing
about who serves the site.

This should be confirmed against the actual invoice or the account team before
acting, because the slot count is recorded from a previous session rather than
read from the dashboard today. It is the one number in this memo that is not
independently verified.

Sequencing note: this option only pays off if Option 1 happens too. An Enterprise
plan on a zone where every record is grey-clouded buys nothing at all.

## Option 3 — Put AI Gateway in front of Azure AI Foundry

**Cost: free. Core AI Gateway features are free on every plan.**

This is the option that fits the product rather than the infrastructure.

The PRD's runtime architecture already describes a disclosed persona lane calling
Azure AI Foundry with **bounded spend**. Today that bound is enforced by the
gateway's own counters. `agent-worker/src/azure.ts` restricts calls to a single
deployment and caps `max_completion_tokens`, and the daily caps live in config.
That is sound, but it is self-reported: the system that spends the money is also
the only system that measures the spending.

Cloudflare AI Gateway sits between the caller and Azure OpenAI and adds an
independent layer of measurement and control:

- per-request token and cost logs
- configurable **spend limits** enforced outside the application
- response caching, which for repeated deterministic audit prompts is a direct
  cost reduction
- rate limiting independent of application code

Azure OpenAI is a first-class provider. The gateway URL is
`https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/azure-openai/{resource_name}/{deployment_name}`.

Why this is worth more here than at most companies: this project's entire
argument is that a claim without independent evidence is just an assertion. A
spend bound that only the spender can see is exactly that. AI Gateway turns
"bounded spend" from a promise into a number somebody else is holding.

Scope, honestly stated: this is a small code change, not a pure environment
change. `agent-worker/src/azure.ts:45` builds `${endpoint}/openai/v1/chat/completions`,
and the gateway path shape differs. It is one function and one variable, plus
keeping the existing deployment allowlist intact. It is not free of work, it is
just small.

It also does not touch the origin, does not deploy anything to Cloudflare, and
does not create a second production authority. It is an outbound call changing
its route.

## What would actually violate section 12

For completeness, so the line is unambiguous:

- deploying the Astro site to Cloudflare Pages
- deploying `agent-worker` as a live Cloudflare Worker on a route
- adding a `routes` or `custom_domain` entry to `agent-worker/wrangler.toml`
- any CI step that runs `wrangler deploy` without `--dry-run`

The last two are now blocked mechanically by the guard added in issue #102.

## Recommendation

1. **Option 1**, on `www` first, as a reversible experiment. It costs nothing,
   it closes a real security gap before strangers start submitting
   repositories, and it gives the project the visitor measurement it currently
   lacks entirely.
2. **Option 3**, when the Tier B persona lane is next touched. It converts a
   self-reported spend bound into an independently observable one, which is
   philosophically the same move this repository makes everywhere else.
3. **Option 2**, only after 1 and 3 prove the edge is doing useful work, and
   only after confirming the spare slot really exists.

## Incidental hygiene noticed while measuring

Not urgent, not part of the recommendation, recorded so it is not lost:

- `books.curations.dev` points at `64.23.186.251`, unproxied, and is not
  referenced anywhere in this repository.
- `lax.curations.dev` and `brands.curations.dev` point at Cloudflare Pages
  projects (`newsletter-beta.pages.dev`, `brands-917.pages.dev`).
- `la.curations.dev` points at `curationsdev.github.io`.

None of these serve `curations.dev` itself, so none of them are the section 12
hazard. They are simply subdomains nobody has audited in a while, and each one is
a live surface with somebody else's deploy authority behind it. Worth a look on a
quiet afternoon.
