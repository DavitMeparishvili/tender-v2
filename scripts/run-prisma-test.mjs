import "dotenv/config";
import { spawn } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL_TEST;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_TEST is required");
}

const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.slice(1));

if (!databaseName.endsWith("_test")) {
  throw new Error("DATABASE_URL_TEST must target a database ending in _test");
}

const command = process.platform === "win32" ? process.env.ComSpec : "pnpm";
const commandArguments =
  process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm exec prisma migrate deploy"]
    : ["exec", "prisma", "migrate", "deploy"];

if (!command) {
  throw new Error("Unable to resolve a command shell");
}

const child = spawn(command, commandArguments, {
  env: { ...process.env, DATABASE_URL: parsedDatabaseUrl.toString() },
  stdio: "inherit",
});

child.on("error", (error) => {
  throw error;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
