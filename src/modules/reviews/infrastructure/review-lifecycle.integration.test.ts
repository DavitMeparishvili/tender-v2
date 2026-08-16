import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { createPublishReview } from "../application/publish-review";
import { createRedactReview } from "../application/redact-review";
import { PrismaReviewRepository } from "./prisma-review-repository";

const ids = { next: () => randomUUID() };
const clock = { now: () => new Date("2026-08-16T10:00:00.000Z") };
const validReview = {
  quality: 5,
  deadline: 4,
  communication: 5,
  agreedPrice: 4,
  comment: "Careful work, clear updates, and the agreed price was kept.",
};

async function user(): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: "Review party",
      email: `${id}@tender.test`,
      emailVerified: true,
    },
  });
  return id;
}

async function completedAgreement(
  status: "COMPLETED" | "IN_PROGRESS" = "COMPLETED",
) {
  const clientId = await user();
  const providerId = await user();
  const tenderId = randomUUID();
  const bidId = randomUUID();
  const agreementId = randomUUID();
  await database.tender.create({
    data: {
      id: tenderId,
      ownerId: clientId,
      status: "CLOSED",
      specialty: "CONSTRUCTION_REPAIR",
      title: "Reviewable kitchen renovation",
    },
  });
  await database.bid.create({
    data: {
      id: bidId,
      tenderId,
      providerId,
      amountMinorUnits: 1000,
      currency: "GEL",
      status: "WINNER",
      conditions: "Clear winning terms for the review lifecycle test.",
      qualifyingSubmittedAt: clock.now(),
    },
  });
  await database.agreement.create({
    data: {
      id: agreementId,
      tenderId,
      clientId,
      providerId,
      bidId,
      status,
      amountMinorUnits: 1000,
      currency: "GEL",
      tenderTitle: "Reviewable kitchen renovation",
      snapshot: {},
      confirmDeadline: clock.now(),
      ...(status === "COMPLETED" ? { completedAt: clock.now() } : {}),
    },
  });
  return { agreementId, clientId, providerId };
}

const publish = createPublishReview({
  repository: new PrismaReviewRepository(),
  ids,
  clock,
});
const redact = createRedactReview({
  repository: new PrismaReviewRepository(),
  ids,
  clock,
});

describe("review lifecycle", () => {
  it("rejects incomplete agreements, outsiders, and invalid drafts", async () => {
    const incomplete = await completedAgreement("IN_PROGRESS");
    await expect(
      publish(incomplete.agreementId, validReview, { id: incomplete.clientId }),
    ).resolves.toEqual({ ok: false, error: "AGREEMENT_NOT_COMPLETED" });
    const completed = await completedAgreement();
    const outsiderId = await user();
    await expect(
      publish(completed.agreementId, validReview, { id: outsiderId }),
    ).resolves.toEqual({ ok: false, error: "NOT_PARTICIPANT" });
    await expect(
      publish(
        completed.agreementId,
        { ...validReview, quality: 6 },
        { id: completed.clientId },
      ),
    ).resolves.toEqual({ ok: false, error: "INVALID_REVIEW" });
  });

  it("publishes once per party, derives the recipient, and writes audit/outbox/inbox", async () => {
    const agreement = await completedAgreement();
    const first = await publish(agreement.agreementId, validReview, {
      id: agreement.clientId,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("expected published review");
    expect(first.value.reviewedId).toBe(agreement.providerId);
    await expect(
      publish(agreement.agreementId, validReview, { id: agreement.clientId }),
    ).resolves.toEqual({ ok: false, error: "REVIEW_ALREADY_EXISTS" });
    const reciprocal = await publish(agreement.agreementId, validReview, {
      id: agreement.providerId,
    });
    expect(reciprocal.ok).toBe(true);
    await expect(
      database.auditEvent.count({ where: { targetType: "Review" } }),
    ).resolves.toBeGreaterThanOrEqual(2);
    await expect(
      database.inboxNotification.count({
        where: { aggregateType: "Review", aggregateId: first.value.id },
      }),
    ).resolves.toBe(1);
  });

  it("keeps exactly one review when concurrent duplicate publication races", async () => {
    const agreement = await completedAgreement();
    const results = await Promise.all([
      publish(agreement.agreementId, validReview, { id: agreement.clientId }),
      publish(agreement.agreementId, validReview, { id: agreement.clientId }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    await expect(
      database.review.count({
        where: {
          agreementId: agreement.agreementId,
          reviewerId: agreement.clientId,
        },
      }),
    ).resolves.toBe(1);
  });

  it("redacts immutably and removes the review from public aggregates", async () => {
    const agreement = await completedAgreement();
    const published = await publish(agreement.agreementId, validReview, {
      id: agreement.clientId,
    });
    if (!published.ok) throw new Error("expected published review");
    const adminId = await user();
    const first = await redact(
      published.value.id,
      { reason: "Contains a private telephone number." },
      { id: adminId },
    );
    expect(first).toMatchObject({ ok: true, value: { changed: true } });
    const stored = await database.review.findUniqueOrThrow({
      where: { id: published.value.id },
    });
    expect(stored).toMatchObject({
      status: "REDACTED",
      comment: validReview.comment,
      quality: validReview.quality,
      redactedById: adminId,
      redactionReason: "Contains a private telephone number.",
    });
    await expect(
      new PrismaReviewRepository().getForProfile(agreement.providerId),
    ).resolves.toMatchObject({ aggregate: { reviewCount: 0 }, reviews: [] });
    const auditsBeforeRetry = await database.auditEvent.count({
      where: { action: "REVIEW_REDACTED", targetId: published.value.id },
    });
    await expect(
      redact(
        published.value.id,
        { reason: "Contains a private telephone number." },
        { id: adminId },
      ),
    ).resolves.toMatchObject({ ok: true, value: { changed: false } });
    await expect(
      database.auditEvent.count({
        where: { action: "REVIEW_REDACTED", targetId: published.value.id },
      }),
    ).resolves.toBe(auditsBeforeRetry);
  });
});

afterAll(async () => {
  await database.$disconnect();
});
