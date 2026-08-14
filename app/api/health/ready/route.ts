import { checkDatabaseReadiness } from "@/src/infrastructure/db/readiness";

export async function GET(): Promise<Response> {
  const readiness = await checkDatabaseReadiness();

  if (!readiness.ok) {
    return Response.json(
      { status: "unavailable", reason: readiness.reason },
      { status: 503 },
    );
  }

  return Response.json({ status: "ok" });
}
