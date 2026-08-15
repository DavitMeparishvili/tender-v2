import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { createSyncTenderLocation } from "../application/sync-tender-location";
import { GazetteerGeocoder } from "./gazetteer-geocoder";
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

  it("syncs the location for a known city and coarsens the public coordinates", async () => {
    const ownerId = await createOwner();
    const now = new Date();

    const created = await repository.createDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
      { id: ownerId },
      { tenderId: randomUUID() },
      now,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const syncTenderLocation = createSyncTenderLocation({
      repository,
      geocoder: new GazetteerGeocoder(),
    });

    const synced = await syncTenderLocation(
      created.value.id,
      {
        mode: "ADDRESS",
        city: "Tbilisi",
        addressLine: "1 Chavchavadze Ave",
      },
      { id: ownerId },
    );

    expect(synced.ok).toBe(true);
    if (!synced.ok) return;
    expect(synced.value.location).not.toBeNull();
    expect(synced.value.location?.public).not.toEqual(
      synced.value.location?.exact,
    );
  });

  it("returns ADDRESS_NOT_FOUND when syncing the location for an unknown city", async () => {
    const ownerId = await createOwner();
    const now = new Date();

    const created = await repository.createDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
      { id: ownerId },
      { tenderId: randomUUID() },
      now,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const syncTenderLocation = createSyncTenderLocation({
      repository,
      geocoder: new GazetteerGeocoder(),
    });

    const synced = await syncTenderLocation(
      created.value.id,
      {
        mode: "ADDRESS",
        city: "Nonexistentville",
        addressLine: "1 Main St",
      },
      { id: ownerId },
    );

    expect(synced).toEqual({ ok: false, error: "ADDRESS_NOT_FOUND" });
  });
});
