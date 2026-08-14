import { expect, it } from "vitest";
import { database } from "./client";
import { checkDatabaseReadiness } from "./readiness";

it("round-trips a PostgreSQL readiness query", async () => {
  await expect(checkDatabaseReadiness()).resolves.toEqual({ ok: true });
});

it("creates, reads, and deletes a record through the migrated schema", async () => {
  const id = "phase-0-audit-event-schema-sentinel";
  let tableAvailable = false;
  let deletedCount = 0;

  try {
    await database.auditEvent.deleteMany({ where: { id } });
    tableAvailable = true;

    await database.auditEvent.create({
      data: {
        id,
        action: "PHASE_0_SCHEMA_SENTINEL",
        targetType: "foundation",
        targetId: "phase-0",
        correlationId: "phase-0-schema-sentinel",
        metadata: { purpose: "migration-verification" },
      },
    });

    const persisted = await database.auditEvent.findUnique({ where: { id } });

    expect(persisted).toMatchObject({
      id,
      action: "PHASE_0_SCHEMA_SENTINEL",
      targetType: "foundation",
      targetId: "phase-0",
      correlationId: "phase-0-schema-sentinel",
      metadata: { purpose: "migration-verification" },
    });
  } finally {
    if (tableAvailable) {
      const deletion = await database.auditEvent.deleteMany({ where: { id } });
      deletedCount = deletion.count;
    }
  }

  expect(deletedCount).toBe(1);
});
