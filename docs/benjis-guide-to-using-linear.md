# Benji's Guide to Using Linear (Practical + Opinionated)

I've used Linear for ~4 years now and this is an opinionated setup I've used that optimizes for:

- Team coordination (who's doing what, what's next)
- Async visibility (so we can catch up without meetings or Slack archaeology)

This isn't "the official Linear way." It's a lightweight system that works well in practice and doesn't require constant maintenance.

## Guiding principles

- Keep it simple. If the system feels heavy, people stop using it.
- Statuses should carry meaning. Fewer statuses, clearer behavior.
- Short-lived active issues. If everything is "In Progress" for weeks, the board stops being useful.
- Context lives in the issue. The issue should be the best place to understand what happened and how to reproduce it.

## How we treat Projects

Linear suggests projects are time-bounded. In practice, we often use Projects as long-running buckets (team/domain areas) where work naturally belongs.

- Projects are usually ongoing.
- We mostly ignore project statuses.
- If we want time-boxing, we can use milestones occasionally, but they're optional and require upkeep.

**Goal:** someone opens a project and quickly sees the main workstreams, what's active, and what's next.

---

## Statuses (and what they mean)

Reminder: statuses are configured per team in Linear.

### Backlog (default for new issues)

**Meaning:** real work, but not ready / not scheduled / not soon.

Backlog is where most new issues should start. It's fine if these are rough.

### Idea (optional custom status)

**Meaning:** a thought worth keeping, with enough context to be understandable later.

Use this when you've written a real description (links, reasoning, notes). If it's just a quick thought, keep it in the Backlog.

### To Do

**Meaning:** ready to pick up and likely soon.

To Do should be small and clear. Rough guideline: if it can't be completed in ~2–5 days (maybe up to a week), split it.

Optional automation: if something sits in To Do for >2 weeks, downgrade it back to Backlog.

### In Progress

**Meaning:** actively being worked on right now.

This is our highest-signal status. A strong default is one In Progress issue per person so it's obvious what you're focused on.

Nice workflow: use Linear's Git integration to create/copy the branch name from the issue so PRs/commits link automatically.

### Paused (custom)

**Meaning:** started, but not actively worked on.

Use this when priorities shift or you're blocked/waiting. If you move something to Paused, leave a quick comment explaining:

- why it's paused
- what would unblock it

Optional automation: if something is Paused with no activity for a long time (e.g., ~2 months), move it to Canceled or back to Backlog.

### In Review

**Meaning:** PR is up and review/feedback is happening.

If your PR is linked, this can be automatic.

### Done

**Meaning:** we're not working on this anymore.

Done doesn't have to mean "perfectly shipped everywhere," but it does mean the issue is no longer an active thread.

Recommendation: avoid auto-marking issues Done just because a PR merged. Merged code is often only part of the story (rollout, follow-ups, verification, docs, etc.).

### Canceled (optional)

**Meaning:** we decided not to do this.

Useful when you want a clear outcome rather than letting things sit forever.

---

## Tracking issues (big work without deep nesting)

Tracking is a custom status for "container" issues:

- the tracking issue is the workstream
- the sub-issues are the atomic tasks

This avoids two common failure modes:

- one huge issue that stays open forever
- deep trees of sub-issues that get hard to read

Rules of thumb:

- Prefer one layer of sub-issues under a tracking issue.
- Keep sub-issues as small/atomic as possible.
- Tracking issues can live longer; they're organizational, not "active work" by themselves.
- Tracking issues don't always need an assignee.

---

## Put context in the issue (links + artifacts)

An issue can be the hub for everything related. Add links aggressively:

- PRs, commits, branches
- design docs (whatever tool we used)
- ChatGPT outputs that influenced the decision
- dashboards / data views (e.g., a 1DB view link)
- logs, screenshots, incident notes

More context attached = less guessing later.

---

## Prefer posting results in the Linear issue (not only Slack)

When you run code, experiments, scripts, migrations, or anything reproducible:

- post the results in the related Linear issue
- optionally cross-post a link in Slack to notify people

When posting in Linear, include the exact things someone needs to rerun it:

- the command(s)
- the script name/path
- the branch / commit SHA
- key flags / environment assumptions
- a short output summary + links to artifacts

Slack is great for awareness. Linear is better for permanence and discoverability.

---

## Comments + @mentions are part of the workflow

We should use comments more than we do.

If you open an issue and something isn't clear:

- leave a comment
- @mention the teammate
- ask the question right there

This helps immediately, but it also helps later:

- when someone else reads the issue and has the same question
- when future-you comes back in a month and has forgotten why any of this existed

---

## Titles vs descriptions (how to write issues that don't rot)

Default rule:

- Title = what the issue is
- Description = why we're doing it + the context

The description shouldn't just restate the title. It should answer things like:

- Why are we doing this now?
- What triggered it (someone asked, a bug report, a metric, a decision)?
- Any constraints or relevant background?
- Links to the source context (docs, threads, dashboards, PRs)

Writing Linear issue descriptions can be challenging due to the "blank sheet" effect. I find it better to co-write them with the owner and ask them, "Why are you doing this?" verbally. They often provide five minutes of valuable context that they omit in a one-liner that merely restates the title. When this happens, I use text-to-speech to record their explanation and then use an LLM to summarize it into a useful description.

---

## Favorites (pin the stuff you actually use)

Use Favorites a lot. It sounds trivial, but it saves time every day.

- You can right-click -> Favorite almost anything (projects, issues, views, etc.)
- That pins it in the sidebar so it's always one click away.

What I typically put in my favorite sidebar:

- the main project I'm working on
- my main tracking issues
- a couple of views I use daily/weekly, such as:
  - the in progress issues of close collaborators
  - the issues that have been updated for the last week in my main project

---

## Views (very useful, very underrated)

Views are saved filters. They're flexible, fast, and they help you avoid "where is the work?" questions.

### Creating views

- You can create a view for almost anything (project + labels + assignee + status + date filters, etc.).
- There's also an AI Filter feature now: describe what you want, and it generates the view for you.

Examples that work well:

- Per-person views (click a teammate's view to see what they're working on)
- A weekly rollup view like "Updated last week" (great for writing weekly updates)
- "Blocked / needs input"
- "In review"

### Pinning views in the top bar

You can pin views in the top bar (next to Overview / Updates / Issues) so they're always visible.

---

## Priorities (light take)

I don't rely much on priority fields because they often drift. We get more signal from:

- clean status usage (Backlog / To Do / In Progress)
- small issues
- tracking issues that show workstreams
- comments that explain pauses and decisions

If a team wants priorities, they need to be actively maintained.

---

## Suggested minimal setup (if we standardize)

### Statuses

- Backlog (default)
- Idea (optional)
- To Do
- In Progress
- Paused
- In Review
- Done
- Canceled (optional)
- Tracking (recommended)

### Optional automations

- To Do stale -> Backlog
- In Progress stale -> Paused (or flagged)
- Paused long-stale -> Canceled / Backlog

---

## Closing note

Please feel free to add comments, propose tweaks, or improve this doc. This is meant to be practical suggestions, not a strict or definitive guide.

One area I haven't explored much yet: using the Linear CLI (linproj) (and related automation packages) + AI to automate reporting, summaries, project analysis, etc. There's probably a lot of cool stuff to do there; I just haven't used it yet.
