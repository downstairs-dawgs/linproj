---
name: pr-feedback
description: Review and respond to PR feedback on design documents. Analyzes comments, updates the design doc, replies to reviewers, and resolves threads.
argument-hint: "[PR number] (optional - defaults to current branch's PR)"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, TodoWrite, AskUserQuestion
---

# PR Feedback Reviewer for Design Documents

Review pull request feedback on design documents, respond to each comment, update the document as needed, and resolve threads.

## Arguments

- `$ARGUMENTS` - Optional PR number. If not provided, uses the PR associated with the current branch.

## Workflow

### 1. Identify the PR

```bash
# If no argument provided, get PR for current branch
gh pr view --json number,title,url,headRefName
```

### 2. Fetch Review Comments

Get all review comments on the PR:

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments
```

### 3. Analyze Each Comment

For each comment, determine:
- **Accept**: Clear improvement, implement it
- **Needs Discussion**: Multiple valid approaches, ask user
- **Clarify**: Add explanation to document
- **Decline**: Explain why in reply (rare)

### 4. Create Action Plan

Use TodoWrite to track all feedback items:
- Group related comments by theme
- Identify dependencies between changes
- Note which comments need user input

### 5. Gather User Input

For architectural decisions or unclear requirements, use AskUserQuestion to get user preference before making changes. Present options with pros/cons.

### 6. Update the Design Document

Make all agreed changes to the design document:
- Read the current document
- Apply changes using Edit tool
- Ensure consistency across sections

### 7. Reply to Each Comment

For each PR comment, post a reply explaining:
- What was changed (if accepted)
- Why the suggestion was helpful
- Any clarifications or context

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments/{comment_id}/replies -f body="..."
```

### 8. Commit and Push

```bash
git add <changed-files>
git commit -m "Update design doc based on PR feedback

<summary of changes>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push
```

### 9. Resolve Comment Threads

Get thread IDs and resolve each addressed thread:

```bash
# Get thread IDs
gh api graphql -f query='
query {
  repository(owner: "{owner}", name: "{repo}") {
    pullRequest(number: {pr_number}) {
      reviewThreads(first: 50) {
        nodes { id isResolved }
      }
    }
  }
}'

# Resolve each thread
gh api graphql -f query='
mutation {
  resolveReviewThread(input: {threadId: "{thread_id}"}) {
    thread { isResolved }
  }
}'
```

## Output Format

Provide a summary at the end:

```
## Summary

**PR**: #{number} - {title}
**Comments Addressed**: {count}

### Changes Made
- {change 1}
- {change 2}
...

### Decisions Made (with user input)
- {decision 1}: {chosen option}
...

**Commit**: {commit_hash}
**All threads resolved**: Yes/No
```

## Important Notes

- Always read the design document before making changes
- Group related feedback to make coherent updates
- Ask for user input on architectural decisions - don't guess
- Reply to comments before resolving threads
- Use clear, professional language in PR replies
- Reference specific sections when explaining changes
