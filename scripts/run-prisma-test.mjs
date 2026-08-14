import "dotenv/config";
import { spawn } from "node:child_process";
import { validateTestDatabaseUrl } from "../src/config/test-database-url.ts";

const databaseUrl = validateTestDatabaseUrl(process.env.DATABASE_URL_TEST);
const command = process.platform === "win32" ? process.env.ComSpec : "pnpm";
const commandArguments =
  process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm exec prisma migrate deploy"]
    : ["exec", "prisma", "migrate", "deploy"];

if (!command) {
  throw new Error("Unable to resolve a command shell");
}

const child = spawn(command, commandArguments, {
  env: { ...process.env, DATABASE_URL: databaseUrl },
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
