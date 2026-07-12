---
id: source-synthesis
title: Research Source Synthesis
category: research
version: 0.1.0
status: draft
license: MIT
tags: [research, synthesis, citations]
---

# Research Source Synthesis

## Purpose and non-goals

**Purpose:** Synthesize a set of user-provided sources into a structured summary with per-claim attribution, agreement/disagreement mapping, and confidence labels.

**Non-goals:** Not a literature search — it works only on sources you supply. Not a substitute for reading the sources on anything consequential. It must never cite anything not provided.

## Required inputs

- Two or more sources: pasted text or excerpts, each with a label (S1, S2, …) and origin (title/author/date if known).
- The synthesis question: what you want to learn from these sources.

## Prompt text

```text
You are a research assistant synthesizing ONLY the sources I provide. You have
no other knowledge for this task.

Rules:
- Every claim in your synthesis must cite its source label (S1, S2, ...).
- If sources disagree, show the disagreement explicitly; do not average it away.
- If my question cannot be answered from these sources, say exactly that and
  list what kind of source would be needed.
- Never introduce facts, statistics, or references that are not in the sources.
- Label each synthesized finding with confidence: HIGH (multiple sources
  agree), MEDIUM (single source, no contradiction), LOW (sources conflict or
  evidence is indirect).

Synthesis question: {{question}}

Sources:
{{labeled_sources}}

Produce:
1. Direct answer to the question (2-4 sentences, with citations)
2. Findings table: finding | supporting sources | confidence
3. Points of disagreement between sources
4. Gaps: what the sources do not cover relative to my question
5. Suggested follow-up questions for further research
```

## Expected output contract

- Every claim carries at least one source label.
- Findings table present with confidence labels from the defined scale.
- Disagreements surfaced, not smoothed over.
- Explicit "cannot answer from these sources" when true.

## Limitations and failure modes

- Models sometimes blend prior knowledge into the synthesis despite instructions — spot-check unusual specifics against the sources.
- Long sources may be summarized lossily before synthesis; provide excerpts rather than full documents when precision matters.
- Confidence labels reflect source agreement, not source *quality* — the model can't assess whether S2 is a credible outlet.

## Human review requirements

Verify at least the HIGH-confidence claims against the original sources before reusing them. Check that no citation points to content the source doesn't contain. You, not the model, judge source credibility.

## Privacy and data handling

Only paste sources you have the right to process. For internal documents, strip personal data and confidential identifiers first. Do not paste paywalled content into tools whose retention terms you haven't verified.

## Evaluation checks

- Random-sample three citations: does the cited source actually support the claim?
- Are conflicting sources shown as conflicts?
- Does the gaps section honestly reflect what's missing?

## Example usage

**Input (fictional):** Question: "What do these reviews say about the fictional NotesOwl app's offline mode?" Sources: S1 (a fictional blog review praising offline sync), S2 (a fictional forum thread reporting sync conflicts), S3 (fictional release notes claiming conflict fixes in v2.1).

**Conforming output sketch:** Answer notes offline mode exists and is praised (S1, HIGH for existence) but sync conflicts are reported (S2) and claimed fixed in v2.1 (S3) — labeled LOW confidence due to conflict, with a gap flagged: no post-v2.1 user reports provided.
