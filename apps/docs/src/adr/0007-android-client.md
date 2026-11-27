---
status: proposed
date: 2026-11-27
decision-makers: AREA team (4 members)
supersedes: —
superseded-by: —
---

# ADR-0007: Android client technology

> **Decision:** the Android app is **native Kotlin with Jetpack Compose**, built with Gradle and generated from the server's OpenAPI description.
> **Why:** the mobile scope is small (list, toggle, history), and native Compose gives the best accessibility, the simplest APK build and no shared-runtime risk. Code sharing with the web client has little value here.

## Context

Mobile is deliberately limited by the subject: it **lists workflows, enables or disables them, and shows what they did**. There is **no building on mobile** (the Builder is web only). The MVP scope ([mvp.md](../mvp.md)) is:

- configure the server address;
- log in (local or Google);
- list workflows and toggle them;
- see recent runs and their status.

Requirements from the subject that weigh on the choice:

- **Android** is mandatory; iOS is an optional bonus.
- **WCAG AA** on both clients, with a committed audit report.
- **Two languages** (French, English) on the whole main flow.
- **Installable APK** produced by the Docker Compose build (`apk-builder` container).
- **OIDC and OAuth 2.0** on mobile, with the same hardening as web if SEC-AUTH is selected (exact redirect allow list, code interception mitigated).
- Business logic stays on the server; the client only does presentation.
- The API client comes from the OpenAPI description ([ADR-0002](0002-backend-framework.md)). No language is shared with the back end either way.

## Decision drivers

1. **Accessibility**: WCAG AA reachable with first-class tooling (TalkBack, automated checks).
2. **Reproducible APK build**: one command in CI and in Docker, no extra toolchain to maintain.
3. **Auth on mobile**: system-browser OIDC with PKCE is supported by a maintained library.
4. **Team effort**: the app is small, so setup cost matters more than long-term reuse.
5. **Fit with the scope**: no need for a rich cross-platform UI; iOS is only a bonus.

## Evidence

> ⚠️ **Gap:** no mobile spike is recorded yet. The subject requires selection documents "backed by exploratory code". Before this ADR moves to `accepted`, the PoC in [Confirmation](#confirmation) must be done and its results added here.

## Options compared

|                              | **Kotlin + Compose** | Kotlin + XML Views | Flutter       | React Native  | PWA / Capacitor (reuse Vue) |
| :--------------------------- | :------------------- | :----------------- | :------------ | :------------ | :-------------------------- |
| 1. Accessibility             | 🟢 **Native, TalkBack** | 🟢 Native          | 🟡 Own semantics tree | 🟡 Bridge to native | 🟡 Web a11y in a WebView |
| 2. APK build                 | 🟢 **Gradle only**   | 🟢 Gradle only     | 🟡 Flutter SDK + Gradle | 🟡 Node + Gradle | 🟡 Node + Gradle          |
| 3. Mobile OIDC (PKCE)        | 🟢 **AppAuth**       | 🟢 AppAuth         | 🟡 Plugin     | 🟡 Plugin     | 🔴 WebView limits, custom handling |
| 4. Team effort               | 🟡 **New language (Kotlin)** | 🟡 Kotlin, more boilerplate | 🔴 New language (Dart) | 🟢 TypeScript | 🟢 Reuses Vue              |
| 5. Fit with the scope        | 🟢 **Yes**           | 🟡 Legacy style    | 🟡 Overkill   | 🟡 Overkill   | 🔴 Weak for "Android app"   |
| iOS bonus later              | 🔴 No                | 🔴 No              | 🟢 Yes        | 🟢 Yes        | 🟢 Yes                      |

- **Kotlin + Jetpack Compose**: Google's current UI toolkit. Accessibility semantics, `stringResource` i18n (`res/values-fr`), Material 3, ViewModel and Navigation are all official. OpenAPI client generation exists for Kotlin. The only cost is Kotlin, which is new to part of the team.
- **Kotlin + XML Views**: same platform, older and more verbose. No reason to pick it for a new app.
- **Flutter**: good cross-platform story, but adds the Dart language and the Flutter SDK to CI and to the APK container, and draws its own widgets, so accessibility is mediated by Flutter's semantics layer. The benefit (iOS) is optional.
- **React Native**: TypeScript is familiar, but the shared language does not give shared code: the API client is generated and the UI is separate. It adds Metro, Node and Gradle to the build.
- **PWA / Capacitor**: would reuse the Vue app, but the subject asks for an **Android mobile client** that is installable and configurable. The Builder-free scope is small, yet a WebView wrapper makes the secure OIDC redirect harder and the web a11y audit would cover both clients as one, which hides mobile-specific issues. Rejected.

## Decision

### Stack

| Layer          | Choice                                          | Why                                                    |
| -------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Language       | Kotlin                                          | Android's first-class language                         |
| UI             | Jetpack Compose + Material 3                    | Official, accessibility semantics built in             |
| Architecture   | Single activity, ViewModel + `StateFlow`        | Presentation only; no business logic                   |
| Navigation     | Navigation Compose                              | Official                                               |
| API client     | Generated from the OpenAPI description          | No hand-written request types, drift caught at build   |
| HTTP           | OkHttp (through the generated client)           | Standard, supports configurable base URL              |
| Auth (OIDC)    | AppAuth for Android (system browser, PKCE)      | No credentials in a WebView, code interception mitigated |
| Token storage  | Encrypted storage (Android Keystore backed)     | Session token never in plain preferences               |
| i18n           | Android string resources (`en`, `fr`)           | Official; lint rejects hard-coded strings              |
| Build          | Gradle, run in the `apk-builder` container      | One command, reproducible APK                          |
| Min SDK        | To be fixed in the PoC                          | Balance device coverage and library support            |

### Rules

| Topic          | Rule                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Business logic | None on the client. Workflow validity and run status come from the server.                                |
| Server address | User-configurable at first launch and in settings; cleartext HTTP allowed only for a user-set local address in debug builds. |
| Catalogue      | Workflows are displayed from API data; no service or node type is hard-coded.                             |
| Text           | Every visible string is an Android resource, in `en` and `fr`. Android lint fails on hard-coded text.      |
| Accessibility  | Content descriptions, 48 dp touch targets, contrast checked, Accessibility Scanner and TalkBack on the main flow. |
| No Builder     | Mobile has no editing screen for workflows, nodes or mappings.                                             |

## Consequences

**Good**

- Best accessibility tooling and the least abstraction between code and what TalkBack reads.
- The APK is built by Gradle alone, simple to run in CI and in Docker Compose.
- Secure OIDC with PKCE through the system browser, using a maintained library.
- Small app, so a single native codebase stays easy to review.

**Bad**

- Kotlin and Compose are a learning cost for members who did not use them.
- No code sharing with the web client or the back end; the API contract is the only link.
- **iOS would be a full rewrite** (or a move to Kotlin Multiplatform). Accepted because iOS is only a bonus.
- Android toolchain (SDK, Gradle caches) makes the `apk-builder` image large and the first CI build slow.

## Confirmation

The decision holds only if all of these pass in a PoC. Otherwise, revisit (Flutter is the first alternative if iOS becomes a goal).

- [ ] **Build**: `docker compose` produces an installable APK from a fresh clone, with no manual step.
- [ ] **Server address**: the app reaches a server whose address is entered at runtime.
- [ ] **OIDC**: Google login through the system browser with PKCE; a replayed callback is refused.
- [ ] **Core flow**: list workflows, toggle one, see recent runs; data comes from the generated client.
- [ ] **Contracts**: change a field in the OpenAPI description; the Android build fails.
- [ ] **i18n**: switch the device language between French and English; no untranslated string.
- [ ] **Accessibility**: Accessibility Scanner reports no blocking issue and the main flow is usable with TalkBack.

## Related

- [ADR-0002: Back-end framework](0002-backend-framework.md), [ADR-0003: Web front-end framework](0003-frontend-framework.md).
- [MVP scope](../mvp.md): Android section.
- Requirements: [CLAUDE.md](https://github.com/Matt4401/area/blob/main/CLAUDE.md).
