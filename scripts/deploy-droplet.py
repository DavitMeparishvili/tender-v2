"""Safely deploy the published master image without restarting data services.

Code-only release:
    python scripts/deploy-droplet.py

Release containing reviewed, additive Prisma migrations:
    python scripts/deploy-droplet.py --allow-migrations

Read-only remote validation:
    python scripts/deploy-droplet.py --preflight-only
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote
from collections.abc import Callable

import paramiko

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

GITHUB_REPOSITORY = "DavitMeparishvili/tender-v2"
IMAGE_REPOSITORY = "ghcr.io/davitmeparishvili/tender-v2"
DEFAULT_HOST = "159.223.148.92"
REMOTE_REPOSITORY = "/opt/tender-market"
COMPOSE = "docker compose --env-file deploy/.env.droplet -f compose.droplet.yaml"
HEALTH_ORIGIN = "https://tender-market.online"
ALWAYS_MANUAL_PATHS = (
    "compose.droplet.yaml",
    "docker-entrypoint.sh",
    "deploy/Caddyfile.droplet",
)
MIGRATION_PATH = re.compile(
    r"^prisma/migrations/([0-9A-Za-z_-]+)/migration\.sql$"
)

RunRemote = Callable[..., str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Deploy the published master image with a validated database backup "
            "and automatic app rollback on failed validation."
        )
    )
    parser.add_argument(
        "--allow-migrations",
        action="store_true",
        help=(
            "allow newly added Prisma migration.sql files after manual review; "
            "modified or deleted migrations are always refused"
        ),
    )
    parser.add_argument(
        "--preflight-only",
        action="store_true",
        help="run read-only publication, repository, container, and health checks",
    )
    parser.add_argument(
        "--configure-mail", action="store_true",
        help="set RESEND_API_KEY and MAIL_FROM from the local process environment",
    )
    return parser.parse_args()


def setting(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    if value is None and sys.platform == "win32":
        import winreg

        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
                value = winreg.QueryValueEx(key, name)[0]
        except FileNotFoundError:
            pass
    return value or default


def gh(*args: str):
    return json.loads(
        subprocess.check_output(["gh", *args], encoding="utf-8")
    )


def published_master_sha() -> str:
    sha = gh("api", f"repos/{GITHUB_REPOSITORY}/commits/master")["sha"]
    print(f"Waiting for the published image for {sha}...", flush=True)
    for _ in range(80):
        runs = gh(
            "run",
            "list",
            "--repo",
            GITHUB_REPOSITORY,
            "--workflow",
            "publish-container.yml",
            "--commit",
            sha,
            "--limit",
            "1",
            "--json",
            "status,conclusion,url",
        )
        if runs and runs[0]["status"] == "completed":
            if runs[0]["conclusion"] != "success":
                raise RuntimeError(
                    f"Image publishing failed ({runs[0]['url']}); production was not changed."
                )
            print(f"Published image confirmed: {runs[0]['url']}")
            return sha
        time.sleep(15)
    raise RuntimeError(
        "Image publishing is still pending after twenty minutes. Run this script again later."
    )


def connect(password: str) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.load_system_host_keys()
    known_hosts = Path.home() / ".ssh" / "known_hosts"
    if known_hosts.exists():
        client.load_host_keys(str(known_hosts))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    client.connect(
        setting("TENDER_DROPLET_HOST", DEFAULT_HOST),
        username="root",
        password=password,
        timeout=20,
        look_for_keys=False,
        allow_agent=False,
    )
    return client


def remote_runner(client: paramiko.SSHClient, password: str) -> RunRemote:
    def run(command: str, *, quiet: bool = False) -> str:
        _, stdout, _ = client.exec_command(command, timeout=900)
        channel = stdout.channel
        chunks: list[str] = []
        error_chunks: list[str] = []
        deadline = time.monotonic() + 900
        while (
            not channel.exit_status_ready()
            or channel.recv_ready()
            or channel.recv_stderr_ready()
        ):
            if time.monotonic() > deadline:
                channel.close()
                raise RuntimeError(
                    "Remote command exceeded fifteen minutes; inspect the deployment before retrying."
                )
            if channel.recv_ready():
                message = channel.recv(32768).decode("utf-8", errors="replace")
                chunks.append(message)
                if not quiet:
                    print(
                        message.replace(password, "[REDACTED]"),
                        end="",
                        flush=True,
                    )
            if channel.recv_stderr_ready():
                message = channel.recv_stderr(32768).decode(
                    "utf-8", errors="replace"
                )
                error_chunks.append(message)
                if not quiet:
                    print(
                        message.replace(password, "[REDACTED]"),
                        end="",
                        flush=True,
                    )
            time.sleep(0.1)
        status = channel.recv_exit_status()
        if status:
            detail = "".join(error_chunks).strip().replace(password, "[REDACTED]")
            raise RuntimeError(
                f"Remote command failed with exit code {status}"
                + (f": {detail}" if detail else "")
            )
        return "".join(chunks).strip()

    return run


def changed_files(run: RunRemote, sha: str, *paths: str) -> list[str]:
    path_arguments = " ".join(shlex.quote(path) for path in paths)
    output = run(
        f"cd {REMOTE_REPOSITORY} && git diff --name-only HEAD {shlex.quote(sha)} -- {path_arguments}",
        quiet=True,
    )
    return output.splitlines() if output else []


def migration_changes(run: RunRemote, sha: str) -> tuple[list[str], list[str]]:
    output = run(
        f"cd {REMOTE_REPOSITORY} && git diff --name-status HEAD {shlex.quote(sha)} -- prisma/migrations",
        quiet=True,
    )
    names: list[str] = []
    unsafe: list[str] = []
    for line in output.splitlines():
        fields = line.split("\t")
        if len(fields) != 2 or fields[0] != "A":
            unsafe.append(line)
            continue
        match = MIGRATION_PATH.fullmatch(fields[1])
        if match:
            names.append(match.group(1))
        else:
            unsafe.append(line)
    return names, unsafe


def public_health(run: RunRemote, *, retry: bool) -> None:
    retry_options = (
        "--retry 24 --retry-all-errors --retry-delay 3 " if retry else ""
    )
    for path in ("live", "ready"):
        run(
            "curl --fail --silent --show-error "
            f"{retry_options}--max-time 10 {HEALTH_ORIGIN}/api/health/{path}"
        )


def preflight(
    run: RunRemote, sha: str, *, allow_migrations: bool
) -> tuple[list[str], str, str, bool]:
    print("== Production preflight ==")
    run(f"cd {REMOTE_REPOSITORY} && git fetch origin master")
    tracked_changes = run(
        f"cd {REMOTE_REPOSITORY} && "
        "{ git diff --name-only; git diff --cached --name-only; }",
        quiet=True,
    )
    if tracked_changes:
        raise RuntimeError(
            "The Droplet checkout has tracked changes; production was not changed:\n"
            + tracked_changes
        )
    current = run(
        f"cd {REMOTE_REPOSITORY} && git rev-parse HEAD", quiet=True
    )
    remote_main = run(
        f"cd {REMOTE_REPOSITORY} && git rev-parse origin/master", quiet=True
    )
    print(f"Current commit: {current}\nTarget commit:  {sha}")
    if remote_main != sha:
        raise RuntimeError(
            f"GitHub master ({sha}) does not match fetched origin/master ({remote_main})."
        )
    run(
        f"cd {REMOTE_REPOSITORY} && git merge-base --is-ancestor HEAD {shlex.quote(sha)}"
    )
    manual_changes = changed_files(run, sha, *ALWAYS_MANUAL_PATHS)
    if manual_changes:
        raise RuntimeError(
            "Production infrastructure changed and requires a separate manual review:\n"
            + "\n".join(manual_changes)
        )
    migrations, unsafe_migrations = migration_changes(run, sha)
    if unsafe_migrations:
        raise RuntimeError(
            "Existing or nonstandard migration files changed; automatic deployment is refused:\n"
            + "\n".join(unsafe_migrations)
        )
    if migrations and not allow_migrations:
        raise RuntimeError(
            "New migrations detected:\n"
            + "\n".join(f"- {name}" for name in migrations)
            + "\nReview their SQL, then rerun with --allow-migrations."
        )
    schema_changed = bool(changed_files(run, sha, "prisma/schema.prisma"))
    if schema_changed and not migrations:
        raise RuntimeError(
            "prisma/schema.prisma changed without a new migration; automatic deployment is refused."
        )
    if migrations:
        print("Reviewed migrations allowed:")
        for name in migrations:
            print(f"- {name}")
    else:
        print("No new migrations detected.")
    run(
        "set -eu; "
        f"test \"$(stat -c %a {REMOTE_REPOSITORY}/deploy/.env.droplet)\" = 600; "
        "test \"$(docker inspect tender-demo-postgres-1 --format "
        "'{{if .State.Health}}{{.State.Health.Status}}{{end}}')\" = healthy; "
        "test \"$(docker inspect tender-demo-minio-1 --format "
        "'{{if .State.Health}}{{.State.Health.Status}}{{end}}')\" = healthy; "
        "available=$(df -Pk / | awk 'NR == 2 {print $4}'); "
        "test \"$available\" -ge 2097152; "
        "df -h /"
    )
    run(f"cd {REMOTE_REPOSITORY} && {COMPOSE} ps")
    public_health(run, retry=False)
    services = run(
        "docker inspect tender-demo-postgres-1 tender-demo-minio-1 "
        "--format '{{.Id}} {{json .Mounts}}'",
        quiet=True,
    )
    previous_image = run(
        "docker inspect tender-demo-app-1 --format '{{.Config.Image}}'", quiet=True
    )
    saved_image = run(
        f"cd {REMOTE_REPOSITORY} && sed -n 's/^APP_IMAGE=//p' deploy/.env.droplet",
        quiet=True,
    )
    print(f"Current image: {previous_image}")
    expected_image = f"{IMAGE_REPOSITORY}:{sha}"
    already_deployed = (
        current == sha
        and previous_image == expected_image
        and saved_image == expected_image
    )
    return migrations, services, previous_image, already_deployed


SNAPSHOT_SQL = """SELECT 'users', count(*)::text FROM "user"
UNION ALL SELECT 'tenders', count(*)::text FROM "Tender"
UNION ALL SELECT 'bids', count(*)::text FROM "Bid"
UNION ALL SELECT 'migrations', count(*)::text FROM _prisma_migrations WHERE finished_at IS NOT NULL;
"""


def snapshot(run: RunRemote) -> dict[str, str]:
    output = run(
        "docker exec -i tender-demo-postgres-1 sh -c "
        "'psql -v ON_ERROR_STOP=1 -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -At' <<'SQL'\n"
        + SNAPSHOT_SQL
        + "SQL\n",
        quiet=True,
    )
    return dict(line.split("|", 1) for line in output.splitlines())


def print_snapshot(label: str, values: dict[str, str]) -> None:
    print(label)
    for key, value in values.items():
        print(f"  {key}: {value}")


def create_backup(run: RunRemote, sha: str, migrations: list[str]) -> str:
    label = "migration-deploy" if migrations else "code-deploy"
    migration_manifest = (
        "printf '%s\\n' "
        + " ".join(shlex.quote(name) for name in migrations)
        + " > \"$backup/target-migrations.txt\"; "
        if migrations
        else ""
    )
    backup_command = (
        "set -eu; umask 077; "
        f"backup=/opt/tender-backups/$(date -u +%Y%m%dT%H%M%SZ)-{label}; "
        "mkdir -p \"$backup\"; "
        "docker exec tender-demo-postgres-1 sh -c "
        "'pg_dump -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Fc' "
        "> \"$backup/postgres.dump\"; "
        "docker exec -i tender-demo-postgres-1 pg_restore --list "
        "< \"$backup/postgres.dump\" >/dev/null; "
        f"cp {REMOTE_REPOSITORY}/deploy/.env.droplet \"$backup/env.droplet\"; "
        "docker inspect tender-demo-app-1 --format '{{.Config.Image}}' "
        "> \"$backup/previous-image.txt\"; "
        f"printf '%s\\n' {shlex.quote(sha)} > \"$backup/target-commit.txt\"; "
        + migration_manifest
        + "printf '%s' \"$backup\""
    )
    backup = run(backup_command, quiet=True)
    print(f"Validated backup: {backup}")
    return backup


def verify_migrations(run: RunRemote, migrations: list[str]) -> None:
    for name in migrations:
        # Names came from the strict MIGRATION_PATH expression, so interpolation
        # into this SQL literal cannot introduce quotes or shell syntax.
        result = run(
            "docker exec -i tender-demo-postgres-1 sh -c "
            "'psql -v ON_ERROR_STOP=1 -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -At' <<'SQL'\n"
            "SELECT count(*) FROM _prisma_migrations "
            f"WHERE migration_name = '{name}' AND finished_at IS NOT NULL;\n"
            "SQL\n",
            quiet=True,
        )
        if result != "1":
            raise RuntimeError(f"Migration did not finish successfully: {name}")


def rollback_app(run: RunRemote, previous_image: str) -> None:
    print(f"Rolling the app container back to {previous_image}...", flush=True)
    run(
        f"cd {REMOTE_REPOSITORY} && APP_IMAGE={shlex.quote(previous_image)} "
        f"{COMPOSE} up -d --no-deps app"
    )
    public_health(run, retry=True)
    print("Previous app image is healthy. Database backups were retained.")


def deploy(
    run: RunRemote,
    sha: str,
    migrations: list[str],
    services_before: str,
    previous_image: str,
    client: paramiko.SSHClient,
    configure_mail: bool,
) -> None:
    image = f"{IMAGE_REPOSITORY}:{sha}"
    before = snapshot(run)
    print_snapshot("Data summary before:", before)
    backup = create_backup(run, sha, migrations)
    app_replaced = False
    try:
        run(
            f"cd {REMOTE_REPOSITORY} && APP_IMAGE={shlex.quote(image)} {COMPOSE} pull app"
        )
        run(
            f"cd {REMOTE_REPOSITORY} && git merge --ff-only {shlex.quote(sha)}"
        )
        app_replaced = True
        if configure_mail:
            update_mail_environment(client)
        run(
            f"cd {REMOTE_REPOSITORY} && APP_IMAGE={shlex.quote(image)} "
            f"{COMPOSE} up -d --no-deps app"
        )
        public_health(run, retry=True)
        actual_image = run(
            "docker inspect tender-demo-app-1 --format '{{.Config.Image}}'", quiet=True
        )
        if actual_image != image:
            raise RuntimeError(
                f"Running app image is {actual_image}, expected {image}."
            )
        verify_migrations(run, migrations)
        services_after = run(
            "docker inspect tender-demo-postgres-1 tender-demo-minio-1 "
            "--format '{{.Id}} {{json .Mounts}}'",
            quiet=True,
        )
        if services_before != services_after:
            raise RuntimeError(
                "Database or storage container/mount identity changed unexpectedly."
            )
        after = snapshot(run)
        print_snapshot("Data summary after:", after)
        business_before = {k: v for k, v in before.items() if k != "migrations"}
        business_after = {k: v for k, v in after.items() if k != "migrations"}
        if business_before == business_after:
            print("Business data summary unchanged.")
        else:
            print(
                "Business data changed during deployment; inspect the summaries "
                "for live traffic or unexpected changes."
            )
        run(f"cd {REMOTE_REPOSITORY} && {COMPOSE} logs --tail=60 app && {COMPOSE} ps")
        run(
            f"cd {REMOTE_REPOSITORY} && "
            "grep -q '^APP_IMAGE=' deploy/.env.droplet && "
            f"sed -i 's|^APP_IMAGE=.*|APP_IMAGE={image}|' deploy/.env.droplet && "
            f"test \"$(sed -n 's/^APP_IMAGE=//p' deploy/.env.droplet)\" = {shlex.quote(image)}"
        )
        print(
            f"Deployed {sha}.\n"
            f"Backup: {backup}\n"
            f"Previous image: {previous_image}"
        )
    except Exception as deployment_error:
        if app_replaced:
            try:
                run(
                    f"cp {shlex.quote(backup)}/env.droplet "
                    f"{REMOTE_REPOSITORY}/deploy/.env.droplet && "
                    f"chmod 600 {REMOTE_REPOSITORY}/deploy/.env.droplet",
                    quiet=True,
                )
                rollback_app(run, previous_image)
            except Exception as rollback_error:
                raise RuntimeError(
                    f"Deployment failed: {deployment_error}. "
                    f"Automatic app rollback also failed: {rollback_error}"
                ) from deployment_error
        raise


def mail_settings() -> dict[str, str]:
    values = {
        "RESEND_API_KEY": os.environ.get("RESEND_API_KEY", ""),
        "MAIL_FROM": os.environ.get("MAIL_FROM", ""),
    }
    for name, value in values.items():
        if not value or any(char in value for char in "\r\n\x00'\\"):
            raise RuntimeError(f"Set a valid {name} in the local process environment.")
    return values


def configure_registry_access(client: paramiko.SSHClient) -> None:
    token = os.environ.get("GH_TOKEN")
    if not token:
        return
    # Persist only on the deployment host, with owner-only permissions.
    path = "/root/.tender-git-credentials"
    with client.open_sftp() as sftp:
        with sftp.open(path, "w") as target:
            sftp.chmod(path, 0o600)
            target.write(
                "https://DavitMeparishvili:" + quote(token, safe="") + "@github.com\n"
            )
    command = (
        f"cd {REMOTE_REPOSITORY} && "
        "git config credential.helper 'store --file=/root/.tender-git-credentials' && "
        "docker login ghcr.io -u DavitMeparishvili --password-stdin"
    )
    stdin, stdout, stderr = client.exec_command(command, timeout=60)
    stdin.write(token + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    stdout.read()
    stderr.read()
    if stdout.channel.recv_exit_status():
        raise RuntimeError("GitHub registry authentication failed.")
    print("Configured private repository and registry access on the Droplet.")


def update_mail_environment(client: paramiko.SSHClient) -> None:
    values = mail_settings()
    path = f"{REMOTE_REPOSITORY}/deploy/.env.droplet"
    with client.open_sftp() as sftp:
        with sftp.open(path, "r") as source:
            lines = source.read().decode("utf-8").splitlines()
        lines = [line for line in lines if line.split("=", 1)[0] not in values]
        lines.extend(f"{name}='{value}'" for name, value in values.items())
        temporary = path + ".pending"
        with sftp.open(temporary, "w") as target:
            sftp.chmod(temporary, 0o600)
            target.write("\n".join(lines) + "\n")
        sftp.posix_rename(temporary, path)
    print("Updated mail credentials in the private Droplet environment file.")


def main() -> None:
    args = parse_args()
    if args.configure_mail:
        mail_settings()
    password = setting("TENDER_DROPLET_PASSWORD")
    if not password:
        raise RuntimeError(
            "Set TENDER_DROPLET_PASSWORD in your user environment first."
        )
    sha = published_master_sha()
    client = connect(password)
    try:
        if not args.preflight_only:
            configure_registry_access(client)
        run = remote_runner(client, password)
        migrations, services, previous_image, already_deployed = preflight(
            run, sha, allow_migrations=args.allow_migrations
        )
        if args.preflight_only:
            print("Preflight passed. Production was not changed.")
            return
        if already_deployed and not args.configure_mail:
            print(f"{sha} is already deployed and healthy. Nothing to do.")
            return
        deploy(run, sha, migrations, services, previous_image, client, args.configure_mail)
    finally:
        client.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Deployment stopped: {error}", file=sys.stderr)
        sys.exit(1)
