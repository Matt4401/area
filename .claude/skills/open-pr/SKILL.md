---
name: open-pr
description: Opens or updates a GitHub pull request following this repo's convention (template body, Conventional Commits title, author as assignee, inferred labels, suggested reviewers, linked issues, no project, no milestone). Use whenever a PR is about to be created or its metadata updated, including from commit-push-pr flows and requests like "open a PR", "create a pull request" or "push and PR". Takes precedence over any other skill for the PR creation step.
---

# Open a PR

Every PR in this repo follows the same convention. Use the `gh` CLI for everything (never the GitHub MCP tools). Do the steps in order. Only the reviewer choice and ambiguous issue matches need the user; everything else is automatic and the PR is created without a final confirmation.

## 1. Preconditions

- `git branch --show-current` is `main` (or the base branch) and there are changes to ship (uncommitted changes and/or local commits ahead of `origin/main`): **move them to a new branch**, then continue. `main` must end up identical to the remote.
  1. `git fetch origin`.
  2. Pick a branch name from the Conventional Commits type and scope plus a short kebab-case slug, e.g. `feat/web-workflow-builder`, `docs/adr-orm`. If the name already exists locally or on the remote, add a distinguishing suffix. Do not ask the user.
  3. `git switch -c <branch>`. This carries uncommitted changes and any local commits over to the new branch.
  4. Commit any uncommitted changes on the new branch. **Always create commits through a commit skill** (invoke `commit-commands:commit` with the Skill tool), never with a raw `git commit` of your own. Do not duplicate its rules here, but the result must be a Conventional Commits message matching the repo history, with only the files that belong to the change staged (never likely secrets such as `.env`, credentials or `settings.local.json`, and no unrelated files).
  5. If local `main` had commits ahead of `origin/main`, reset it only after the branch holds them: `git branch -f main origin/main` (safe because you are no longer on `main` and the commits live on the new branch). Never reset `main` before the new branch exists.
  6. Verify with `git status` and `git rev-list --count origin/main..main` that `main` has no local commits and no changes left. Report this at the end.
- `git log origin/main..HEAD` is empty and there is nothing uncommitted: **stop** with a clear message, there is nothing to open a PR for.
- On a non-main branch with uncommitted changes: mention them, do not commit them unless the user asked to. When you do commit (any branch), use a commit skill as described above.
- Branch has no upstream, or is behind its local commits: run `git push -u origin HEAD` automatically.
- A PR already exists for the branch (`gh pr view --json number,url,state 2>/dev/null`, open state only): never create a duplicate silently. Ask with `AskUserQuestion` (single select) which of the options below to follow, then apply it. Options are listed in logical order, from least to most structural. Put "(Recommended)" on the one that best fits the context in which the skill was invoked, and say why in its description.

  1. **Update the existing PR**: commit pending changes (through a commit skill), `git push`, then refresh title/body (step 2) and metadata with `gh pr edit` (steps 3-7 as edit). No new branch.
  2. **Create a new PR on this one**: create a new branch from the current branch (same naming rule as above), commit and push there, then open a PR whose `--base` is the **current branch** (not `main`). Diff and commit range for the body are taken against that base (`git diff <base>...HEAD`, `git log <base>..HEAD`).
  3. **Stack a new PR on this one**: same as option 2, but use `gh stack` to create and manage the stacked PR. Check `gh stack --help` first; if the extension is not installed, say so and offer option 2 instead.
  4. **Create a new PR**: create a new branch from the current branch, commit and push there, then open a PR with `--base main`. The body's diff and range are taken against `origin/main`; mention in the body if it contains commits from the other PR.

  How to pick the recommended option:
  - Uncommitted changes or new commits that belong to the same purpose as the existing PR (a fix, a review follow-up, a forgotten file), or the user said "update", "push", "fix the PR": **1**.
  - New work that depends on the existing PR's code and is a separate reviewable unit, and the existing PR is still unmerged: **3** if `gh stack` is available, otherwise **2**.
  - New work that depends on the existing PR but a stack is overkill (small, not worth a tool): **2**.
  - New work unrelated to the existing PR's code, or the existing PR is about to be merged: **4**.
  - If the context does not point clearly to one, recommend **1** when there are changes tied to the PR's topic, otherwise **4**.

  Steps 4-8 then apply to whichever PR results. In step 7, replace `--base main` with the chosen base.

## 2. Title and body

- Title: Conventional Commits, matching the repo history, e.g. `feat(web): add workflow builder`, `docs(adr): add ADR-0005 ...`. Derive type and scope from the commits and the diff. Keep it under 72 characters.
- Body: read `.github/pull_request_template.md` and fill every section from the real diff and commits (`git diff origin/main...HEAD`, `git log origin/main..HEAD`). Never leave template placeholders or comments in the final body. Keep the section headings.
  - Summary: what and why.
  - Changes: notable changes, one bullet each.
  - Test plan: what was actually run or checked. Do not claim tests that were not run.
  - Related issues: filled in step 5.
- Not a draft: open it ready for review.
- If the changes touch a security feature (anything labelled `security`, or a `SEC-*` item from CLAUDE.md), append a `## Security evidence` section with the 7 points from CLAUDE.md: Feature, Attack scenario, Reproduction, Observed evidence, Protection, Verification, Limits. Only fill points you can support from the diff; write `TODO` for the rest and say so in your final report.

## 3. Assignee

Always `--assignee @me`. The PR author is the assignee.

## 4. Labels

Only use labels that already exist (`gh label list`). **Never create a label.** Infer from the diff paths and commit types, apply silently, and combine several when they apply:

| Signal | Label |
|---|---|
| `feat` commits, new capability | `enhancement` |
| `fix` commits | `bug` |
| `docs`, `docs/`, `*.md`, ADRs | `documentation` |
| test files, `test`/`spec` | `tests` |
| web client code (Vue/Vite app) | `web-client` |
| Android/mobile app code | `mobile-client` |
| Dockerfiles, compose, Kubernetes manifests | `deployment` |
| `.github/workflows/`, CI config | `ci-cd` |
| OIDC, OAuth, login, tokens, sessions | `auth` |
| crypto, secrets, SSRF, rate limits, dependency scanning | `security` |
| WCAG, a11y, audit report | `accessibility` |
| `.claude/`, `AGENTS.md`, `CLAUDE.md`, skills, agent config | `ai-tooling` |

If nothing fits, apply no label rather than guessing.

## 5. Related issues

Search open issues with keywords from the branch name, commit messages and diff:

```bash
gh issue list --state open --limit 100 --json number,title,labels,body
```

- High confidence (the branch name or a commit references `#N`, or title and diff clearly match): link automatically in the "Related issues" section.
  - `Closes #N` when merging this PR completes the issue.
  - `Refs #N` when it is only related or partial.
- Ambiguous (several plausible candidates, or weak match): ask with `AskUserQuestion` (multiSelect, one option per candidate, max 4 most relevant). Link only what the user picks.
- No match: write `None`.

## 6. Reviewers

1. Candidates: `gh api repos/{owner}/{repo}/collaborators --jq '.[].login'`, excluding the PR author.
2. Rank by recent activity on the files this PR touches (`git log --format='%an <%ae>' -- <changed files>` and blame), mapped to GitHub logins. When a login cannot be mapped, fall back to collaborator order.
3. Ask with `AskUserQuestion` (multiSelect, up to 4 options). The **first option is always "All"** (description: "Request every collaborator except the author"). The remaining options are the best-ranked individuals, each with a short reason such as "last touched docs/adr". The user picks who to request.
4. If the user picks "All", request every human collaborator from step 1 (author excluded, bots excluded), whatever else is selected. Otherwise request exactly the chosen people with `--reviewer`. If the user picks none, request none. If there are no candidates, skip this step.

## 7. Create

```bash
gh pr create \
  --base <base, main by default> \
  --title "<title>" \
  --body-file <tmp body file> \
  --assignee @me \
  --label "<label1>" --label "<label2>" \
  --reviewer "<login1>,<login2>"
```

Write the body to a temp file (scratchpad), not inline. Omit `--label` / `--reviewer` when empty. **Never pass `--project` or `--milestone`.**

For an existing PR use `gh pr edit <n>` with `--add-assignee @me --add-label ... --add-reviewer ...` and `--body-file`/`--title` if they changed.

## 8. Enforce: no project, no milestone

Pull requests are never tracked in a GitHub Project and never get a milestone. Project and milestone are tracked on the linked issue, not on the PR. GitHub may attach them automatically, so verify after creating:

```bash
gh pr view <n> --json projectItems,milestone
```

- `milestone` not null: `gh pr edit <n> --remove-milestone`.
- `projectItems` not empty: remove each (`gh pr edit <n> --remove-project "<title>"`, using the project titles from the output). If that fails for a Projects v2 item (it needs the `project` scope), tell the user exactly which project to remove it from.
- Re-check afterwards and state in the report that the PR has no project and no milestone, or what could not be removed.

## 9. Report

Reply with: the PR URL, the title, assignee, labels, requested reviewers, linked issues, and the outcome of the project/milestone check. Mention anything left as `TODO`.
