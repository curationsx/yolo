---
id: meeting-notes-decisions-tasks-approval
title: Meeting Notes → Decisions → Tasks → Approval
version: 0.1.0
status: draft
maturity: foundation
license: MIT
tags: [meetings, decisions, tasks]
---

# Meeting Notes → Decisions → Tasks → Approval

## Overview

Converts raw meeting notes into a verified record of decisions and owned tasks, approved by the people who were in the room. Use for working meetings that produce decisions. Not for formal governance minutes with legal requirements — those follow your governance process.

## Actors

- **Note-taker** (human) — captures raw notes during the meeting.
- **Extraction model** (AI) — proposes structured decisions/tasks from the notes.
- **Meeting owner** (human) — corrects the extraction and circulates for approval.
- **Attendees** (humans) — confirm decisions attributed to them; accept tasks.

## Inputs and preconditions

- Raw notes (typed notes, whiteboard photos transcribed, or a consented transcript).
- Attendee list with roles.
- Attendees know AI will process the notes (consent; see privacy below).
- A task tracker category exists for the resulting tasks.

## Steps

1. **Capture** — *Note-taker* records notes with timestamps where possible. Done at meeting end.
2. **Sanitize** — *Meeting owner* removes off-record remarks and personal data irrelevant to outcomes. Done before any AI processing.
3. **Extract** — *Extraction model* is asked to list: decisions (with who decided), tasks (with proposed owner and due signal), and open questions — marking anything uncertain as UNCERTAIN rather than guessing. Done when output covers the notes.
4. **⛔ CHECKPOINT: Owner correction** — *Meeting owner* checks every extracted item against the raw notes; deletes inventions, restores omissions. Done when the owner would sign their name to the list.
5. **Circulate** — *Meeting owner* sends the corrected record to attendees with a response window and the note that silence is not consent for decisions attributed to them.
6. **⛔ CHECKPOINT: Attendee approval** — each *Attendee* confirms decisions attributed to them; task owners explicitly accept tasks. Disputes resolve by checking notes or amending the record.
7. **Commit** — *Meeting owner* files approved decisions in the decision log and creates tasks in the tracker. Done when links exist in the evidence trail.
8. **Learn** — recurring extraction errors noted; notes template or extraction instructions revised.

**Text flow equivalent:** capture → sanitize → extract → (checkpoint: owner corrects) → circulate → (checkpoint: attendees approve) → commit → learn.

## Tools (replaceable categories)

- Note capture: any editor or transcription tool used with consent.
- Extraction: any text model in a tool with acceptable data-handling terms.
- Decision log and task tracker: whatever the team already uses.

## Evidence captured

- Sanitized notes (the AI input).
- Raw extraction output vs. owner-corrected version (the diff shows AI reliability).
- Attendee confirmations.
- Links to filed decisions and created tasks.

## Failure modes

- **Invented decisions** — extraction states things more firmly than the room did. Caught at step 4; the diff record shows how often.
- **Task ownership by fiat** — proposed owners treated as assigned. Step 6's explicit acceptance prevents this.
- **Approval fatigue** — attendees stop reading circulations. Keep records short; only decisions and tasks, not prose summaries.
- **Sanitization skipped under time pressure** — make step 2 a hard precondition of step 3, not a nicety.

## Rollback and recovery

- Any item is freely editable before step 7.
- After commit: amend the decision log with a visible correction note; reassign or withdraw tasks in the tracker. Never silently edit an approved record.

## Privacy considerations

Meeting notes contain personal opinions and sometimes personal data. Attendees must know AI processing happens (step precondition). Sanitize before extraction. Recording/transcription follows local consent law. The extraction tool's retention terms must be verified for internal-meeting content.

## Success measures

- Step 4 correction rate falling over time (extraction improving).
- Zero disputes at step 6 traced to the record misstating the room.
- Tasks from meetings actually land in the tracker with accepted owners.
