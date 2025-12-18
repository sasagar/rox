# PR Review Response Workflow

This document describes the standard workflow for responding to CodeRabbit or other automated review comments on GitHub PRs.

## Workflow Steps

### 1. Retrieve Review Comments
```bash
# Using MCP GitHub tool
pull_request_read with method: "get_review_comments"
```

### 2. Fix Issues in Code
- Edit the relevant files to address each review comment
- Run type checking: `bun run typecheck`
- Run linting if needed: `bun run lint`
- Extract translations if i18n changes: `bun run lingui:extract`
- Compile translations: `bun run lingui:compile`

### 3. Commit and Push
```bash
git add <files>
git commit -m "fix: address review feedback for <component>"
git push origin <branch>
```

### 4. Reply to Each Review Comment
Reply directly to the review comment thread using the GitHub API:

```bash
gh api repos/{owner}/{repo}/pulls/{pull_number}/comments \
  -X POST \
  -f body="Fixed in commit {sha}. {description of fix}" \
  -F in_reply_to={comment_id}
```

Parameters:
- `owner`: Repository owner (e.g., "Love-Rox")
- `repo`: Repository name (e.g., "rox")
- `pull_number`: PR number
- `comment_id`: The review comment ID to reply to (from step 1)
- `body`: Reply message explaining what was fixed

### 5. Resolve the Conversation
Use GraphQL API to mark the review thread as resolved:

```bash
gh api graphql -f query='
mutation {
  resolveReviewThread(input: {threadId: "{thread_id}"}) {
    thread {
      isResolved
    }
  }
}'
```

To get the thread ID, query the PR's review threads:
```bash
gh api graphql -f query='
{
  repository(owner: "{owner}", name: "{repo}") {
    pullRequest(number: {pr_number}) {
      reviewThreads(first: 20) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes {
              body
              path
            }
          }
        }
      }
    }
  }
}'
```

## Example Reply Messages

### For bug fixes:
```
Fixed in commit abc1234. Added try/catch to handle malformed URLs gracefully.
```

### For accessibility improvements:
```
Fixed in commit abc1234. Replaced custom button-based toggles with React Aria `Switch` component for proper keyboard navigation and ARIA semantics.
```

### For i18n fixes:
```
Fixed in commit abc1234. Applied Lingui `msg` template literals for CATEGORIES and `useLingui()` hook for rendering. Added Japanese translations for all labels.
```

### For type alignment:
```
Fixed in commit abc1234. Removed local type definition and now importing `ContactCategory` from shared package. Updated shared type to include new categories.
```

## Benefits of This Workflow

1. **Clear audit trail** - Each review comment has a direct reply explaining the fix
2. **Commit references** - Reviewers can easily find the fix commit
3. **Resolved status** - Conversations are properly marked as resolved
4. **Better communication** - Reviewers are notified of responses
