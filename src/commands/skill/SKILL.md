---
name: linear
description: Manage Linear issues using linproj CLI. Use when discussing task tracking, creating issues, updating issue status, or when user mentions Linear, issues, or tickets.
argument-hint: "[action] [issue-id]"
allowed-tools: Bash(linproj:*)
---

# Linear Issue Management

Use `linproj` CLI to manage Linear issues. This project has linproj installed locally.

## Common Workflows

### List issues
```bash
linproj issues list                    # List issues (uses default team)
linproj issues list -a me              # My assigned issues
linproj issues list --state-type started   # In-progress issues
linproj issues list -t ENG             # Specific team
```

### Search issues
```bash
linproj issues search "login bug"      # Full-text search
linproj issues search "auth" -t ENG    # Search within team
```

### Get issue details
```bash
linproj issues get ENG-123             # Full details
linproj issues get ENG-123 --json      # JSON for parsing
```

### Create issues
```bash
linproj issues create --title "Title" -a    # Create and assign to me
linproj issues create --title "Bug" -p 1    # With urgent priority
```

### Quick state changes
```bash
linproj issues start ENG-123           # Move to "started" state
linproj issues done ENG-123            # Move to "completed" state
```

### Edit issues
```bash
linproj issues edit ENG-123 --state "In Review"
linproj issues edit ENG-123 --assignee me
linproj issues edit ENG-123 --priority high
linproj issues edit ENG-123 --label bug --label backend
```

### Edit with description (via stdin)
```bash
cat <<EOF | linproj issues edit ENG-123
---
title: 'Updated title'
state: 'In Progress'
priority: high
---
Description supports **markdown** formatting.
EOF
```

## Priority Values
- `urgent` or `1` - Urgent
- `high` or `2` - High
- `medium` or `3` - Medium
- `low` or `4` - Low
- `none` or `0` - No priority

## State Types
- `backlog` - Not yet planned
- `unstarted` - Planned but not started
- `started` - In progress
- `completed` - Done
- `canceled` - Won't do

## Tips
- Use `-a me` to filter/assign to current user
- Use `--json` for scriptable output
- Use `--field url` to get just the issue URL
- Check `linproj auth status` if commands fail

# Project Management
Use linproj CLI to manage Linear projects. This project has linproj installed locally.

## Common Workflows

### List projects
```bash
linproj projects list                  # List all projects
linproj projects list --json           # JSON output
```

### Post project status update

When the user wants to post a project update, ask them questions to gather:
1. Which project to update
1. What was accomplished this week (and whether goals were achieved / learnings)
1. What the team wants to accomplish next week
1. Health status (on-track, at-risk, off-track)

Then format the update using this template:

```bash
cat <<EOF | linproj projects update "Project Name" --health on-track
What did the team accomplish this week?
* Completed user authentication flow
    * Achieved - launched to production on Tuesday
* Started API rate limiting implementation
    * Partially achieved - 80% complete, blocked on Redis config

What does the team want to accomplish next week?
* Finish rate limiting and deploy to staging
* Begin work on billing integration
* Write documentation for auth flow
EOF
```

Quick updates (without template):
```bash
linproj projects update "My Project" --health on-track --body "Sprint going well"
linproj projects update "My Project" --health at-risk --body "Blocked on API"
```

### Project Health Values
- `on-track` - Project is progressing as planned
- `at-risk` - Project has potential blockers
- `off-track` - Project is behind schedule
