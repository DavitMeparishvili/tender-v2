import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { cancelTender } from "../../tenders/application/cancel-tender";
import { reviseBid } from "./revise-bid";
import { submitBid } from "./submit-bid";
import { withdrawBid } from "./withdraw-bid";

const CONDITIONS =
  "Materials and labour included; scaffolding excluded from this price.";

async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: "Party",
      email: `${id}@tender.test`,
      emailVerified: true,
    },
  });
  return id;
}

async function seedPublishedTender(
  ownerId: string,
  deadline: Date,
): Promise<string> {
  const id = randomUUID();
  await database.tender.create({
    data: {
      id,
      ownerId,
      status: "PUBLISHED",
      specialty: "CONSTRUCTION_REPAIR",
      title: "Repaint two rooms",
      shortDescription: "Interior repaint",
      fullDescription: "Sand, prime, and repaint two bedrooms.",
      scopeOfWork: "Sanding, priming, painting",
      budgetMinorUnits: 80_000,
      currency: "GEL",
      deadline,
      countryCode: "GE",
      locationMode: "ADDRESS",
      city: "Tbilisi",
      addressLine: "1 Chavchavadze Ave",
      exactLatitude: 41.7151,
      exactLongitude: 44.8271,
      publicLatitude: 41.72,
      publicLongitude: 44.83,
      publishedAt: new Date(),
    },
  });
  return id;
}

async function entitle(providerId: string, tenderId: string): Promise<void> {
  await database.accessEntitlement.create({
    data: {
      id: randomUUID(),
      providerId,
      kind: "SINGLE_TENDER",
      tenderId,
      grantedAt: new Date(Date.now() - 1_000),
      expiresAt: null,
    },
  });
}

const future = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

afterAll(async () => {
  await database.$disconnect();
});

describe("bid lifecycle", () => {
  it("refuses a bid from a provider with no entitlement", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());

    await expect(
      submitBid(
        tenderId,
        { amountMinorUnits: 70_000, conditions: CONDITIONS },
        { id: providerId },
      ),
    ).resolves.toEqual({ ok: false, error: "NOT_ENTITLED" });
  });

  it("accepts one bid per provider and refuses a second", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());
    await entitle(providerId, tenderId);

    const first = await submitBid(
      tenderId,
      { amountMinorUnits: 70_000, conditions: CONDITIONS },
      { id: providerId },
    );
    expect(first).toMatchObject({
      ok: true,
      value: { amountMinorUnits: 70_000, currency: "GEL", status: "SUBMITTED" },
    });

    await expect(
      submitBid(
        tenderId,
        { amountMinorUnits: 60_000, conditions: CONDITIONS },
        { id: providerId },
      ),
    ).resolves.toEqual({ ok: false, error: "BID_ALREADY_EXISTS" });
  });

  it("refuses a bid on the provider's own tender", async () => {
    const dualId = await seedUser();
    const tenderId = await seedPublishedTender(dualId, future());
    await entitle(dualId, tenderId);

    await expect(
      submitBid(
        tenderId,
        { amountMinorUnits: 10_000, conditions: CONDITIONS },
        { id: dualId },
      ),
    ).resolves.toEqual({ ok: false, error: "OWN_TENDER" });
  });

  it("rejects a conditions note that is not substantive", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());
    await entitle(providerId, tenderId);

    await expect(
      submitBid(
        tenderId,
        { amountMinorUnits: 70_000, conditions: "ok" },
        { id: providerId },
      ),
    ).resolves.toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("moves a revised bid to the back of the tie-break queue", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());
    await entitle(providerId, tenderId);

    const submitted = await submitBid(
      tenderId,
      { amountMinorUnits: 70_000, conditions: CONDITIONS },
      { id: providerId },
    );
    if (!submitted.ok) throw new Error("submit failed");

    const revised = await reviseBid(
      tenderId,
      { amountMinorUnits: 65_000, conditions: CONDITIONS },
      { id: providerId },
    );
    expect(revised).toMatchObject({
      ok: true,
      value: { amountMinorUnits: 65_000 },
    });
    if (!revised.ok) throw new Error("revise failed");
    expect(
      revised.value.qualifyingSubmittedAt.getTime(),
    ).toBeGreaterThanOrEqual(submitted.value.qualifyingSubmittedAt.getTime());
  });

  it("keeps a withdrawn bid's row and refuses to revise it", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());
    await entitle(providerId, tenderId);
    await submitBid(
      tenderId,
      { amountMinorUnits: 70_000, conditions: CONDITIONS },
      { id: providerId },
    );

    const withdrawn = await withdrawBid(tenderId, { id: providerId });
    expect(withdrawn).toMatchObject({
      ok: true,
      value: { status: "WITHDRAWN" },
    });

    await expect(
      reviseBid(
        tenderId,
        { amountMinorUnits: 1_000, conditions: CONDITIONS },
        { id: providerId },
      ),
    ).resolves.toEqual({ ok: false, error: "BID_NOT_ACTIVE" });
  });

  it("refuses every bid mutation once the deadline has passed", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());
    await entitle(providerId, tenderId);
    await submitBid(
      tenderId,
      { amountMinorUnits: 70_000, conditions: CONDITIONS },
      { id: providerId },
    );

    // The fixture-only write the seed script also uses: move the deadline
    // into the past without touching any application rule.
    await database.tender.update({
      where: { id: tenderId },
      data: { deadline: new Date(Date.now() - 1_000) },
    });

    const otherProviderId = await seedUser();
    await entitle(otherProviderId, tenderId);

    await expect(
      submitBid(
        tenderId,
        { amountMinorUnits: 1_000, conditions: CONDITIONS },
        { id: otherProviderId },
      ),
    ).resolves.toEqual({ ok: false, error: "DEADLINE_PASSED" });
    await expect(
      reviseBid(
        tenderId,
        { amountMinorUnits: 1_000, conditions: CONDITIONS },
        { id: providerId },
      ),
    ).resolves.toEqual({ ok: false, error: "DEADLINE_PASSED" });
    await expect(withdrawBid(tenderId, { id: providerId })).resolves.toEqual({
      ok: false,
      error: "DEADLINE_PASSED",
    });
  });

  it("refuses to cancel a tender that already has a bid", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());
    await entitle(providerId, tenderId);
    await submitBid(
      tenderId,
      { amountMinorUnits: 70_000, conditions: CONDITIONS },
      { id: providerId },
    );

    await expect(
      cancelTender(
        tenderId,
        { reason: "Changed my mind entirely" },
        { id: clientId },
      ),
    ).resolves.toEqual({ ok: false, error: "TENDER_HAS_BIDS" });

    // ...but a withdrawal releases the tender again.
    await withdrawBid(tenderId, { id: providerId });
    await expect(
      cancelTender(
        tenderId,
        { reason: "Changed my mind entirely" },
        { id: clientId },
      ),
    ).resolves.toMatchObject({ ok: true, value: { status: "CANCELLED" } });
  });
});
