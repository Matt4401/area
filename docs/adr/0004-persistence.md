---
status: proposed
date: 2026-11-25
decision-makers: AREA team (4 members)
supersedes: —
superseded-by: —
amends: ADR-0001 (data topology)
---

# ADR-0004: Persistence engine and topology

> **Decision:** every stateful service stores its data in **PostgreSQL**. Each service owns **its own database and its own role**. For the MVP and Docker Compose, all these databases live on **one PostgreSQL instance**. Moving a service to its own instance is a configuration change, not a code change.
> **Why:** PostgreSQL covers relational data, JSON documents, deduplication and the outbox pattern with one engine. One instance keeps operations simple for a 4-person team, while separate databases keep the service boundaries of ADR-0001.

## Context

[ADR-0001](0001-service-granularity.md) gives each stateful service its own data. [ADR-0002](0002-backend-framework.md) writes the services in NestJS / TypeScript. We now need to decide **which database engine** they use and **how databases are deployed**.

What the services store:

| Service          | Data                                                        | Shape                     |
| ---------------- | ----------------------------------------------------------- | ------------------------- |
| `identity`       | Users, local credentials (hashed), linked OIDC identities   | Relational                |
| `credentials`    | OAuth2 tokens (encrypted), expiry, scopes                   | Relational                |
| `workflow`       | Workflows, nodes, edges, node parameters                    | Relational + JSON         |
| `hook-scheduler` | Next poll time per trigger                                  | Relational                |
| `connector-*`    | Already-seen event keys (deduplication), cursors           | Key + unique constraint   |
| `engine`         | In-progress runs, suspended runs (AI-REVIEW)                | Relational + JSON         |
| `run-records`    | Immutable execution records (SYS-OBS), retention (SEC-GDPR) | Append-only + JSON        |

`gateway` and `catalog` are stateless: `catalog` is rebuilt from the manifests connectors send at startup.

The team notes (Notion, AREA › Architecture) already point to **PostgreSQL** and to **one host with separate databases** for the MVP, "with an explanation of how to scale to one host per service". No database spike is recorded.

## Decision drivers

1. **Integrity**: users, identities, tokens and workflows reference each other inside a service. Foreign keys and transactions prevent orphans.
2. **Flexible payloads**: node parameters and run outputs differ per connector and must be stored without a schema change per connector.
3. **Exactly-once effects**: hooks must not process the same event twice (deduplication), and a state change and its outgoing message must not diverge (outbox pattern, ADR-0001).
4. **Operability**: backups, metrics, health checks and Kubernetes deployment are documented and tooled.
5. **Footprint and simplicity**: the stack must run with Docker Compose on a laptop and on the demo cluster.

## Engine: options compared

|                          | **PostgreSQL** | MySQL / MariaDB | MongoDB         | SQLite per service |
| :----------------------- | :------------- | :-------------- | :-------------- | :----------------- |
| 1. Integrity             | 🟢 **Yes**     | 🟢 Yes          | 🟡 Partial      | 🟢 Yes             |
| 2. Flexible payloads     | 🟢 **JSONB, indexed** | 🟡 JSON, weaker indexing | 🟢 Native | 🟡 JSON1          |
| 3. Dedup + outbox        | 🟢 **Yes**     | 🟢 Yes          | 🟡 Needs replica set for transactions | 🟢 Yes |
| 4. Operability           | 🟢 **Yes**     | 🟢 Yes          | 🟢 Yes          | 🔴 No (file on a volume) |
| 5. Multiple replicas     | 🟢 **Yes**     | 🟢 Yes          | 🟢 Yes          | 🔴 One writer only |

- **PostgreSQL**: relational integrity and indexed JSONB in one engine. `INSERT … ON CONFLICT DO NOTHING` on a unique key gives deduplication for free. `SELECT … FOR UPDATE SKIP LOCKED` makes the outbox relay safe with several replicas. Supported by every NestJS ORM.
- **MySQL / MariaDB**: equivalent for relational data, weaker for querying JSON payloads. No reason to prefer it.
- **MongoDB**: good fit for payloads, but users ↔ identities ↔ tokens are relational, and multi-document transactions (needed by the outbox) require a replica set even in development.
- **SQLite**: zero operations, but a file cannot be shared by several replicas, which breaks SYS-K8S ("multiple server replicas survive a pod deletion").

## Topology: options compared

|                              | Shared DB, schema per service | **One instance, DB per service** | Instance per service (ADR-0001) |
| :--------------------------- | :---------------------------- | :------------------------------- | :------------------------------ |
| Boundary between services    | 🟡 Schemas, easy to cross     | 🟢 **Separate DBs and roles**    | 🟢 Separate servers             |
| Failure isolation (instance) | 🔴 No                         | 🔴 **No**                        | 🟢 Yes                          |
| Failure isolation (one DB: bad migration, lock, full table) | 🔴 No | 🟢 **Yes**            | 🟢 Yes                          |
| Containers to run            | 1                             | **1**                            | ~7                              |
| Backup / monitoring          | 1 target                      | **1 target**                     | ~7 targets                      |
| Move to the next column      | Code change                   | **Config + dump/restore**        | —                               |

**One instance, one database per service** is chosen for the MVP and Docker Compose. It keeps the boundaries of ADR-0001 strict (a service cannot even connect to another service's database) and costs one container. The instance is a single point of failure: this is the accepted trade-off.

## Decision

### Rules

| Topic         | Rule                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ownership     | One database and one role per stateful service. `CONNECT` is revoked from `PUBLIC`: a role can only open its own database.                       |
| Configuration | Each service receives only its own `DATABASE_URL`. No service knows the instance is shared.                                                       |
| Cross-service | No query crosses databases (no `dblink`, no foreign data wrapper). Services exchange data through the API or the broker only (ADR-0001).          |
| Migrations    | Owned by the service, versioned in its folder, run as a step before the service starts. A failed migration stops only that service.              |
| Payloads      | Connector-specific data (node parameters, run inputs and outputs) is stored as `JSONB`. Columns the code filters on are real columns.             |
| Deduplication | Each connector stores `(trigger_id, event_key)` with a unique constraint. Inserting an existing key is a no-op, so the event is not re-emitted.   |
| Outbox        | A state change and its outgoing message are written in the same transaction. A relay publishes pending rows using `SKIP LOCKED`.                  |
| Tokens        | `credentials` encrypts tokens in the application with an authenticated cipher. The key is never stored in PostgreSQL (SEC-CRYPTO).              |
| Run records   | Append-only. A scheduled job deletes records past the configured retention (SEC-GDPR).                                                            |
| Connections   | Pool size per replica is set by configuration. `services × replicas × pool` must stay below `max_connections`. Add PgBouncer if it does not.     |

### When to split a database onto its own instance

A service moves to a dedicated instance when one of these is observed:

- its load slows down other services' queries (likely first: `run-records`, then `connector-*`);
- its availability requirement differs (e.g. `identity` must stay up during maintenance of the others);
- the instance cannot be sized to fit everything.

Procedure: start a new instance, dump and restore that service's database, change its `DATABASE_URL`. No code change.

### Deployment

| Environment    | PostgreSQL                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------- |
| Docker Compose | Official `postgres` image, one container, an init script creates one database and role per service |
| Kubernetes     | One PostgreSQL deployment with a persistent volume (operator choice left to SYS-K8S work)     |

The ORM / query layer is a separate decision (next ADR).

## Consequences

**Good**

- One engine to learn, back up, monitor and secure.
- Service boundaries are enforced by the database itself (roles), not only by convention.
- Deduplication and outbox rely on built-in features, not custom locking.
- The path to one instance per service is documented and cheap.

**Bad**

- **The instance is a single point of failure.** If it goes down, every stateful service is unhealthy. Mitigations: health checks, automatic restart, backups. Work on the execution path is held by the broker and resumes after recovery.
- One noisy service can slow the others until it is split out.
- Connection count grows with replicas and must be watched.
- JSONB payloads are not checked by the database. Their shape is checked by the code (contracts from ADR-0002).

## Confirmation

- [ ] **Isolation**: with `workflow`'s credentials, connecting to `identity`'s database is refused.
- [ ] **Split**: move one service to a second instance by changing only its `DATABASE_URL` after dump/restore; its tests still pass.
- [ ] **Deduplication**: the same third-party event delivered twice creates one row and starts one run.
- [ ] **Outbox**: kill a service between the commit and the publish; the message is published exactly once after restart.
- [ ] **Instance failure**: stop PostgreSQL during a run; services report unhealthy, then recover after restart with no lost or duplicated run.
- [ ] **Connections**: the full stack at its maximum replica count stays below `max_connections`.

## Related

- [ADR-0001: Service granularity](0001-service-granularity.md). This ADR amends its "one database per service" rule: databases stay separate, but share one instance for now.
- [ADR-0002: Back-end framework](0002-backend-framework.md).
- Team notes: Notion, AREA › Architecture.
- Next ADRs: ORM / query layer, broker.
- Requirements: [CLAUDE.md](../../CLAUDE.md).
