import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import {
  runDeadlineSelection,
  runDueSelections,
} from "./run-deadline-selection";

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

async function seedDueTender(ownerId: string): Promise<string> {
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
      // Already due: the deadline is in the past.
      deadline: new Date(Date.now() - 60_000),
      countryCode: "GE",
      locationMode: "ADDRESS",
      city: "Tbilisi",
      addressLine: "1 Chavchavadze Ave",
      exactLatitude: 41.7151,
      exactLongitude: 44.8271,
      publicLatitude: 41.72,
      publicLongitude: 44.83,
      publishedAt: new Date(Date.now() - 120_000),
    },
  });
  return id;
}

async function seedBid(
  tenderId: string,
  amountMinorUnits: number,
  submittedAt: Date,
  overrides: Partial<{
    currency: string;
    status: "SUBMITTED" | "WITHDRAWN";
  }> = {},
): Promise<string> {
  const providerId = await seedUser();
  const id = randomUUID();
  await database.bid.create({
    data: {
      id,
      tenderId,
      providerId,
      amountMinorUnits,
      currency: overrides.currency ?? "GEL",
      status: overrides.status ?? "SUBMITTED",
      conditions: CONDITIONS,
      qualifyingSubmittedAt: submittedAt,
      withdrawnAt: overrides.status === "WITHDRAWN" ? new Date() : null,
    },
  });
  return id;
}

afterAll(async () => {
  await database.$disconnect();
});

describe("runDeadlineSelection", () => {
  it("selects the lowest eligible bid and closes the tender", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    const expensive = await seedBid(
      tenderId,
      90_000,
      new Date(Date.now() - 300_000),
    );
    const cheapest = await seedBid(
      tenderId,
      40_000,
      new Date(Date.now() - 200_000),
    );

    const result = await runDeadlineSelection(tenderId);

    expect(result).toMatchObject({
      ok: true,
      value: {
        outcome: "WINNER_SELECTED",
        winningBidId: cheapest,
        alreadyRan: false,
      },
    });
    await expect(
      database.bid.findUniqueOrThrow({
        where: { id: cheapest },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "WINNER" });
    await expect(
      database.bid.findUniqueOrThrow({
        where: { id: expensive },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "LOST" });
    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: tenderId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "CLOSED" });
  });

  it("breaks an equal amount by the earliest qualifying submission", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    const early = await seedBid(
      tenderId,
      50_000,
      new Date(Date.now() - 400_000),
    );
    await seedBid(tenderId, 50_000, new Date(Date.now() - 200_000));

    const result = await runDeadlineSelection(tenderId);
    expect(result).toMatchObject({ ok: true, value: { winningBidId: early } });
  });

  it("ignores withdrawn and wrong-currency bids", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    await seedBid(tenderId, 1_000, new Date(Date.now() - 400_000), {
      status: "WITHDRAWN",
    });
    await seedBid(tenderId, 2_000, new Date(Date.now() - 400_000), {
      currency: "USD",
    });
    const onlyEligible = await seedBid(
      tenderId,
      70_000,
      new Date(Date.now() - 300_000),
    );

    const result = await runDeadlineSelection(tenderId);
    expect(result).toMatchObject({
      ok: true,
      value: { winningBidId: onlyEligible },
    });
  });

  it("creates exactly one pending agreement snapshot of the winning offer", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    const winnerBid = await seedBid(
      tenderId,
      40_000,
      new Date(Date.now() - 200_000),
    );

    const result = await runDeadlineSelection(tenderId);
    if (!result.ok || result.value.agreementId === null) {
      throw new Error("expected an agreement");
    }

    const agreement = await database.agreement.findUniqueOrThrow({
      where: { id: result.value.agreementId },
    });
    expect(agreement).toMatchObject({
      tenderId,
      clientId,
      bidId: winnerBid,
      status: "PENDING_CONFIRMATION",
      amountMinorUnits: 40_000,
      currency: "GEL",
    });
    // 48 hours, to the minute.
    expect(
      agreement.confirmDeadline.getTime() - agreement.createdAt.getTime(),
    ).toBeGreaterThan(47 * 60 * 60 * 1000);
  });

  it("expires a due tender that received no eligible bid", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);

    const result = await runDeadlineSelection(tenderId);

    expect(result).toMatchObject({
      ok: true,
      value: {
        outcome: "EXPIRED_NO_BIDS",
        winningBidId: null,
        agreementId: null,
      },
    });
    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: tenderId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "EXPIRED" });
    await expect(
      database.agreement.count({ where: { tenderId } }),
    ).resolves.toBe(0);
  });

  it("refuses to run before the deadline", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    await database.tender.update({
      where: { id: tenderId },
      data: { deadline: new Date(Date.now() + 60_000) },
    });

    await expect(runDeadlineSelection(tenderId)).resolves.toEqual({
      ok: false,
      error: "NOT_DUE",
    });
  });

  it("produces one winner, one agreement, and one outbox set under concurrency", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    const cheapest = await seedBid(
      tenderId,
      30_000,
      new Date(Date.now() - 400_000),
    );
    await seedBid(tenderId, 60_000, new Date(Date.now() - 300_000));
    await seedBid(tenderId, 90_000, new Date(Date.now() - 200_000));

    // Eight selectors racing on the same tender, exactly as several worker
    // invocations overlapping in production would.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => runDeadlineSelection(tenderId)),
    );

    for (const result of results) {
      expect(result).toMatchObject({
        ok: true,
        value: { outcome: "WINNER_SELECTED", winningBidId: cheapest },
      });
    }
    await expect(
      database.tenderSelection.count({ where: { tenderId } }),
    ).resolves.toBe(1);
    await expect(
      database.bid.count({ where: { tenderId, status: "WINNER" } }),
    ).resolves.toBe(1);
    await expect(
      database.agreement.count({ where: { tenderId } }),
    ).resolves.toBe(1);
    await expect(
      database.outboxMessage.count({
        where: { aggregateId: tenderId, topic: "BID_WON" },
      }),
    ).resolves.toBe(1);
    await expect(
      database.auditEvent.count({
        where: { targetId: tenderId, action: "TENDER_WINNER_SELECTED" },
      }),
    ).resolves.toBe(1);
  });

  it("re-running returns the existing result with no new side effects", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    await seedBid(tenderId, 30_000, new Date(Date.now() - 400_000));

    const first = await runDeadlineSelection(tenderId);
    const outboxAfterFirst = await database.outboxMessage.count({
      where: { aggregateId: tenderId },
    });

    const second = await runDeadlineSelection(tenderId);

    expect(second).toMatchObject({ ok: true, value: { alreadyRan: true } });
    if (!first.ok || !second.ok) throw new Error("expected both to succeed");
    expect(second.value.winningBidId).toBe(first.value.winningBidId);
    expect(second.value.agreementId).toBe(first.value.agreementId);
    await expect(
      database.outboxMessage.count({ where: { aggregateId: tenderId } }),
    ).resolves.toBe(outboxAfterFirst);
  });
});

describe("runDueSelections", () => {
  it("settles every due tender and leaves future ones alone", async () => {
    const clientId = await seedUser();
    const dueTender = await seedDueTender(clientId);
    await seedBid(dueTender, 25_000, new Date(Date.now() - 400_000));
    const futureTender = await seedDueTender(clientId);
    await database.tender.update({
      where: { id: futureTender },
      data: { deadline: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });

    const results = await runDueSelections();

    expect(results.some((result) => result.tenderId === dueTender)).toBe(true);
    expect(results.some((result) => result.tenderId === futureTender)).toBe(
      false,
    );
    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: futureTender },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "PUBLISHED" });
  });
});
