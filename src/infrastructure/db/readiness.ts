import { database } from "./client";

export async function checkDatabaseReadiness(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  try {
    await database.$queryRaw`SELECT 1`;

    return { ok: true };
  } catch {
    return { ok: false, reason: "database_unavailable" };
  }
}
