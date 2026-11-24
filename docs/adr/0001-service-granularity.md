---
status: proposed
date: 2026-11-24
decision-makers: AREA team (4 members)
supersedes: —
superseded-by: —
---

# ADR-0001: Service granularity — microservices, one service per connector

## Context and problem statement

AREA is made of an application server, a web client and an Android client. The server has to:

- detect Actions in third-party services with no client open (hooks: polling, webhooks, deduplication);
- walk workflows (trigger → reactions, optional condition) and substitute `{{ key.path }}` data;
- perform REActions against third-party APIs that are slow, rate-limited and sometimes down;
- hold user identities (local + OIDC) and delegated OAuth 2.0 credentials;
- expose a server-declared catalogue (`about.json`) and an OpenAPI-described HTTP API.

The team had already assumed "microservices on Kubernetes" without recording why. This ADR decides **how the server is cut into deployable units**. The four options are monolith, macroservices, miniservices and microservices. The ADR also records the evidence that will confirm or overturn the choice.

Constraints and inputs:

- **Team**: M = 4, experienced with distributed systems (Kubernetes, brokers, tracing). Team size is explicitly **not** meant to cap the architecture.
- **Quantities**: S ≥ 5 services (≥ half OAuth2), A + R ≥ 10, D ≥ 8.
- **Targeted additional features**: SYS-K8S, ENG-ASYNC, SYS-OBS, SYS-HEALTH, ENG-EXT, ENG-RETRY.
- **Delivery**: the whole product must also run with Docker Compose. Kubernetes cannot be the only runtime.

## Decision drivers

1. **Independent scalability** (primary). Hook detection, workflow execution and each third-party connector have different load profiles and must scale separately.
2. **Fault isolation**. A slow or failing third-party API must not degrade the API or unrelated workflows ("survives its own failures").
3. **Extensibility (ENG-EXT)**. Adding a connector must touch only that connector, and `about.json` must update itself.
4. **Asynchronous, retryable execution (ENG-ASYNC, ENG-RETRY)**. A separate worker must survive stop/restart without losing work. Retries are bounded, and failed jobs go to a dead-letter store.
5. **Operability (SYS-K8S, SYS-OBS, SYS-HEALTH)**. Multiple replicas must survive a pod deletion, and execution records must live in a single store.

## Considered options

| Option | Shape | Deployable units |
|---|---|---|
| **A. Monolith** (modular) | One codebase, one image, optionally run in two roles (api / worker) | 1 image, 1–2 deployments |
| **B. Macroservices** | `api` (auth, CRUD, catalogue) + `runtime` (hooks, engine, reactions) | 2 |
| **C. Miniservices** | Cut by business capability. Connectors are in-process plugins of one worker | ~5–6 |
| **D. Microservices** | Cut by capability **and** one service per connector | ~12–15 |

## Decision outcome

**Chosen option: D. Microservices, one service per connector.** It is the only option where every load profile scales on its own (driver 1) and a third-party failure is contained to one connector (driver 2). The team's experience makes the operational cost acceptable.

### Service map

| Service | Responsibility | Owns |
|---|---|---|
| `gateway` | Public HTTP entry point, OpenAPI, auth checks, routing | — (stateless) |
| `identity` | Local accounts, account confirmation, OIDC login, sessions | users, external identities |
| `credentials` | Delegated OAuth 2.0 tokens (encrypted), refresh, revocation | service subscriptions, tokens |
| `workflow` | Workflow CRUD, structural validation and key-path validation at save | workflows, nodes |
| `catalog` | Receives connector manifests, serves `about.json` | catalogue registry |
| `hook-scheduler` | Schedules poll ticks for enabled triggers and publishes them to the broker | trigger schedules |
| `engine` | Consumes trigger events, walks the workflow, substitutes data, dispatches reaction jobs | in-flight run state |
| `run-records` | Single store of execution records (SYS-OBS), usage and failure views | run records |
| `connector-<name>` (×S) | Polls / receives webhooks, deduplicates, executes REActions for one third-party service | per-connector dedup state |

Kubernetes supplies the broker and the databases as infrastructure. Their technology is chosen in separate ADRs.

### Cross-cutting rules decided here

- **Communication**: the execution path (tick → event → run → reaction job → result) goes through a **broker** with durable messages, bounded retries with backoff, and a dead-letter queue. Point lookups (e.g. a connector fetching a short-lived access token from `credentials`) use **synchronous internal calls** (REST or gRPC).
- **Hooks**: `hook-scheduler` owns *when* to poll. The connector owns *how* to poll, deduplicates in its own schema, and publishes only new occurrences.
- **Credentials**: only `credentials` stores delegated tokens. Connectors never persist tokens. This keeps OIDC (who the user is, in `identity`) separate from OAuth 2.0 (what the app may do, in `credentials`).
- **Catalogue**: each connector **self-registers** its manifest (actions, reactions, parameters, published keys) with `catalog` at startup. No client and no central file lists connectors.
- **Data ownership**: each service owns its data. No service reads another service's tables. Cross-service consistency uses events and the **transactional outbox** pattern.
- **Shared code**: a **monorepo** hosts every service, a shared connector SDK (the ENG-EXT node interface) and shared message contracts. CI builds and tests only affected services.

### Data topology: one database per service

Every stateful service gets **its own database instance** from the MVP onwards, with its own credentials, volume, migrations, backups and health check. Stateless services (`gateway`) have none.

The reason is fault isolation. A database is one of the most likely components to fail (disk full, OOM kill, lost volume, slow query locking tables, failed migration). With a shared instance, any of these takes the whole product down. With one database per service, the outage is limited to the service that owns it. For example, if the `run-records` database is down, workflows still run and records are buffered by the broker. If one connector's database is down, only that connector stops.

Alternatives considered for the data topology:

- **One shared instance, one schema and role per service**: less to operate and a smaller footprint, but a single point of failure for every service and a shared performance bottleneck. Rejected on fault isolation.
- **One shared database, shared tables**: rejected. It recreates a distributed monolith.

## Consequences

### Positive

- Each connector, the engine and the hook scheduler scale on their own metric (e.g. queue length), which serves driver 1.
- A rate-limited or failing third-party API only backs up its own connector's queue. The API and other workflows stay responsive.
- A database outage is limited to the service that owns it. There is no shared database whose failure stops everything.
- Each database can be sized, tuned and scaled for its own service's load (driver 1 applies to storage too).
- ENG-EXT is structural: a new connector is a new service built on the SDK, and it appears in `about.json` once it registers.
- ENG-ASYNC and ENG-RETRY follow directly from the broker-based execution path. Worker restarts lose no work because messages are acknowledged after processing.
- SYS-K8S is exercised for real: many deployments, replicas, ConfigMaps and Secrets.

### Negative

- **Operational load**: ~12–15 deployments, plus broker and databases. Each needs a health endpoint, metrics, manifests and a Compose entry.
- **Distributed debugging**: a single workflow run spans 4+ services. Correlation IDs and tracing become mandatory, not optional.
- **Eventual consistency**: e.g. disabling a workflow takes effect at the scheduler after an event, not instantly. Every such case must be documented.
- **Contract drift**: message schemas between services need versioning and contract tests, in addition to the OpenAPI test.
- **Resource footprint**: the local cluster used during the defense must fit all pods, including one database per stateful service. This must be measured early.
- **More databases to operate**: one database per stateful service means N StatefulSets/volumes, N credentials, N migration pipelines, N backup jobs and N health checks (SYS-HEALTH reports each). This must be templated (shared Helm chart or Compose anchors), never hand-written N times.
- **No cross-service transactions or joins**: every cross-service consistency rule goes through events and the outbox. Reports that combine data from several services must be built from events (e.g. in `run-records`), not queries.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Duplicated logic across connectors | Shared connector SDK (polling, dedup, retries, token fetch, manifest, health, metrics) |
| "Distributed monolith" (chatty sync calls) | Execution path is async. Sync calls are limited to point lookups with timeouts |
| A connector polling twice with several replicas | Ticks come from `hook-scheduler` as broker messages consumed once. Dedup is enforced in the connector's schema |
| Demo depends on unreliable third parties | Recorded fallback demos, as the subject requires |

## Confirmation

The decision holds only if the following are observed. Otherwise it is revised (e.g. towards option C):

1. **Load test**: inject a burst of trigger events for one connector. Dashboards must show that **only** that connector (and the engine, if relevant) scales out via queue-length autoscaling, while API latency stays flat.
2. **Fault injection**: make one third-party API return 503 or time out. Other workflows keep running, and failed jobs land in the dead-letter store and can be replayed.
3. **Pod deletion**: delete a `gateway`, `engine` and connector pod during a run. No run is lost or duplicated.
4. **Database failure**: stop one service's database (e.g. a connector's or `run-records`'). Only that service reports unhealthy. Other workflows keep running, and the affected service recovers without losing messages once its database is back.
5. **Extensibility**: add a connector following `HOWTOCONTRIBUTE.md` without touching any other service, and observe it in `about.json`.
6. **Footprint**: the full stack (including every service's database) runs on the defense cluster and under Docker Compose on a team laptop.

## Pros and cons of the options

### A. Monolith (modular)

- Good: simplest to build, test, debug and deploy. Atomic transactions. Lowest footprint.
- Good: can still run as `api` + `worker` roles to satisfy ENG-ASYNC.
- Bad: everything scales together. A hot connector forces scaling the whole application (fails driver 1).
- Bad: a connector bug (memory leak, blocking call) can take down the API (weak on driver 2).
- Bad: contradicts the team's intent to exercise SYS-K8S with independent workloads.

### B. Macroservices

- Good: satisfies ENG-ASYNC and SYS-K8S replicas at low cost (2 units).
- Bad: `runtime` mixes hook detection, orchestration and every connector. They cannot scale or fail independently.
- Bad: the boundary is technical (sync vs async), not a business capability.

### C. Miniservices

- Good: clean capability boundaries (gateway, identity, workflow, engine, hooks, worker) with a moderate unit count.
- Good: ENG-EXT is simple (plugins inside one worker).
- Bad: all connectors share one worker. A slow or rate-limited API consumes shared capacity, and connectors cannot scale separately (partially fails drivers 1 and 2).
- Neutral: it is the fallback if the confirmation steps show microservices cost more than they return.

### D. Microservices, one service per connector (chosen)

- Good: meets drivers 1, 2 and 3 structurally.
- Bad: highest operational and debugging cost. Requires discipline on contracts, observability and the shared SDK.

## More information

- Follow-up ADRs: broker choice, database engine, back-end framework, workflow engine model and failure semantics.
- Subject requirements: `CLAUDE.md` (common base, additional features catalogue).
