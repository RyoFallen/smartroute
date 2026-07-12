# KMP Phase 2: Auth + Ktor Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sign in to the KMP app with the same Clerk email-code (OTP) flow the legacy Expo app uses, persist the session securely, and call the existing Fastify backend through a shared Ktor client with automatic bearer-token refresh.

**Architecture:** All auth + networking logic lives in `commonMain` — Clerk is driven directly through its **Frontend API (FAPI)** with Ktor, not through the native Clerk SDKs. Rationale: one code path for both platforms, no dependency on the not-yet-created `iosApp` Xcode wrapper, fully testable with Ktor `MockEngine`, and it mirrors exactly what `@clerk/clerk-expo` does under the hood (the legacy app's flow in `apps/mobile/src/screens/SignInScreen.tsx` is the behavioural reference). Token storage goes through `multiplatform-settings` behind a small `TokenStore` interface (Keychain on iOS, `SharedPreferences` on Android). UI is a two-stage sign-in screen (email → code) gated in `App.kt`, with state in a `ViewModel` + `StateFlow` per spec §1.3.

**Tech Stack (additions):** Ktor Client 3.0.3 (core, content-negotiation, auth, logging; OkHttp engine on Android, Darwin on iOS; mock for tests), kotlinx-serialization 1.7.3 (plugin version = Kotlin 2.1.0), kotlinx-coroutines-test 1.9.0, multiplatform-settings 1.2.0, JetBrains `lifecycle-viewmodel-compose` 2.8.4.

## Global Constraints

- **Host OS is macOS** — both Android and iOS targets compile locally. Verify with `:composeApp:testDebugUnitTest`, `ktlintCheck`, and `:composeApp:linkDebugFrameworkIosSimulatorArm64`.
- Spec: `docs/superpowers/specs/2026-07-06-smartroute-traveler-thesis-spec.md` §13 Phase 2, **reinterpreted for Clerk** per the repo-alignment note: no custom register/login/refresh/password-reset endpoints are built — Clerk provides them. The backend already verifies Clerk bearer tokens (`apps/backend/src/plugins/auth.ts`); it is NOT modified in this plan.
- Deliverables kept from spec Phase 2: sign-in screen (mobile), token storage with multiplatform-settings, auto-refresh via Ktor Auth plugin (`bearer` + `refreshTokens`). Registration happens through Clerk's hosted/dev instance for thesis scope (same as the Expo app, which only ships a SignInScreen).
- **Commit messages must never mention Claude, AI, or code generation.** Author is RyoFallen only. Conventional commits (`feat(mobile):` etc.).
- `docs/**/*.md` must be Prettier-formatted (`pnpm format:check`).
- ktlint must stay green; remember the pinned engine 1.5.0 and Composable naming exemption (don't touch `mobile/build.gradle.kts` ktlint config).
- The Expo app `apps/mobile` stays untouched (retirement happens after Phase 2–3 parity, not now).
- Prices/shared-code conventions unaffected; no changes to `packages/shared`.

## Design Decisions (record, they deviate from or refine the spec)

1. **Clerk FAPI over native SDKs.** FAPI endpoints used (all `application/x-www-form-urlencoded` requests, JSON responses wrapped in `{ response, client }`):
   - `POST {fapi}/v1/client/sign_ins` — body `identifier=<email>`
   - `POST {fapi}/v1/client/sign_ins/{id}/prepare_first_factor` — body `strategy=email_code&email_address_id=<id>`
   - `POST {fapi}/v1/client/sign_ins/{id}/attempt_first_factor` — body `strategy=email_code&code=<otp>`
   - `POST {fapi}/v1/client/sessions/{sessionId}/tokens` — returns `{ jwt }`, the short-lived (~60 s) session JWT the backend verifies
   - `POST {fapi}/v1/client/sessions/{sessionId}/remove` — sign-out
   - Native-app conventions: append `_is_native=1` to every call; persist the **client JWT** returned in the `Authorization` response header and send it as the `Authorization` request header on subsequent FAPI calls. These conventions come from Clerk's own native SDKs; they are isolated in `ClerkAuthClient` so any real-instance mismatch is a one-file fix (see Residual Risks).
2. **FAPI base URL is derived from the publishable key** (`pk_test_<base64>` → decode → `clerk.xxx.yyy$` → strip `$` → `https://clerk.xxx.yyy`). Implemented in `ClerkKeys.kt`, unit-tested.
3. **Android token storage is plain `SharedPreferences`** (`MODE_PRIVATE`), not `EncryptedSharedPreferences`: `androidx.security:security-crypto` was deprecated in 2025 with no 1:1 replacement; app-private storage is the Google-recommended baseline now. iOS uses Keychain (`KeychainSettings`). The `TokenStore` interface hides both, so hardening later is a one-file change per platform.
4. **Publishable key + API base URL live in `AppConfig.kt` (committed).** Clerk publishable keys are public by design; the dev key placeholder is filled in by Burak. API base URL is `expect/actual`: `http://10.0.2.2:3000` on the Android emulator, `http://localhost:3000` on the iOS simulator.
5. **Manual DI** (a single `AppGraph` object) — no Koin/kotlin-inject for thesis scope; revisit if the object graph grows past ~10 entries in Phase 3+.
6. **Auth session persistence:** `clientJwt` + `sessionId` in `TokenStore`. App start with both present = optimistically signed in; a 401 that survives one token refresh signs the user out.

---

### Task 1: Gradle dependencies + serialization plugin

**Files:** `mobile/gradle/libs.versions.toml`, `mobile/composeApp/build.gradle.kts`

- [ ] **Step 1:** Add to `[versions]`: `ktor = "3.0.3"`, `kotlinxSerialization = "1.7.3"`, `kotlinxCoroutines = "1.9.0"`, `multiplatformSettings = "1.2.0"`, `lifecycleViewmodelCompose = "2.8.4"`. Add corresponding `[libraries]` entries: ktor-client-core / -content-negotiation / -auth / -logging / -okhttp / -darwin / -mock, ktor-serialization-kotlinx-json, kotlinx-serialization-json, kotlinx-coroutines-test, multiplatform-settings, multiplatform-settings-test, jetbrains-lifecycle-viewmodel-compose. Add `[plugins]` entry `kotlinSerialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }`.
- [ ] **Step 2:** Wire into `composeApp/build.gradle.kts`: apply serialization plugin; commonMain += ktor core/content-negotiation/auth/logging/serialization-json + kotlinx-serialization-json + multiplatform-settings + viewmodel-compose; commonTest += ktor-client-mock + kotlinx-coroutines-test + multiplatform-settings-test; androidMain += ktor-client-okhttp; iosMain += ktor-client-darwin.
- [ ] **Step 3:** `./gradlew :composeApp:assembleDebug` compiles (dependency resolution proof).

### Task 2: TokenStore (expect/actual storage)

**Files:** `commonMain/.../data/storage/TokenStore.kt`, `commonMain/.../data/storage/Settings.kt` (expect), `androidMain/.../data/storage/Settings.android.kt`, `iosMain/.../data/storage/Settings.ios.kt`, `androidMain/.../AppContext.kt`, `commonTest/.../data/storage/TokenStoreTest.kt`

- [ ] **Step 1:** `expect fun createSettings(): Settings`; Android actual = `SharedPreferencesSettings` over `AppContext.get().getSharedPreferences("smartroute_auth", MODE_PRIVATE)` (a tiny holder initialized from `MainActivity`); iOS actual = `KeychainSettings(service = "com.smartroute.traveler")`.
- [ ] **Step 2:** `TokenStore` class over `Settings`: `clientJwt`, `sessionId` (nullable String properties), `clear()`.
- [ ] **Step 3:** commonTest with `MapSettings` covering round-trip + clear.

### Task 3: Clerk auth client (FAPI)

**Files:** `commonMain/.../data/auth/ClerkKeys.kt`, `ClerkDto.kt`, `ClerkAuthClient.kt`; `commonTest/.../data/auth/ClerkKeysTest.kt`, `ClerkAuthClientTest.kt`

- [ ] **Step 1:** `ClerkKeys.frontendApiUrl(publishableKey)` with base64 decode (kotlin.io.encoding); unit tests for pk_test/pk_live and malformed keys.
- [ ] **Step 2:** DTOs (`@Serializable`, `ignoreUnknownKeys = true`): sign-in envelope (`id`, `status`, `supported_first_factors[].{strategy, email_address_id}`, `created_session_id`), FAPI error envelope (`errors[].{code, message, long_message}`), token response (`jwt`).
- [ ] **Step 3:** `ClerkAuthClient(httpClient, fapiUrl, tokenStore)` with suspend functions: `startEmailCodeSignIn(email)` (create + prepare, returns sign-in id), `attemptCode(signInId, code)` (on `status == "complete"` persists `sessionId`), `fetchSessionJwt()`, `signOut()`. Every response's `Authorization` header (if present) is persisted as the new client JWT; every request sends the stored one + `_is_native=1`. FAPI error envelope maps to `ClerkAuthException(code, message)`.
- [ ] **Step 4:** commonTest with `MockEngine`: happy path email→code→session, error envelope mapping, client-JWT capture/replay, `needs_first_factor`/missing email_code factor handling.

### Task 4: Backend API client

**Files:** `commonMain/.../data/api/ApiClient.kt`, `ApiError.kt`, `commonMain/.../config/AppConfig.kt` (+ expect/actual `platformApiBaseUrl`), `commonTest/.../data/api/ApiClientTest.kt`

- [ ] **Step 1:** `AppConfig`: `clerkPublishableKey` (placeholder const, Burak fills in), `apiBaseUrl` via expect/actual (`10.0.2.2` / `localhost`).
- [ ] **Step 2:** `createApiClient(engine, authClient)`: ContentNegotiation(json, ignoreUnknownKeys), `Auth` plugin `bearer { loadTokens { authClient.cachedOrFetchSessionJwt() }; refreshTokens { authClient.fetchSessionJwt() }; sendWithoutRequest { true } }`, `expectSuccess = false` + response validator mapping the backend's `{ error: { code, message, details } }` envelope to `ApiError(code, message, status)` — behavioural parity with `apps/mobile/src/api/client.ts`.
- [ ] **Step 3:** First real endpoint binding to prove the stack: `getTrips()` against `GET /trips` (list shape from `packages/shared` trip schema; only the fields the UI needs).
- [ ] **Step 4:** commonTest with `MockEngine`: bearer header attached, 401 triggers `refreshTokens` + retry, error envelope mapping.

### Task 5: Sign-in UI + auth gating

**Files:** `commonMain/.../ui/auth/AuthViewModel.kt`, `SignInScreen.kt`, `commonMain/.../AppGraph.kt`, modified `App.kt`, `androidMain/.../MainActivity.kt` (AppContext init)

- [ ] **Step 1:** `AuthViewModel(authClient, tokenStore)` exposing `StateFlow<AuthUiState>` — states: `SignedOut(emailStage | codeStage, error?, busy)`, `SignedIn`. Intents: `sendCode(email)`, `verify(code)`, `signOut()`.
- [ ] **Step 2:** `SignInScreen` (Material3, mirrors Expo screen: title, subtitle, email field → "Send code", code field → "Verify", error text).
- [ ] **Step 3:** `App.kt`: `SignedIn` → existing map screen + sign-out affordance; else `SignInScreen`. `AppGraph` wires Ktor engine per platform default, `ClerkAuthClient`, `ApiClient`, `TokenStore`.
- [ ] **Step 4:** ViewModel unit tests (coroutines-test): state transitions incl. error and busy flags.

### Task 6: Verification + docs + commit

- [ ] **Step 1:** `./gradlew :composeApp:testDebugUnitTest ktlintCheck :composeApp:assembleDebug :composeApp:linkDebugFrameworkIosSimulatorArm64` — all green locally.
- [ ] **Step 2:** `pnpm format:check` (this plan file), fix with `pnpm format` if needed.
- [ ] **Step 3:** Update `AGENTS.md` Current state (Phase 2 shipped) — keep it short.
- [ ] **Step 4:** Conventional commits, e.g. `feat(mobile): clerk email-code auth + ktor client with bearer refresh`.

---

## Residual Risks / Deferred (record, don't solve now)

- **FAPI native-app conventions unverified against a live instance.** `_is_native=1` + Authorization-header client JWT is how Clerk's native SDKs operate, but the exact envelope/edge cases must be verified with Burak's dev-instance publishable key (not in the repo yet). All FAPI specifics are quarantined in `ClerkAuthClient.kt`/`ClerkDto.kt`; tests use MockEngine so CI stays green regardless.
- **No registration screen** — thesis scope signs up users via Clerk dashboard/hosted pages, same as the Expo app today. Revisit in Phase 3 if user testing needs self-serve sign-up.
- **Android storage hardening** (EncryptedSharedPreferences successor or Tink) — deferred; `TokenStore` isolates it.
- **`iosApp` Xcode wrapper** still pending (separate task from AGENTS.md); auth code compiles for iOS via framework link, on-device iOS validation blocked until the wrapper exists.
- **Session token caching** is refresh-on-401 (Ktor bearer plugin semantics) — an occasional duplicate request after the ~60 s JWT expiry. Proactive expiry-based refresh is a micro-optimization for later.
