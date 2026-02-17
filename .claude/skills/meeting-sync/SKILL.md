---
name: meeting-sync
description: Take raw meeting notes or transcript and sync updates back to the relevant Linear issues. Handles ambiguous attribution and issue matching by presenting proposed changes for approval before writing.
argument-hint: "<project-name> [path-to-notes-file]"
---

# Meeting Sync

Take unstructured meeting notes or a transcript and push the updates back into the right Linear issues — as comments, description improvements, or status changes. Handles the messy reality that meeting notes don't clearly say who spoke or which exact issue is being discussed.

## Arguments

- `$ARGUMENTS` — the project name, optionally followed by a path to a notes file

If a file path is provided, read the notes from that file. If only a project name is provided, ask the user to paste the meeting notes.

## Workflow

### 1. Get the meeting notes

If `$ARGUMENTS` contains a file path (second argument), read that file. Otherwise, use AskUserQuestion to ask the user to paste the notes.

The notes might be:
- A raw transcript from speech-to-text (messy, repetitive, no punctuation)
- Manually typed notes (bullet points, shorthand)
- A mix of both
- A document with sections per person or per topic

Accept whatever format they come in. Do not ask for a cleaner version.

### 2. Fetch active issues from the project

```bash
linproj issues list --project "<project-name>" --json -n 200
```

Build a reference table of all active issues: identifier, title, description, state, assignee. This is your matching corpus.

### 3. Extract update chunks from the notes

Parse the meeting notes into discrete **update chunks** — each chunk is one piece of information about one topic. A single paragraph might contain multiple chunks.

For each chunk, extract:
- **Content:** what was said (summarized clearly, not verbatim)
- **Implied person:** who likely said it or who it's about (if inferrable — often it isn't, and that's fine)
- **Implied issue:** which Linear issue this relates to (could be obvious, ambiguous, or unclear)

### 4. Match chunks to issues

For each chunk, assign a confidence level for the issue match:

- **High confidence:** the notes mention an issue identifier directly (e.g., "ENG-45"), or the topic maps unambiguously to a single issue title/description
- **Medium confidence:** the topic could plausibly match 2-3 issues, or the match relies on keyword overlap with a title
- **Low confidence:** the topic is vague or doesn't clearly map to any existing issue
- **No match:** the update doesn't relate to any existing issue (might be a new topic, action item, or off-topic)

### 5. Decide the update type for each chunk

For each matched chunk, determine what kind of update it should become:

- **Comment:** new information, progress update, decision made, blocker identified. This is the most common type. Format as a clear, concise comment attributed to the meeting.
- **Description improvement:** the discussion revealed context that should live in the issue description (the "why", background, constraints). Only propose this if the current description is missing this context.
- **Status change:** the discussion clearly indicates the issue should move (e.g., "we decided to pause X" → move to Paused, "Y is done" → move to Done). Only propose if the intent was unambiguous.
- **New issue:** the discussion introduced a new work item, action item, or blocker that doesn't belong on any existing issue. Propose creating a new issue with a title, description, and optional assignee/priority.

### 6. Present proposed changes for approval

This is the critical step. **Never write to Linear without showing the user what you plan to do first.**

Present all proposed changes grouped by issue:

```
# Proposed Updates from Meeting Notes

## High Confidence Matches

### ENG-45 — <title>
**1. Add comment:**
> <proposed comment text>
> _Source: meeting notes — "[relevant excerpt]"_

**2. Update description** (append to existing):
> <proposed addition>

---

## Medium Confidence Matches (please confirm)

### ENG-32 — <title> (could also be ENG-38)
**1. Add comment:**
> <proposed comment text>
> _Source: "[relevant excerpt]"_

→ Is this the right issue? [ENG-32 / ENG-38 / skip]

---

## Suggested New Issues

These updates didn't map to any existing issue. Create them?

### NEW — <proposed title>
**Description:**
> <proposed description, derived from meeting notes>

**Assignee:** <name, if inferrable from who was asked to do it>
**Priority:** <Urgent/High/Medium/Low/None — infer from meeting tone>
**Source:** "<relevant excerpt from notes>"

**Tracking issue:** <identifier of the tracking issue this belongs under, if one exists>

→ Create? [yes / skip / edit title]

Guidance on when to propose a new issue vs skip:
- **Propose** when: a concrete action item was assigned, a new blocker was identified, or a new workstream was discussed
- **Skip** when: the topic was casual/off-topic, already covered by an existing issue's scope, or too vague to be actionable

New issues should belong under a tracking issue whenever possible. Look at the project's existing issues fetched in Step 2 to find tracking issues (status = "Tracking") that cover the relevant workstream. If no tracking issue fits, note that in the proposal so the user can decide.

---

## Proposed Status Changes

- ENG-45: In Progress → Paused (reason: "<from notes>")
- ENG-78: In Progress → Done

→ Approve status changes? [yes / no / selective]
```

Use AskUserQuestion to get approval. The user can:
- Approve all
- Approve selectively (approve some, skip others)
- Reassign medium-confidence matches to different issues
- Skip unmatched chunks or request new issues be created

### 7. Apply approved changes

For approved comments:
```bash
linproj issues comments add <IDENTIFIER> "<comment text>"
```

For approved description updates, use the stdin editing format:
```bash
cat <<EOF | linproj issues edit <IDENTIFIER>
---
---
<full updated description with the new context appended>
EOF
```

For approved status changes:
```bash
linproj issues edit <IDENTIFIER> --state "<new state>"
```

If a status change is to Paused, also add the explanation comment from the notes.

For approved new issues, follow the guide's conventions: title = what the issue is, description = why we're doing it + context. New issues start in Backlog by default (the guide says "Backlog is where most new issues should start").

```bash
linproj issues create --team <TEAM_KEY> --title "<title>" --description "<description>"
```

Then assign the new issue to the project and tracking issue. `--team` can be inferred from the project's existing issues (they all share the same team key). `--assign-to-me` is the only assignee option at create time; for other assignees, use `linproj issues edit` after creation.

```bash
linproj issues edit <IDENTIFIER> --project "<project-name>"
```

If a tracking issue was identified, add the new issue as a sub-issue:
```bash
linproj issues edit <IDENTIFIER> --parent <TRACKING_IDENTIFIER>
```

If an assignee other than the current user was identified:
```bash
linproj issues edit <IDENTIFIER> --assignee "<email>"
```

### 8. Summary

After applying changes, output a summary:

```
# Meeting Sync Complete

**Project:** <name>
**Issues updated:** N
**Comments added:** N
**Descriptions improved:** N
**Status changes:** N
**Issues created:** N
**Skipped (unmatched):** N

## Changes Applied
- ENG-45: added comment, updated description
- ENG-32: added comment
- ENG-78: moved to Done
- ENG-123: created (new issue from meeting notes)
```

## Comment Formatting

When writing comments from meeting notes, follow this format:

```
📋 **Meeting update** (<date>)

<Clear, concise summary of what was discussed about this issue>

<If a decision was made:>
**Decision:** <what was decided>

<If a blocker was identified:>
**Blocker:** <what's blocking and what would unblock>

<If next steps were discussed:>
**Next steps:** <what happens next>
```

Keep comments factual and concise. Do not pad with filler. If the meeting only produced one sentence of relevant info for an issue, the comment should be one sentence.

## Handling Ambiguity

This skill must handle messy, real-world input gracefully:

- **Unknown speaker:** if you can't tell who said something, don't attribute it. Write "The team discussed..." or "It was mentioned that..." instead of guessing.
- **Ambiguous issue match:** always surface the ambiguity to the user rather than guessing. A wrong comment on the wrong issue is worse than no comment.
- **Overlapping topics:** if one discussion section touches multiple issues, split it into separate comments for each issue rather than posting one long comment on one issue.
- **Contradictions:** if the notes contradict what's in Linear (e.g., notes say "done" but issue is In Progress with recent activity suggesting otherwise), flag it for the user rather than assuming the notes are authoritative.
- **Names vs. usernames:** people in meeting notes are referenced by first name, nickname, or role. Match them to Linear assignees by best guess but don't stress about it — attribution is secondary to getting the content into the right issue.

## Important Notes

- **Always confirm before writing.** This skill modifies Linear issues. Never skip the approval step.
- Read each issue's existing description before proposing description changes — don't duplicate what's already there.
- If `linproj` commands fail with auth errors, tell the user to run `linproj auth login`.
- For comments, prefer short and useful over comprehensive. One good sentence beats three vague ones.
- If the meeting notes are mostly off-topic or don't relate to the project's issues, say so and don't force matches.
