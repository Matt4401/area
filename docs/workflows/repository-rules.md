# Repository rules

> **In short:** nobody pushes to `main` directly. Every change goes through a pull request approved by at least one other member. `main` cannot be deleted or rewritten.

This page describes how the GitHub repository [`Matt4401/area`](https://github.com/Matt4401/area) protects `main`, and why each setting was chosen.

## Where the rules live

The rules come from a **repository ruleset**, not from the legacy "branch protection" settings.

| Setting         | Value                                                         |
| :-------------- | :------------------------------------------------------------ |
| Ruleset name    | `Main Rules 23-11`                                            |
| Created         | 2026-11-23                                                    |
| Enforcement     | **Active**                                                    |
| Target          | the default branch (`~DEFAULT_BRANCH`, currently `main`)      |
| Bypass list     | **empty**: nobody, admins included, can bypass the rules      |

**Why a ruleset:** it lists every rule in one place, it can be read through the API (`gh api repos/Matt4401/area/rulesets`), and it follows the default branch if `main` is ever renamed.

**Why no bypass:** the rules have to apply to everyone, repository owner included. A rule that the person with the most rights can skip protects nothing.

## Rules on `main`

### 1. Deletion is blocked

`main` cannot be deleted.

**Why:** `main` is the reference for deployments and for the defense. Losing it by mistake (for example with `git push origin :main`) would break the history the team relies on.

### 2. Force-push is blocked

History on `main` cannot be rewritten (`non_fast_forward`).

**Why:** a force-push can silently delete commits that are already merged and reviewed. Everyone's local branches start from `main`, so its history must only move forward.

### 3. A pull request is required

Every change reaches `main` through a pull request.

| Parameter                                  | Value                       | Why                                                                                                           |
| :----------------------------------------- | :-------------------------- | :------------------------------------------------------------------------------------------------------------ |
| Required approvals                         | **1**                       | At least one other member reads every change. With 4 members, 1 approval keeps the flow quick. |
| Extra approval for unattributed changes    | **on**                      | If commits that cannot be attributed are pushed to the PR, one more approval is required. |
| Dismiss stale approvals on push            | off                         | Small fixes after a review do not force a new review. Reviewers rely on trust for later pushes. |
| Require approval of the last push          | off                         | Same reason: keeps small follow-up commits cheap. |
| Code owner review                          | off                         | There is no `CODEOWNERS` file yet. Ownership is shared while the stack is being chosen. |
| Conversation resolution required           | off                         | Comments can stay open as notes without blocking the merge. |
| Allowed merge methods                      | merge, squash, rebase       | Each PR picks the method that fits its history. So far, PRs have been merged with merge commits. |

**Why:** the subject expects every member to be able to explain the whole product, and it grades architecture choices that the team defends together. Review is how knowledge spreads and how decisions (ADRs, code) are checked before they become the reference.

### 4. Status checks (enabled, empty)

The `required_status_checks` rule is active, but **no check is listed yet**. In practice, **CI does not block merges today**.

**Why:** there is no CI workflow in the repository yet (no `.github/workflows/`). The rule is in place so that adding checks later only means filling in the list.

## Repository settings

| Setting                         | Value   | Why                                                                     |
| :------------------------------ | :------ | :---------------------------------------------------------------------- |
| Delete branch on merge          | **on**  | Merged branches disappear on their own, so the branch list stays short. |
| Auto-merge                      | off     | A PR is merged by a person who checks it is ready.                      |
| Merge commit / squash / rebase  | all on  | Matches the methods allowed by the ruleset.                             |

## Workflow for a contributor

```bash
git switch main && git pull
git switch -c <type>/<scope>/<topic>   # e.g. docs/adr/backend
# ... commit ...
git push -u origin HEAD
gh pr create --base main
```

1. Ask a teammate for a review.
2. Once you have 1 approval, merge from GitHub (or with `gh pr merge`).
3. The branch is deleted automatically.

Pushing directly to `main` is rejected by GitHub. Use a branch and a PR.

## Known gaps and next steps

| Gap                                       | Impact                                    | Planned change                                                                                       |
| :---------------------------------------- | :---------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| No required status checks                 | A PR that breaks lint, tests or build can still be merged | When CI exists (MVP milestone: lint, tests, build on every contribution), add its jobs to the ruleset. |
| Stale approvals are not dismissed         | Code pushed after an approval is merged without a second look | Turn on `dismiss_stale_reviews_on_push` if this causes problems.                               |
| No `CODEOWNERS`                           | Any member can approve any area           | Add one when ownership per service or client is clear.                                               |
| Branch not required to be up to date      | Two PRs that each pass can break `main` once combined | Turn on `strict_required_status_checks_policy` once CI checks are required.             |

## Checking the configuration

```bash
gh api repos/Matt4401/area/rulesets                 # list rulesets
gh api repos/Matt4401/area/rulesets/27913169        # full ruleset
gh api repos/Matt4401/area/rules/branches/main      # rules that apply to main
```

If the ruleset changes, update this page in the same PR.
