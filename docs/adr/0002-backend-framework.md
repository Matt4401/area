---
status: proposed
date: 2026-11-25
decision-makers: AREA team (4 members)
supersedes: —
superseded-by: —
---

# ADR-0002: Back-end framework

> **Decision:** every back-end service is written in **TypeScript on Node.js with NestJS**.
> **Why:** it is the only candidate that imposes a module structure on ~15 services, shares a language with the Vue 3 web client, and ships OpenAPI and broker transports out of the box. It is also the team's first choice after the spikes.

## Context

[ADR-0001](0001-service-granularity.md) splits the server into ~12–15 services (`gateway`, `identity`, `credentials`, `workflow`, `engine`, one `connector-<name>` per third-party service, …). We now need to decide **which language and framework those services are written in**.

- The web client is **Vue 3** (TypeScript). The Android client is **Jetpack Compose** (Kotlin).
- The code lives in a **monorepo** with a shared connector SDK and shared message contracts (ADR-0001).
- The server must serve an **OpenAPI** description, and a test must fail when code and description disagree.
- The broker is not chosen yet (Redis, RabbitMQ, NATS, Kafka are candidates). The framework must not force that choice.
- Targeted features that depend on the framework: ENG-EXT, ENG-ASYNC, ENG-RETRY, SYS-HEALTH, SYS-OBS, SEC-AUTH.

## Decision drivers

1. **Uniform structure**: ~15 services written by 4 people must look the same, so anyone can work on any service.
2. **Shared contracts**: message schemas, `about.json` types and the connector SDK are written once and used by every service and by the web client.
3. **OpenAPI as a contract**: the description is generated from the code and checked by a test, not maintained by hand.
4. **Broker independence**: switching broker must not mean rewriting the services.
5. **Ecosystem**: OAuth2 / OIDC, validation, health checks, metrics and job queues are available as maintained libraries.
6. **Footprint**: ~15 instances must run on the demo cluster and with Docker Compose.

## Evidence: spikes

Each member built the same thing with one framework: a `GET /ping` route answering `{"status": "ok"}` on port 8080, with configuration read from the environment. Notes are in Notion (AREA › Architecture › Ranking).

| Spike  | Framework     | Time   | Pros reported                                                                  | Cons reported                                                                                     |
| ------ | ------------- | ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Matt   | NestJS (TS)   | —      | Guided project generation, good AI tooling, clear docs, module separation      | Config via env only (risk of a huge `.env`), unit tests felt poorly integrated                    |
| Charles | Hono (TS)    | 5 min 20 | Very fast, very simple, Node ecosystem, deploys anywhere, hot reload         | Code differs per runtime, no imposed file structure ("can quickly become a mess"), maybe too simple |
| Ethan  | Fiber (Go)    | 5 min 19 | Very fast, easy, readable code, single binary to deploy                      | No imposed structure, install and JSON response hard to find in the docs, no hot reload, needs `godotenv` for `.env` |
| Noé    | Actix (Rust)  | —      | Accessible docs, standard install with Cargo                                   | Verbose, functional style not always easy to grasp                                                |

**Team ranking after the spikes:** 1. NestJS, 2. Hono, 3. Go (Fiber), 4. Rust (Actix).

What the spikes show: all four reach a running endpoint quickly, so **time to "hello world" does not separate them**. The difference is structure. Hono and Fiber impose none, and two spike authors flagged it as a risk. NestJS is the only one that imposes it.

## Options compared

|                        | **NestJS (TS)** | Hono (TS)      | Fiber (Go)     | Actix (Rust)   |
| :--------------------- | :-------------- | :------------- | :------------- | :------------- |
| 1. Uniform structure   | 🟢 **Yes**      | 🔴 No          | 🔴 No          | 🔴 No          |
| 2. Shared contracts    | 🟢 **Yes**      | 🟢 Yes         | 🔴 No          | 🔴 No          |
| 3. OpenAPI from code   | 🟢 **Yes**      | 🟡 Add-on      | 🟡 Add-on      | 🟡 Add-on      |
| 4. Broker independence | 🟢 **Yes**      | 🔴 No          | 🔴 No          | 🔴 No          |
| 5. Ecosystem           | 🟢 **Yes**      | 🟡 Partial     | 🟡 Partial     | 🟡 Partial     |
| 6. Footprint           | 🟡 **Medium**   | 🟢 Low         | 🟢 Very low    | 🟢 Very low    |
| Learning curve (spikes) | 🟡 Medium      | 🟢 Low         | 🟢 Low         | 🔴 High        |

- **NestJS**: modules and dependency injection give every service the same shape. `@nestjs/microservices` offers one API over Redis, RabbitMQ, NATS and Kafka. `@nestjs/swagger` generates OpenAPI from controllers and DTOs. `@nestjs/terminus` covers health checks. The cost is more concepts to learn and more memory per service.
- **Hono**: the strongest alternative. Same language, lightweight, fast. But every service would invent its own structure, and broker, OpenAPI and DI wiring would be glue code we write and maintain ourselves.
- **Fiber**: smallest runtime and simplest deployment. But it shares no code with any client, imposes no structure, and the spike found the docs harder to navigate.
- **Actix**: best raw performance, but verbose and the hardest to learn for the team. Performance is not a driver: the bottleneck is third-party APIs, not our CPU.

## Decision

### Stack per service

| Layer        | Choice                                 | Why                                                    |
| ------------ | -------------------------------------- | ------------------------------------------------------ |
| Runtime      | Node.js LTS                            | Same runtime as the web client tooling                 |
| Language     | TypeScript (`strict`)                  | Shared types with Vue 3                                |
| Framework    | NestJS                                 | Modules, DI, transports, OpenAPI                       |
| HTTP adapter | Fastify                                | Lower overhead than the default Express adapter        |
| Validation   | DTOs validated at the edge             | Bad input is refused before it reaches business logic  |
| Config       | `@nestjs/config` with a validated schema per service | Answers the spike's "huge `.env`" concern: each service declares and validates only its own keys, and fails at startup if one is missing |
| OpenAPI      | `@nestjs/swagger`, served by `gateway` | Description generated from the code (driver 3)         |
| Messaging    | `@nestjs/microservices`                | Broker chosen in a later ADR, swappable by config      |
| Health       | `@nestjs/terminus`                     | One endpoint per dependency (SYS-HEALTH)               |

### Rules

| Topic           | Rule                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Shared packages | `contracts` (message schemas, `about.json` types) and `connector-sdk` are monorepo packages. Services import them, never copy them. |
| Connectors      | A connector is a NestJS app that implements the SDK interface and registers its manifest at startup (ENG-EXT).                       |
| Business logic  | Lives in providers, not in controllers or message handlers. Handlers only translate transport → use case.                            |
| OpenAPI         | The generated description is committed. CI regenerates it and fails on any diff, and contract tests run against it.                  |
| Boundaries      | One NestJS app per service. A module from one service is never imported by another service.                                          |
| Tests           | Unit tests sit next to the provider they test and run in CI. This answers the spike's concern about test integration.               |

### Hybrid deployment

NestJS modules make the split between services a deployment choice, not a rewrite. The same modules can run as separate apps (ADR-0001 target) or be mounted together in one process if the footprint check below fails. This matches the "hybrid architecture" idea in the team's notes. It is the fallback, not the plan.

## Consequences

**Good**

- Message contracts and `about.json` types are written once and type-checked in every service and in the web client.
- All services share the same layout, so moving between services costs little.
- The broker decision stays open: services change transport by configuration.
- OpenAPI cannot drift silently from the code.

**Bad**

- Node.js uses more memory per service than Go or Rust. With ~15 services, the total must be measured early.
- Decorators and DI add framework "magic" that members must learn. The spike rated it as the medium learning curve.
- CPU-heavy work (e.g. AI-MULTIMODAL processing) blocks the event loop and must run in a worker thread or a separate service.
- No language shared with the Android client: its API client is generated from the OpenAPI description instead.

## Confirmation

The decision holds only if all of these pass in a PoC. Otherwise, revisit (Hono is the first alternative, then Go).

- [ ] **Shared contract**: change a field in `contracts`; the build fails in every service and in the web client that use it.
- [ ] **OpenAPI drift**: change a DTO without regenerating; CI fails.
- [ ] **Broker swap**: the same connector runs on two transports (e.g. Redis and NATS) by changing only configuration.
- [ ] **New connector**: a connector built from `connector-sdk` appears in `about.json` without touching other services.
- [ ] **Config**: a service started with a missing required variable refuses to start with a clear message.
- [ ] **Footprint**: measure idle memory per service; the full stack fits on the demo cluster and with Docker Compose.

## Related

- [ADR-0001: Service granularity](0001-service-granularity.md).
- Spikes and team ranking: Notion, AREA › Architecture › Ranking.
- Next ADRs: broker, database engine (PostgreSQL is the candidate), ORM, workflow engine, web front-end (Vue 3), Android (Jetpack Compose).
- Requirements: [CLAUDE.md](../../CLAUDE.md).
