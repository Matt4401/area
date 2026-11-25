---
status: proposed
date: 2026-11-25
decision-makers: AREA team (4 members)
supersedes: —
superseded-by: —
amends: ADR-0001 (rollout of the service list)
---

# ADR-0006: Service split for the MVP

> **Decision:** the MVP runs **one `core` service** (gateway, identity, credentials, workflow, catalog, scheduler, engine as NestJS modules) and **one microservice per connector**. `core` is split into the services of ADR-0001 later, when a need is observed.
> **Why:** it proves every inter-service contract (broker, manifests, token RPC) from day one, so the later split moves code without changing contracts, at a fraction of the infrastructure cost.

## Context

[ADR-0001](0001-service-granularity.md) targets ~12–15 services. The team wants real microservices in the MVP, because **switching to microservices later would be useless refactoring**. But building all services before a single workflow runs delays the MVP (end-to-end workflow due in week 4).

The refactoring cost of a later split does not come from the number of containers. It comes from:

1. **Contracts**: code that calls another part in-process must be rewritten to use messages.
2. **Data**: tables of different parts joined by foreign keys must be pulled apart.

## Options compared

|                                  | Full ADR-0001 list | **Core + connectors** | Monolith + one extracted service | Modular monolith |
| :------------------------------- | :----------------- | :-------------------- | :------------------------------- | :--------------- |
| Contracts proven at MVP          | 🟢 All             | 🟢 **All core ↔ connector** | 🟡 One                     | 🔴 None          |
| Data split ready                 | 🟢 Yes             | 🟢 **Yes (DB per module)** | 🟡 Partial                  | 🔴 No            |
| Infra cost before first workflow | 🔴 High            | 🟡 **Medium**         | 🟢 Low                           | 🟢 Low           |
| Refactoring to reach ADR-0001    | None               | **Move modules out**  | Extract every connector          | Everything       |

## Decision

- `core` hosts the gateway, identity, credentials, workflow, catalog, scheduler and engine as **separate NestJS modules**.
- Each connector (GitHub, Discord) is **its own service**.
- **Every exchange between `core` and connectors goes through RabbitMQ**: manifests, poll ticks, events, reaction jobs, results, token RPC.
- **Each `core` module owns its own PostgreSQL database and role** ([ADR-0004](0004-persistence.md)). No foreign key or join crosses modules.
- Inside `core`, modules call each other only through their public provider interface, never another module's repository.

### When to split `core`

Extract a module into its own service when one of these is observed:

- it needs to scale independently (likely `engine` first, then `scheduler`);
- its failure must not affect the API (e.g. `engine` crash takes the gateway down);
- SYS-K8S work requires separate replicas.

Extraction steps: move the module into a new app, replace in-process calls with the existing message patterns, point it at its own `DATABASE_URL`. Connectors do not change.

## Consequences

**Good**

- The core ↔ connector contracts are real and tested from the MVP.
- Splitting `core` later changes neither connectors nor data.
- 2 application containers plus `core`, instead of ~15, during the MVP.

**Bad**

- Inside `core`, a crash or a slow module affects the whole API until it is split.
- Module boundaries inside `core` rely on discipline and review. A lint rule on imports between modules is needed.
- Fault isolation and independent scaling (ADR-0001 drivers 1 and 2) are only partly met until the split.

## Confirmation

- [ ] Adding a third connector requires no change to `core`.
- [ ] A lint rule fails when one `core` module imports another module's repository or entity.
- [ ] No migration of a `core` module references another module's tables.
- [ ] Extracting one module (e.g. `engine`) into its own container in a branch requires no connector change.

## Related

- [ADR-0001: Service granularity](0001-service-granularity.md): target architecture; this ADR defines how it is reached.
- [ADR-0004: Persistence](0004-persistence.md).
- [MVP scope](../mvp.md).
