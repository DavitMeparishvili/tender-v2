import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { createTenderDraft } from "./create-tender-draft";
import { getOwnedTender } from "./get-owned-tender";
import { listOwnedTenders } from "./list-owned-tenders";
import { updateTenderDraft } from "./update-tender-draft";

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

describe("tender draft application entry points", () => {
  it("creates, updates, reads, and lists a draft through the exported functions", async () => {
    const ownerId = await createOwner();

    const created = await createTenderDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
      { id: ownerId },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateTenderDraft(
      created.value.id,
      { budgetMinorUnits: 150_000, currency: "GEL" },
      { id: ownerId },
    );
    expect(updated).toMatchObject({
      ok: true,
      value: {
        id: created.value.id,
        budgetMinorUnits: 150_000,
        currency: "GEL",
      },
    });

    const read = await getOwnedTender(created.value.id, { id: ownerId });
    expect(read).toMatchObject({
      ok: true,
      value: {
        id: created.value.id,
        budgetMinorUnits: 150_000,
        currency: "GEL",
      },
    });

    const listed = await listOwnedTenders({ id: ownerId });
    expect(listed.some((tender) => tender.id === created.value.id)).toBe(true);
  });

  it("rejects invalid input without touching the repository", async () => {
    const ownerId = await createOwner();

    const result = await createTenderDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Hi" },
      { id: ownerId },
    );

    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("rejects an update from a non-owner through the application layer", async () => {
    const ownerId = await createOwner();
    const otherId = await createOwner();

    const created = await createTenderDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
      { id: ownerId },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateTenderDraft(
      created.value.id,
      { title: "Repaint three rooms" },
      { id: otherId },
    );

    expect(result).toEqual({ ok: false, error: "NOT_OWNER" });
  });
});
