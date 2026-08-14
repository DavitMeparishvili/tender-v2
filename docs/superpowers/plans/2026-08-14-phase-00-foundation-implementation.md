# Phase 0 Engineering Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a reproducible Next.js/PostgreSQL foundation whose architecture and test harness can support every marketplace phase without importing business rules into UI or transport code.

**Architecture:** The application is one deployable Next.js process organized by vertical modules. Shared domain primitives have no framework dependencies; Prisma is isolated in infrastructure adapters. Docker Compose runs separate standard PostgreSQL 17 development and test services, so integration and concurrency behavior match production PostgreSQL rather than an in-process substitute. Unit, PostgreSQL integration, and Playwright suites are separate and independently runnable.

**Tech Stack:** Node.js 24 LTS, pnpm, Next.js 16 App Router, React 19, strict TypeScript, Docker Desktop with Docker Compose, PostgreSQL 17, Prisma ORM 7 GA with `pg` adapter, Zod, Vitest, Playwright, ESLint, Prettier, and GitHub Actions.

## Global Constraints

- Do not copy code, CSS, components, or assets from `C:\Users\mefar\repos\tender-marketplace`.
- Use `/ka` and `/en` locale prefixes; Georgian is the default locale.
- All environment access goes through one validated configuration module.
- Domain modules may not import `next`, `react`, Prisma Client, or provider SDKs.
- External ports accept injected clocks and IDs for deterministic tests.
- Docker Compose service `postgres-dev` owns persistent database `tender_dev`; service `postgres-test` owns disposable database `tender_test`.
- Prisma ORM is the query/migration layer, not the database host. Do not require a Prisma Postgres or other managed-database account in Phase 0.
- PostgreSQL integration tests must use a dedicated `DATABASE_URL_TEST` database.
- The phase is complete only when `pnpm verify:phase-0` passes from a clean install.

---

## Planned file structure

```text
app/
  api/health/live/route.ts       process liveness only
  api/health/ready/route.ts      database readiness
  [locale]/layout.tsx            locale document shell
  [locale]/page.tsx              neutral phase-0 landing shell
  error.tsx                      unexpected-error recovery
  global-error.tsx               root recovery
  not-found.tsx                  localized-safe not-found fallback
src/
  config/env.ts                  validated server/client environment
  generated/prisma/              generated client; gitignored
  infrastructure/db/client.ts    only shared Prisma client construction
  modules/shared/domain/         Result, Money, Clock, ID contracts
  modules/shared/testing/        fakes used by module tests
  modules/shared/index.ts        public shared-module exports
  test/integration/setup.ts      test DB guard and cleanup hooks
  test/e2e/phase-00.spec.ts      browser acceptance
prisma/
  schema.prisma                  database contract
  migrations/                    committed migrations
prisma.config.ts                 Prisma 7 config
compose.yaml                     local PostgreSQL 17 dev/test topology
vitest.config.ts                 unit project
vitest.integration.config.ts     PostgreSQL project
playwright.config.ts             desktop/mobile browser projects
.github/workflows/verify.yml     CI pipeline with PostgreSQL service
```

### Task 1: Initialize the pinned toolchain

**Files:**
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`
- Create: `app/layout.tsx`

**Interfaces:**
- Consumes: none.
- Produces: scripts `dev`, `build`, `typecheck`, `lint`, `format:check`, and a strict `@/* -> ./*` alias.

- [ ] **Step 1: Initialize version control and record the runtime**

Run:

```powershell
git init
corepack enable
corepack prepare pnpm@latest --activate
```

Create `.nvmrc` with exactly:

```text
24
```

Expected: `git status --short` lists `.nvmrc`; `node --version` reports a supported Node 24 release before dependencies are installed.

- [ ] **Step 2: Scaffold Next.js into the existing directory**

The workspace is already non-empty, so scaffold into an explicit sibling directory and copy only generated application files. Resolve the sibling path first and stop if it already exists.

Run:

```powershell
$scaffoldPath = Join-Path (Split-Path (Resolve-Path '.').Path -Parent) 'tender-v2-scaffold'
if (Test-Path -LiteralPath $scaffoldPath) { throw "Scaffold target already exists: $scaffoldPath" }
pnpm dlx create-next-app@16.1.0 $scaffoldPath --ts --eslint --tailwind --app --use-pnpm --import-alias '@/*' --yes
Copy-Item -LiteralPath (Join-Path $scaffoldPath 'app') -Destination '.\app' -Recurse
Copy-Item -LiteralPath (Join-Path $scaffoldPath 'public') -Destination '.\public' -Recurse
Copy-Item -LiteralPath (Join-Path $scaffoldPath 'package.json') -Destination '.\package.json'
Copy-Item -LiteralPath (Join-Path $scaffoldPath 'pnpm-lock.yaml') -Destination '.\pnpm-lock.yaml'
Copy-Item -LiteralPath (Join-Path $scaffoldPath 'tsconfig.json') -Destination '.\tsconfig.json'
Copy-Item -LiteralPath (Join-Path $scaffoldPath 'next.config.ts') -Destination '.\next.config.ts'
Copy-Item -LiteralPath (Join-Path $scaffoldPath 'eslint.config.mjs') -Destination '.\eslint.config.mjs'
Copy-Item -LiteralPath (Join-Path $scaffoldPath 'postcss.config.mjs') -Destination '.\postcss.config.mjs'
pnpm add --save-exact zod
pnpm add --save-dev --save-exact prettier vitest @vitest/coverage-v8 @playwright/test
pnpm exec playwright install chromium
```

Expected: the command preserves `Product_description.md`, `Specs.md`, `PRODUCT.md`, and `docs/`; `package.json` pins resolved versions and `pnpm-lock.yaml` exists.

- [ ] **Step 3: Strengthen TypeScript and scripts**

Set `compilerOptions` in `tsconfig.json` to include:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "forceConsistentCasingInFileNames": true,
  "paths": { "@/*": ["./*"] }
}
```

Set scripts in `package.json`:

```json
{
  "typecheck": "tsc --noEmit",
  "lint": "eslint . --max-warnings=0",
  "format:check": "prettier --check .",
  "test:unit": "vitest run",
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:e2e": "playwright test",
  "verify:phase-0": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm build && pnpm test:e2e"
}
```

- [ ] **Step 4: Verify the scaffold**

Run: `pnpm lint; pnpm typecheck; pnpm build`

Expected: all three commands exit 0.

After verification, remove only the validated sibling scaffold directory:

```powershell
$repoPath = (Resolve-Path '.').Path
$expectedParent = Split-Path $repoPath -Parent
$resolvedScaffold = (Resolve-Path (Join-Path $expectedParent 'tender-v2-scaffold')).Path
if ((Split-Path $resolvedScaffold -Parent) -ne $expectedParent -or (Split-Path $resolvedScaffold -Leaf) -ne 'tender-v2-scaffold') {
  throw "Refusing to remove unexpected scaffold path: $resolvedScaffold"
}
Remove-Item -LiteralPath $resolvedScaffold -Recurse
```

- [ ] **Step 5: Commit**

```powershell
git add .gitignore .nvmrc package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json next.config.ts eslint.config.mjs .prettierrc.json postcss.config.mjs app
git commit -m "chore: initialize marketplace application"
```

### Task 2: Validate configuration and expose health contracts

**Files:**
- Create: `.env.example`
- Create: `.env.test.example`
- Create: `src/config/env.ts`
- Create: `src/config/env.test.ts`
- Create: `app/api/health/live/route.ts`
- Create: `app/api/health/ready/route.ts`

**Interfaces:**
- Consumes: Zod.
- Produces: `getServerEnv(input?: NodeJS.ProcessEnv): ServerEnv`, `GET /api/health/live`, and `GET /api/health/ready`.

- [ ] **Step 1: Write failing environment tests**

Create `src/config/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getServerEnv } from "./env";

describe("getServerEnv", () => {
  it("rejects a missing database URL", () => {
    expect(() => getServerEnv({ NODE_ENV: "test" })).toThrow(/DATABASE_URL/);
  });

  it("accepts explicit test configuration", () => {
    const env = getServerEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://tender_local:tender_local_only@localhost:5432/tender_dev",
      DATABASE_URL_TEST: "postgresql://tender_test:tender_test_local_only@localhost:5433/tender_test",
      AUTH_SECRET: "01234567890123456789012345678901",
      APP_URL: "http://localhost:3000",
    });
    expect(env.NODE_ENV).toBe("test");
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm vitest run src/config/env.test.ts`

Expected: FAIL because `./env` does not exist.

- [ ] **Step 3: Implement the configuration contract**

Create `src/config/env.ts`:

```ts
import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(input: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(input);
}
```

Populate examples with the Docker-local URLs used above and comments that these accounts are technical local-only PostgreSQL logins. Production credentials must not be committed, and application clients/providers/admins never receive either connection string.

- [ ] **Step 4: Add liveness and readiness handlers**

`live` returns `{ "status": "ok" }` without external calls. `ready` calls the database interface introduced in Task 3; temporarily make its test expect `503` until Task 3 connects it.

- [ ] **Step 5: Run unit tests**

Run: `pnpm vitest run src/config/env.test.ts`

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add .env.example .env.test.example src/config app/api/health
git commit -m "feat: validate environment and define health endpoints"
```

### Task 3: Isolate Prisma and prove PostgreSQL migrations

**Files:**
- Create: `compose.yaml`
- Create: `prisma/schema.prisma`
- Create: `prisma.config.ts`
- Create: `src/infrastructure/db/client.ts`
- Create: `src/infrastructure/db/readiness.ts`
- Create: `src/test/integration/setup.ts`
- Create: `src/infrastructure/db/readiness.integration.test.ts`
- Create: `scripts/run-prisma-test.mjs`
- Modify: `app/api/health/ready/route.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Docker Desktop/Compose and `getServerEnv()`.
- Produces: `database`, `checkDatabaseReadiness(): Promise<{ ok: true } | { ok: false; reason: string }>`.

- [ ] **Step 1: Define and start isolated PostgreSQL services**

Create `compose.yaml` exactly as the starting topology:

```yaml
services:
  postgres-dev:
    image: postgres:17
    environment:
      POSTGRES_DB: tender_dev
      POSTGRES_USER: tender_local
      POSTGRES_PASSWORD: tender_local_only
    ports:
      - "5432:5432"
    volumes:
      - tender_dev_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tender_local -d tender_dev"]
      interval: 2s
      timeout: 3s
      retries: 20

  postgres-test:
    image: postgres:17
    environment:
      POSTGRES_DB: tender_test
      POSTGRES_USER: tender_test
      POSTGRES_PASSWORD: tender_test_local_only
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tender_test -d tender_test"]
      interval: 2s
      timeout: 3s
      retries: 20

volumes:
  tender_dev_data:
```

Add package scripts:

```json
{
  "db:up": "docker compose up -d --wait",
  "db:down": "docker compose down",
  "db:logs": "docker compose logs --tail=100 postgres-dev postgres-test"
}
```

Run:

```powershell
docker compose config
pnpm db:up
docker compose ps
```

Expected: `postgres-dev` and `postgres-test` report healthy. `pnpm db:down` may remove containers but preserves the named development volume; never add `--volumes` to the normal shutdown script.

- [ ] **Step 2: Install database dependencies**

Run:

```powershell
pnpm add --save-exact @prisma/client @prisma/adapter-pg dotenv pg
pnpm add --save-dev --save-exact prisma @types/pg tsx
```

- [ ] **Step 3: Write the failing readiness integration test**

```ts
import { expect, it } from "vitest";
import { checkDatabaseReadiness } from "./readiness";

it("round-trips a PostgreSQL readiness query", async () => {
  await expect(checkDatabaseReadiness()).resolves.toEqual({ ok: true });
});
```

Run: `pnpm test:integration -- readiness.integration.test.ts`

Expected: FAIL because the database adapter is absent.

- [ ] **Step 4: Define Prisma 7 configuration**

Create a schema with the Prisma client output under `src/generated/prisma`, PostgreSQL datasource, and two shared models:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model AuditEvent {
  id            String   @id
  actorId       String?
  action        String
  targetType    String
  targetId      String
  reason        String?
  correlationId String
  metadata      Json
  createdAt     DateTime @default(now())

  @@index([targetType, targetId, createdAt])
  @@index([actorId, createdAt])
}

model OutboxMessage {
  id          String   @id
  topic       String
  aggregateId String
  payload     Json
  availableAt DateTime
  processedAt DateTime?
  attempts    Int      @default(0)
  createdAt   DateTime @default(now())

  @@index([processedAt, availableAt])
}
```

Configure Prisma 7 without relying on implicit `.env` loading:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
```

Create `scripts/run-prisma-test.mjs` to require `DATABASE_URL_TEST`, parse it as a URL, refuse any database name not ending `_test`, then spawn `pnpm exec prisma migrate deploy` with `DATABASE_URL` set to the validated test URL. Add exact scripts:

```json
{
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:migrate:test": "node scripts/run-prisma-test.mjs"
}
```

- [ ] **Step 5: Generate and migrate the development and test databases**

Run:

```powershell
pnpm db:generate
pnpm prisma migrate dev --name foundation
pnpm db:migrate:test
```

Expected: both databases have `_prisma_migrations`, `AuditEvent`, and `OutboxMessage`.

- [ ] **Step 6: Implement the adapter and readiness query**

Construct Prisma with `PrismaPg` in `src/infrastructure/db/client.ts`. In `readiness.ts`, run `SELECT 1` through `$queryRaw`, return `{ ok: true }`, and map exceptions to `{ ok: false, reason: "database_unavailable" }` without leaking connection details.

- [ ] **Step 7: Guard integration tests against the wrong database**

In `src/test/integration/setup.ts`, require `DATABASE_URL_TEST`, parse its database pathname, and throw unless the name ends in `_test`. Override `DATABASE_URL` with that validated URL before importing Prisma.

- [ ] **Step 8: Run migration and readiness tests**

Run: `pnpm db:migrate:test; pnpm test:integration -- readiness.integration.test.ts`

Expected: migration is current and the readiness test PASSes.

- [ ] **Step 9: Commit**

```powershell
git add compose.yaml prisma prisma.config.ts scripts/run-prisma-test.mjs package.json pnpm-lock.yaml src/infrastructure src/test app/api/health/ready
git commit -m "feat: establish PostgreSQL persistence boundary"
```

### Task 4: Create framework-free domain primitives

**Files:**
- Create: `src/modules/shared/domain/result.ts`
- Create: `src/modules/shared/domain/money.ts`
- Create: `src/modules/shared/domain/clock.ts`
- Create: `src/modules/shared/domain/id-generator.ts`
- Create: `src/modules/shared/domain/money.test.ts`
- Create: `src/modules/shared/testing/fake-clock.ts`
- Create: `src/modules/shared/testing/fixed-id-generator.ts`
- Create: `src/modules/shared/index.ts`

**Interfaces:**
- Consumes: no framework or persistence dependency.
- Produces: `Result<T, E>`, `Money`, `Clock`, `IdGenerator`, `FakeClock`, and `FixedIdGenerator`.

- [ ] **Step 1: Write money invariant tests**

```ts
import { describe, expect, it } from "vitest";
import { Money } from "./money";

describe("Money", () => {
  it("stores integer minor units", () => {
    expect(Money.create(1250, "GEL")).toEqual({ minor: 1250, currency: "GEL" });
  });

  it("rejects fractional and negative minor units", () => {
    expect(() => Money.create(1.5, "USD")).toThrow(/integer/);
    expect(() => Money.create(-1, "USD")).toThrow(/non-negative/);
  });

  it("rejects unsupported currency", () => {
    expect(() => Money.create(100, "EUR" as "GEL")).toThrow(/currency/);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run src/modules/shared/domain/money.test.ts`

Expected: FAIL because `Money` is absent.

- [ ] **Step 3: Implement the shared contracts**

Use these exact public signatures:

```ts
export type Currency = "GEL" | "USD";
export type Money = Readonly<{ minor: number; currency: Currency }>;
export const Money: { create(minor: number, currency: Currency): Money };

export interface Clock { now(): Date }
export interface IdGenerator { next(): string }

export type Result<T, E extends string> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

`Money.create` must use `Number.isSafeInteger`, require a non-negative value, and accept only `GEL`/`USD`.

- [ ] **Step 4: Verify dependency purity**

Run:

```powershell
rg -n 'from "(next|react|@prisma|pg)' src\modules\shared\domain
pnpm vitest run src/modules/shared
```

Expected: `rg` returns no matches; all shared tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/shared
git commit -m "feat: add deterministic domain primitives"
```

### Task 5: Separate unit, integration, and browser test projects

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.integration.config.ts`
- Create: `playwright.config.ts`
- Create: `src/test/e2e/phase-00.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: health endpoints and locale routes.
- Produces: stable `test:unit`, `test:integration`, and `test:e2e` commands.

- [ ] **Step 1: Configure test inclusion boundaries**

Unit config includes `src/**/*.test.ts` and excludes `*.integration.test.ts`. Integration config includes only `src/**/*.integration.test.ts`, uses Node environment, loads `src/test/integration/setup.ts`, disables file parallelism initially, and sets a 30-second timeout.

- [ ] **Step 2: Write Phase 0 browser acceptance**

```ts
import { expect, test } from "@playwright/test";

for (const locale of ["ka", "en"] as const) {
  test(`${locale} shell and health are reachable`, async ({ page, request }) => {
    await page.goto(`/${locale}`);
    await expect(page.getByRole("main")).toBeVisible();
    const live = await request.get("/api/health/live");
    expect(await live.json()).toEqual({ status: "ok" });
    const ready = await request.get("/api/health/ready");
    expect(ready.status()).toBe(200);
  });
}
```

- [ ] **Step 3: Configure Playwright projects**

Create `desktop-chromium` at 1440×900 and `mobile-chromium` using the Pixel 7 device. Configure `webServer.command` as `pnpm dev` locally and the CI start command after build.

- [ ] **Step 4: Run all three layers**

Run: `pnpm test:unit; pnpm test:integration; pnpm build; pnpm test:e2e`

Expected: every command exits 0 and each suite reports only its intended files.

- [ ] **Step 5: Commit**

```powershell
git add vitest.config.ts vitest.integration.config.ts playwright.config.ts src/test/e2e package.json
git commit -m "test: establish layered verification harness"
```

### Task 6: Add the locale-aware accessible application shell

**Files:**
- Create: `src/modules/localization/config.ts`
- Create: `src/modules/localization/config.test.ts`
- Create: `app/[locale]/layout.tsx`
- Create: `app/[locale]/page.tsx`
- Create: `app/error.tsx`
- Create: `app/global-error.tsx`
- Create: `app/not-found.tsx`
- Delete after replacement: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: no identity or marketplace module.
- Produces: `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `isLocale(value): value is Locale`, and accessible `/ka`, `/en` shells.

- [ ] **Step 1: Test locale validation**

```ts
import { expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale } from "./config";

it("accepts only supported locales", () => {
  expect(DEFAULT_LOCALE).toBe("ka");
  expect(isLocale("ka")).toBe(true);
  expect(isLocale("en")).toBe(true);
  expect(isLocale("ru")).toBe(false);
});
```

- [ ] **Step 2: Implement locale config and document landmarks**

Make `app/[locale]/layout.tsx` the root layout for localized pages so it can set `<html lang={locale}>` correctly during server rendering. Delete the scaffolded `app/layout.tsx` in the same patch. `proxy.ts` redirects `/` to `/ka`; API routes do not require a root layout. Include a visible-on-focus skip link, one `<main id="main-content">`, and neutral source-backed copy only. Do not establish palette, typography, or component aesthetics before the separate visual-direction approval.

- [ ] **Step 3: Implement bounded error states**

`error.tsx` and `global-error.tsx` show a localized-safe generic message, correlation identifier when provided, and retry action. They must not render stack traces or raw exception messages.

- [ ] **Step 4: Run accessibility smoke checks**

Run: `pnpm test:unit; pnpm test:e2e`

Expected: locale validation and keyboard focus on the skip link PASS in both locale routes.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/localization app
git commit -m "feat: add accessible bilingual application shell"
```

### Task 7: Add CI and clean-install documentation

**Files:**
- Create: `.github/workflows/verify.yml`
- Create: `docs/development.md`
- Create: `scripts/verify-module-boundaries.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: every Phase 0 command.
- Produces: CI status and `verify:boundaries`.

- [ ] **Step 1: Encode module boundary checks**

The script scans `src/modules/**/domain` and fails when it finds imports from `next`, `react`, `@prisma`, `pg`, another module's infrastructure directory, or a provider SDK. Add `verify:boundaries` to `verify:phase-0` before tests.

- [ ] **Step 2: Configure CI PostgreSQL**

Use a PostgreSQL 17 service with a database ending `_test`. CI steps are: checkout, Node 24 setup with pnpm cache, frozen install, Prisma generate, migrate test DB, format, lint, boundaries, typecheck, unit, integration, build, install Chromium, start production server, E2E, and upload Playwright report only on failure.

- [ ] **Step 3: Document exact setup and verification**

`docs/development.md` must include Docker Desktop/Compose prerequisites, `pnpm db:up`, environment copy commands, the separate development/test URLs and technical logins, migrations, development start, each test layer, safe container shutdown, clean test reset, and the fact that no managed database account is required for local work. It must also state that source documents—not the reference UI—govern behavior.

- [ ] **Step 4: Perform a clean verification**

Run:

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate:test
pnpm verify:phase-0
```

Expected: all checks exit 0; Playwright reports both desktop and mobile projects passing.

- [ ] **Step 5: Commit**

```powershell
git add .github docs/development.md scripts package.json
git commit -m "ci: gate foundation with full verification"
```

## Phase 0 completion checklist

- [ ] `pnpm verify:phase-0` passes from a frozen install.
- [ ] A migration applies to an empty PostgreSQL 17 database.
- [ ] Docker Compose reports separate healthy `postgres-dev` and `postgres-test` services, and normal shutdown preserves only the development volume.
- [ ] No Prisma Postgres or other managed-database account is required to run the full Phase 0 gate locally.
- [ ] `/api/health/live` is independent of external services.
- [ ] `/api/health/ready` fails safely when PostgreSQL is unavailable.
- [ ] `/ka` and `/en` render with keyboard-reachable main content on desktop and mobile.
- [ ] Domain folders contain no framework, ORM, or provider imports.
- [ ] The visual direction has been reviewed separately before Phase 1 UI components are styled.
