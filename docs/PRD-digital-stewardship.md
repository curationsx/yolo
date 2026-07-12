# PRD — Digital Stewardship for CurationsX AoT

**Status:** Draft · **Owner:** CurationsX · **Scope:** Community foundation for Human × AI workflows

## 1. Purpose

Establish digital stewardship as the operating principle of CurationsX YOLO and **AoT — Artificial of Things**: a community framework that enables people and AI systems to collaborate accountably, with clear guardrails, transparent provenance, and shared responsibility for outcomes.

## 2. Background

As new AI engines and model families are released, expectations around safety, compliance, and public trust evolve quickly. Communities building Human × AI workflows need a stable stewardship layer that adapts to these shifts without depending on any single engine, vendor, or naming convention.

## 3. Goals

1. **Enable community participation** — provide clear pathways for contributors to propose, review, and refine Human × AI workflows.
2. **Codify guardrails** — document safety, compliance, and ethical boundaries that apply to all AoT workflows, and keep them versioned as engines and regulations change.
3. **Promote nuance-aware engagement** — encourage workflows that surface AI limitations, uncertainty, and human judgment points rather than hiding them.
4. **Ensure provenance and accountability** — every workflow artifact should identify its human and AI contributions.

## 4. Non-Goals

- Building or endorsing a specific AI engine or model.
- Automating decisions that require human accountability.
- Replacing legal or regulatory compliance review.

## 5. Guiding Principles

| Principle | Meaning |
| --- | --- |
| Human primacy | Humans set intent, review outputs, and own final decisions. |
| Transparency | AI involvement is disclosed; provenance is traceable. |
| Adaptive guardrails | Safety boundaries are versioned and updated with each engine or regulatory shift. |
| Community governance | Stewardship rules evolve through open proposals and review. |
| Nuance over automation | Workflows highlight ambiguity and judgment points, not just answers. |

## 6. Functional Requirements

### 6.1 Stewardship Charter
- A `STEWARDSHIP.md` charter defining roles (steward, contributor, reviewer), responsibilities, and escalation paths.

### 6.2 Guardrail Registry
- A versioned document of active guardrails (content boundaries, data handling rules, disclosure requirements).
- Change log tied to engine releases and regulatory updates.

### 6.3 Workflow Templates
- Templates for proposing Human × AI workflows, including required sections: purpose, human checkpoints, AI role, risk assessment, and provenance notes.

### 6.4 Community Contribution Process
- Contribution guide (`CONTRIBUTING.md`) describing how community members submit workflows and guardrail proposals via pull requests.
- Review criteria emphasizing accountability, transparency, and nuance.

## 7. Success Criteria

- Charter, guardrail registry, and contribution guide published and linked from README.
- First community-submitted workflow reviewed and merged under the stewardship process.
- Guardrail registry updated within one release cycle of any relevant engine or policy change.

## 8. Open Questions

- What governance cadence (e.g., quarterly review) fits the community's size?
- Which external frameworks (e.g., NIST AI RMF, EU AI Act guidance) should the guardrail registry reference?
- How should provenance metadata be standardized across workflow artifacts?

## 9. Milestones

1. **M1 — Foundation:** Publish this PRD, charter skeleton, and guardrail registry stub.
2. **M2 — Process:** Publish contribution guide and workflow template.
3. **M3 — Community:** Onboard first external contributors and merge first stewarded workflow.
