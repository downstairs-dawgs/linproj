---
name: weekly-update
description: Draft a weekly project status update for posting to Linear
argument-hint: "<project-name>"
---

# Weekly Project Status Update

Draft an end-of-week project status update for Linear. Analyzes recent issue activity, references past updates for tone/style matching, and produces a review-ready draft with a suggested health rating.

## Arguments

- `$ARGUMENTS` — the project name (required)

## Workflow

### 1. Fetch recent project updates for style reference

```bash
linproj projects updates "$ARGUMENTS" --json --limit 3
```

These past updates establish the team's writing style, level of detail, formatting conventions, and typical content structure. Study them carefully before drafting.

### 2. Fetch all project issues

```bash
linproj issues list --project "$ARGUMENTS" --json -n 200
```

From the results, categorize issues by their current state and identify activity from the last 7 days by comparing `updatedAt` to today's date.

### 3. Analyze the week's activity

From the issue data, identify:

- **Completed this week:** issues where `state.type == "completed"` and `updatedAt` is within the last 7 days
- **In Progress:** issues currently in an active working state
- **Moved forward:** issues that changed state this week (inferred from `updatedAt` recency + current state)
- **New this week:** issues where `createdAt` is within the last 7 days
- **Paused / Blocked:** issues in a paused or blocked state
- **In Review:** issues awaiting review
- **Tracking issues:** identify issues in "Tracking" state — these represent workstreams. Group sub-issues under their parent tracking issue to show progress by workstream, not just flat lists. The goal is that someone reading the update quickly sees the main workstreams, what's active, and what's next.

### 4. Analyze past update style

Before drafting, study the 3 most recent updates fetched in step 1:

- **Format:** Do they use bullet points, paragraphs, headers? What sections do they include?
- **Detail level:** Are items one-liners or do they include sub-bullets with context?
- **Tone:** Formal or casual? First person ("we") or third person ("the team")?
- **Content patterns:** Do they link to issues? Mention people by name? Include metrics?
- **Structure:** What comes first — accomplishments, blockers, or next steps?

Mirror these conventions in the draft. If no past updates exist, use the default format below.

### 5. Draft the update

Produce the update body following the team's established style, or this default format if no past updates exist:

```
**What did the team accomplish this week?**
* <completed item> — [IDENTIFIER](url)
* <progress item> — [IDENTIFIER](url)
    * <detail, achievement, or note>

**What does the team want to accomplish next week?**
* <planned item> — [IDENTIFIER](url)
* <continuation of in-progress work>

[PLACEHOLDER: <prompt for what to fill in, e.g. "Any customer feedback, external blockers, or cross-team dependencies to mention?">]
```

**Key rules for the draft:**

- Every mentioned issue MUST include its Linear URL from the `url` field in the JSON data
- Use `[PLACEHOLDER: <description>]` for anything you aren't confident about — future priorities, external context, stakeholder feedback, team-specific details only a human would know
- Completed items come first, then progress, then planned work
- Be specific — "Shipped the new auth flow" is better than "Made progress on auth"
- Match the granularity of past updates — if past updates mention 3 items, don't list 15

### 6. Suggest a health rating

Analyze the week's data and suggest one of:

- **on-track** — work is progressing as expected, no major blockers
- **at-risk** — some concerns: stale issues, growing blockers, slower-than-expected progress
- **off-track** — significant problems: many blocked issues, critical items stalled, no completions

Provide 2-3 bullet points of reasoning so the person can evaluate and adjust.

Signals to consider:
- Ratio of completed vs new issues this week
- Number of issues stuck in the same state for >7 days
- Presence of blocked/paused issues without resolution paths
- Whether In Progress issues are actively moving
- Paused issues missing explanation comments (a sign of poor hygiene)
- Anyone with multiple In Progress issues (guide recommends one per person)

### 7. Output

Present the complete output in this structure:

---

**Draft Update**

<the full update body, ready to paste or post>

---

**Suggested Health:** `<on-track|at-risk|off-track>`

<reasoning bullets>

---

**Style Notes**

<1-3 observations about how this draft compares to the team's past updates, e.g. "Past updates include a 'Blockers' section — I've added one to match." or "No past updates found — using default format.">

---

**Ready-to-run command**

```bash
linproj projects update "$ARGUMENTS" --health <suggested-health> --body "<escaped body>"
```

Or for longer updates:

```bash
cat <<'BODY' | linproj projects update "$ARGUMENTS" --health <suggested-health>
<update body>
BODY
```

---

Then ask the user: "Want me to post this update? You can edit the body or health rating first, or I can post it as-is."

## Important Notes

- This skill is read-only until the user explicitly approves posting
- Use `--json` output from linproj for reliable field access
- "This week" means the last 7 days from today's date
- If the project has no past updates, note this and use the default format
- If there are no issues or no recent activity, say so honestly rather than fabricating content
- Placeholders are a feature, not a bug — they signal where human judgment is needed
- If `linproj` commands fail with auth errors, tell the user to run `linproj auth login`
- Always include Linear issue URLs so people can click through to the issues
