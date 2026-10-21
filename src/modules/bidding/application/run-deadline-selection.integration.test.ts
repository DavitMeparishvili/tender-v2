import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { SELECTION_WINDOW_DAYS } from "../domain/selection";
import {
  runDeadlineSelection,
  runDueSelections,
} from "./run-deadline-selection";

const CONDITIONS =
  "Materials and labour included; scaffolding excluded from this price.";
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = SELECTION_WINDOW_DAYS;

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

async function seedDueTender(
  ownerId: string,
  deadline = new Date(Date.now() - 60_000),
): Promise<string> {
  const id = randomUUID();
  await database.tender.create({
    data: {
      id,
      ownerId,
      status: "PUBLISHED",
      specialty: "CONSTRUCTION_REPAIR",
      serviceCode: "GENERAL_CONSTRUCTION",
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
      publishedAt: new Date(deadline.getTime() - 120_000),
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

const tenderState = (id: string) =>
  database.tender.findUniqueOrThrow({
    where: { id },
    select: { status: true, selectionExpiresAt: true, deadline: true },
  });

afterAll(async () => {
  await database.$disconnect();
});

describe("runDeadlineSelection", () => {
  it("never picks a winner: a due tender with offers awaits the client's choice", async () => {
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
        outcome: "AWAITING_SELECTION",
        winningBidId: null,
        agreementId: null,
        alreadyRan: false,
      },
    });
    const tender = await tenderState(tenderId);
    expect(tender.status).toBe("AWAITING_SELECTION");
    // Deadline + N days.
    expect(tender.selectionExpiresAt?.getTime()).toBe(
      tender.deadline!.getTime() + WINDOW_DAYS * DAY_MS,
    );
    // Every offer is still standing; none won, none lost.
    await expect(
      database.bid.findMany({
        where: { id: { in: [expensive, cheapest] } },
        select: { status: true },
      }),
    ).resolves.toEqual([{ status: "SUBMITTED" }, { status: "SUBMITTED" }]);
    await expect(
      database.agreement.count({ where: { tenderId } }),
    ).resolves.toBe(0);
    // The client is told to choose.
    await expect(
      database.inboxNotification.findMany({
        where: { aggregateId: tenderId },
        select: { recipientId: true, messageKey: true },
      }),
    ).resolves.toEqual([
      {
        recipientId: clientId,
        messageKey: "notifications.tenderAwaitingSelection",
      },
    ]);
  });

  it("ignores withdrawn and wrong-currency bids when deciding there is a choice", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    await seedBid(tenderId, 1_000, new Date(Date.now() - 400_000), {
      status: "WITHDRAWN",
    });
    await seedBid(tenderId, 2_000, new Date(Date.now() - 400_000), {
      currency: "USD",
    });

    const result = await runDeadlineSelection(tenderId);

    expect(result).toMatchObject({
      ok: true,
      value: { outcome: "EXPIRED_NO_BIDS" },
    });
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
    await expect(tenderState(tenderId)).resolves.toMatchObject({
      status: "EXPIRED",
    });
    await expect(
      database.agreement.count({ where: { tenderId } }),
    ).resolves.toBe(0);
  });

  it("refuses to run before the deadline", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(
      clientId,
      new Date(Date.now() + 60_000),
    );

    await expect(runDeadlineSelection(tenderId)).resolves.toEqual({
      ok: false,
      error: "NOT_DUE",
    });
  });

  it("expires the tender when the selection window ends without a choice", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    const first = await seedBid(
      tenderId,
      40_000,
      new Date(Date.now() - 300_000),
    );
    const second = await seedBid(
      tenderId,
      50_000,
      new Date(Date.now() - 200_000),
    );
    await runDeadlineSelection(tenderId);

    // One day short of the window: still waiting, nothing changes.
    const early = await runDeadlineSelection(tenderId, {
      now: () => new Date(Date.now() + (WINDOW_DAYS - 1) * DAY_MS),
    });
    expect(early).toMatchObject({
      ok: true,
      value: { outcome: "AWAITING_SELECTION", alreadyRan: true },
    });
    await expect(tenderState(tenderId)).resolves.toMatchObject({
      status: "AWAITING_SELECTION",
    });

    const late = await runDeadlineSelection(tenderId, {
      now: () => new Date(Date.now() + (WINDOW_DAYS + 1) * DAY_MS),
    });
    expect(late).toMatchObject({
      ok: true,
      value: { outcome: "SELECTION_EXPIRED", alreadyRan: false },
    });
    await expect(tenderState(tenderId)).resolves.toMatchObject({
      status: "EXPIRED",
      selectionExpiresAt: null,
    });
    await expect(
      database.bid.count({
        where: { id: { in: [first, second] }, status: "LOST" },
      }),
    ).resolves.toBe(2);
    await expect(
      database.agreement.count({ where: { tenderId } }),
    ).resolves.toBe(0);
    // The client and both bidders hear about it.
    const keys = (
      await database.inboxNotification.findMany({
        where: { aggregateId: tenderId },
        select: { messageKey: true },
      })
    ).map((row) => row.messageKey);
    expect(keys.filter((key) => key === "notifications.bidLost")).toHaveLength(
      2,
    );
    expect(keys).toContain("notifications.tenderSelectionExpired");
  });

  it("gives a full window from the sweep when it arrives after deadline + N", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(
      clientId,
      new Date(Date.now() - (WINDOW_DAYS + 2) * DAY_MS),
    );
    await seedBid(
      tenderId,
      40_000,
      new Date(Date.now() - (WINDOW_DAYS + 3) * DAY_MS),
    );

    await expect(runDeadlineSelection(tenderId)).resolves.toMatchObject({
      ok: true,
      value: { outcome: "AWAITING_SELECTION" },
    });
    // Never an instant expiry: now + N days.
    const state = await tenderState(tenderId);
    expect(state.status).toBe("AWAITING_SELECTION");
    expect(state.selectionExpiresAt!.getTime()).toBeGreaterThan(
      Date.now() + (WINDOW_DAYS - 1) * DAY_MS,
    );
  });

  it("moves into selection exactly once under concurrency", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    await seedBid(tenderId, 30_000, new Date(Date.now() - 400_000));
    await seedBid(tenderId, 60_000, new Date(Date.now() - 300_000));

    // Eight sweeps racing on the same tender, exactly as several worker
    // invocations overlapping in production would.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => runDeadlineSelection(tenderId)),
    );

    for (const result of results) {
      expect(result).toMatchObject({
        ok: true,
        value: { outcome: "AWAITING_SELECTION" },
      });
    }
    expect(
      results.filter((result) => result.ok && !result.value.alreadyRan),
    ).toHaveLength(1);
    await expect(
      database.bid.count({ where: { tenderId, status: { not: "SUBMITTED" } } }),
    ).resolves.toBe(0);
    await expect(
      database.inboxNotification.count({
        where: { aggregateType: "Tender", aggregateId: tenderId },
      }),
    ).resolves.toBe(1);
    await expect(
      database.auditEvent.count({
        where: { targetId: tenderId, action: "TENDER_AWAITING_SELECTION" },
      }),
    ).resolves.toBe(1);
  });
});

describe("runDueSelections", () => {
  it("handles every due tender and leaves future ones alone", async () => {
    const clientId = await seedUser();
    const dueTender = await seedDueTender(clientId);
    await seedBid(dueTender, 25_000, new Date(Date.now() - 400_000));
    const futureTender = await seedDueTender(
      clientId,
      new Date(Date.now() + DAY_MS),
    );

    const results = await runDueSelections();

    expect(
      results.find((result) => result.tenderId === dueTender),
    ).toMatchObject({ outcome: "AWAITING_SELECTION" });
    expect(results.some((result) => result.tenderId === futureTender)).toBe(
      false,
    );
    await expect(tenderState(futureTender)).resolves.toMatchObject({
      status: "PUBLISHED",
    });
  });

  it("drives the selection-window expiry from the same sweep", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    await seedBid(tenderId, 25_000, new Date(Date.now() - 400_000));
    await runDeadlineSelection(tenderId);
    // The window has run out.
    await database.tender.update({
      where: { id: tenderId },
      data: { selectionExpiresAt: new Date(Date.now() - 1_000) },
    });

    const results = await runDueSelections(500);

    expect(
      results.find((result) => result.tenderId === tenderId),
    ).toMatchObject({ outcome: "SELECTION_EXPIRED" });
    await expect(tenderState(tenderId)).resolves.toMatchObject({
      status: "EXPIRED",
    });
  });
});
