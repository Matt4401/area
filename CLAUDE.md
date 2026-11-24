# CLAUDE.md

Context for AI agents working on this repository. It summarises the Epitech **AREA** subject (project, additional features catalogue, security evidence template). It records requirements, not decisions: technical choices live in ADRs (to be added).

## The project in one paragraph

AREA is an automation platform inspired by IFTTT and Zapier. Users subscribe to third-party **Services**, then build **workflows** where an **Action** (an event detected in a service) triggers one or more **REActions** (tasks performed in a service). The product is made of an **application server**, a **web client** and an **Android mobile client**. The team acts as software architects: understand the need, compare alternatives, integrate existing components, prove choices with PoCs, and defend the trade-offs. Code we write is mostly business logic and glue.

> Interconnecting two APIs is not the hard part. Assembling many parts into one product that runs on its own, survives its own failures, and can be handed to someone else is.

## Architecture constraint already decided

- The product is built as **microservices** deployed on **Kubernetes**.
- Everything else (languages, frameworks, database, broker, etc.) is open and will be recorded as ADRs. Do not assume a stack that is not in the code or an ADR.

## Common base (every group delivers it)

### Users and authentication
- Create and confirm an account, authenticate.
- Local authentication (username + password).
- Authentication through an external identity provider with **OpenID Connect**.
- Delegated access to services via the service's own mechanism (usually **OAuth 2.0**); delegated credentials are stored so hooks can run unattended.
- OIDC = *who the user is*. OAuth 2.0 = *what the app may do on the user's behalf*. Keep them distinct.
- How external identities link to local users and the lifecycle of delegated credentials must be documented.

### Services, Actions, REActions
- Each Service offers at least one Action and one REAction (≥ 2 components).
- An **Action** is an event the product detects; detecting it is the job of a **hook**.
- A **REAction** is a task the product performs in a service.
- The catalogue is declared by the server and exposed to clients (no hard-coded catalogue in clients).
- Connectors are valued for the real use case they enable, not for the count.

### Workflows
- A workflow is a chain of nodes walked in order once the Action fires. An AREA (one Action → one REAction) is the smallest workflow.
- Node kinds: **trigger** (the Action), **reaction** (a REAction), optional **condition** (two branches).
- Structural rules:
  - the normal chain is linear;
  - a condition has exactly two successors;
  - at most one condition, never nested;
  - branches terminate the workflow and never merge;
  - workflows without a condition, or with a single reaction, are valid;
  - the engine must demo a meaningful workflow with **≥ 4 reaction nodes**, but the data model must not cap reactions at four.
- Structural validity is checked **when the workflow is saved**.
- Unspecified points (e.g. is an empty branch valid?) are group decisions: document and apply them consistently.
- Every workflow offered must save the user real time or effort.

### Data between nodes
- Nodes reference earlier results with key paths, e.g. `{{ trigger.subject }}`, `{{ node_2.file_id }}`.
- Each node type declares the keys it may publish.
- References to undeclared keys are rejected at save time.
- Missing values at runtime are handled deterministically, following a documented model.
- Substitution replaces data only and **never evaluates user-supplied code**.

### Hooks
- Detect Actions and start workflows with no client open.
- Must not treat the same occurrence as a new event forever (deduplication).
- Event identification, scheduling and persistence are architecture decisions to document.

### Clients
- Clients do presentation and interaction; business logic lives on the server.
- **Builder** (where workflows are assembled, including data mapping) is **web only**. Its form is free but justified.
- Mobile lists workflows, enables/disables them and shows what they did. No building on mobile.
- Mobile targets Android and lets the user configure the server address. iOS is an optional bonus.
- Both clients meet **WCAG AA**, with a committed accessibility audit report (what, which tool, which screens, fixed, left unfixed and why).
- Both clients are usable in **at least two languages** on the whole main flow (registration → AREA creation).
- Full-stack frameworks mixing client and server in one codebase are strongly discouraged.

### Server API
- Server serves an **OpenAPI** description of its HTTP API plus a browsable UI.
- It is the contract between client and server developers: covers every endpoint clients call, error responses included.
- A test fails when implementation and OpenAPI description disagree.
- A machine-readable **service discovery** endpoint (`about.json`-style) exposes Services, Actions, REActions with identifiers, descriptions and parameters. Its schema is documented, versionable and consistent with what clients offer.

### Build and run
- The whole product is reproducibly buildable and runnable with **Docker Compose** (container decomposition is free).
- The stack makes the server and web client reachable locally and produces an installable Android app.
- Documentation states the commands and resulting endpoints/artifacts.

### Quantities (M = number of members)
- **S** (services available on both clients) ≥ 1 + M, at least half requiring OAuth2.
- **A + R** (Actions + REActions) ≥ 2·M + 2.
- **D** (sum of difficulty of selected additional features) ≥ 2·M.
- Counts are based on the **less complete client**. Unfinished features count for nothing. Quality over quantity.

### Documentation deliverables
- `README.md`: setup, operation, public API.
- `HOWTOCONTRIBUTE.md`: how to add Services, Actions, REActions and workflow nodes.
- Technical docs: workflow model and failure semantics; persistence model and key data structures; selected additional features and where each acceptance criterion is observable; architectural decisions with alternatives, consequences and revisions.
- Each member identifies a significant technical question at Plan and, by Final, defends one architectural decision they contributed to (need, alternatives, evidence, decision, trade-offs, observed result).

## Milestones

1. **Plan** (week 1): three technology selection documents (front-end, back-end, persistence) comparing options incl. security, backed by exploratory code; selection of additional features with learning rationale and owners; one architectural question per member; full task breakdown (actionable, scheduled, assigned, dependencies); project management method and tools.
2. **MVP** (week 4): reproducibly deployable product; end-to-end workflow with a trigger, ≥ 2 reactions and a condition; first technical docs; updated plan with analysis of changes; observable progress on ≥ 1/3 of selected catalogue points; last chance to change the feature selection. CI runs lint, tests and build on every contribution with visible failures; OpenAPI covers MVP endpoints.
3. **Final**: complete product with all selected features; up-to-date docs; accessibility audit for both clients; final planning artifacts; post-mortem; live demo and technical defense. CI runs lint, tests, build **and deploys without manual steps**. Tests prove OpenAPI matches the implementation. Keep fallback recordings for demos relying on unreliable third parties.

Decisions may change when evidence invalidates them, as long as the change, reason and consequences are documented.

## Additional features catalogue

Selection is made and justified at Plan, may be revised once at MVP, then frozen. A feature counts only if **every** acceptance criterion is observable. Any documented claim may be demonstrated live on request. Full criteria: `area-additional_features.pdf`.

| Id | Topic | Diff. | Core of the acceptance criteria |
|---|---|---|---|
| AI-EVAL | Model evaluation | 2 | ≥ 15 labelled examples with provenance, reproducible metric command, deterministic control, ≥ 2 dated measurements. Requires AI-NODE. |
| AI-GUARD | Prompt injection defense | 2 | ≥ 20 attack payloads run by one command, third-party content never an instruction, fixed PII category list, PII stripped from outbound request and restored byte for byte, blocked attempts logged. |
| AI-MULTIMODAL | Multimodal inputs | 2 | Node turns audio/image into text via key paths, deterministic impl, size/duration limits, unsupported format refused cleanly, retention stated. |
| AI-NODE | Autonomous AI node | 3 | AI node in the key path mechanism, provider abstraction (real + deterministic) switched by config, cost controls, caching, dry run, ≥ 2 use cases, declared keys checked at save. |
| AI-PROMPT | Prompt versioning | 1 | Prompts versioned outside code, version chosen by config with rollback, one command compares two versions on ≥ 10 inputs, ≥ 2 dated comparisons. |
| AI-REVIEW | Human validation | 2 | Review node suspends run (survives restart), web approves/edits/rejects, timeout to a configured terminal state, mobile lists only. |
| ENG-ADMIN | Administration area | 2 | Admin role, inspect/disable users and services, no token exposure, audited admin actions. |
| ENG-ADR | Architecture decision records | 1 | ≥ 3 dated ADRs with status (one on the workflow engine), real alternatives, consequences, superseding links. |
| ENG-ASYNC | Asynchronous execution | 3 | Execution outside the request, existing broker/queue (justified), separate worker survives stop/restart without losing work, timeouts, capacity via config. |
| ENG-EXT | Extensible connectors | 2 | Common documented node interface, startup registration, adding a node touches only that node, HOWTOCONTRIBUTE procedure run live, `about.json` auto-updated. |
| ENG-RETRY | Retries and idempotency | 2 | Bounded retries with backoff (no broker needed), idempotent side effects, dead letter store with inspect/replay, policy in config. |
| ENG-TEMPLATES | Shareable templates | 3 | Export AREA as a portable credential-free file, import and bind to own subscriptions, missing service reported by name, tampered file rejected, versioned format. |
| SEC-AUTH | Authentication hardening | 2 | Exact redirect allow list, replayed/unsolicited callback rejected, code interception mitigated, same on mobile, rate limits with 429 + retry signal, no permanent lockout, attempts logged without passwords. |
| SEC-CRYPTO | Encryption at rest | 2 | Tokens encrypted with an authenticated cipher, key outside source/repo/DB, no tokens in logs, key rotation documented, tampering detected. |
| SEC-DEPS | Dependency scanning | 1 | Automatic scanning on server + both clients, blocking severity threshold, reachable report, accepted findings justified. |
| SEC-GDPR | Personal data compliance | 2 | Data inventory, self-service export, account deletion (incl. token revocation), enforced retention of execution records, backup policy. |
| SEC-SSRF | SSRF protection | 2 | Demo before fix, private/loopback/reserved ranges blocked, DNS rebinding blocked, redirects handled, scheme allow list, blocked calls logged, timeout and size limits. |
| SEC-THREAT | Threat modeling | 3 | Threat model incl. workflow execution and outbound calls, attack chain in a recognised framework, mitigations and detections per step, chain replayed, ≥ 2 detection indicators implemented. |
| SYS-BACKUP | Backup and restore | 2 | Scheduled timestamped backups outside the DB container, one-command restore demoed after data loss, stated RPO, tokens protected in backups. |
| SYS-HEALTH | Health checks | 1 | HTTP health endpoint per dependency (DB, auth providers, hook runner), failing status on required failure, answers < 1 s, no secrets leaked. |
| SYS-K8S | Container orchestration | 3 | Versioned manifests for the whole product, runs on a cluster during defense, multiple server replicas survive a pod deletion, config/secrets from cluster objects, live diagnosis with kubectl. |
| SYS-OBS | Observability | 3 | Persisted immutable run records, metrics in a standard format, provisioned dashboard, web view of usage and most failing AREA, single store of execution records. |
| SYS-RELEASE | Release automation | 2 | Images built once per main commit and tagged by commit, tag → automated release with APK and changelog, deploy pulls images, automatic rollback on failed check, one-command redeploy, README badge. |
| SYS-SECRETS | Secrets management | 1 | Clean secret scan (or revoked history), complete `.env.example`, fresh clone runs, secrets via env/orchestrator only, no secrets in logs. |

## Security evidence (for every selected SEC feature)

Security must be demonstrated, not described. Keep a short evidence note per SEC feature:

1. **Feature**: identifier and the security claim.
2. **Attack scenario**: attacker position, asset at risk, action, impact without protection. Reproducible with no undocumented setup.
3. **Reproduction**: shortest command / request / script / test. No real credentials, tokens or personal data.
4. **Observed evidence**: response, test result, sanitised log, screenshot or trace.
5. **Protection**: mechanism and where it lives in the code.
6. **Verification**: replay against the protected product; the result must be distinguishable from a never-executed scenario.
7. **Limits**: what is not covered, assumptions, residual risks.
