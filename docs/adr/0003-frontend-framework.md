---
status: proposed
date: 2026-11-25
decision-makers: AREA team (4 members)
supersedes: —
superseded-by: —
---

# ADR-0003: Web front-end framework

> **Decision:** the web client is a **Vue 3 single-page app built with Vite**, in TypeScript.
> **Why:** it is the team's choice, it shares TypeScript contracts with the NestJS back end, and it covers the Builder, i18n and accessibility needs without a full-stack framework.

## Context

The web client is where users register, connect services and **build workflows** (the Builder is web only). It talks to the `gateway` through the OpenAPI-described HTTP API ([ADR-0002](0002-backend-framework.md)). We need to decide **which framework the web client is written in**.

Requirements from the subject that weigh on the choice:

- **Builder**: assemble a chain of nodes (trigger, ≥ 4 reactions, one condition with two branches) and map data between them (`{{ trigger.subject }}`).
- **No hard-coded catalogue**: forms for Actions and REActions are generated from `about.json`.
- **WCAG AA**, with a committed accessibility audit.
- **At least two languages** on the whole main flow.
- **No full-stack framework** mixing client and server in one codebase (Next.js, Nuxt in server mode, SvelteKit, …).
- Back end is **TypeScript / NestJS** in a monorepo with a shared `contracts` package.

## Decision drivers

1. **Builder feasibility**: a maintained node-graph editor library exists, with keyboard support.
2. **Shared contracts**: types from `contracts` and an API client generated from OpenAPI are used as-is.
3. **Accessibility and i18n**: mature libraries for both, so WCAG AA and two languages are reachable.
4. **Team fit**: the team prefers it and can be productive quickly.
5. **Pure client**: runs as a static SPA served by its own container, no server-side code.

## Evidence

The team listed four candidates and voted in Notion (AREA › Architecture › Ranking):

| Candidate | Team signal | Result   |
| --------- | ----------- | -------- |
| React     | —           |          |
| **Vue**   | 🔥🔥         | **Chosen (Vue 3 + Vite)** |
| Svelte    | —           |          |
| Angular   | —           |          |

> ⚠️ **Gap:** unlike the back end, **no front-end spike is recorded**, and the reasons for the vote are not written down. The subject requires selection documents "backed by exploratory code". Before this ADR moves to `accepted`, the PoC in [Confirmation](#confirmation) must be done and its results added here.

## Options compared

|                         | React        | **Vue 3**      | Svelte       | Angular       |
| :---------------------- | :----------- | :------------- | :----------- | :------------ |
| 1. Builder library      | 🟢 React Flow | 🟢 **`@xyflow/vue`** | 🟢 Svelte Flow | 🟡 Fewer options |
| 2. Shared contracts     | 🟢 Yes        | 🟢 **Yes**      | 🟢 Yes        | 🟢 Yes         |
| 3. Accessibility / i18n | 🟢 Yes        | 🟢 **Yes**      | 🟡 Partial    | 🟢 Yes         |
| 4. Team fit             | 🟡 —          | 🟢 **Voted**    | 🟡 —          | 🔴 Heavy       |
| 5. Pure client (SPA)    | 🟢 Yes        | 🟢 **Yes**      | 🟢 Yes        | 🟢 Yes         |

- **React**: the largest ecosystem and strong accessibility tooling (e.g. React Aria). React Flow and Vue Flow now come from the same xyflow team, so the Builder no longer separates React from Vue. A real alternative, rejected on team preference rather than capability.
- **Vue 3**: Single File Components and the Composition API keep templates close to HTML, which helps accessibility reviews. `@xyflow/vue` (Vue Flow v2, MIT) covers the Builder, `vue-i18n` covers languages, Pinia and Vue Router are official. Vite is its native build tool.
- **Svelte**: lightest runtime, but a smaller ecosystem for a11y components and i18n, and the official tooling pushes toward SvelteKit (full stack), which the subject discourages.
- **Angular**: complete and opinionated (router, i18n, CDK a11y built in), but the heaviest to learn and to set up for a 4-person team on a short schedule.

## Decision

### Stack

| Layer          | Choice                                      | Why                                                       |
| -------------- | ------------------------------------------- | --------------------------------------------------------- |
| Framework      | Vue 3, Composition API, `<script setup>`    | Team choice                                               |
| Language       | TypeScript (`strict`)                       | Imports `contracts` from the monorepo                     |
| Build          | Vite                                        | Native Vue tooling, fast dev server, static output        |
| Routing        | Vue Router                                  | Official                                                  |
| State          | Pinia                                       | Official, typed                                           |
| Builder        | `@xyflow/vue` (MIT, free tier) + `@dagrejs/dagre` (MIT) | Node-graph canvas; extra features built in-house (see below) |
| i18n           | `vue-i18n`                                  | Two languages on the whole main flow                      |
| API client     | Generated from the OpenAPI description      | No hand-written request types, drift caught at build      |
| Delivery       | Static files served by a web server container | No server-side code in the client                       |

### Rules

| Topic          | Rule                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Business logic | None in the client. Workflow validation, key-path checks and the catalogue live on the server.                       |
| Catalogue      | Action and REAction forms are rendered from `about.json`. No service is hard-coded.                                  |
| Text           | Every user-visible string goes through `vue-i18n`. A lint rule rejects raw strings in templates.                     |
| Accessibility  | Automated a11y checks (e.g. axe) run in CI on the main flow pages. Manual keyboard and screen-reader checks for the Builder. |
| SSR            | No Nuxt / SSR. The client is a pure SPA.                                                                              |

### Builder

The Builder is a canvas built on **`@xyflow/vue`**, the Vue Flow v2 package now maintained by xyflow. The older `@vue-flow/core` repository is archived.

**Licensing.** The library is MIT and free. **Vue Flow Pro** is a paid subscription (from $169/month) that sells Pro Examples, support, prioritised issues and the right to hide the attribution. It does **not** unlock library components: Background, MiniMap, Controls, NodeResizer, NodeToolbar and Panel are all in the free package. We do not subscribe, and:

- the xyflow attribution stays visible on the canvas;
- features shown in the Pro Examples are **written by us from scratch**. Pro Example code is under a commercial licence and is never copied into the repo.

**Features we build ourselves**

| Feature             | How                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------- |
| Copy / paste        | Serialise selected nodes to the clipboard, paste with new ids and remapped `{{ }}` keys |
| Undo / redo         | Command history in the Pinia store                                                      |
| Auto layout         | `@dagrejs/dagre` (MIT). `elkjs` is rejected because it is EPL-2.0 / GPL-3.0              |
| Helper lines / snap | Built-in snap grid; alignment guides only if time allows                                |
| Keyboard editing    | Add, select, connect and delete nodes without a mouse (WCAG AA)                         |

**The canvas must enforce the structural rules.** A free-form graph editor lets users draw shapes the subject forbids: merging branches, a nested condition, a third branch. Every edit (connect, paste, delete) goes through a guard that rejects invalid shapes **before** they reach the store. The server still validates at save time. The client guard only gives earlier feedback.

**Rejected alternative: list builder.** A Zapier-style vertical list with plain Vue components needs no library, is accessible by default, and cannot express an invalid shape. It is rejected for the canvas's clearer view of branches in the demo. It stays the **fallback** if the canvas cannot meet WCAG AA.

## Consequences

**Good**

- Same language and the same `contracts` package as the back end, so a contract change breaks the client build.
- Official router, store and build tool: few third-party choices to make and maintain.
- The client is a static bundle, simple to containerise and to serve with Docker Compose and Kubernetes.

**Bad**

- Copy/paste, undo/redo and auto layout are ours to write and maintain, instead of adapting paid examples.
- The canvas allows shapes the subject forbids, so the client needs a structural guard on every edit.
- The choice rests on a team vote with no recorded spike. It must be backed by the PoC before acceptance.
- Graph editors are hard to make accessible. The Builder needs extra work (keyboard alternative to drag and drop) to reach WCAG AA, with the list builder as fallback.

## Confirmation

The decision holds only if all of these pass in a PoC. Otherwise, revisit (React is the first alternative).

- [ ] **Builder**: build a workflow with a trigger, 4 reactions and one condition with two branches, using only the keyboard.
- [ ] **Structural guard**: try to merge two branches, add a second condition, and paste a condition inside a branch; each is refused in the canvas.
- [ ] **Copy / paste and undo**: copy two reactions, paste them, undo, redo; `{{ }}` references in the copies point to the new nodes.
- [ ] **Data mapping**: insert `{{ trigger.subject }}` into a reaction field from a list of keys declared by earlier nodes.
- [ ] **Catalogue**: add a field to a connector manifest; the form shows it without client changes.
- [ ] **Contracts**: change a type in `contracts`; the client build fails.
- [ ] **i18n**: switch language on registration → AREA creation; no untranslated string.
- [ ] **Accessibility**: automated audit reports no WCAG AA violation on the main flow pages.

## Related

- [ADR-0001: Service granularity](0001-service-granularity.md), [ADR-0002: Back-end framework](0002-backend-framework.md).
- Team vote: Notion, AREA › Architecture › Ranking.
- Next ADRs: Android client (Jetpack Compose), accessibility audit tooling.
- Requirements: [CLAUDE.md](../../CLAUDE.md).
