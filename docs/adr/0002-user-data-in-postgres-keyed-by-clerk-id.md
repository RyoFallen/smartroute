# ADR-0002: User data in local Postgres keyed by Clerk userId (no local User table)

**Status:** accepted (2026-07-12)

## Context

The thesis spec (§5.2, drafted pre-Clerk) defines a local `User` model with
`passwordHash`, `refreshTokens`, and profile columns. The repo has since
adopted Clerk for authentication: identity (email, name, credentials,
sessions) lives in Clerk, and `Trip.userId` already stores the Clerk user id
as a plain string. Phase 3 introduces the first real user-owned data beyond
trips: interests, intensity, and wake-up time.

## Decision

There is deliberately **no local `User` table**. Clerk is the sole owner of
identity; the backend stores only the domain data it needs (e.g.
`UserProfile`, `UserInterest`), each keyed by the Clerk user id string —
the same pattern `Trip` uses. Clerk metadata
(`publicMetadata`/`unsafeMetadata`) was rejected as the profile store: it is
not queryable from SQL (Phase 6/7 interest-based ranking runs server-side),
has size limits, and would couple domain features to the auth vendor.

## Consequences

- No FK integrity across user-owned tables — the Clerk id is an opaque
  string, and rows for different features are linked only by sharing it.
- GDPR account deletion must touch both stores: `DELETE /users/me` erases
  local rows (profile, interests, trips) and then deletes the Clerk user via
  the Backend API (secret key already held by the backend).
- A user can exist in Clerk with no local rows at all — "no profile row yet"
  is a meaningful state (it drives the mobile onboarding gate), not an error.
- If Clerk is ever swapped, only the id namespace and the deletion call
  change; no password/session data exists locally to migrate.
