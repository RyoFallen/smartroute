# Mobile Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Expo mobile app's core flow: sign in with Clerk, pick 2–8 cities, fetch top-3 labeled routes from `POST /optimize`, view a route map, save a trip, and browse saved trips.

**Architecture:** React Navigation native stack with an auth-gated root. Clerk Expo SDK provides session + JWT (cached in `expo-secure-store`); a thin `fetch`-based API client attaches the token and decodes the project's error envelope. Screens are dumb; data lives in small hooks (`useOptimize`, `useTrips`) that wrap the API client. Map rendering uses `react-native-maps` with a static IATA→lat/lng table (no live geocoder — Plan 4 territory). All request/response payloads use Zod schemas from `@smartroute/shared` so the mobile and backend types never drift.

**Tech Stack:** Expo SDK 51 · React Native 0.74 · TypeScript · Clerk Expo · `@react-navigation/native` + native-stack · `react-native-maps` · `expo-secure-store` · `expo-constants` · Zod (via `@smartroute/shared`) · jest-expo for unit tests.

**Carry-overs from Plan 2:**

- CI must build `@smartroute/shared` before typecheck/test (TS project references need `dist/`). Addressed in T0.
- `/optimize` is still backed by `MockFlightProvider`; that swap is Plan 4. Mobile treats `/optimize` as a black box.

**Out of scope (deferred):** delete trip, offline cache, push notifications, polish (skeleton loaders, empty-state illustrations), real geocoding, deep linking, EAS builds.

---

## File Structure

**Create:**

- `apps/mobile/src/config.ts` — reads `API_URL` from `expo-constants`
- `apps/mobile/src/auth/tokenCache.ts` — Clerk token cache backed by `expo-secure-store`
- `apps/mobile/src/auth/ClerkProvider.tsx` — wraps app with `ClerkProvider` + `tokenCache`
- `apps/mobile/src/api/client.ts` — `apiFetch<T>(path, opts, getToken)` with error envelope decode
- `apps/mobile/src/api/optimize.ts` — `postOptimize`
- `apps/mobile/src/api/trips.ts` — `createTrip`, `listTrips`, `getTrip`
- `apps/mobile/src/data/airports.ts` — static IATA→{name, lat, lng} table (~50 entries)
- `apps/mobile/src/components/Screen.tsx` — `SafeAreaView` + padding wrapper
- `apps/mobile/src/components/CityPicker.tsx` — searchable add/remove of IATA codes
- `apps/mobile/src/components/RouteOption.tsx` — labeled card (cheapest/fastest/most_direct)
- `apps/mobile/src/components/RouteMap.tsx` — `MapView` + polyline of ordered cities
- `apps/mobile/src/hooks/useOptimize.ts`
- `apps/mobile/src/hooks/useTrips.ts`
- `apps/mobile/src/navigation/RootNavigator.tsx` — auth-gated stack
- `apps/mobile/src/screens/SignInScreen.tsx`
- `apps/mobile/src/screens/PlannerScreen.tsx`
- `apps/mobile/src/screens/ResultsScreen.tsx`
- `apps/mobile/src/screens/TripsListScreen.tsx`
- `apps/mobile/src/screens/TripDetailScreen.tsx`
- `apps/mobile/jest.config.js`
- `apps/mobile/jest.setup.ts`
- `apps/mobile/__tests__/api/client.test.ts`
- `apps/mobile/__tests__/components/CityPicker.test.tsx`
- `apps/mobile/__tests__/data/airports.test.ts`

**Modify:**

- `.github/workflows/ci.yml` — add `pnpm --filter @smartroute/shared build` step
- `apps/mobile/package.json` — new deps + `test`/`lint` scripts
- `apps/mobile/app.json` → rename to `apps/mobile/app.config.ts` for `extra.apiUrl` + `extra.clerkPublishableKey`
- `apps/mobile/App.tsx` — wire ClerkProvider + RootNavigator
- `apps/mobile/tsconfig.json` — add `types: ["jest"]`
- `README.md` — mobile setup notes

---

## Task 0: Fix CI to build @smartroute/shared

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add shared build step before typecheck**

Edit `.github/workflows/ci.yml` — insert a new step between "Apply migrations" (line 67) and "Format check":

```yaml
- name: Build shared package
  run: pnpm --filter @smartroute/shared build
```

- [ ] **Step 2: Verify CI file lints locally**

Run: `pnpm format:check`
Expected: PASS (yaml is in prettier scope)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: build shared package before typecheck/test"
```

---

## Task 1: Install mobile dependencies

**Files:**

- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Add runtime deps**

Run from repo root:

```bash
pnpm --filter @smartroute/mobile add \
  @clerk/clerk-expo@^2.2.0 \
  expo-secure-store@~13.0.2 \
  expo-constants@~16.0.2 \
  @react-navigation/native@^6.1.18 \
  @react-navigation/native-stack@^6.11.0 \
  react-native-screens@~3.31.1 \
  react-native-safe-area-context@4.10.5 \
  react-native-maps@1.14.0 \
  zod@^3.23.8
```

- [ ] **Step 2: Add dev deps**

```bash
pnpm --filter @smartroute/mobile add -D \
  jest-expo@~51.0.4 \
  jest@^29.7.0 \
  @types/jest@^29.5.12 \
  @testing-library/react-native@^12.5.3 \
  react-test-renderer@18.2.0
```

- [ ] **Step 3: Update mobile package.json scripts**

Replace the `scripts` block in `apps/mobile/package.json` with:

```json
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "typecheck": "tsc --noEmit",
  "test": "jest",
  "lint": "eslint . --max-warnings=0",
  "build": "echo 'use eas build' && exit 0"
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): add Clerk, navigation, maps, and jest deps"
```

---

## Task 2: Add Jest config and tsconfig types

**Files:**

- Create: `apps/mobile/jest.config.js`
- Create: `apps/mobile/jest.setup.ts`
- Modify: `apps/mobile/tsconfig.json`

- [ ] **Step 1: Create jest config**

```javascript
// apps/mobile/jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@clerk/.*|react-native-maps|@react-navigation/.*))',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['<rootDir>/__tests__/**/*.test.(ts|tsx)'],
};
```

- [ ] **Step 2: Create jest setup**

```typescript
// apps/mobile/jest.setup.ts
import '@testing-library/react-native/extend-expect';
```

- [ ] **Step 3: Add jest types to tsconfig**

Read the current `apps/mobile/tsconfig.json` first. Then merge `"types": ["jest", "node"]` into `compilerOptions`, and add `"__tests__/**/*"` to `include`.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @smartroute/mobile test`
Expected: `No tests found` exit 0 (or success — no tests yet).

Run: `pnpm --filter @smartroute/mobile typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/jest.config.js apps/mobile/jest.setup.ts apps/mobile/tsconfig.json
git commit -m "feat(mobile): add jest-expo config"
```

---

## Task 3: Migrate app.json → app.config.ts with extras

**Files:**

- Create: `apps/mobile/app.config.ts`
- Delete: `apps/mobile/app.json`
- Create: `apps/mobile/.env.example`

- [ ] **Step 1: Write app.config.ts**

```typescript
// apps/mobile/app.config.ts
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'SmartRoute',
  slug: 'smartroute',
  version: '0.0.1',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  splash: { resizeMode: 'contain', backgroundColor: '#ffffff' },
  ios: { supportsTablet: false, bundleIdentifier: 'com.smartroute.app' },
  android: {
    package: 'com.smartroute.app',
    adaptiveIcon: { backgroundColor: '#ffffff' },
  },
  assetBundlePatterns: ['**/*'],
  plugins: ['expo-secure-store'],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  },
};

export default config;
```

- [ ] **Step 2: Delete app.json**

```bash
rm apps/mobile/app.json
```

- [ ] **Step 3: Add .env.example**

```bash
# apps/mobile/.env.example
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @smartroute/mobile typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app.config.ts apps/mobile/.env.example
git rm apps/mobile/app.json
git commit -m "feat(mobile): switch to app.config.ts with extras"
```

---

## Task 4: Add config module reading expo-constants

**Files:**

- Create: `apps/mobile/src/config.ts`

- [ ] **Step 1: Write config**

```typescript
// apps/mobile/src/config.ts
import Constants from 'expo-constants';

type Extras = { apiUrl: string; clerkPublishableKey: string };

const extras = (Constants.expoConfig?.extra ?? {}) as Partial<Extras>;

if (!extras.apiUrl) {
  throw new Error('Missing extra.apiUrl in app.config.ts');
}
if (!extras.clerkPublishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY env var');
}

export const config = {
  apiUrl: extras.apiUrl,
  clerkPublishableKey: extras.clerkPublishableKey,
};
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @smartroute/mobile typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/config.ts
git commit -m "feat(mobile): add config module"
```

---

## Task 5: Add Clerk token cache (SecureStore)

**Files:**

- Create: `apps/mobile/src/auth/tokenCache.ts`

- [ ] **Step 1: Write tokenCache**

```typescript
// apps/mobile/src/auth/tokenCache.ts
import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/clerk-expo/dist/cache';

export const tokenCache: TokenCache = {
  async getToken(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore — Clerk will retry on next sign-in
    }
  },
};
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @smartroute/mobile typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/auth/tokenCache.ts
git commit -m "feat(mobile): add SecureStore-backed Clerk token cache"
```

---

## Task 6: API client with token attachment and error decoding

**Files:**

- Create: `apps/mobile/src/api/client.ts`
- Test: `apps/mobile/__tests__/api/client.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/mobile/__tests__/api/client.test.ts
import { apiFetch, ApiClientError } from '../../src/api/client';

const getToken = async () => 'tok_abc';

describe('apiFetch', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('attaches bearer token and parses JSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    });
    const out = await apiFetch<{ hello: string }>('/x', {}, getToken);
    expect(out).toEqual({ hello: 'world' });
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[1].headers.Authorization).toBe('Bearer tok_abc');
  });

  it('throws ApiClientError with envelope code on non-2xx', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'INVALID_INPUT', message: 'bad' } }),
    });
    await expect(apiFetch('/x', {}, getToken)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      status: 400,
    });
  });

  it('throws UNKNOWN on missing token', async () => {
    await expect(apiFetch('/x', {}, async () => null)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `pnpm --filter @smartroute/mobile test`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement client**

```typescript
// apps/mobile/src/api/client.ts
import { config } from '../config';

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export type GetToken = () => Promise<string | null>;

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  getToken: GetToken,
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new ApiClientError('UNAUTHENTICATED', 'No session token', 401);
  }
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiClientError(
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? `HTTP ${res.status}`,
      res.status,
      body.error?.details,
    );
  }
  return (await res.json()) as T;
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @smartroute/mobile test`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/api/client.ts apps/mobile/__tests__/api/client.test.ts
git commit -m "feat(mobile): add API client with token + error envelope"
```

---

## Task 7: Optimize + Trips API wrappers

**Files:**

- Create: `apps/mobile/src/api/optimize.ts`
- Create: `apps/mobile/src/api/trips.ts`

- [ ] **Step 1: Write optimize wrapper**

```typescript
// apps/mobile/src/api/optimize.ts
import type { OptimizeRequest, OptimizeResponse } from '@smartroute/shared';
import { apiFetch, type GetToken } from './client';

export function postOptimize(body: OptimizeRequest, getToken: GetToken): Promise<OptimizeResponse> {
  return apiFetch<OptimizeResponse>(
    '/optimize',
    { method: 'POST', body: JSON.stringify(body) },
    getToken,
  );
}
```

- [ ] **Step 2: Write trips wrappers**

```typescript
// apps/mobile/src/api/trips.ts
import type { Trip, CreateTripRequest } from '@smartroute/shared';
import { apiFetch, type GetToken } from './client';

export function createTrip(body: CreateTripRequest, getToken: GetToken): Promise<Trip> {
  return apiFetch<Trip>('/trips', { method: 'POST', body: JSON.stringify(body) }, getToken);
}

export function listTrips(getToken: GetToken): Promise<Trip[]> {
  return apiFetch<Trip[]>('/trips', { method: 'GET' }, getToken);
}

export function getTrip(id: string, getToken: GetToken): Promise<Trip> {
  return apiFetch<Trip>(`/trips/${id}`, { method: 'GET' }, getToken);
}
```

- [ ] **Step 3: Verify shared exports**

Run: `pnpm --filter @smartroute/mobile typecheck`
Expected: PASS. If `OptimizeRequest`/`Trip`/`CreateTripRequest` aren't exported from `@smartroute/shared`, add them to `packages/shared/src/index.ts` and re-run `pnpm --filter @smartroute/shared build`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/api/optimize.ts apps/mobile/src/api/trips.ts
git commit -m "feat(mobile): add optimize and trips API wrappers"
```

---

## Task 8: Static airport coordinates table

**Files:**

- Create: `apps/mobile/src/data/airports.ts`
- Test: `apps/mobile/__tests__/data/airports.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/mobile/__tests__/data/airports.test.ts
import { airports, findAirport, AIRPORT_CODES } from '../../src/data/airports';

describe('airports', () => {
  it('contains at least 30 entries', () => {
    expect(AIRPORT_CODES.length).toBeGreaterThanOrEqual(30);
  });

  it('has unique IATA codes', () => {
    expect(new Set(AIRPORT_CODES).size).toBe(AIRPORT_CODES.length);
  });

  it('lat/lng are valid numbers', () => {
    for (const code of AIRPORT_CODES) {
      const a = airports[code]!;
      expect(a.lat).toBeGreaterThanOrEqual(-90);
      expect(a.lat).toBeLessThanOrEqual(90);
      expect(a.lng).toBeGreaterThanOrEqual(-180);
      expect(a.lng).toBeLessThanOrEqual(180);
    }
  });

  it('findAirport returns entry for known code', () => {
    expect(findAirport('JFK')?.name).toMatch(/Kennedy/i);
  });

  it('findAirport returns undefined for unknown', () => {
    expect(findAirport('ZZZ')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement airports**

```typescript
// apps/mobile/src/data/airports.ts
export type Airport = { code: string; name: string; city: string; lat: number; lng: number };

export const airports: Record<string, Airport> = {
  JFK: { code: 'JFK', name: 'John F. Kennedy Intl', city: 'New York', lat: 40.6413, lng: -73.7781 },
  LAX: { code: 'LAX', name: 'Los Angeles Intl', city: 'Los Angeles', lat: 33.9416, lng: -118.4085 },
  ORD: { code: 'ORD', name: "O'Hare Intl", city: 'Chicago', lat: 41.9742, lng: -87.9073 },
  SFO: {
    code: 'SFO',
    name: 'San Francisco Intl',
    city: 'San Francisco',
    lat: 37.6213,
    lng: -122.379,
  },
  ATL: { code: 'ATL', name: 'Hartsfield-Jackson', city: 'Atlanta', lat: 33.6407, lng: -84.4277 },
  MIA: { code: 'MIA', name: 'Miami Intl', city: 'Miami', lat: 25.7959, lng: -80.287 },
  SEA: { code: 'SEA', name: 'Seattle-Tacoma', city: 'Seattle', lat: 47.4502, lng: -122.3088 },
  BOS: { code: 'BOS', name: 'Logan Intl', city: 'Boston', lat: 42.3656, lng: -71.0096 },
  DEN: { code: 'DEN', name: 'Denver Intl', city: 'Denver', lat: 39.8561, lng: -104.6737 },
  YYZ: { code: 'YYZ', name: 'Toronto Pearson', city: 'Toronto', lat: 43.6777, lng: -79.6248 },
  LHR: { code: 'LHR', name: 'Heathrow', city: 'London', lat: 51.47, lng: -0.4543 },
  LGW: { code: 'LGW', name: 'Gatwick', city: 'London', lat: 51.1537, lng: -0.1821 },
  CDG: { code: 'CDG', name: 'Charles de Gaulle', city: 'Paris', lat: 49.0097, lng: 2.5479 },
  ORY: { code: 'ORY', name: 'Orly', city: 'Paris', lat: 48.7233, lng: 2.3794 },
  AMS: { code: 'AMS', name: 'Schiphol', city: 'Amsterdam', lat: 52.3105, lng: 4.7683 },
  FRA: { code: 'FRA', name: 'Frankfurt', city: 'Frankfurt', lat: 50.0379, lng: 8.5622 },
  MUC: { code: 'MUC', name: 'Munich', city: 'Munich', lat: 48.3538, lng: 11.7861 },
  BER: { code: 'BER', name: 'Berlin Brandenburg', city: 'Berlin', lat: 52.3667, lng: 13.5033 },
  MAD: { code: 'MAD', name: 'Barajas', city: 'Madrid', lat: 40.4983, lng: -3.5676 },
  BCN: { code: 'BCN', name: 'El Prat', city: 'Barcelona', lat: 41.2974, lng: 2.0833 },
  FCO: { code: 'FCO', name: 'Fiumicino', city: 'Rome', lat: 41.8003, lng: 12.2389 },
  MXP: { code: 'MXP', name: 'Malpensa', city: 'Milan', lat: 45.6306, lng: 8.7281 },
  VIE: { code: 'VIE', name: 'Vienna Intl', city: 'Vienna', lat: 48.1102, lng: 16.5697 },
  ZRH: { code: 'ZRH', name: 'Zurich', city: 'Zurich', lat: 47.4647, lng: 8.5492 },
  CPH: { code: 'CPH', name: 'Copenhagen', city: 'Copenhagen', lat: 55.618, lng: 12.6508 },
  ARN: { code: 'ARN', name: 'Arlanda', city: 'Stockholm', lat: 59.6519, lng: 17.9186 },
  IST: { code: 'IST', name: 'Istanbul', city: 'Istanbul', lat: 41.2753, lng: 28.7519 },
  DXB: { code: 'DXB', name: 'Dubai Intl', city: 'Dubai', lat: 25.2532, lng: 55.3657 },
  DOH: { code: 'DOH', name: 'Hamad Intl', city: 'Doha', lat: 25.2731, lng: 51.6086 },
  SIN: { code: 'SIN', name: 'Changi', city: 'Singapore', lat: 1.3644, lng: 103.9915 },
  HND: { code: 'HND', name: 'Haneda', city: 'Tokyo', lat: 35.5494, lng: 139.7798 },
  NRT: { code: 'NRT', name: 'Narita', city: 'Tokyo', lat: 35.772, lng: 140.3929 },
  HKG: { code: 'HKG', name: 'Hong Kong Intl', city: 'Hong Kong', lat: 22.308, lng: 113.9185 },
  ICN: { code: 'ICN', name: 'Incheon', city: 'Seoul', lat: 37.4602, lng: 126.4407 },
  PEK: { code: 'PEK', name: 'Beijing Capital', city: 'Beijing', lat: 40.0801, lng: 116.5846 },
  PVG: { code: 'PVG', name: 'Pudong', city: 'Shanghai', lat: 31.1443, lng: 121.8083 },
  BKK: { code: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', lat: 13.69, lng: 100.7501 },
  SYD: { code: 'SYD', name: 'Kingsford Smith', city: 'Sydney', lat: -33.9399, lng: 151.1753 },
  GRU: {
    code: 'GRU',
    name: 'São Paulo-Guarulhos',
    city: 'São Paulo',
    lat: -23.4356,
    lng: -46.4731,
  },
  EZE: { code: 'EZE', name: 'Ezeiza', city: 'Buenos Aires', lat: -34.8222, lng: -58.5358 },
  MEX: { code: 'MEX', name: 'Mexico City', city: 'Mexico City', lat: 19.4361, lng: -99.0719 },
  YVR: { code: 'YVR', name: 'Vancouver', city: 'Vancouver', lat: 49.1939, lng: -123.1844 },
  DEL: { code: 'DEL', name: 'Indira Gandhi', city: 'Delhi', lat: 28.5562, lng: 77.1 },
  BOM: { code: 'BOM', name: 'Chhatrapati Shivaji', city: 'Mumbai', lat: 19.0896, lng: 72.8656 },
  JNB: { code: 'JNB', name: 'OR Tambo', city: 'Johannesburg', lat: -26.1392, lng: 28.246 },
  CAI: { code: 'CAI', name: 'Cairo Intl', city: 'Cairo', lat: 30.1219, lng: 31.4056 },
  LIS: { code: 'LIS', name: 'Lisbon', city: 'Lisbon', lat: 38.7813, lng: -9.1359 },
  DUB: { code: 'DUB', name: 'Dublin', city: 'Dublin', lat: 53.4213, lng: -6.2701 },
  HEL: { code: 'HEL', name: 'Helsinki-Vantaa', city: 'Helsinki', lat: 60.3172, lng: 24.9633 },
  PRG: { code: 'PRG', name: 'Václav Havel', city: 'Prague', lat: 50.1008, lng: 14.26 },
};

export const AIRPORT_CODES = Object.keys(airports).sort();

export function findAirport(code: string): Airport | undefined {
  return airports[code.toUpperCase()];
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @smartroute/mobile test`
Expected: airports tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/data/airports.ts apps/mobile/__tests__/data/airports.test.ts
git commit -m "feat(mobile): add static airport coordinate table"
```

---

## Task 9: Screen wrapper component

**Files:**

- Create: `apps/mobile/src/components/Screen.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/mobile/src/components/Screen.tsx
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ children }: { children: ReactNode }): JSX.Element {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 16 },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @smartroute/mobile typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/Screen.tsx
git commit -m "feat(mobile): add Screen wrapper"
```

---

## Task 10: CityPicker component

**Files:**

- Create: `apps/mobile/src/components/CityPicker.tsx`
- Test: `apps/mobile/__tests__/components/CityPicker.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/mobile/__tests__/components/CityPicker.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { CityPicker } from '../../src/components/CityPicker';

describe('CityPicker', () => {
  it('renders selected codes and removes one on tap', () => {
    const onChange = jest.fn();
    const { getByText } = render(<CityPicker selected={['JFK', 'CDG']} onChange={onChange} />);
    fireEvent.press(getByText('JFK ✕'));
    expect(onChange).toHaveBeenCalledWith(['CDG']);
  });

  it('adds a code on submit and uppercases it', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = render(<CityPicker selected={['JFK']} onChange={onChange} />);
    const input = getByPlaceholderText('Add airport (e.g. CDG)');
    fireEvent.changeText(input, 'cdg');
    fireEvent(input, 'submitEditing');
    expect(onChange).toHaveBeenCalledWith(['JFK', 'CDG']);
  });

  it('rejects unknown codes', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <CityPicker selected={['JFK']} onChange={onChange} />,
    );
    const input = getByPlaceholderText('Add airport (e.g. CDG)');
    fireEvent.changeText(input, 'ZZZ');
    fireEvent(input, 'submitEditing');
    expect(onChange).not.toHaveBeenCalled();
    expect(getByText(/unknown airport/i)).toBeTruthy();
  });

  it('rejects duplicates', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <CityPicker selected={['JFK']} onChange={onChange} />,
    );
    const input = getByPlaceholderText('Add airport (e.g. CDG)');
    fireEvent.changeText(input, 'JFK');
    fireEvent(input, 'submitEditing');
    expect(onChange).not.toHaveBeenCalled();
    expect(getByText(/already added/i)).toBeTruthy();
  });

  it('caps at 8 cities', () => {
    const onChange = jest.fn();
    const eight = ['JFK', 'CDG', 'FCO', 'AMS', 'MAD', 'BCN', 'LHR', 'FRA'];
    const { getByPlaceholderText, getByText } = render(
      <CityPicker selected={eight} onChange={onChange} />,
    );
    const input = getByPlaceholderText('Add airport (e.g. CDG)');
    fireEvent.changeText(input, 'MUC');
    fireEvent(input, 'submitEditing');
    expect(onChange).not.toHaveBeenCalled();
    expect(getByText(/maximum/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `pnpm --filter @smartroute/mobile test -- CityPicker`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// apps/mobile/src/components/CityPicker.tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { findAirport } from '../data/airports';

type Props = { selected: string[]; onChange: (next: string[]) => void };

export function CityPicker({ selected, onChange }: Props): JSX.Element {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(): void {
    const code = draft.trim().toUpperCase();
    if (!code) return;
    if (selected.length >= 8) {
      setError('Maximum 8 cities');
      return;
    }
    if (selected.includes(code)) {
      setError('Already added');
      return;
    }
    if (!findAirport(code)) {
      setError('Unknown airport code');
      return;
    }
    onChange([...selected, code]);
    setDraft('');
    setError(null);
  }

  function remove(code: string): void {
    onChange(selected.filter((c) => c !== code));
  }

  return (
    <View>
      <View style={styles.chips}>
        {selected.map((code) => (
          <Pressable key={code} onPress={() => remove(code)} style={styles.chip}>
            <Text style={styles.chipText}>{code} ✕</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Add airport (e.g. CDG)"
        autoCapitalize="characters"
        autoCorrect={false}
        value={draft}
        onChangeText={(t) => {
          setDraft(t);
          setError(null);
        }}
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: '#0D9488', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  chipText: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 16 },
  error: { color: '#DC2626', marginTop: 6 },
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @smartroute/mobile test -- CityPicker`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/CityPicker.tsx apps/mobile/__tests__/components/CityPicker.test.tsx
git commit -m "feat(mobile): add CityPicker component"
```

---

## Task 11: useOptimize and useTrips hooks

**Files:**

- Create: `apps/mobile/src/hooks/useOptimize.ts`
- Create: `apps/mobile/src/hooks/useTrips.ts`

- [ ] **Step 1: useOptimize**

```typescript
// apps/mobile/src/hooks/useOptimize.ts
import { useCallback, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import type { OptimizeRequest, OptimizeResponse } from '@smartroute/shared';
import { postOptimize } from '../api/optimize';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: OptimizeResponse }
  | { status: 'error'; message: string };

export function useOptimize() {
  const { getToken } = useAuth();
  const [state, setState] = useState<State>({ status: 'idle' });

  const run = useCallback(
    async (req: OptimizeRequest) => {
      setState({ status: 'loading' });
      try {
        const data = await postOptimize(req, () => getToken());
        setState({ status: 'success', data });
      } catch (e) {
        setState({ status: 'error', message: (e as Error).message });
      }
    },
    [getToken],
  );

  return { state, run };
}
```

- [ ] **Step 2: useTrips**

```typescript
// apps/mobile/src/hooks/useTrips.ts
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import type { Trip, CreateTripRequest } from '@smartroute/shared';
import { createTrip, getTrip, listTrips } from '../api/trips';

export function useTripsList() {
  const { getToken } = useAuth();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrips(await listTrips(() => getToken()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { trips, error, loading, refresh };
}

export function useTrip(id: string) {
  const { getToken } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTrip(id, () => getToken())
      .then((t) => active && setTrip(t))
      .catch((e) => active && setError((e as Error).message));
    return () => {
      active = false;
    };
  }, [id, getToken]);

  return { trip, error };
}

export function useCreateTrip() {
  const { getToken } = useAuth();
  return useCallback((body: CreateTripRequest) => createTrip(body, () => getToken()), [getToken]);
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @smartroute/mobile typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/useOptimize.ts apps/mobile/src/hooks/useTrips.ts
git commit -m "feat(mobile): add useOptimize and useTrips hooks"
```

---

## Task 12: RouteOption card component

**Files:**

- Create: `apps/mobile/src/components/RouteOption.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/mobile/src/components/RouteOption.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteOption as RouteOptionT } from '@smartroute/shared';

const labelText: Record<string, string> = {
  cheapest: 'Cheapest',
  fastest: 'Fastest',
  most_direct: 'Most direct',
};

const labelColor: Record<string, string> = {
  cheapest: '#0D9488',
  fastest: '#2563EB',
  most_direct: '#7C3AED',
};

export function RouteOption({
  option,
  onPress,
}: {
  option: RouteOptionT;
  onPress?: () => void;
}): JSX.Element {
  const totalUsd = (option.totalPriceCents / 100).toFixed(0);
  const totalH = Math.round(option.totalDurationMin / 60);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.tag, { backgroundColor: labelColor[option.label] ?? '#64748B' }]}>
        <Text style={styles.tagText}>{labelText[option.label] ?? option.label}</Text>
      </View>
      <Text style={styles.order}>{option.order.join(' → ')}</Text>
      <Text style={styles.meta}>
        ${totalUsd} · {totalH}h · {option.flights.length} legs
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  tagText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  order: { fontSize: 18, fontWeight: '600', color: '#0F172A' },
  meta: { marginTop: 6, color: '#475569' },
});
```

- [ ] **Step 2: Verify typecheck**

If `RouteOption` isn't exported from `@smartroute/shared`, add it (likely as part of `optimize.ts`) and rebuild shared.

Run: `pnpm --filter @smartroute/mobile typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/RouteOption.tsx
git commit -m "feat(mobile): add RouteOption card"
```

---

## Task 13: RouteMap component

**Files:**

- Create: `apps/mobile/src/components/RouteMap.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/mobile/src/components/RouteMap.tsx
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { findAirport } from '../data/airports';

type Props = { order: string[]; height?: number };

export function RouteMap({ order, height = 280 }: Props): JSX.Element {
  const points = order
    .map((c) => findAirport(c))
    .filter((a): a is NonNullable<ReturnType<typeof findAirport>> => Boolean(a))
    .map((a) => ({ latitude: a.lat, longitude: a.lng, code: a.code, name: a.name }));

  if (points.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Map unavailable</Text>
      </View>
    );
  }

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const region = {
    latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
    longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
    latitudeDelta: Math.max(...lats) - Math.min(...lats) + 10,
    longitudeDelta: Math.max(...lngs) - Math.min(...lngs) + 10,
  };

  return (
    <MapView style={[styles.map, { height }]} provider={PROVIDER_DEFAULT} initialRegion={region}>
      {points.map((p) => (
        <Marker
          key={p.code}
          coordinate={{ latitude: p.latitude, longitude: p.longitude }}
          title={p.code}
          description={p.name}
        />
      ))}
      <Polyline
        coordinates={points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
        strokeColor="#0D9488"
        strokeWidth={3}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: 12, overflow: 'hidden' },
  empty: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: '#64748B' },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @smartroute/mobile typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/RouteMap.tsx
git commit -m "feat(mobile): add RouteMap component"
```

---

## Task 14: SignInScreen

**Files:**

- Create: `apps/mobile/src/screens/SignInScreen.tsx`

- [ ] **Step 1: Implement (email code flow)**

```tsx
// apps/mobile/src/screens/SignInScreen.tsx
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { Screen } from '../components/Screen';

export function SignInScreen(): JSX.Element {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [error, setError] = useState<string | null>(null);

  async function sendCode(): Promise<void> {
    if (!isLoaded) return;
    setError(null);
    try {
      const attempt = await signIn.create({ identifier: email });
      const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === 'email_code');
      if (!factor) throw new Error('Email code not available for this account');
      await signIn.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: (factor as { emailAddressId: string }).emailAddressId,
      });
      setStage('code');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function verify(): Promise<void> {
    if (!isLoaded) return;
    setError(null);
    try {
      const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else {
        setError('Sign-in incomplete');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>SmartRoute</Text>
      <Text style={styles.subtitle}>Sign in to plan your trip</Text>
      {stage === 'email' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Button title="Send code" onPress={sendCode} />
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="6-digit code"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
          <Button title="Verify" onPress={verify} />
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: '700', color: '#0D9488', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#64748B', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  error: { color: '#DC2626', marginTop: 12 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/screens/SignInScreen.tsx
git commit -m "feat(mobile): add SignInScreen with Clerk email-code flow"
```

---

## Task 15: PlannerScreen

**Files:**

- Create: `apps/mobile/src/screens/PlannerScreen.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/mobile/src/screens/PlannerScreen.tsx
import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/clerk-expo';
import { Screen } from '../components/Screen';
import { CityPicker } from '../components/CityPicker';
import { useOptimize } from '../hooks/useOptimize';
import type { RootStackParamList } from '../navigation/RootNavigator';

export function PlannerScreen(): JSX.Element {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Planner'>>();
  const { signOut } = useAuth();
  const { state, run } = useOptimize();
  const [cities, setCities] = useState<string[]>(['JFK', 'CDG', 'FCO']);
  const [departDate, setDepartDate] = useState('2026-06-01');
  const [perCity, setPerCity] = useState('2');
  const [directOnly, setDirectOnly] = useState(false);

  async function submit(): Promise<void> {
    if (cities.length < 2) return;
    const days = Number(perCity) || 2;
    await run({
      cities,
      perCityDays: cities.map(() => days),
      departDate,
      travelers: 1,
      cabinClass: 'ECONOMY',
      directOnly,
    });
  }

  if (state.status === 'success') {
    nav.navigate('Results', { response: state.data, request: { cities, departDate, directOnly } });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Plan a trip</Text>
          <Button title="Sign out" onPress={() => signOut()} />
        </View>
        <Text style={styles.label}>Cities (2–8)</Text>
        <CityPicker selected={cities} onChange={setCities} />
        <Text style={styles.label}>Depart date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={departDate}
          onChangeText={setDepartDate}
          autoCapitalize="none"
        />
        <Text style={styles.label}>Days per city</Text>
        <TextInput
          style={styles.input}
          value={perCity}
          onChangeText={setPerCity}
          keyboardType="number-pad"
        />
        <View style={styles.row}>
          <Text style={styles.label}>Direct flights only</Text>
          <Switch value={directOnly} onValueChange={setDirectOnly} />
        </View>
        <View style={{ marginTop: 16 }}>
          <Button
            title={state.status === 'loading' ? 'Optimizing…' : 'Find routes'}
            onPress={submit}
            disabled={state.status === 'loading' || cities.length < 2}
          />
        </View>
        <View style={{ marginTop: 12 }}>
          <Button title="My saved trips" onPress={() => nav.navigate('TripsList')} />
        </View>
        {state.status === 'error' ? <Text style={styles.error}>{state.message}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  label: { fontSize: 14, color: '#475569', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  error: { color: '#DC2626', marginTop: 12 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/screens/PlannerScreen.tsx
git commit -m "feat(mobile): add PlannerScreen"
```

---

## Task 16: ResultsScreen with save action

**Files:**

- Create: `apps/mobile/src/screens/ResultsScreen.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/mobile/src/screens/ResultsScreen.tsx
import { useMemo, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { RouteOption } from '../components/RouteOption';
import { RouteMap } from '../components/RouteMap';
import { useCreateTrip } from '../hooks/useTrips';
import type { RootStackParamList } from '../navigation/RootNavigator';

export function ResultsScreen(): JSX.Element {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Results'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Results'>>();
  const createTrip = useCreateTrip();
  const { response, request } = route.params;
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => response.options[selectedIdx], [response, selectedIdx]);

  if (!response.options.length) {
    return (
      <Screen>
        <Text style={styles.title}>No routes found</Text>
        <Text style={styles.empty}>{response.reason ?? 'Try adjusting filters'}</Text>
        <Button title="Back" onPress={() => nav.goBack()} />
      </Screen>
    );
  }

  async function save(): Promise<void> {
    if (!selected) return;
    setSaving(true);
    try {
      const trip = await createTrip({
        name: `${request.cities.join(' → ')}`,
        startDate: request.departDate,
        endDate: request.departDate,
        cabinClass: 'ECONOMY',
        travelers: 1,
        cities: selected.order,
        flights: selected.flights,
        totalPriceCents: selected.totalPriceCents,
      });
      Alert.alert('Saved', 'Trip saved.', [
        { text: 'View', onPress: () => nav.navigate('TripDetail', { id: trip.id }) },
        { text: 'OK' },
      ]);
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.title}>Top routes</Text>
        {response.options.map((opt, i) => (
          <View key={`${opt.label}-${i}`}>
            <RouteOption option={opt} onPress={() => setSelectedIdx(i)} />
            {selectedIdx === i ? <RouteMap order={opt.order} /> : null}
          </View>
        ))}
        <View style={{ marginTop: 16 }}>
          <Button
            title={saving ? 'Saving…' : 'Save selected trip'}
            onPress={save}
            disabled={saving}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
  empty: { color: '#64748B', marginBottom: 16 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/screens/ResultsScreen.tsx
git commit -m "feat(mobile): add ResultsScreen with save action"
```

---

## Task 17: TripsListScreen and TripDetailScreen

**Files:**

- Create: `apps/mobile/src/screens/TripsListScreen.tsx`
- Create: `apps/mobile/src/screens/TripDetailScreen.tsx`

- [ ] **Step 1: TripsListScreen**

```tsx
// apps/mobile/src/screens/TripsListScreen.tsx
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { useTripsList } from '../hooks/useTrips';
import type { RootStackParamList } from '../navigation/RootNavigator';

export function TripsListScreen(): JSX.Element {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, 'TripsList'>>();
  const { trips, error, loading, refresh } = useTripsList();

  return (
    <Screen>
      <Text style={styles.title}>Saved trips</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={trips ?? []}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No saved trips yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => nav.navigate('TripDetail', { id: item.id })}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.cities.join(' → ')} · ${(item.totalPriceCents / 100).toFixed(0)}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  name: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  meta: { color: '#64748B', marginTop: 4 },
  empty: { color: '#64748B', textAlign: 'center', marginTop: 32 },
  error: { color: '#DC2626', marginBottom: 12 },
});
```

- [ ] **Step 2: TripDetailScreen**

```tsx
// apps/mobile/src/screens/TripDetailScreen.tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { RouteMap } from '../components/RouteMap';
import { useTrip } from '../hooks/useTrips';
import type { RootStackParamList } from '../navigation/RootNavigator';

export function TripDetailScreen(): JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'TripDetail'>>();
  const { trip, error } = useTrip(route.params.id);

  if (error)
    return (
      <Screen>
        <Text style={styles.error}>{error}</Text>
      </Screen>
    );
  if (!trip)
    return (
      <Screen>
        <Text style={styles.loading}>Loading…</Text>
      </Screen>
    );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.title}>{trip.name}</Text>
        <Text style={styles.meta}>
          {trip.startDate} – {trip.endDate} · {trip.travelers} traveler(s) · {trip.cabinClass}
        </Text>
        <View style={{ marginVertical: 16 }}>
          <RouteMap order={trip.cities} />
        </View>
        <Text style={styles.section}>Flights</Text>
        {trip.flights.map((f, i) => (
          <View key={i} style={styles.leg}>
            <Text style={styles.legTitle}>
              {f.origin} → {f.destination} · {f.carrier}
            </Text>
            <Text style={styles.legMeta}>
              {new Date(f.depart).toLocaleString()} → {new Date(f.arrive).toLocaleString()}
            </Text>
            <Text style={styles.legMeta}>
              ${(f.priceCents / 100).toFixed(0)} · {Math.round(f.durationMin / 60)}h · {f.stops}{' '}
              stop(s)
            </Text>
          </View>
        ))}
        <Text style={styles.total}>Total: ${(trip.totalPriceCents / 100).toFixed(0)}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  meta: { color: '#64748B', marginTop: 4 },
  section: { fontSize: 16, fontWeight: '600', color: '#0F172A', marginBottom: 8 },
  leg: { padding: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, marginBottom: 8 },
  legTitle: { fontWeight: '600', color: '#0F172A' },
  legMeta: { color: '#475569', marginTop: 2 },
  total: { fontSize: 18, fontWeight: '700', marginTop: 16, color: '#0D9488' },
  loading: { color: '#64748B' },
  error: { color: '#DC2626' },
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/TripsListScreen.tsx apps/mobile/src/screens/TripDetailScreen.tsx
git commit -m "feat(mobile): add TripsList and TripDetail screens"
```

---

## Task 18: Root navigator with auth gate

**Files:**

- Create: `apps/mobile/src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/mobile/src/navigation/RootNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/clerk-expo';
import { ActivityIndicator, View } from 'react-native';
import type { OptimizeResponse } from '@smartroute/shared';
import { SignInScreen } from '../screens/SignInScreen';
import { PlannerScreen } from '../screens/PlannerScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { TripsListScreen } from '../screens/TripsListScreen';
import { TripDetailScreen } from '../screens/TripDetailScreen';

export type RootStackParamList = {
  SignIn: undefined;
  Planner: undefined;
  Results: {
    response: OptimizeResponse;
    request: { cities: string[]; departDate: string; directOnly: boolean };
  };
  TripsList: undefined;
  TripDetail: { id: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): JSX.Element {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {isSignedIn ? (
          <>
            <Stack.Screen
              name="Planner"
              component={PlannerScreen}
              options={{ title: 'SmartRoute' }}
            />
            <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Routes' }} />
            <Stack.Screen
              name="TripsList"
              component={TripsListScreen}
              options={{ title: 'My Trips' }}
            />
            <Stack.Screen
              name="TripDetail"
              component={TripDetailScreen}
              options={{ title: 'Trip' }}
            />
          </>
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @smartroute/mobile typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/navigation/RootNavigator.tsx
git commit -m "feat(mobile): add auth-gated root navigator"
```

---

## Task 19: Wire ClerkProvider in App.tsx

**Files:**

- Modify: `apps/mobile/App.tsx`

- [ ] **Step 1: Replace App.tsx**

```tsx
// apps/mobile/App.tsx
import { ClerkProvider } from '@clerk/clerk-expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { config } from './src/config';
import { tokenCache } from './src/auth/tokenCache';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App(): JSX.Element {
  return (
    <ClerkProvider publishableKey={config.clerkPublishableKey} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @smartroute/mobile typecheck`
Expected: PASS

Run: `pnpm --filter @smartroute/mobile test`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): wire ClerkProvider, SafeAreaProvider, and navigator"
```

---

## Task 20: Update README with mobile setup

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Append mobile section**

Add this section to `README.md` after the existing "Backend endpoints" section:

````markdown
## Mobile setup

```bash
cd apps/mobile
cp .env.example .env
# Edit .env: set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (from your Clerk dashboard)
# EXPO_PUBLIC_API_URL defaults to http://localhost:3000 (use your LAN IP for physical devices)
pnpm --filter @smartroute/mobile start
```
````

Sign in with email + 6-digit code (Clerk). The planner accepts 2–8 IATA airport codes from a built-in list of ~50 popular airports (real geocoding lands in Plan 4).

````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add mobile setup instructions"
````

---

## Task 21: Final verification

- [ ] **Step 1: Lint, format, typecheck, test across the workspace**

Run from repo root:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all green. Backend test count unchanged (30 passing); mobile reports CityPicker (5) + airports (5) + apiFetch (3) = 13 passing.

- [ ] **Step 2: Smoke test**

In one shell: `pnpm --filter @smartroute/backend dev`
In another: `pnpm --filter @smartroute/mobile start`
Expected: backend up on :3000, Expo dev server starts, app launches in simulator/device, sign-in screen renders. (Full sign-in needs a real Clerk dev key — document this in the task summary if not configured.)

- [ ] **Step 3: Final commit if any cleanup needed**

```bash
git status
# only commit if there are formatting/lint fixes to apply
```
