import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { PrismaTenderRepository } from "../infrastructure/prisma-tender-repository";
import { publishTender } from "./publish-tender";
import {
  MAX_PUBLISHED_TENDER_RESULTS,
  searchPublishedTenders,
} from "./search-published-tenders";
import { updateTenderDraft } from "./update-tender-draft";

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

// Creates and publishes a complete draft in `city` titled `title`, with a
// deadline 30 days out — the same shape `publish-tender.integration.test.ts`
// seeds, parameterised so each test can scope its own city and tell its
// tenders apart by title.
async function seedPublishedTender(
  ownerId: string,
  city: string,
  title: string,
): Promise<string> {
  const created = await tenders.createDraft(
    { specialty: "CONSTRUCTION_REPAIR", title },
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
      city,
      district: null,
      addressLine: "1 Chavchavadze Ave",
      exact: { latitude: 41.7151, longitude: 44.8271 },
      public: { latitude: 41.72, longitude: 44.83 },
    },
    { id: ownerId },
  );

  const published = await publishTender(tenderId, { id: ownerId });
  if (!published.ok) throw new Error("publish seed failed");
  return tenderId;
}

// Bulk-inserts already-PUBLISHED rows directly, bypassing the draft/publish
// workflow `seedPublishedTender` exercises one row at a time — the volume
// this test needs to prove a bound exists would make the full workflow slow
// for no added coverage, since the fields below are exactly what
// `toTenderRecord` requires to be non-null for a row to be readable.
async function seedManyPublishedTenders(
  ownerId: string,
  city: string,
  count: number,
): Promise<void> {
  const now = new Date();
  const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await database.tender.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      id: randomUUID(),
      ownerId,
      status: "PUBLISHED" as const,
      specialty: "CONSTRUCTION_REPAIR" as const,
      title: `Bounded discovery tender ${index}`,
      shortDescription: "Interior repaint, two bedrooms",
      fullDescription: "Sand, prime, and repaint two bedrooms and a hallway.",
      scopeOfWork: "Sanding, priming, two coats of paint",
      budgetMinorUnits: 80_000,
      currency: "GEL",
      city,
      addressLine: "1 Chavchavadze Ave",
      exactLatitude: 41.7151,
      exactLongitude: 44.8271,
      publicLatitude: 41.72,
      publicLongitude: 44.83,
      deadline,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    })),
  });
}

afterAll(async () => {
  await database.$disconnect();
});

describe("searchPublishedTenders", () => {
  it("excludes a published tender whose deadline has passed, while returning a comparable future-deadline tender in the same city", async () => {
    const ownerId = await seedOwner();
    // A per-test city keeps this assertion honest against other integration
    // tests (and other runs of this same test) writing PUBLISHED rows into
    // the shared database: without a unique scope, an empty result could
    // pass for the wrong reason.
    const city = `Test City ${randomUUID()}`;

    const futureId = await seedPublishedTender(
      ownerId,
      city,
      "Future-deadline tender",
    );
    const pastId = await seedPublishedTender(
      ownerId,
      city,
      "Past-deadline tender",
    );

    // `publishTender` correctly refuses to publish a tender whose deadline
    // has already passed, so the only way to get a PUBLISHED row with an
    // elapsed deadline is to back-date it directly after publication
    // succeeds.
    await database.tender.update({
      where: { id: pastId },
      data: { deadline: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const result = await searchPublishedTenders({ city });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.value.map((tender) => tender.title);
    expect(titles).toContain("Future-deadline tender");
    expect(titles).not.toContain("Past-deadline tender");
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.id).toBe(futureId);
  });

  it("rejects a query with an unrecognized specialty", async () => {
    const result = await searchPublishedTenders({ specialty: "PLUMBING" });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("keeps a budget range inside one currency instead of comparing minor units across them", async () => {
    const ownerId = await seedOwner();
    const city = `Currency City ${randomUUID()}`;
    await seedPublishedTender(ownerId, city, "GEL tender");
    const usdId = await seedPublishedTender(ownerId, city, "USD tender");
    // Same integer minor units, different currency: without a currency scope
    // both would satisfy the same numeric bound.
    await database.tender.update({
      where: { id: usdId },
      data: { currency: "USD" },
    });

    const gel = await searchPublishedTenders({
      city,
      currency: "GEL",
      minBudgetMinorUnits: 1,
    });
    const usd = await searchPublishedTenders({
      city,
      currency: "USD",
      minBudgetMinorUnits: 1,
    });

    expect(gel.ok).toBe(true);
    expect(usd.ok).toBe(true);
    if (!gel.ok || !usd.ok) return;
    expect(gel.value.map((tender) => tender.title)).toEqual(["GEL tender"]);
    expect(usd.value.map((tender) => tender.title)).toEqual(["USD tender"]);
  });

  it("matches a city regardless of the casing a provider types", async () => {
    const ownerId = await seedOwner();
    const city = `Kutaisi ${randomUUID()}`;
    await seedPublishedTender(ownerId, city, "Case-insensitive city tender");

    // The filter is a free-text field, so a provider typing the city in any
    // casing must reach the same tenders as the exact stored spelling.
    for (const typed of [city, city.toLowerCase(), city.toUpperCase()]) {
      const result = await searchPublishedTenders({ city: typed });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.map((tender) => tender.title)).toEqual([
        "Case-insensitive city tender",
      ]);
    }
  });

  it("bounds the discovery result set to the named maximum even when more tenders match", async () => {
    const ownerId = await seedOwner();
    const city = `Bounded City ${randomUUID()}`;
    await seedManyPublishedTenders(
      ownerId,
      city,
      MAX_PUBLISHED_TENDER_RESULTS + 5,
    );

    const result = await searchPublishedTenders({ city });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(MAX_PUBLISHED_TENDER_RESULTS);
  });

  it("matches a district regardless of the casing a provider types", async () => {
    const ownerId = await seedOwner();
    const city = `Rustavi ${randomUUID()}`;
    await seedPublishedTender(
      ownerId,
      city,
      "Case-insensitive district tender",
    );
    const district = "Vake";
    await database.tender.updateMany({ where: { city }, data: { district } });

    const result = await searchPublishedTenders({
      city,
      district: district.toLowerCase(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
  });
});
