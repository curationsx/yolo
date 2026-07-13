# Software submission intake

The form at `curations.dev/submit/` creates one JSON file in this directory and
hands the contributor into GitHub's fork/branch/pull-request flow.

Submission files are **review artifacts**, not published catalog records. A
maintainer verifies the official sources, folds accepted fields into
`software/entries.json`, regenerates `catalog.json`, and removes the intake file
before merge.

This keeps `software/entries.json` as the single authoritative dataset while
letting non-technical contributors use a guided web form.
