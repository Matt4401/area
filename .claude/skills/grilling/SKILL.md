---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round, then wait for the user's answers before the next round.

## Asking: always through the `AskUserQuestion` tool

Never write questions as plain text in the conversation. Every question goes through the `AskUserQuestion` tool so the user gets the interactive picker.

Tool constraints and how to map a round onto them:

- **1 to 4 questions per call.** If the frontier has more than 4 questions, ask the 4 most structuring ones first (those that unblock the most downstream decisions), then issue another `AskUserQuestion` call with the rest of the frontier once answered. Every call is still part of the same round.
- **`header`**: a short chip label, 12 characters max (e.g. `Broker`, `Auth flow`, `DB`).
- **`question`**: self-contained and ending with `?`. The user may see only the dialog, so include the context needed to decide (what you found, what it impacts). Keep it to a few sentences.
- **`options`**: 2 to 4 concrete, mutually exclusive choices. Put your recommended answer **first** with ` (Recommended)` appended to its `label`. Use `description` for the trade-off of each choice (cost, risk, what it unlocks or blocks). Do not add an "Other" option: the tool provides it automatically for free-text answers.
- **`multiSelect: true`** only when choices genuinely combine (e.g. "which features to include").
- **`preview`**: use it when comparing concrete artefacts (code snippets, schema shapes, ASCII layouts, config examples) so the user sees them side by side. Single-select only.

If a question is truly open-ended with no sensible options, still offer 2 to 4 plausible candidates (your best guesses) and let the user pick "Other".

After each answer, reply with a short recap in the conversation (one line per settled decision) so the decisions are recorded, then move on.

## Recomputing the frontier

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one (and therefore never in the same `AskUserQuestion` call).

## Facts vs decisions

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent with a fresh context window to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them through `AskUserQuestion` and wait.

## Ending

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Post a final summary of every settled decision, then ask through `AskUserQuestion` whether you have reached a shared understanding. Do not act on it until the user confirms.
