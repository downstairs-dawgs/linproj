---
name: lint-project
description: Lint a Linear project's issues against best practices from Benji's guide. Checks for stale issues, missing context, status discipline violations, and content quality problems.
argument-hint: "<project-name>"
---

# Lint Linear Project

Analyze all active issues in a Linear project against best practices defined in Benji's Guide to Using Linear. Produces a structured report with actionable findings grouped by severity.

## Arguments

- `$ARGUMENTS` — the project name to lint (required)

## Workflow

### 1. Fetch all active issues

```bash
linproj issues list --project "$ARGUMENTS" --json -n 200
```

This returns JSON with fields: identifier, title, description, state, assignee, dueDate, createdAt, updatedAt, priority, labels, etc.

If no issues are returned, report "No issues found for project" and stop.

### 2. Fetch comments for Paused issues only

For each issue where `state` is "Paused", fetch its comments:

```bash
linproj issues comments list <IDENTIFIER> --json
```

This is needed for Rule 5 (Paused without explanation).

### 3. Apply lint rules

Apply all 11 rules below to every fetched issue. Track findings as a list of `{rule, severity, identifier, title, detail, suggestion}`.

---

## Lint Rules

### Deterministic Rules (check field values directly)

**Rule 1 -- To Do stale (>2 weeks)**
- Severity: Warning
- Condition: `state == "To Do"` AND issue has not been updated in more than 14 days (compare `updatedAt` to today's date)
- Detail: "In To Do for N days without activity"
- Suggestion: "Move back to Backlog if not ready, or pick it up"

**Rule 2 -- In Progress stale (>7 days)**
- Severity: Critical
- Condition: `state == "In Progress"` AND issue has not been updated in more than 7 days
- Detail: "In Progress for N days without updates"
- Suggestion: "Update the issue, move to Paused with a comment, or complete it"

**Rule 3 -- In Progress without assignee**
- Severity: Critical
- Condition: `state == "In Progress"` AND `assignee` is null/empty
- Excludes: issues in "Tracking" state (tracking issues don't always need an assignee)
- Detail: "In Progress but nobody is assigned"
- Suggestion: "Assign someone -- In Progress means actively worked on"

**Rule 4 -- Multiple In Progress per person**
- Severity: Critical
- Condition: More than one issue with `state == "In Progress"` for the same `assignee`
- Detail: "Assignee has N issues In Progress simultaneously"
- Suggestion: "Focus on one -- the guide recommends one In Progress issue per person"
- Note: report this once per person, listing all their In Progress issue identifiers

**Rule 5 -- Paused without explanation comment**
- Severity: Critical
- Condition: `state == "Paused"` AND the issue's comments (fetched in step 2) do not contain any comment that explains why it was paused or what would unblock it
- Detail: "Paused without an explanation comment"
- Suggestion: "Add a comment explaining why it's paused and what would unblock it"
- Judgment: use your best judgment -- a comment like "waiting on X" or "blocked by Y" counts; an unrelated comment does not

### LLM-Judged Rules (use your judgment on content quality)

**Rule 6 -- Missing or weak description (non-backlog)**
- Severity: Warning
- Applies to: issues where `state` is NOT "Backlog" and NOT "Idea"
- Condition: description is empty, is just a link with no context, or merely restates the title without adding why/context
- Detail: describe what's missing (e.g., "Description is empty", "Description only restates the title")
- Suggestion: "Add context: why are we doing this, what triggered it, any constraints or background"

**Rule 7 -- Unclear title**
- Severity: Suggestion
- Condition: title is vague, overly generic, or doesn't convey what the issue actually is (e.g., "Fix bug", "Update things", "Misc")
- Detail: explain why the title is unclear
- Suggestion: propose a clearer title if possible

**Rule 8 -- Large issue not using tracking pattern**
- Severity: Warning
- Condition: description or title suggests a large scope of work (multiple deliverables, multi-week effort, "phase 1/2/3", etc.) but the issue is NOT in "Tracking" state and has no sub-issues
- Detail: "Looks like a large workstream but isn't using the tracking pattern"
- Suggestion: "Convert to a Tracking issue with atomic sub-issues"

**Rule 9 -- Description links without context**
- Severity: Suggestion
- Condition: description contains URLs/links but no surrounding text explaining what they are or why they matter
- Detail: "Description has links but no context around them"
- Suggestion: "Add a sentence explaining what each link is and why it's relevant"

**Rule 10 -- Paused stale (>2 months)**
- Severity: Warning
- Condition: `state == "Paused"` AND issue has not been updated in more than 60 days
- Detail: "Paused for N days without activity"
- Suggestion: "Move to Canceled if no longer relevant, or back to Backlog if it might be picked up later"

**Rule 11 -- Sub-issues nested too deep**
- Severity: Warning
- Condition: an issue has sub-issues that themselves have sub-issues (more than one layer of nesting)
- Detail: "Sub-issues are nested more than one layer deep"
- Suggestion: "Flatten to one layer of sub-issues under the tracking issue -- deep trees get hard to read"
- Note: this requires checking sub-issue structure; if the JSON data includes sub-issue info, check it. Otherwise skip this rule and note it was not checkable.

---

## 4. Output format

Present findings in this structured format:

```
# Lint Report: <Project Name>

**Date:** <today>
**Issues scanned:** <count>
**Findings:** <total> (<critical count> critical, <warning count> warnings, <suggestion count> suggestions)

---

## Critical

### <IDENTIFIER> -- <title>
- **Rule N:** <detail>
  - Fix: <suggestion>

(repeat for each critical finding)

---

## Warnings

### <IDENTIFIER> -- <title>
- **Rule N:** <detail>
  - Fix: <suggestion>

(repeat for each warning finding)

---

## Suggestions

### <IDENTIFIER> -- <title>
- **Rule N:** <detail>
  - Fix: <suggestion>

(repeat for each suggestion finding)

---

## Per-Person Summary

| Person | In Progress | Paused | Findings |
|--------|-------------|--------|----------|
| <name> | <count>     | <count>| <brief>  |

## Statistics

| Metric | Value |
|--------|-------|
| Total issues scanned | N |
| Clean issues (no findings) | N |
| Critical findings | N |
| Warning findings | N |
| Suggestion findings | N |

---

## Top Recommendations

1. <most impactful action to take>
2. <second most impactful>
3. <third most impactful>
```

### Grouping rules

- If an issue has multiple findings, list them all under that issue's heading (don't repeat the issue)
- Group the issue under its highest severity section (e.g., if an issue has both a Critical and a Warning, it appears in Critical with both findings listed)
- Within each severity section, sort issues by identifier
- The "Per-Person Summary" table should list each assignee and their issue counts across active states, plus a brief summary of findings against them
- The "Top Recommendations" section should highlight the 3 most impactful actions the team could take based on the findings

## Important Notes

- This skill is read-only -- it never modifies issues, only reports findings
- Use `--json` output from linproj for reliable field access
- Today's date for staleness calculations: use the current date from context
- If `linproj` commands fail with auth errors, tell the user to run `linproj auth login`
- For Rule 4, count In Progress issues per person across the entire project, not just flagged ones
- Be generous with Rule 5 judgment -- any comment that gives context about why work stopped counts
- For LLM-judged rules (6-9), err on the side of not flagging -- only flag clear violations
