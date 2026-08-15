import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { PrismaTenderRepository } from "../infrastructure/prisma-tender-repository";
import { publishTender } from "./publish-tender";
import { searchPublishedTenders } from "./search-published-tenders";
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
});
