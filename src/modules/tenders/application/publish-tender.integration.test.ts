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

// Creates a draft with every field `evaluateDraftForPublication` requires,
// so `publishTender` should accept it. Shared by every test below that
// needs a publishable (or just-published) tender, to avoid repeating the
// same four seeding calls in each test.
async function seedCompleteDraftId(ownerId: string): Promise<string> {
  const created = await tenders.createDraft(
    {
      specialty: "CONSTRUCTION_REPAIR",
      serviceCode: "GENERAL_CONSTRUCTION",
      title: "Repaint two rooms",
    },
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
      mode: "ADDRESS",
      city: "Tbilisi",
      district: null,
      addressLine: "1 Chavchavadze Ave",
      exact: { latitude: 41.7151, longitude: 44.8271 },
      public: { latitude: 41.72, longitude: 44.83 },
    },
    { id: ownerId },
  );

  return tenderId;
}

async function seedPublishedTenderId(ownerId: string): Promise<string> {
  const tenderId = await seedCompleteDraftId(ownerId);
  const published = await publishTender(tenderId, { id: ownerId });
  if (!published.ok) throw new Error("publish seed failed");
  return tenderId;
}

afterAll(async () => {
  await database.$disconnect();
});

describe("publishTender", () => {
  it("rejects publication while required fields are missing", async () => {
    const ownerId = await seedOwner();
    const created = await tenders.createDraft(
      {
        specialty: "CONSTRUCTION_REPAIR",
        serviceCode: "GENERAL_CONSTRUCTION",
        title: "Repaint two rooms",
      },
      { id: ownerId },
      { tenderId: randomUUID() },
      new Date(),
    );
    if (!created.ok) throw new Error("seed failed");

    // The seed only sets `specialty` and `title`, so the domain policy's
    // next check — the first missing field — must be the one reported.
    // Asserting only `result.ok === false` would pass identically if
    // rejection came from an unrelated bug (e.g. `getOwned` misfiring or
    // ownership being mis-wired), so the exact reason is pinned down here.
    const result = await publishTender(created.value.id, { id: ownerId });
    expect(result).toEqual({
      ok: false,
      error: "SHORT_DESCRIPTION_REQUIRED",
    });
  });

  it("publishes a complete draft and then blocks in-place edits", async () => {
    const ownerId = await seedOwner();
    const tenderId = await seedCompleteDraftId(ownerId);

    const published = await publishTender(tenderId, { id: ownerId });
    expect(published.ok).toBe(true);

    const blockedEdit = await updateTenderDraft(
      tenderId,
      { title: "Retitled after publish" },
      { id: ownerId },
    );
    expect(blockedEdit).toEqual({ ok: false, error: "NOT_DRAFT" });
  });

  it("rejects the atomic write when the deadline elapses before the transition", async () => {
    // Simulates the exact race the atomic `where` clause guards against:
    // `evaluateDraftForPublication` passed (the deadline was future at
    // evaluation time), but by the time the write runs the deadline has
    // moved into the past — here modelled by calling the repository's
    // `publish` directly with a `now` well past the seeded deadline, rather
    // than the `now` `evaluateDraftForPublication` would have seen.
    const ownerId = await seedOwner();
    const tenderId = await seedCompleteDraftId(ownerId);
    const wayPastDeadline = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);

    const result = await tenders.publish(
      tenderId,
      { id: ownerId },
      wayPastDeadline,
    );

    expect(result).toEqual({ ok: false, error: "DEADLINE_NOT_FUTURE" });

    // The row must not have been left half-transitioned: it is still a
    // DRAFT, so a caller can retry (or the client can be told the deadline
    // needs extending) rather than the tender silently ending up PUBLISHED
    // past its own deadline.
    const stillDraft = await tenders.getOwned(tenderId, { id: ownerId });
    expect(stillDraft).toMatchObject({ ok: true, value: { status: "DRAFT" } });
  });
});

describe("cancelTender", () => {
  it("rejects cancellation from a non-owner", async () => {
    const ownerId = await seedOwner();
    const otherId = await seedOwner();
    const tenderId = await seedPublishedTenderId(ownerId);

    const nonOwnerCancel = await cancelTender(
      tenderId,
      { reason: "Owner is unavailable" },
      { id: otherId },
    );
    expect(nonOwnerCancel).toEqual({ ok: false, error: "NOT_OWNER" });
  });

  it("cancels a published tender and rejects a second cancellation", async () => {
    const ownerId = await seedOwner();
    const tenderId = await seedPublishedTenderId(ownerId);

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

  it("cancels a tender that is still a draft", async () => {
    const ownerId = await seedOwner();
    const tenderId = await seedCompleteDraftId(ownerId);

    const cancelled = await cancelTender(
      tenderId,
      { reason: "Requirements changed" },
      { id: ownerId },
    );

    expect(cancelled).toMatchObject({
      ok: true,
      value: {
        id: tenderId,
        status: "CANCELLED",
        cancelReason: "Requirements changed",
      },
    });
  });
});
