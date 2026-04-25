# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working pnpm monorepo with a Fastify backend exposing `/health`, an Expo mobile app that boots, a local Postgres via Docker, Prisma migrations applied, lint + typecheck + tests passing, and a green GitHub Actions CI.

**Architecture:** Plain pnpm workspaces (no Turborepo). Three packages: `apps/backend`, `apps/mobile`, `packages/shared`. Postgres 16 in Docker for local dev. Vitest for backend tests. ESLint flat config + Prettier at the root.

**Tech Stack:** Node 22, pnpm, TypeScript 5, Fastify 4, Prisma 5, Postgres 16, Expo SDK (latest), Vitest, ESLint 9 (flat), Prettier 3, GitHub Actions.

---

## File Structure

```
smartroute/
├── .github/workflows/ci.yml
├── .gitignore
├── .editorconfig
├── .nvmrc
├── .prettierrc.json
├── .prettierignore
├── eslint.config.mjs
├── tsconfig.base.json
├── docker-compose.yml
├── .env.example
├── package.json                 # root, scripts only
├── pnpm-workspace.yaml
├── README.md
├── apps/
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── server.ts        # Fastify factory (exported for tests)
│   │   │   ├── index.ts         # boot entrypoint
│   │   │   └── routes/
│   │   │       └── health.route.ts
│   │   └── tests/
│   │       └── health.test.ts
│   └── mobile/
│       ├── package.json
│       ├── tsconfig.json
│       ├── app.json
│       ├── App.tsx
│       └── babel.config.js
└── packages/
    └── shared/
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts          # placeholder export
```

**File responsibilities:**
- `apps/backend/src/server.ts` — exports a `buildServer()` factory so tests can `inject()` requests without binding a port. No top-level side-effects.
- `apps/backend/src/index.ts` — calls `buildServer()` and `.listen()`. Single entrypoint for runtime, never imported by tests.
- `apps/backend/src/routes/*.ts` — each route in its own file, registered in `server.ts`. Keeps `server.ts` short.
- `packages/shared/src/index.ts` — for V1 just exports a `version` constant. Real Zod schemas land in Plan 2.

---

## Prerequisites Check

Before starting, verify:
- Node 22+ installed (`node --version`)
- pnpm installed (`pnpm --version` — if missing: `npm i -g pnpm`)
- Docker running (`docker --version` and `docker info`)
- Git available (`git --version`)
- You're in `C:\repos\smartroute` and `git status` shows the existing spec commit

---

## Task 1: Root package.json + pnpm workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.nvmrc`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create `.nvmrc`**

```
22
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "smartroute",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "build": "pnpm -r build"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "eslint": "^9.13.0",
    "globals": "^15.11.0",
    "prettier": "^3.3.3",
    "typescript": "^5.6.3",
    "typescript-eslint": "^8.11.0"
  }
}
```

- [ ] **Step 4: Install root dev dependencies**

Run: `pnpm install`
Expected: pnpm creates `pnpm-lock.yaml`, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml .nvmrc pnpm-lock.yaml
git commit -m "chore: initialize pnpm monorepo root"
```

---

## Task 2: .gitignore + .editorconfig

**Files:**
- Create: `.gitignore`
- Create: `.editorconfig`

- [ ] **Step 1: Create `.gitignore`**

```
# deps
node_modules/
.pnpm-store/

# build output
dist/
build/
.expo/
.expo-shared/
*.tsbuildinfo

# env
.env
.env.local
.env.*.local
!.env.example

# logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# editor
.vscode/
.idea/
*.swp
.DS_Store

# coverage
coverage/

# Prisma
apps/backend/prisma/migrations/dev.db*
```

- [ ] **Step 2: Create `.editorconfig`**

```
root = true

[*]
end_of_line = lf
insert_final_newline = true
charset = utf-8
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore .editorconfig
git commit -m "chore: add gitignore and editorconfig"
```

---

## Task 3: Prettier config

**Files:**
- Create: `.prettierrc.json`
- Create: `.prettierignore`

- [ ] **Step 1: Create `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 2: Create `.prettierignore`**

```
node_modules
dist
build
.expo
coverage
pnpm-lock.yaml
apps/backend/prisma/migrations
```

- [ ] **Step 3: Run format check on existing files**

Run: `pnpm format:check`
Expected: Either passes or prints files needing formatting. If any, run `pnpm format`.

- [ ] **Step 4: Commit**

```bash
git add .prettierrc.json .prettierignore
git commit -m "chore: add prettier config"
```

---

## Task 4: ESLint flat config

**Files:**
- Create: `eslint.config.mjs`

- [ ] **Step 1: Create `eslint.config.mjs`**

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/build/**', '**/.expo/**', '**/coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
);
```

- [ ] **Step 2: Install `@eslint/js` (peer of typescript-eslint config helper)**

Run: `pnpm add -Dw @eslint/js`
Expected: installed at root.

- [ ] **Step 3: Run lint to check config works**

Run: `pnpm lint`
Expected: No errors (no source files yet).

- [ ] **Step 4: Commit**

```bash
git add eslint.config.mjs package.json pnpm-lock.yaml
git commit -m "chore: add eslint flat config"
```

---

## Task 5: Root TypeScript base config

**Files:**
- Create: `tsconfig.base.json`

- [ ] **Step 1: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.base.json
git commit -m "chore: add shared TypeScript base config"
```

---

## Task 6: packages/shared scaffold

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@smartroute/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "echo 'no tests yet' && exit 0",
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/shared/src/index.ts`**

```typescript
export const SHARED_VERSION = '0.0.0';
```

- [ ] **Step 4: Install workspace and verify typecheck**

Run: `pnpm install`
Run: `pnpm --filter @smartroute/shared typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ pnpm-lock.yaml
git commit -m "feat(shared): scaffold @smartroute/shared package"
```

---

## Task 7: Backend scaffold with /health route (TDD)

**Files:**
- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/backend/vitest.config.ts`
- Create: `apps/backend/src/server.ts`
- Create: `apps/backend/src/index.ts`
- Create: `apps/backend/src/routes/health.route.ts`
- Create: `apps/backend/tests/health.test.ts`

- [ ] **Step 1: Create `apps/backend/package.json`**

```json
{
  "name": "@smartroute/backend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@smartroute/shared": "workspace:*",
    "fastify": "^4.28.1"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "tsx": "^4.19.1",
    "typescript": "^5.6.3",
    "vitest": "^2.1.3"
  }
}
```

- [ ] **Step 2: Create `apps/backend/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `apps/backend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
});
```

- [ ] **Step 4: Install backend deps**

Run: `pnpm install`
Expected: workspace dep `@smartroute/shared` resolves; no errors.

- [ ] **Step 5: Write failing test**

Create `apps/backend/tests/health.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { buildServer } from '../src/server.js';

describe('GET /health', () => {
  let server: Awaited<ReturnType<typeof buildServer>>;

  afterEach(async () => {
    if (server) await server.close();
  });

  it('returns 200 with status ok', async () => {
    server = await buildServer();
    const res = await server.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @smartroute/backend test`
Expected: FAIL — module `../src/server.js` not found.

- [ ] **Step 7: Implement health route**

Create `apps/backend/src/routes/health.route.ts`:

```typescript
import type { FastifyInstance } from 'fastify';

export async function healthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok' }));
}
```

- [ ] **Step 8: Implement server factory**

Create `apps/backend/src/server.ts`:

```typescript
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { healthRoute } from './routes/health.route.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(healthRoute);
  return app;
}
```

- [ ] **Step 9: Implement boot entrypoint**

Create `apps/backend/src/index.ts`:

```typescript
import { buildServer } from './server.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = await buildServer();
try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `pnpm --filter @smartroute/backend test`
Expected: PASS — `GET /health returns 200 with status ok`.

- [ ] **Step 11: Run typecheck**

Run: `pnpm --filter @smartroute/backend typecheck`
Expected: No errors.

- [ ] **Step 12: Smoke-test the dev server**

Run: `pnpm --filter @smartroute/backend dev`
In another shell: `curl http://localhost:3000/health`
Expected: `{"status":"ok"}`. Stop the dev server (Ctrl+C).

- [ ] **Step 13: Commit**

```bash
git add apps/backend/ pnpm-lock.yaml
git commit -m "feat(backend): scaffold Fastify server with /health route"
```

---

## Task 8: Docker Compose for Postgres + .env

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: smartroute-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: smartroute
      POSTGRES_PASSWORD: smartroute_dev
      POSTGRES_DB: smartroute
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U smartroute -d smartroute"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
```

- [ ] **Step 2: Create `.env.example`**

```
# Backend
DATABASE_URL=postgresql://smartroute:smartroute_dev@localhost:5432/smartroute?schema=public
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Clerk (filled in Plan 2)
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=

# Flight provider (filled in Plan 4)
FLIGHT_PROVIDER=mock
FLIGHT_API_KEY=
```

- [ ] **Step 3: Create local `.env` (not committed)**

Run: `cp .env.example .env`
(On Windows PowerShell: `Copy-Item .env.example .env`)

- [ ] **Step 4: Start Postgres and wait for healthy**

Run: `docker compose up -d`
Run: `docker compose ps`
Expected: `smartroute-postgres` shows `healthy` within ~10 seconds.

- [ ] **Step 5: Verify connection**

Run: `docker exec -it smartroute-postgres psql -U smartroute -d smartroute -c "SELECT version();"`
Expected: prints PostgreSQL version 16.x.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore: add Docker Compose for local Postgres 16"
```

---

## Task 9: Prisma init + initial schema (TDD via migrate)

**Files:**
- Create: `apps/backend/prisma/schema.prisma`
- Modify: `apps/backend/package.json` (add prisma dep + scripts)

- [ ] **Step 1: Add Prisma to backend**

Run: `pnpm --filter @smartroute/backend add prisma @prisma/client`
Run: `pnpm --filter @smartroute/backend add -D prisma`
Expected: `prisma` and `@prisma/client` in `apps/backend/package.json`.

- [ ] **Step 2: Add prisma scripts to `apps/backend/package.json`**

Edit the `scripts` block in `apps/backend/package.json` to add:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:reset": "prisma migrate reset --force"
  }
}
```

- [ ] **Step 3: Create `apps/backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Trip {
  id          String   @id @default(cuid())
  userId      String
  name        String
  startDate   DateTime
  endDate     DateTime
  cabinClass  String
  travelers   Int
  cities      String[]
  flights     Json
  totalPrice  Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, createdAt])
}

model FlightPriceCache {
  id          String   @id @default(cuid())
  origin      String
  destination String
  departDate  DateTime @db.Date
  cabinClass  String
  priceCents  Int
  durationMin Int
  stops       Int
  carrier     String?
  fetchedAt   DateTime @default(now())

  @@unique([origin, destination, departDate, cabinClass])
  @@index([fetchedAt])
}

model City {
  iata     String  @id
  name     String
  country  String
  lat      Float
  lon      Float
  timezone String
}
```

- [ ] **Step 4: Run initial migration**

Ensure Postgres is running (`docker compose ps`).

Run: `pnpm --filter @smartroute/backend exec prisma migrate dev --name init`
Expected: prisma creates `apps/backend/prisma/migrations/<timestamp>_init/migration.sql` and applies it. Output ends with "Your database is now in sync with your schema."

- [ ] **Step 5: Verify tables exist**

Run: `docker exec -it smartroute-postgres psql -U smartroute -d smartroute -c "\dt"`
Expected: lists `Trip`, `FlightPriceCache`, `City`, plus Prisma's `_prisma_migrations`.

- [ ] **Step 6: Generate Prisma client**

Run: `pnpm --filter @smartroute/backend db:generate`
Expected: Prisma client regenerated successfully.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/prisma/ apps/backend/package.json pnpm-lock.yaml
git commit -m "feat(backend): add Prisma schema with Trip, FlightPriceCache, City"
```

---

## Task 10: Mobile app scaffold (Expo TypeScript)

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/App.tsx`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/index.ts`

- [ ] **Step 1: Create `apps/mobile/package.json`**

```json
{
  "name": "@smartroute/mobile",
  "version": "0.0.0",
  "private": true,
  "main": "index.ts",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit",
    "test": "echo 'no tests yet' && exit 0",
    "build": "echo 'use eas build' && exit 0"
  },
  "dependencies": {
    "@smartroute/shared": "workspace:*",
    "expo": "~51.0.39",
    "expo-status-bar": "~1.12.1",
    "react": "18.2.0",
    "react-native": "0.74.5"
  },
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "@types/react": "~18.2.79",
    "typescript": "^5.6.3"
  }
}
```

> Note: Pin to Expo SDK 51 here for compatibility with current Expo Go (as of 2026-04-25). If a newer SDK is current when you run this plan, run `pnpm --filter @smartroute/mobile exec npx expo install expo@latest` after install and adjust other Expo-managed deps with `npx expo install --fix`.

- [ ] **Step 2: Create `apps/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "jsx": "react-native"
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", ".expo", "dist", "build"]
}
```

- [ ] **Step 3: Create `apps/mobile/app.json`**

```json
{
  "expo": {
    "name": "SmartRoute",
    "slug": "smartroute",
    "version": "0.0.1",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": { "supportsTablet": false, "bundleIdentifier": "com.smartroute.app" },
    "android": { "package": "com.smartroute.app", "adaptiveIcon": { "backgroundColor": "#ffffff" } },
    "assetBundlePatterns": ["**/*"]
  }
}
```

> If `assets/icon.png` doesn't exist yet, remove the `icon` and `splash` lines for now — Expo will use defaults. We'll add real assets in Plan 3.

- [ ] **Step 4: Create `apps/mobile/babel.config.js`**

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

- [ ] **Step 5: Create `apps/mobile/index.ts`**

```typescript
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```

- [ ] **Step 6: Create `apps/mobile/App.tsx`**

```tsx
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SHARED_VERSION } from '@smartroute/shared';

export default function App(): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SmartRoute</Text>
      <Text style={styles.subtitle}>shared v{SHARED_VERSION}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '600', color: '#0D9488' },
  subtitle: { marginTop: 8, fontSize: 14, color: '#64748B' },
});
```

- [ ] **Step 7: Install mobile deps**

Run: `pnpm install`
Expected: workspace builds. Expo and RN install successfully.

- [ ] **Step 8: Typecheck mobile**

Run: `pnpm --filter @smartroute/mobile typecheck`
Expected: No errors. (If `JSX.Element` is unresolved, check that `@types/react` installed.)

- [ ] **Step 9: Smoke-boot Expo (manual)**

Run: `pnpm --filter @smartroute/mobile start`
Expected: Expo dev server starts and prints a QR code. Open Expo Go on your phone (or press `w` for web preview) to verify the app shows "SmartRoute" + the shared version. Stop with `Ctrl+C`.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/ pnpm-lock.yaml
git commit -m "feat(mobile): scaffold Expo app importing @smartroute/shared"
```

---

## Task 11: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: smartroute
          POSTGRES_PASSWORD: smartroute_dev
          POSTGRES_DB: smartroute
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U smartroute -d smartroute"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10

    env:
      DATABASE_URL: postgresql://smartroute:smartroute_dev@localhost:5432/smartroute?schema=public

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.12.0
          run_install: false

      - name: Get pnpm store directory
        id: pnpm-cache
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT

      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: ${{ runner.os }}-pnpm-

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm --filter @smartroute/backend db:generate

      - name: Apply migrations
        run: pnpm --filter @smartroute/backend exec prisma migrate deploy

      - name: Format check
        run: pnpm format:check

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test
```

- [ ] **Step 2: Commit (we'll only see green CI when pushed to GitHub later)**

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflow with lint, typecheck, test"
```

- [ ] **Step 3: Locally simulate the CI sequence to confirm it'll pass**

Run each in order, expect all to pass:

```bash
pnpm install --frozen-lockfile
pnpm --filter @smartroute/backend db:generate
pnpm --filter @smartroute/backend exec prisma migrate deploy
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

Expected: every step exits 0. If any fails, fix and re-run before considering this task done.

---

## Task 12: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
# SmartRoute

Mobile app that finds the cheapest order to visit multiple cities, with a route map and saved trips.

## Stack

- **Mobile:** React Native + Expo + TypeScript
- **Backend:** Node 22 + Fastify + Prisma + Postgres 16
- **Auth:** Clerk (added in Plan 2)
- **Hosting (later):** Fly.io + Neon

## Repo layout

```
apps/
  backend/   # Fastify API
  mobile/    # Expo app
packages/
  shared/    # Zod schemas + types
docs/
  superpowers/specs/   # design specs
  superpowers/plans/   # implementation plans
```

## Prerequisites

- Node 22+
- pnpm 9
- Docker (for local Postgres)

## Getting started

```bash
pnpm install
cp .env.example .env
docker compose up -d                # start Postgres
pnpm --filter @smartroute/backend db:migrate
pnpm --filter @smartroute/backend dev   # backend on :3000
pnpm --filter @smartroute/mobile start  # Expo dev server
```

## Scripts

- `pnpm lint` — ESLint
- `pnpm format` / `pnpm format:check` — Prettier
- `pnpm typecheck` — TS across all packages
- `pnpm test` — Vitest across all packages

## Specs and plans

See `docs/superpowers/`.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Acceptance — Foundation Done

Before declaring this plan complete, verify all of:

- [ ] `pnpm install --frozen-lockfile` succeeds.
- [ ] `pnpm format:check` passes.
- [ ] `pnpm lint` passes (zero errors).
- [ ] `pnpm typecheck` passes across all 3 workspaces.
- [ ] `pnpm test` runs Vitest and passes (1 test: `/health`).
- [ ] `docker compose up -d` brings Postgres healthy.
- [ ] `pnpm --filter @smartroute/backend exec prisma migrate deploy` is idempotent on a fresh DB.
- [ ] `pnpm --filter @smartroute/backend dev` serves `GET /health` returning `{"status":"ok"}`.
- [ ] `pnpm --filter @smartroute/mobile start` boots Expo and the app loads in Expo Go (or web).
- [ ] `git log --oneline` shows ~12 clean commits, one per task.

When all green: this plan is done. Next: Plan 2 (Backend Core).
