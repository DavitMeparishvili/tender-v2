# Local development

## Prerequisites

- Node.js 24, matching `.nvmrc`.
- pnpm 11.21.0, selected through the `packageManager` field in `package.json` (Corepack may activate it).
- Docker Desktop running with Docker Compose v2 available as `docker compose`.

No Prisma Postgres or other managed-database account is required for local development or the complete Phase 0 verification gate. Both databases run in standard PostgreSQL 17 containers.

## First-time setup

Install the pinned dependency graph:

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

For the normal local workflow, copy the development template:

```powershell
Copy-Item .env.example .env
```

For a test-only checkout, use the test-focused template instead:

```powershell
Copy-Item .env.test.example .env
```

`.env.test.example` is a template and is not loaded under that filename. Prisma and Next.js load `.env`; the guarded migration and integration-test tools read `DATABASE_URL_TEST` from the process environment loaded from `.env`. They require that URL to name a database ending in `_test`. The normal `.env.example` already contains both local URLs, so most developers need only the first copy command.

Start both databases and wait for their health checks:

```powershell
pnpm db:up
```

The Docker-only technical logins are separate from application users:

| Use             | URL                                                                          | Technical login                                       |
| --------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| Development     | `postgresql://tender_local:tender_local_only@localhost:5432/tender_dev`      | user `tender_local`, password `tender_local_only`     |
| Automated tests | `postgresql://tender_test:tender_test_local_only@localhost:5433/tender_test` | user `tender_test`, password `tender_test_local_only` |

Clients, providers, and administrators are application records. They never receive these PostgreSQL credentials or connect directly to either database.

Generate the Prisma client, apply development migrations, and deploy the same committed migrations to the disposable test database:

```powershell
pnpm db:generate
pnpm db:migrate
pnpm db:migrate:test
```

Start the development server:

```powershell
pnpm dev
```

Open `http://localhost:3000`; the root route redirects to the default Georgian locale.

## Verification layers

Run layers independently while developing:

```powershell
pnpm format:check
pnpm lint
pnpm verify:boundaries
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e
```

- Unit tests are isolated and never connect to PostgreSQL.
- Integration tests require the healthy test service and always substitute the guarded `DATABASE_URL_TEST` for `DATABASE_URL`.
- Playwright runs both `desktop-chromium` and `mobile-chromium`. It owns a fresh Next.js server lifecycle, never attaches to an existing development server, and maps the guarded `DATABASE_URL_TEST` into that server's `DATABASE_URL`. CI starts the built application with `pnpm start` through Playwright's `webServer` configuration.

The domain-boundary gate is fail-closed. Production files under `src/modules/**/domain` may import relative paths and repository aliases, but bare third-party packages and Node.js built-ins are rejected unless a package is deliberately added to the empty `domainSafePackages` allowlist. Colocated test files have a test-only exception for Vitest; this does not permit Vitest in production domain code.

The complete local Phase 0 gate preserves this order: format, lint, module boundaries, typecheck, unit, integration, build, and the pre-Phase-1 E2E suite. It excludes tests tagged `@phase-1`; the Phase 1 gate runs those only after deterministic seeding.

`verify:phase-0` is a verification gate, not a bootstrap command. It assumes the frozen dependencies are installed, the Prisma client has been generated, the test PostgreSQL service is healthy with committed migrations applied, the required environment values are present, and Playwright's Chromium binary is installed.

```powershell
pnpm verify:phase-0
```

## Phase 1 identity fixtures and gate

Phase 1 browser acceptance uses deterministic account addresses and a random password supplied only through `PHASE_1_SEED_PASSWORD`. The seeder refuses production and always resolves `DATABASE_URL_TEST` through the `_test` database guard. It creates accounts through Better Auth, completes commercial profiles through the onboarding use case, and applies only moderation-owned fixture state (dual capability, disabled, and restricted flags) directly.

Generate a fresh local secret for the current PowerShell session, then seed the disposable test database:

```powershell
$bytes = [byte[]]::new(24)
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:PHASE_1_SEED_PASSWORD = [Convert]::ToBase64String($bytes)
pnpm seed:phase-1
```

The seed resets only these fixed `@tender.test` accounts: verified client, verified construction provider, dual-capability company, unverified user, onboarding-incomplete user, restricted user, and disabled user. It never stores or prints the password.

Run the complete Phase 1 gate after the standard first-time setup:

```powershell
pnpm verify:phase-1
```

The gate first preserves the complete Phase 0 production-build and production-server suite. It then reapplies committed test migrations, reruns identity/profile integration tests, rebuilds, reseeds, and executes every `@phase-1` browser journey on desktop and mobile Chromium. Tagged verification-email journeys use the development-only in-memory mailbox; the production-server CI smoke test separately proves `/api/test/mailbox` returns only `404 NOT_FOUND`.

## Phase 2 and Phase 3 fixtures and gates

`pnpm seed:phase-2` seeds three deterministic tenders (a published listing, an incomplete draft, and a cancelled tender) owned by the Phase 1 seeded client. It requires the Phase 1 seed to have already run — it looks the client account up rather than creating it.

`pnpm seed:phase-3` requires both the Phase 1 and the Phase 2 seed to have run first. It looks up the Phase 1 client and provider accounts, creates two additional seeded provider accounts (`phase3.provider.b@tender.test`, `phase3.provider.c@tender.test`) through Better Auth and the onboarding use case, reusing `PHASE_1_SEED_PASSWORD` for their passwords, then publishes one tender and has all three providers buy access and bid on it before moving its deadline into the past — the only fixture-only write in the script, applied after every bid was submitted through the real application use cases.

Every environment, including local development, must supply `SELECTION_WORKER_SECRET` (at least 32 characters): it is the shared secret `POST /api/tenders/selection/run` compares in constant time before running the deadline selector. Generate one for the current PowerShell session:

```powershell
$bytes = [byte[]]::new(24)
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:SELECTION_WORKER_SECRET = [Convert]::ToBase64String($bytes)
```

Phase 3's non-negotiable behaviour for future contributors: a tender's winner is produced only by `POST /api/tenders/selection/run`, and only at or after that tender's deadline. No customer-facing or administrator route may select, replace, or override a winner. Re-running the worker against an already-settled tender returns the existing result and performs no new writes.

`pnpm verify:phase-3` reapplies the complete Phase 2 gate, then reapplies committed test migrations, runs the `access`, `bidding`, `agreements`, and `notifications` integration suites, rebuilds, reseeds through `pnpm seed:phase-3`, and executes every `@phase-3` browser journey on desktop and mobile Chromium.

## Phase 4 agreements, reviews, and MVP gate

Phase 4 is cumulative. Run `pnpm seed:phase-1`, `pnpm seed:phase-2`, `pnpm seed:phase-3`, then `pnpm seed:phase-4` in that order. The final seed runs the real deadline selector for the fixed due tender when necessary, leaves its winning agreement in `PENDING_CONFIRMATION`, and creates the fixture-only moderation account. It never prints the shared password or worker secrets.

Agreement expiry uses a second worker secret. Generate it with the same 24-byte PowerShell pattern used for the selection secret:

```powershell
$bytes = [byte[]]::new(24)
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:AGREEMENT_WORKER_SECRET = [Convert]::ToBase64String($bytes)
```

`POST /api/agreements/expiry/run` accepts only that shared secret and cancels pending agreements at or after their exact 48-hour confirmation deadline. Confirmation never selects a fallback bidder: a declined, expired, or cancelled agreement is terminal. The platform records neutral lifecycle status and reviews; it does not adjudicate disputes, determine fault, hold payment, or award compensation.

Inbox records are created in the same transaction as lifecycle and review notifications. They are available in Phase 4 for in-product reading; production email delivery remains a Phase 5 concern.

Each completed-agreement party may publish one review only. The reviewed party is always derived from the agreement counterpart, never accepted from the browser. Public lists and aggregates include only published, non-redacted reviews; administrative redaction preserves the original review and its audit history while removing it from those public projections.

```powershell
pnpm verify:mvp
```

`verify:mvp` adds the agreement, notification, review, and profile integration suites plus Phase 4 deterministic seeding and the full `@phase-4` desktop/mobile Playwright journey on top of `verify:phase-3`.

## Reset and shutdown

The test database uses container `tmpfs`. To reset only test state without touching development data, recreate that service and reapply committed migrations:

```powershell
docker compose stop postgres-test
docker compose rm --force postgres-test
docker compose up -d --wait postgres-test
pnpm db:migrate:test
```

For a normal shutdown, stop and remove both containers and their network:

```powershell
pnpm db:down
```

This command intentionally omits `--volumes`: it preserves the named development volume while the disposable test database is discarded. Do not add `--volumes` unless permanent deletion of local development data is explicitly intended.

## Product authority

`Product_description.md` and `Specs.md` are the source documents and govern product behavior. Confirmed decisions recorded in the program design resolve their implementation boundaries. The reference application may supply logic evidence and edge cases, but its UI is not authoritative and must not govern or be copied into this product.
