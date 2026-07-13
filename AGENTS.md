# SmartRoute — Agent Context

Thesis project (deadline: **early December 2026**). Multi-city trip optimizer: backend finds the cheapest city visiting order with real flight prices; mobile app plans per-city itineraries. Solo developer (RyoFallen); trunk-based development on `main`.

## Authoritative documents

- Product/tech spec: `docs/superpowers/specs/2026-07-06-smartroute-traveler-thesis-spec.md` (v2.0 — read the repo-alignment note at the top: where spec and code disagree, code wins)
- Executed & pending plans: `docs/superpowers/plans/`
- Thesis evaluation: competitor benchmark vs Kiwi Nomad / Skyscanner / Google Flights (spec §2.5, §11.5)

## Stack & layout

- `mobile/` — **Kotlin + Compose Multiplatform** app (Gradle build, NOT in the pnpm workspace). Replaces the legacy Expo app.
- `apps/backend/` — Node 22 + **Fastify** + Prisma + Postgres 16, Clerk auth, Duffel flight provider (mock provider in CI/by default)
- `apps/mobile/` — legacy Expo app; keep working until KMP reaches feature parity, then retire. Don't invest in it.
- `packages/shared/` — zod schemas/types (backend-side only)

## Current state (2026-07-13)

- Backend: Plans 1–6 shipped (optimize, trips CRUD, Duffel, must-go attractions endpoint `GET /trips/:id/plan`)
- Mobile KMP: **Phase 2 complete** — Clerk email-code auth driven via the Frontend API in commonMain (no native Clerk SDKs; see plan's Design Decisions), Ktor `ApiClient` with bearer auto-refresh, `TokenStore` (Keychain/SharedPreferences via multiplatform-settings), sign-in screen + auth gating in `App.kt`. Plan: `docs/superpowers/plans/2026-07-12-kmp-phase2-auth-ktor.md`
- Auth verified end-to-end on the Android emulator against the live Clerk dev instance (2026-07-12): email-code sign-in, client-JWT rotation, session JWT accepted by the backend. Clerk keys: publishable in `AppConfig.kt` (committed), secret in gitignored `apps/backend/.env`
- iOS (2026-07-12): `iosApp` Xcode wrapper shipped (`mobile/iosApp/`, XcodeGen `project.yml` + committed `.xcodeproj`) with MapLibre iOS 6.27.0 via SPM, injected through `MapViewBridge` (ADR-0001 — MapLibre stays out of the Kotlin build). Verified end-to-end on the iOS 26.5 simulator: sign-in via Clerk email code and MapLibre map rendering after auth.
- **Phase 3 implemented (2026-07-13, issues #1–#10):** backend `GET/PUT /users/me`, `PUT /users/me/interests` (full replace), GDPR `DELETE /users/me` (local wipe then Clerk deletion), `UserProfile`/`Interest` Prisma models per ADR-0002; shared `InterestCategory` vocabulary (15 slugs, zod + Kotlin mirror, slug-stability tests pin both) and `ATTRACTION_TO_INTEREST_CATEGORY` map; mobile 4-tab scaffold (navigation-compose, type-safe routes), onboarding gate (`profile: null` → swipe deck) + swipe deck with haptics, Profile hub (email, Interests editor, Preferences, Language, sign out, delete account), EN/TR localization via Compose resources with in-app switch (`LocalAppLocale` + `key()` pattern; language stored device-locally). Manual emulator/simulator verification (swipe feel, haptics, back handling, EN/TR rendering, live Clerk delete) still pending — see open issue checklists.
- **Next:** Phase 3 manual verification, then Phase 4 (route optimization)

## Machine division of labor

- **Windows:** Android only. Kotlin/Native Apple targets DO NOT compile — never run `:composeApp:linkDebugFrameworkIos*` locally; the `Mobile CI` macOS job is the iOS compile check. Set `JAVA_HOME` explicitly in shells if not inherited.
- **macOS:** can do both targets. iOS wrapper work happens here.
- Android SDK discovery: `ANDROID_HOME` env var or `mobile/local.properties` (`sdk.dir=...`, gitignored).

## Commands

Backend (repo root): `pnpm install`, `docker compose up -d`, `pnpm --filter @smartroute/backend dev`, `pnpm lint` / `pnpm format:check` / `pnpm typecheck` / `pnpm test`

Mobile (from `mobile/`):

```
./gradlew :composeApp:assembleDebug          # Android APK
./gradlew :composeApp:testDebugUnitTest      # shared unit tests
./gradlew ktlintCheck                        # lint
./gradlew :composeApp:installDebug           # install on emulator/device
```

iOS (macOS only, from `mobile/iosApp/`): `xcodebuild -project iosApp.xcodeproj -scheme iosApp -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build` — the "Compile Kotlin Framework" phase runs Gradle itself. After editing `project.yml`, regenerate with `xcodegen generate`.

## Hard rules

- Commit messages: conventional commits (`feat(mobile):`, `fix:`, `docs:`, `ci:`). **No tooling attribution, no co-author trailers, no generation notes** — author is RyoFallen only.
- `docs/**/*.md` must be Prettier-formatted or backend CI fails (`pnpm format:check`).
- Don't modify `.github/workflows/ci.yml` (backend) for mobile concerns; mobile CI is `mobile-ci.yml` (path-filtered).
- Prices in shared code are minor units (`Long`); format via `formatPrice` in `commonMain/domain/Formatters.kt`.

## Non-obvious config (learned the hard way — don't "fix" these)

- `mobile/build.gradle.kts`: ktlint engine is pinned to **1.5.0** — required for the `.editorconfig` `ktlint_function_naming_ignore_when_annotated_with = Composable` exemption to work. Generated Compose resources are excluded via a **predicate** filter (`contains("/build/generated/")`); glob excludes silently fail for registered generated source roots.
- `iosMain/MainViewController.kt`: the entry point must stay PascalCase `MainViewController()` (Swift calls `MainViewControllerKt.MainViewController()`); it carries a ktlint `@Suppress` on purpose.
- Map: MapLibre (`demotiles` style, no token) was chosen for the spike; Mapbox swap is an open styling decision (spec §8.3). `RouteMap` is `expect`/`actual`; evolve it toward a state-holder parameter when adding polylines/markers, don't accrete positional params.
- CI: `gradle/actions/setup-gradle@v4` validates the committed Gradle wrapper JAR. `mobile/gradlew` must keep its executable bit (`100755`).
- Duffel test mode returns only the synthetic "Duffel Airways" carrier; currency mapper prefers USD, falls back to cheapest — a real FX layer is a known follow-up.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `RyoFallen/smartroute`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary — the five canonical role names used as-is (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
