---
name: weekly-prep
description: Prepare for the weekly Monday meeting. Generates a Slack-ready update, per-person summaries with links, and a facilitation guide with speaking order and conversation starters.
argument-hint: "<project-name>"
---

# Weekly Meeting Prep

Prepare everything needed for the Monday weekly meeting on a Linear project: a Slack-ready update, per-person activity summaries, and a facilitation guide that tells you who to call on first and what to ask them.

## Arguments

- `$ARGUMENTS` — the project name (required)

## Workflow

### 1. Fetch issues updated in the last 7 days

```bash
linproj issues list --project "$ARGUMENTS" --json -n 200
```

From the results, identify issues where `updatedAt` falls within the last 7 days. These are the "active this week" issues.

Also keep track of ALL issues in active states (To Do, In Progress, Paused, In Review) regardless of update date — these form the full picture of ongoing work.

Identify issues in "Tracking" state — these represent workstreams. Group sub-issues under their parent tracking issue throughout the analysis to give workstream context, not just flat lists.

### 2. Fetch comments for active issues

For each issue that is In Progress, In Review, or Paused, fetch recent comments to understand what happened this week:

```bash
linproj issues comments list <IDENTIFIER> --json --limit 5
```

Parallelize these calls where possible to save time. Skip issues in To Do or Backlog — they rarely have meaningful weekly updates.

### 3. Build per-person activity profiles

For each person with assigned issues in active states, compile:

- **Status changes this week:** issues that moved between states (infer from current state + updatedAt)
- **Comments posted this week:** comments they authored in the last 7 days
- **Currently In Progress:** their active work right now
- **Currently Paused:** work they've paused with reasons (from comments)
- **In Review:** PRs/work awaiting review

Calculate an **update coverage** score (not shown in output — internal only) for facilitation ordering:
- High coverage: person has recent comments on their active issues, status changes are reflected, descriptions are up to date
- Low coverage: person has In Progress or Paused issues with no comments or updates this week

### 4. Determine facilitation order

Sort people by how much they need to share verbally:

1. **Speak first:** people with low update coverage — they have active issues but little written context this week. The meeting is where we'll get that context.
2. **Speak middle:** people with moderate coverage — some updates exist but there are gaps or open questions.
3. **Speak last (or skip):** people with high coverage — their work is well-documented. Note: "Skip unless questions" is fine for these people.

### 5. Prepare conversation starters

For each person who should speak (first and middle groups), prepare 1-2 specific questions based on their issues. These should be:

- **Concrete**, not generic — reference the actual issue identifier and title
- **Helpful**, not interrogative — the goal is to help them share context, not put them on the spot
- **Gap-filling** — ask about things that aren't documented yet

Good question patterns:
- "ENG-45 has been In Progress since last Tuesday — how's it going, anything blocking you?"
- "You paused ENG-32 — is that still waiting on the API team, or has something changed?"
- "ENG-78 moved to In Review — anything reviewers should know before looking at it?"

Bad question patterns (avoid these):
- "Why haven't you updated ENG-45?" (accusatory)
- "What did you do this week?" (too generic)
- "Can you explain your lack of progress?" (toxic)

## 6. Output

Produce two sections: the **Slack Update** (copy-pasteable) and the **Facilitation Guide** (for the meeting runner only).

---

### Part 1: Slack Update

Format this as a Slack message using Slack's mrkdwn syntax (not markdown). This gets pasted directly into Slack.

```
:calendar: *Weekly Update — <Project Name>*
_Week of <date range>_

*Key updates this week:*
• <one-line summary of most notable change> (<IDENTIFIER> — <linear issue URL>)
• <second notable change> (<IDENTIFIER> — <linear issue URL>)
• <third notable change> (<IDENTIFIER> — <linear issue URL>)
(list 3-7 highlights, prioritize completed work and meaningful progress)

*Currently in progress:*
(group by tracking issue/workstream when possible)
• *<Tracking issue title>:*
    • <IDENTIFIER> — <title> (<assignee>) — <linear issue URL>
• <IDENTIFIER> — <title> (<assignee>) — <linear issue URL>
(list all In Progress issues; items under a tracking issue are indented, standalone items are flat)

*In review:*
• <IDENTIFIER> — <title> (<assignee>) — <linear issue URL>
(list all In Review issues, omit section if none)

*Paused / blocked:*
• <IDENTIFIER> — <title> — <reason from comments> — <linear issue URL>
(list all Paused issues with reasons, omit section if none)
```

To get issue URLs, use the `url` field from the JSON output if available. If not available, construct them as `https://linear.app/issue/<IDENTIFIER>`.

### Part 2: Facilitation Guide

This is for the meeting facilitator. Not posted to Slack.

```
# Facilitation Guide

## Speaking Order

### 1. <Person Name> — start here
**Active issues:** <list identifiers>
**Update coverage:** Low — no comments or status changes on active issues this week
**Ask:**
- "<specific question about ENG-XX>"
- "<specific question about ENG-YY>"

### 2. <Person Name>
**Active issues:** <list identifiers>
**Update coverage:** Moderate — some updates but gaps on <identifier>
**Ask:**
- "<specific question>"

### 3. <Person Name> — skip unless questions
**Active issues:** <list identifiers>
**Update coverage:** High — all issues well-documented this week
**No questions needed** — their updates in Linear cover everything. Mention: "Your updates on ENG-XX and ENG-YY are clear — anything else to add?"

---

## Hygiene Flags

Issues that violate guide best practices — mention these during the meeting if appropriate:
- <IDENTIFIER> — <person> has N issues In Progress (guide recommends one per person)
- <IDENTIFIER> — Paused without explanation comment
- <IDENTIFIER> — In Progress for N days without updates
(Keep this brief — 2-3 items max. The goal is awareness, not a lecture.)

## Open Threads

Issues that might need group discussion (not just one person):
- <IDENTIFIER> — <why this needs discussion>
(e.g., blocked issues waiting on decisions, cross-team dependencies, scope questions)

## Quick Stats

| Metric | Value |
|--------|-------|
| Issues updated this week | N |
| Issues completed this week | N |
| Issues currently In Progress | N |
| Issues currently Paused | N |
| New issues created this week | N |
```

## Important Notes

- This skill is read-only — it never modifies issues
- Use `--json` output from linproj for reliable field access
- "This week" means the last 7 days from today's date
- The facilitation guide should feel supportive, not surveillance-like. The tone is "let's make sure nothing falls through the cracks" not "let's see who's slacking"
- If a person has no active issues at all, don't include them in the speaking order
- If everyone has high update coverage, say so — "The team's Linear updates are thorough this week. Consider a shorter meeting focused on the Open Threads section."
- If `linproj` commands fail with auth errors, tell the user to run `linproj auth login`
- Always include Linear issue URLs in the Slack update so people can click through
