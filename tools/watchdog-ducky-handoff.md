# Watchdog Ducky - Portable Handoff Playbook 🦆🛡️

You have successfully curated an automated AI Colleague that protects your repository's vision from scope creep. Watchdog Ducky is now a **composable GitHub Action**, meaning you can install it into *any* other repository. 

Here is exactly how to handoff and implement Watchdog Ducky anywhere else:

## 1. The Core Action Reference
In the target repository, create a new workflow file at `.github/workflows/ducky.yml` and paste this:

```yaml
name: Watchdog Ducky (Introspective Scope Monitor)
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  pull-requests: write
  contents: read

jobs:
  watchdog:
    name: Scope Guard
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Unleash the Watchdog
        # Pin to a full commit SHA (never @main) so upstream changes cannot
        # silently alter what runs in your CI. Grab the latest SHA from
        # https://github.com/curationsx/yolo/commits/main and update deliberately.
        uses: curationsx/yolo/.github/actions/watchdog-ducky@<commit-sha>
        with:
          rules-file: '.watchdog-rules.json'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 2. Define the Custom Ruleset
In the root directory of the target repository, create a `.watchdog-rules.json`. This acts as the explicit constraint map for the AI Colleague. Example:

```json
{
    "\\bthreads\\b": "Threads/conversation layer is deferred to >= v0.3.",
    "\\bpaid tier\\b": "Paid tier logic is deferred to >= v0.3."
}
```

## 3. The Power of this Moonshot (Top 0.1%)
By separating the logic from the `.github/workflows/` file and moving it into a **Reusable Action** (`.github/actions/`), Watchdog Ducky behaves like an NPM package. 
* **Dynamic Rules Engine**: It parses any JSON rule set you give it, making it entirely repository-agnostic.
* **Inline GitHub Annotations**: It doesn't just comment globally on the PR; it outputs exactly `::error file={file}::QUACK` so warnings display beautifully *inline* with the developer's code.

