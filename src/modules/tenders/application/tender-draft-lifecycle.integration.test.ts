import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { createTenderDraft } from "./create-tender-draft";
import { getOwnedTender } from "./get-owned-tender";
import { listOwnedTenders } from "./list-owned-tenders";
import { syncTenderLocation } from "./sync-tender-location";
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

  it("clears a persisted desired start date through the application entry point", async () => {
    const ownerId = await createOwner();
    const created = await createTenderDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Replace kitchen tiles" },
      { id: ownerId },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const dated = await updateTenderDraft(
      created.value.id,
      { desiredStartDate: new Date("2026-09-02T00:00:00.000Z") },
      { id: ownerId },
    );
    expect(dated).toMatchObject({
      ok: true,
      value: { desiredStartDate: new Date("2026-09-02T00:00:00.000Z") },
    });

    const cleared = await updateTenderDraft(
      created.value.id,
      { desiredStartDate: null },
      { id: ownerId },
    );
    expect(cleared).toMatchObject({
      ok: true,
      value: { desiredStartDate: null },
    });
  });

  // The mode has to survive the database round trip, not just the command:
  // it is what the authoring wizard reads to decide whether resuming this
  // draft submits an address or a pin on the next pass through step 3.
  it.each([
    [
      "ADDRESS",
      { mode: "ADDRESS", city: "Tbilisi", addressLine: "12 Rustaveli Avenue" },
      "12 Rustaveli Avenue",
    ],
    [
      "PIN",
      { mode: "PIN", city: "Tbilisi", latitude: 41.7333, longitude: 44.7912 },
      "Near Tbilisi, Georgia",
    ],
  ])(
    "reads back a %s location with the mode the client used",
    async (mode, command, addressLine) => {
      const ownerId = await createOwner();
      const created = await createTenderDraft(
        { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
        { id: ownerId },
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const located = await syncTenderLocation(created.value.id, command, {
        id: ownerId,
      });
      expect(located).toMatchObject({
        ok: true,
        value: { location: { mode, addressLine } },
      });

      const read = await getOwnedTender(created.value.id, { id: ownerId });
      expect(read).toMatchObject({
        ok: true,
        value: { location: { mode, addressLine } },
      });
    },
  );
});
