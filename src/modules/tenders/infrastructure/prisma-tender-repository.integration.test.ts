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
      {
        specialty: "CONSTRUCTION_REPAIR",
        serviceCode: "GENERAL_CONSTRUCTION",
        title: "Repaint two rooms",
      },
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

    expect(await repository.isOwnedBy(created.value.id, ownerId)).toBe(true);
    expect(await repository.isOwnedBy(created.value.id, otherId)).toBe(false);
    expect(await repository.isOwnedBy(randomUUID(), ownerId)).toBe(false);
  });

  it("syncs the location for a known city and coarsens the public coordinates", async () => {
    const ownerId = await createOwner();
    const now = new Date();

    const created = await repository.createDraft(
      {
        specialty: "CONSTRUCTION_REPAIR",
        serviceCode: "GENERAL_CONSTRUCTION",
        title: "Repaint two rooms",
      },
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

  it("syncs the location for a PIN using the submitted coordinates as the exact location", async () => {
    const ownerId = await createOwner();
    const now = new Date();

    const created = await repository.createDraft(
      {
        specialty: "CONSTRUCTION_REPAIR",
        serviceCode: "GENERAL_CONSTRUCTION",
        title: "Repaint two rooms",
      },
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

    // Close to, but distinct from, the Tbilisi gazetteer entry
    // (41.7151, 44.8271) so `exact` can be checked against the submitted pin
    // rather than the reverse-geocoded city centre, and precise enough that
    // coarsening actually changes the value (so `public` can be checked
    // against the coarsened form rather than an accidental no-op round).
    const submittedPin = { latitude: 41.7333, longitude: 44.7912 };

    const synced = await syncTenderLocation(
      created.value.id,
      {
        mode: "PIN",
        city: "Tbilisi",
        latitude: submittedPin.latitude,
        longitude: submittedPin.longitude,
      },
      { id: ownerId },
    );

    expect(synced.ok).toBe(true);
    if (!synced.ok) return;
    expect(synced.value.location).not.toBeNull();
    expect(synced.value.location?.exact).toEqual(submittedPin);
    expect(synced.value.location?.exact).not.toEqual({
      latitude: 41.7151,
      longitude: 44.8271,
    });
    expect(synced.value.location?.public).toEqual({
      latitude: 41.73,
      longitude: 44.79,
    });
  });

  it("returns ADDRESS_NOT_FOUND when syncing the location for an unknown city", async () => {
    const ownerId = await createOwner();
    const now = new Date();

    const created = await repository.createDraft(
      {
        specialty: "CONSTRUCTION_REPAIR",
        serviceCode: "GENERAL_CONSTRUCTION",
        title: "Repaint two rooms",
      },
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

  it("persists an explicit null desired start date", async () => {
    const ownerId = await createOwner();
    const created = await repository.createDraft(
      {
        specialty: "CONSTRUCTION_REPAIR",
        serviceCode: "GENERAL_CONSTRUCTION",
        title: "Replace kitchen tiles",
      },
      { id: ownerId },
      { tenderId: randomUUID() },
      new Date(),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const dated = await repository.updateDraft(
      created.value.id,
      { desiredStartDate: new Date("2026-09-02T00:00:00.000Z") },
      { id: ownerId },
    );
    expect(dated).toMatchObject({
      ok: true,
      value: { desiredStartDate: new Date("2026-09-02T00:00:00.000Z") },
    });

    const cleared = await repository.updateDraft(
      created.value.id,
      { desiredStartDate: null },
      { id: ownerId },
    );
    expect(cleared).toMatchObject({
      ok: true,
      value: { desiredStartDate: null },
    });
    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: created.value.id },
        select: { desiredStartDate: true },
      }),
    ).resolves.toEqual({ desiredStartDate: null });
  });
});
