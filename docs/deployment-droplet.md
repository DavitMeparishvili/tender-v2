# Lightweight full-stack deployment on one DigitalOcean Droplet

This is the deployment path for the existing **1 vCPU / 1 GB** Droplet. It
runs four containers: Next.js, PostgreSQL, MinIO, and Caddy. Do **not** install
Coolify on this Droplet. The database and MinIO console are private Docker
services; only Caddy publishes ports 80 and 443.

The Next.js image is built in GitHub Actions, not on the Droplet. This matters
because a Next.js production build can exhaust 1 GB of RAM.

## 1. Create DNS records at Namecheap

In Namecheap's **Advanced DNS**, create these A records. Replace the IP only if
the Droplet's public IP changes.

| Type     | Host  | Value            |
| -------- | ----- | ---------------- |
| A Record | `@`   | `159.223.148.92` |
| A Record | `www` | `159.223.148.92` |
| A Record | `s3`  | `159.223.148.92` |

Do not create a `CNAME` for `www` and do not enable a Namecheap forwarding
rule. Wait until the records resolve before starting Caddy; Caddy obtains the
HTTPS certificates automatically.

## 2. Prepare the Droplet

The DigitalOcean web console already logs you in as `root`. Run these commands
there one at a time:

```sh
apt update
apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

Add a 2 GB swap file. This is a safety buffer, not extra RAM, but it helps
avoid abrupt out-of-memory failures on a small demo server:

```sh
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```

In the DigitalOcean Networking firewall, allow inbound TCP **22**, **80**, and
**443**. Do not open 5432, 9000, or 9001.

## 3. Publish the application image

Push these repository changes to the `master` branch. The GitHub workflow
`.github/workflows/publish-container.yml` publishes:

```text
ghcr.io/davitmeparishvili/tender-v2:latest
```

Open the workflow in GitHub's **Actions** tab and wait for it to succeed. If
the repository/package is private, create a GitHub classic personal access
token with **read:packages**, then on the Droplet run:

```sh
docker login ghcr.io -u DavitMeparishvili
```

Paste the token when Docker asks for a password. Alternatively, make the
package public in the GitHub package settings after its first publish.

## 4. Copy the deployment files to the Droplet

On the Droplet:

```sh
mkdir -p /opt/tender-market
git clone https://github.com/DavitMeparishvili/tender-v2.git /opt/tender-market
cd /opt/tender-market
cp deploy/.env.droplet.example deploy/.env.droplet
chmod 600 deploy/.env.droplet
```

Edit the private environment file:

```sh
nano deploy/.env.droplet
```

Replace every `replace-with-...` value. Generate each value separately with:

```sh
openssl rand -hex 32
```

Use that output for `POSTGRES_PASSWORD`, the two MinIO passwords, `AUTH_SECRET`,
and the two worker secrets. Keep the supplied domain values and image name:

```text
APP_DOMAIN=tender-market.online
STORAGE_DOMAIN=s3.tender-market.online
APP_ORIGIN=https://tender-market.online
STORAGE_PUBLIC_ENDPOINT=https://s3.tender-market.online
APP_IMAGE=ghcr.io/davitmeparishvili/tender-v2:latest
```

Do not put a database URL in this file. Compose constructs it inside the app
container, so the password never travels over the public network.

For activation and password recovery emails, set `RESEND_API_KEY` to your Resend
sending key and `MAIL_FROM=accounts@email.tender-market.online` in the private
`deploy/.env.droplet` file. Verify `email.tender-market.online` in Resend first.
The key must come from Resend, not the random-secret command above. See
[email setup](email-setup.md). Local `.env.local` credentials are not copied to
the Droplet; configure them there separately, then recreate the app container.

## 5. Start the stack and initialize MinIO

From `/opt/tender-market`:

```sh
docker compose --env-file deploy/.env.droplet -f compose.droplet.yaml pull
docker compose --env-file deploy/.env.droplet -f compose.droplet.yaml up -d
docker compose --env-file deploy/.env.droplet -f compose.droplet.yaml --profile setup run --rm minio-init
docker compose --env-file deploy/.env.droplet -f compose.droplet.yaml ps
```

The `app` container automatically applies Prisma migrations before it starts.
View startup logs if it is not healthy:

```sh
docker compose --env-file deploy/.env.droplet -f compose.droplet.yaml logs --tail=100 app caddy
```

Then open `https://tender-market.online/api/health/live` and
`https://tender-market.online/api/health/ready`.

## 6. Seed the demo data once

Choose a demo login password of at least 12 characters. Run the command below,
substituting only `YOUR_DEMO_PASSWORD`:

```sh
docker compose --env-file deploy/.env.droplet -f compose.droplet.yaml exec \
  -e DEMO_SEED_CONFIRM=tender_demo \
  -e DEMO_SEED_PASSWORD='YOUR_DEMO_PASSWORD' \
  app node_modules/.bin/tsx scripts/seed-demo.ts
```

The seed creates `demo.client@tender.test`, `demo.provider@tender.test`, and
`demo.admin@tender.test`, all with that chosen password. The password is passed
only to this one command; it is not saved in the `.env` file.

### Georgian demo data

`scripts/seed-demo-ka.ts` seeds Georgian-language data for a live demo: open
tenders with VIP-first offers, a tender awaiting the client's choice,
agreements in pending/in-progress/completed states, the VIP Lounge with rated
partners, a draft, a cancelled tender and a redacted review. Run it again on
the morning of a demo: agreements awaiting confirmation expire after 48 hours,
and the seed rebuilds any scenario that drifted.

```sh
docker compose --env-file deploy/.env.droplet -f compose.droplet.yaml exec   -e DEMO_SEED_CONFIRM=tender_demo   -e DEMO_SEED_PASSWORD='YOUR_DEMO_PASSWORD'   app node_modules/.bin/tsx scripts/seed-demo-ka.ts
```

Accounts are `client@`, `provider@`, `standard@` and `admin@tender.test`, plus
supporting partners and clients listed in the script output.

## Updating and operations

### Deployment helper (recommended)

Install Python, `paramiko` (`python -m pip install paramiko`), and the GitHub CLI.
Authenticate `gh` and add the Droplet's verified SSH host key to
`~/.ssh/known_hosts`. Set `TENDER_DROPLET_PASSWORD` in your local process
environment (never in Git); `TENDER_DROPLET_HOST` optionally overrides
`159.223.148.92`. The helper uses root SSH and `/opt/tender-market`.
The remote checkout and Docker must already have access to GitHub/GHCR, or set
`GH_TOKEN` locally to configure that access during deployment. Use a token with
repository read access and `read:packages`. The helper stores it only on the
Droplet in an owner-only Git credential file and Docker's root configuration.
Keep `deploy/.env.droplet` on the Droplet at mode `600`.

```sh
python scripts/deploy-droplet.py --preflight-only
python scripts/deploy-droplet.py
```

For a code-only release when no database backup is wanted, use
`python scripts/deploy-droplet.py --skip-database-backup`. This keeps the private
environment and previous-image metadata needed for app rollback, but does not
run `pg_dump`. Releases with migrations cannot use this option.

The helper waits for the `master` commit's image publication, validates the
running stack, makes a private PostgreSQL/environment backup in
`/opt/tender-backups`, and deploys the immutable commit image. Only the app is
recreated. Public liveness/readiness and database/storage container identities
are checked; failed validation restores the previous environment and app image.
Database migrations are not reversed by an app rollback. Infrastructure changes
require separate review; new additive migrations require `--allow-migrations`.
The preflight fetches Git refs but does not change running services.

To configure email while deploying, set `RESEND_API_KEY` and
`MAIL_FROM=accounts@email.tender-market.online` in your local process environment,
then run:

```sh
python scripts/deploy-droplet.py --configure-mail
```

Credentials are transferred over SFTP into the private environment file, never
printed or passed as remote command arguments. Existing values are preserved
on subsequent deployments without this flag.

After a new GitHub Actions image succeeds, update the checked-out Compose files
and restart only with the new image:

```sh
cd /opt/tender-market
git pull --ff-only
docker compose --env-file deploy/.env.droplet -f compose.droplet.yaml pull app
docker compose --env-file deploy/.env.droplet -f compose.droplet.yaml up -d app
```

Persistent PostgreSQL and MinIO data is in Docker volumes. `docker compose down`
does not delete it. Never run `docker compose down --volumes` unless you
intentionally want to erase the demo database and uploaded files.
