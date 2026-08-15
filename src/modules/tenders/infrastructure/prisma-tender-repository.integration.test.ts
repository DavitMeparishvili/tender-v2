import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { PrismaTenderRepository } from "./prisma-tender-repository";

const repository = new PrismaTenderRepository();

async function createOwner(): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: "Owner",
      email: `${id}@tender.test`,
      emailVerified: true,
    },
  });
  return id;
}

afterAll(async () => {
  await database.$disconnect();
});

describe("PrismaTenderRepository", () => {
  it("creates a draft owned by the actor and rejects updates from a different owner", async () => {
    const ownerId = await createOwner();
    const otherId = await createOwner();
    const now = new Date();

    const created = await repository.createDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
      { id: ownerId },
      { tenderId: randomUUID() },
      now,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const ownerRead = await repository.getOwned(created.value.id, {
      id: ownerId,
    });
    expect(ownerRead).toEqual({ ok: true, value: created.value });

    const otherRead = await repository.getOwned(created.value.id, {
      id: otherId,
    });
    expect(otherRead).toEqual({ ok: false, error: "NOT_OWNER" });

    const otherUpdate = await repository.updateDraft(
      created.value.id,
      { budgetMinorUnits: 100_000, currency: "GEL" },
      { id: otherId },
    );
    expect(otherUpdate).toEqual({ ok: false, error: "NOT_OWNER" });
  });
});
