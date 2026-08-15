import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { cancelTender } from "./cancel-tender";
import { updateTenderDraft } from "./update-tender-draft";
import { publishTender } from "./publish-tender";
import { PrismaTenderRepository } from "../infrastructure/prisma-tender-repository";

const tenders = new PrismaTenderRepository();

async function seedOwner(): Promise<string> {
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

describe("publishTender", () => {
  it("rejects publication while required fields are missing", async () => {
    const ownerId = await seedOwner();
    const created = await tenders.createDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
      { id: ownerId },
      { tenderId: randomUUID() },
      new Date(),
    );
    if (!created.ok) throw new Error("seed failed");

    const result = await publishTender(created.value.id, { id: ownerId });
    expect(result.ok).toBe(false);
  });

  it("publishes a complete draft and then blocks in-place edits", async () => {
    const ownerId = await seedOwner();
    const created = await tenders.createDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
      { id: ownerId },
      { tenderId: randomUUID() },
      new Date(),
    );
    if (!created.ok) throw new Error("seed failed");
    const tenderId = created.value.id;

    await updateTenderDraft(
      tenderId,
      {
        shortDescription: "Interior repaint, two bedrooms",
        fullDescription: "Sand, prime, and repaint two bedrooms and a hallway.",
        scopeOfWork: "Sanding, priming, two coats of paint",
        budgetMinorUnits: 80_000,
        currency: "GEL",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      { id: ownerId },
    );
    await tenders.updateLocation(
      tenderId,
      {
        countryCode: "GE",
        city: "Tbilisi",
        district: null,
        addressLine: "1 Chavchavadze Ave",
        exact: { latitude: 41.7151, longitude: 44.8271 },
        public: { latitude: 41.72, longitude: 44.83 },
      },
      { id: ownerId },
    );

    const published = await publishTender(tenderId, { id: ownerId });
    expect(published.ok).toBe(true);

    const blockedEdit = await updateTenderDraft(
      tenderId,
      { title: "Retitled after publish" },
      { id: ownerId },
    );
    expect(blockedEdit).toEqual({ ok: false, error: "NOT_DRAFT" });
  });
});

describe("cancelTender", () => {
  it("cancels a published tender, rejects a second cancellation, and rejects a non-owner", async () => {
    const ownerId = await seedOwner();
    const otherId = await seedOwner();
    const created = await tenders.createDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
      { id: ownerId },
      { tenderId: randomUUID() },
      new Date(),
    );
    if (!created.ok) throw new Error("seed failed");
    const tenderId = created.value.id;

    await updateTenderDraft(
      tenderId,
      {
        shortDescription: "Interior repaint, two bedrooms",
        fullDescription: "Sand, prime, and repaint two bedrooms and a hallway.",
        scopeOfWork: "Sanding, priming, two coats of paint",
        budgetMinorUnits: 80_000,
        currency: "GEL",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      { id: ownerId },
    );
    await tenders.updateLocation(
      tenderId,
      {
        countryCode: "GE",
        city: "Tbilisi",
        district: null,
        addressLine: "1 Chavchavadze Ave",
        exact: { latitude: 41.7151, longitude: 44.8271 },
        public: { latitude: 41.72, longitude: 44.83 },
      },
      { id: ownerId },
    );

    const published = await publishTender(tenderId, { id: ownerId });
    expect(published.ok).toBe(true);

    const nonOwnerCancel = await cancelTender(
      tenderId,
      { reason: "Owner is unavailable" },
      { id: otherId },
    );
    expect(nonOwnerCancel).toEqual({ ok: false, error: "NOT_OWNER" });

    const cancelled = await cancelTender(
      tenderId,
      { reason: "Owner is unavailable" },
      { id: ownerId },
    );
    expect(cancelled).toMatchObject({
      ok: true,
      value: { id: tenderId, status: "CANCELLED" },
    });

    const secondCancel = await cancelTender(
      tenderId,
      { reason: "Owner is unavailable" },
      { id: ownerId },
    );
    expect(secondCancel).toEqual({ ok: false, error: "ALREADY_CANCELLED" });
  });
});
