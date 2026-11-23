---
name: modern-docs-and-adrs
description: Writes developer-first, modern product and technical documentation (inspired by Hono, VitePress, and Starlight) alongside Architecture Decision Records (ADRs), and detects documentation drift. Use when creating or overhauling project docs, READMEs, guides, API references, getting-started pages, or recording architectural decisions.
---

# Modern Documentation & ADRs

Write high-signal, developer-first documentation modeled on modern frameworks like Hono (`hono.dev/docs`), while preserving rigorous Architecture Decision Records (ADRs) and git-backed drift detection.

Code shows **what** was built. Modern docs get a developer running in under 60 seconds, prove value with concrete metrics, and capture **why** key architectural decisions were made.

If context lacks, the agent will ask for more information before generating docs. If context is sufficient, the agent will generate a complete set of docs and ADRs in a single pass.

## When to Use

- Creating or rewriting project documentation, `README.md`, or a docs site (VitePress, Starlight, Docusaurus, Nextra)
- Documenting a public API, CLI, SDK, or multi-runtime library
- Shipping a feature that changes user-facing behavior or setup flows
- Recording a significant architectural decision (ADR) or trade-off
- Checking whether existing docs have drifted out of sync with the codebase

**When NOT to use:** Do not comment obvious code, restate types in prose, or write full docs portals for throwaway prototypes.

## Part 1: Modern Documentation Style (Hono-Inspired)

Structure documentation around developer velocity, scannability, and runnable code rather than walls of prose.

### 1. Architecture & Navigation Hierarchy

Organize multi-page documentation into clear, predictable buckets:

- **Overview / Landing:** One-line value proposition, immediate runnable snippet (under 10 lines), multi-package-manager Quick Start, and scannable feature pillars.
- **Concepts:** The "Why", architecture mental models, benchmarks, and core design philosophy.
- **Getting Started:** Environment- or runtime-specific setup guides (one focused page per target runtime/platform).
- **Guides:** Task-oriented workflows (authentication, testing, deployment, migration, agent usage).
- **API Reference:** Grouped by domain/module (`App`, `Routing`, `Context`, `Helpers`, `Middleware`), leading with signatures and minimal runnable examples.

### 2. Page Anatomy & Scannability Rules

- **Lead with Code, Not History:** Open landing pages and API sections with a minimal, copy-pasteable snippet showing the "hello world" or happy path before explaining internals.
- **Multi-Tab Command Blocks:** Always provide package manager or runtime tabs (`npm`, `yarn`, `pnpm`, `bun`, `deno`) for installation and CLI commands using standard Markdown/MDX code groups (`::: code-group` or `<Tabs>`).
- **Scannable Value Pillars:** Summarize core strengths as bold-lead bullet points with concise metrics (e.g., "**Lightweight** - Under 14 kB minified with zero dependencies" instead of vague adjectives).
- **Concrete Proof Over Claims:** Back performance or size claims with real terminal output, bundle sizes, or benchmark comparisons.
- **Use-Case & Ecosystem Tables:** Use compact Markdown tables to map use-cases, runtime compatibility matrices, or production adopters (`Project | Platform | What for`).
- **Progressive Disclosure:** Keep each section focused on one concept, ending with a direct link to the deep-dive page (`See more information about Middleware.`) and sequential `Previous / Next` page navigation.
- **LLM-Ready Context:** For modern libraries and frameworks, maintain machine-readable doc indexes (`llms.txt` / `llms-full.txt`) or clean Markdown exports so coding agents can ingest the docs directly.

### 3. README & Landing Page Blueprint

````markdown
# Project Name

One-sentence description of what it does, its core constraint/advantage, and where it runs.

```ts
// Minimal, runnable 5-8 line happy-path example
```
````

## Quick Start

::: code-group

```sh [npm]
npm create project@latest
```

```sh [pnpm]
pnpm create project@latest
```

```sh [bun]
bun create project@latest
```

:::

## Features

- **Fast** - Concrete metric or architectural reason why.
- **Zero-dependency** - Built directly on standard primitives.
- **Type-safe** - End-to-end inference without codegen.

## Use-Cases

- Building Web APIs
- Edge/serverless workers
- Full-stack type-safe RPC

## Documentation

- [Concepts](./docs/concepts.md)
- [Getting Started](./docs/getting-started.md)
- [API Reference](./docs/api.md)
- [Architecture Decisions](./docs/decisions/)

````

### 4. API & Inline Documentation

- **TypeScript / JSDoc:** Document non-obvious behavior, thrown errors, and a runnable `@example`. Never repeat parameter types already expressed in TypeScript signatures.
- **Known Gotchas:** Call out lifecycle constraints, SSR hazards, or ordering dependencies with `IMPORTANT:` blocks referencing the relevant ADR.

```ts
/**
 * Initializes the theme before first paint to prevent FOUC.
 *
 * IMPORTANT: Must run before hydration; calling later breaks SSR state.
 * See ADR-003 for rationale.
 *
 * @example
 * initializeTheme('dark')
 */
export function initializeTheme(theme: Theme): void {
  // ...
}
````

## Part 2: Architecture Decision Records (ADRs)

ADRs capture the reasoning behind significant technical decisions so future humans and agents do not re-litigate settled trade-offs.

### When to Write an ADR

- Choosing a framework, database, runtime, or major dependency
- Designing a core data model, auth strategy, or API protocol (REST vs. RPC vs. GraphQL)
- Choosing build, CI/CD, or hosting infrastructure
- Any decision that is expensive to reverse

### Match Existing Conventions First

Before creating an ADR, inspect the repository for existing ADRs or config (e.g., `.adr-dir`, `docs/adr/`, `docs/decisions/`). Match the existing directory, numbering scheme (`0004-title.md` vs. `ADR-004-Title.rst`), and heading structure. Only use the default layout below when no convention exists.

### Default ADR Template (`docs/decisions/ADR-001-title.md`)

```markdown
# ADR-001: Use PostgreSQL for primary database

## Status

Proposed | Accepted | Superseded by ADR-XXX | Deprecated

## Date

2026-01-15

## Context

Key requirements and constraints driving the decision:

- Relational data model with ACID transactions
- Full-text search without operating a separate search cluster
- Managed hosting suitable for a small team

## Decision

Use PostgreSQL with Prisma ORM.

## Alternatives Considered

### MongoDB

- **Pros:** Flexible schema, fast initial prototyping
- **Cons:** Relational domain requires manual joins or duplication
- **Rejected:** Poor fit for transactional relational invariants

### SQLite

- **Pros:** Zero configuration, fast local reads
- **Cons:** Single-writer bottleneck in multi-instance production
- **Rejected:** Does not scale horizontally for concurrent writes

## Consequences

- Type-safe queries and migrations out of the box
- Built-in full-text search removes need for Elasticsearch
- Team requires standard SQL/Postgres operational knowledge
```

**Lifecycle:** `PROPOSED -> ACCEPTED -> (SUPERSEDED or DEPRECATED)`. Never delete superseded ADRs; link the new ADR to the old one.

## Part 3: Documentation Drift & Prose Quality

### Git-Based Drift Detection

Never guess whether documentation is up to date from how confident the prose sounds. Check commit ancestry:

```sh
code=$(git log -1 --format=%H -- src/router.ts)
doc=$(git log -1 --format=%H -- docs/routing.md)

if [ "$code" = "$doc" ]; then
  echo "current: changed together"
elif git merge-base --is-ancestor "$doc" "$code"; then
  echo "stale: code changed after doc"
elif git merge-base --is-ancestor "$code" "$doc"; then
  echo "current: doc changed after the code"
else
  echo "can't tell: divergent or shallow history"
fi
```

If history is shallow or divergent, report `"can't tell"` rather than claiming docs are current.

### Prose & Changelog Rules

- **Cut fluff:** Replace stock marketing intros ("In today's fast-paced world...") with concrete facts, commands, and trade-offs.
- **Preserve precision:** Keep exact CLI flags, file paths, units, version constraints, and caveats intact when editing prose.
- **Append-only changelogs:** Never rewrite or collapse historical entries in `CHANGELOG.md`; append dated entries explaining what changed and why.
- **Agent rules (`CLAUDE.md` / `AGENTS.md`):** Keep project conventions, build/test commands, and links to ADRs updated so coding agents follow repository standards automatically.

## Verification Checklist

- [ ] Landing page / README opens with a one-liner, minimal runnable code snippet, and multi-runtime Quick Start
- [ ] Features and benchmarks use concrete numbers/proof rather than generic adjectives
- [ ] Docs follow a clean hierarchy (`Concepts`, `Getting Started`, `Guides`, `API Reference`) with progressive links
- [ ] Significant architectural choices have numbered ADRs with alternatives and consequences
- [ ] Drift checks use `git merge-base` and report `"can't tell"` when history is inconclusive
