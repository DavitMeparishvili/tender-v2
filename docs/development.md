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
- Playwright runs both `desktop-chromium` and `mobile-chromium`. It owns the Next.js server lifecycle, so do not start a second production server for the test. Locally it may reuse an existing development server; CI starts the built application with `pnpm start` through Playwright's `webServer` configuration.

The complete local Phase 0 gate preserves this order: format, lint, module boundaries, typecheck, unit, integration, build, and E2E.

```powershell
pnpm verify:phase-0
```

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
