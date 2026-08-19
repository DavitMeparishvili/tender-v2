# Vercel + DigitalOcean Droplet demo deployment

This deployment runs the Next.js application on Vercel Hobby and runs
PostgreSQL 17 plus MinIO on one DigitalOcean Droplet.

Vercel does not need a reverse proxy. MinIO does: Caddy publishes the MinIO S3
API as HTTPS on a dedicated hostname and manages its certificate. PostgreSQL
does not use Caddy; it is published directly with PostgreSQL TLS and SCRAM
password authentication. The MinIO console is deliberately not published.

## 1. Prerequisites

- An Ubuntu Droplet with Docker Engine and the Docker Compose plugin.
- A domain with an `A` record such as `storage.example.com` pointing to the
  Droplet public IPv4 address.
- TCP ports 80, 443, and 5432 open on the Droplet. Restrict SSH port 22 to your
  own IP even if the demo database itself is public.
- This repository cloned on the Droplet for the one-off migration and seed.

The application database password, MinIO application key, auth secret, and
worker secrets must all be independent random values. Do not reuse the MinIO
root credentials in Vercel.

## 2. Configure the Droplet stack

From the repository root on the Droplet:

```sh
cp deploy/.env.droplet.example deploy/.env.droplet
chmod 600 deploy/.env.droplet
```

Edit `deploy/.env.droplet` and replace every placeholder. `APP_ORIGIN` must be
the final Vercel/custom-domain origin. `STORAGE_DOMAIN` must match the DNS
record pointing at the Droplet.

Generate the PostgreSQL server certificate. `sslmode=require` encrypts the
Vercel-to-PostgreSQL connection; this demo certificate is self-signed and is
not used for hostname verification.

```sh
sudo POSTGRES_TLS_CN=db.example.com sh deploy/generate-postgres-tls.sh
```

Start the long-running services, then initialize the private bucket and
restricted application user:

```sh
docker compose --env-file deploy/.env.droplet -f compose.production.yaml up -d postgres minio caddy
docker compose --env-file deploy/.env.droplet -f compose.production.yaml --profile setup run --rm minio-init
docker compose --env-file deploy/.env.droplet -f compose.production.yaml ps
```

The persistent data lives in Docker named volumes. `docker compose down` does
not delete it. Never use `down --volumes` unless intentionally destroying the
demo database and all uploaded objects.

The MinIO console is reachable only inside Docker. When administration is
needed, temporarily forward it over SSH instead of publishing port 9001.

## 3. Apply migrations and seed demo data

Install Node 24 and pnpm on the Droplet, then create a temporary, gitignored
`.env` containing the production values from `.env.production.example`.
`DATABASE_URL` and `DIRECT_DATABASE_URL` can both use the public Droplet
address for this small demo:

```text
postgresql://tender_app:PERCENT_ENCODED_PASSWORD@db.example.com:5432/tender_demo?sslmode=require
```

Run:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:deploy
pnpm seed:demo
```

`seed:demo` requires `NODE_ENV=production`, `DEMO_SEED_CONFIRM=tender_demo`,
and `DEMO_SEED_PASSWORD` with at least 12 characters. It creates these verified
accounts with the supplied shared demo password:

- `demo.client@tender.test`
- `demo.provider@tender.test`
- `demo.admin@tender.test`

It also creates one published tender. Remove `DEMO_SEED_PASSWORD` and
`DEMO_SEED_CONFIRM` from `.env` immediately after the seed succeeds.

## 4. Configure Vercel

Import the repository and use Node 24. `postinstall` generates the ignored
Prisma 7 client during a clean Vercel build.

Add the following Production environment variables:

- `DATABASE_URL` with `sslmode=require`
- `AUTH_SECRET`
- `APP_URL`
- `STORAGE_ENDPOINT=https://storage.example.com`
- `STORAGE_REGION=us-east-1`
- `STORAGE_BUCKET`
- `STORAGE_ACCESS_KEY_ID` using `MINIO_APP_ACCESS_KEY`
- `STORAGE_SECRET_ACCESS_KEY` using `MINIO_APP_SECRET_KEY`
- `STORAGE_FORCE_PATH_STYLE=true`
- `SELECTION_WORKER_SECRET`
- `AGREEMENT_WORKER_SECRET`

Mark the database URL, auth/worker secrets, and MinIO keys as Sensitive.
`DIRECT_DATABASE_URL`, MinIO root credentials, and the demo seed password do
not belong in Vercel.

Do not give Preview deployments the Production database credentials. For the
first demo, deploy only the production branch.

## 5. Verify

After deploying:

1. Open `/api/health/live` and `/api/health/ready`.
2. Sign in using each seeded role.
3. Upload and download a PDF or image, including a file larger than 4.5 MiB.
   The browser uploads directly to the signed MinIO URL, then Vercel verifies
   its stored size, declared type, and magic bytes before creating the record.
4. Confirm an unsigned MinIO object URL is denied.
5. Restart the Compose services and confirm the data remains available.

## 6. Basic operations

View logs:

```sh
docker compose --env-file deploy/.env.droplet -f compose.production.yaml logs --tail=100 postgres minio caddy
```

Update container images after reviewing their release notes:

```sh
docker compose --env-file deploy/.env.droplet -f compose.production.yaml pull
docker compose --env-file deploy/.env.droplet -f compose.production.yaml up -d
```

Enable DigitalOcean Droplet backups and also keep an off-Droplet `pg_dump`.
A copy stored only on the same Droplet is not a backup.
