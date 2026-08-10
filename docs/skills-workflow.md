# Linear Skills Workflow

These Claude Code skills automate recurring Linear project management tasks. They all build on the conventions in [Benji's guide to using Linear](benjis-guide-to-using-linear.md) and use the `linproj` CLI under the hood.

## Skills overview

| Skill | Invocation | Reads/Writes | When to use |
|-------|-----------|--------------|-------------|
| **meeting-sync** | `/linear-meeting-sync <project> [file]` | Reads + Writes | After a meeting - sync notes into Linear |
| **weekly-prep** | `/linear-weekly-prep <project>` | Read-only | Before Monday meeting - prepare agenda |
| **weekly-update** | `/linear-weekly-update <project>` | Read-only (until you approve posting) | End of week - draft status update |
| **lint-project** | `/linear-lint-project <project>` | Read-only | Anytime - audit project hygiene |

## Weekly rhythm

Here's how the skills fit into a typical week:

```
Monday morning
  └─ /linear-weekly-prep <project>
       → Slack update (copy-paste to channel)
       → Facilitation guide (speaking order, questions to ask)

Monday meeting
  └─ /linear-meeting-sync <project>
       → Comments on discussed issues
       → New issues for action items
       → Status changes (e.g., Paused, Done)

During the week
  └─ /linear-meeting-sync <project>    (after any sync or 1:1)
  └─ /linear-lint-project <project>    (periodic hygiene check)

Friday
  └─ /linear-weekly-update <project>
       → Draft update with health rating
       → Post to Linear project updates
```

## Skill details

### `/linear-meeting-sync <project> [notes-file]`

Parses meeting notes (pasted or from a file) and proposes updates to Linear issues.

**What it does:**
- Matches discussion topics to existing issues by title, description, and identifiers
- Proposes comments, description improvements, and status changes
- Suggests new issues for unmatched action items, placing them under tracking issues
- Always asks for approval before writing anything

**Tips:**
- Works with any format: raw transcripts, bullet points, Gemini/Otter notes
- For ambiguous matches, it asks you to pick the right issue
- New issues start in Backlog and get assigned to tracking issues when possible

### `/linear-weekly-prep <project>`

Generates everything you need for the Monday meeting.

**What it produces:**
- A Slack-ready update (copy-paste directly into your channel)
- A facilitation guide with speaking order based on who needs to share verbally vs. who already has good written updates
- Specific conversation starters for each person, referencing their actual issues
- Hygiene flags (stale In Progress, Paused without comments, multiple In Progress per person)

**Tips:**
- People with low "update coverage" (active issues but no recent comments) speak first
- People with thorough Linear updates can be skipped unless they have something to add

### `/linear-weekly-update <project>`

Drafts an end-of-week status update for posting to Linear's project updates.

**What it produces:**
- A formatted update body matching your team's existing style (it reads your last 3 updates)
- A suggested health rating (on-track / at-risk / off-track) with reasoning
- A ready-to-run `linproj projects update` command
- Placeholders for anything only a human would know (upcoming priorities, external context)

**Tips:**
- It groups work by tracking issue/workstream, not just flat lists
- Review and edit the draft before posting - placeholders are intentional

### `/linear-lint-project <project>`

Audits all active issues against 12 rules derived from Benji's guide.

**Rules include:**
- To Do stale >2 weeks, In Progress stale >7 days
- In Progress without assignee, multiple In Progress per person
- Paused without explanation comment, Paused stale >2 months
- Missing/weak descriptions on non-backlog issues
- Large scope issues not using the tracking pattern
- Sub-issues nested too deep (guide says one layer max)

**What it produces:**
- Findings grouped by severity (Critical / Warning / Suggestion)
- Per-person summary table
- Top 3 recommendations

**Tips:**
- This is read-only - it never modifies issues
- Run it before a planning session to identify cleanup work
- LLM-judged rules (descriptions, titles) err on the side of not flagging

## Prerequisites

- `linproj` CLI installed and authenticated (`linproj auth login`)
- The skills installed into your agent, which the CLI ships and writes for you:

  ```bash
  linproj skill --mode claude --force    # all skills, into ~/.claude/skills
  linproj skill meeting-sync --mode claude
  ```

  `--mode` also accepts `claude-project`, `codex`, `universal`, and `github`.
  Run `linproj skill` with no arguments to see the available skills.
- Project names must match exactly what's in Linear (use `linproj projects list` to check)

## Reference

- [Benji's guide to using Linear](benjis-guide-to-using-linear.md) - the conventions these skills enforce
- [linproj CLI](../README.md) - the underlying tool
