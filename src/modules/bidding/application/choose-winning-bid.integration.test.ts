import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { createExpireDueAgreements } from "../../agreements/application/expire-agreements";
import { createManageAgreement } from "../../agreements/application/manage-agreement";
import { prismaAgreementGateway } from "../../agreements/infrastructure/prisma-agreement-gateway";
import { prismaBidRepository } from "../infrastructure/prisma-bid-repository";
import { chooseWinningBid } from "./choose-winning-bid";
import { runDeadlineSelection } from "./run-deadline-selection";

const CONDITIONS =
  "Materials and labour included; scaffolding excluded from this price.";
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;
const DECLINE_REASON = "The schedule no longer works for our household.";

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

async function seedTender(ownerId: string, deadline: Date): Promise<string> {
  const id = randomUUID();
  await database.tender.create({
    data: {
      id,
      ownerId,
      status: "PUBLISHED",
      specialty: "CONSTRUCTION_REPAIR",
      serviceCode: "GENERAL_CONSTRUCTION",
      title: "Retile a bathroom",
      shortDescription: "Bathroom retiling",
      fullDescription: "Remove old tiles and retile walls and floor.",
      scopeOfWork: "Demolition, waterproofing, tiling",
      budgetMinorUnits: 120_000,
      currency: "GEL",
      deadline,
      countryCode: "GE",
      locationMode: "ADDRESS",
      city: "Tbilisi",
      addressLine: "5 Rustaveli Ave",
      exactLatitude: 41.7,
      exactLongitude: 44.8,
      publicLatitude: 41.71,
      publicLongitude: 44.81,
      publishedAt: new Date(Date.now() - 5 * DAY_MS),
    },
  });
  return id;
}

type SeededBid = Readonly<{ id: string; providerId: string }>;

async function seedBid(
  tenderId: string,
  amountMinorUnits: number,
  overrides: Partial<{
    status: "SUBMITTED" | "WITHDRAWN";
    currency: string;
  }> = {},
): Promise<SeededBid> {
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
      qualifyingSubmittedAt: new Date(Date.now() - 2 * DAY_MS),
      withdrawnAt: overrides.status === "WITHDRAWN" ? new Date() : null,
    },
  });
  return { id, providerId };
}

const PAST_DEADLINE = () => new Date(Date.now() - 60_000);

// A client, a tender (by default still open: deadline tomorrow) and three
// offers.
async function seedOpenTender(deadline = new Date(Date.now() + DAY_MS)) {
  const clientId = await seedUser();
  const tenderId = await seedTender(clientId, deadline);
  const cheap = await seedBid(tenderId, 50_000);
  const middle = await seedBid(tenderId, 70_000);
  const dear = await seedBid(tenderId, 90_000);
  return { clientId, tenderId, cheap, middle, dear };
}

const manage = createManageAgreement({
  repository: prismaAgreementGateway,
  now: () => new Date(),
  ids: { next: () => randomUUID() },
  selectionWindowDays: WINDOW_DAYS,
});

const bidStatus = async (id: string) =>
  (
    await database.bid.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    })
  ).status;

const tender = (id: string) =>
  database.tender.findUniqueOrThrow({
    where: { id },
    select: { status: true, selectionExpiresAt: true },
  });

afterAll(async () => {
  await database.$disconnect();
});

describe("chooseWinningBid", () => {
  it("lets the client choose any offer before the deadline, closing the tender", async () => {
    const { clientId, tenderId, cheap, middle, dear } = await seedOpenTender();

    // Deliberately NOT the lowest price.
    const result = await chooseWinningBid(tenderId, middle.id, {
      id: clientId,
    });

    expect(result).toMatchObject({
      ok: true,
      value: { winningBidId: middle.id, alreadyChosen: false },
    });
    if (!result.ok) throw new Error("expected a choice");
    await expect(tender(tenderId)).resolves.toMatchObject({
      status: "CLOSED",
    });
    expect(await bidStatus(middle.id)).toBe("WINNER");
    // The others stay on standby until the agreement is agreed.
    expect(await bidStatus(cheap.id)).toBe("SUBMITTED");
    expect(await bidStatus(dear.id)).toBe("SUBMITTED");
    await expect(
      database.agreement.findUniqueOrThrow({
        where: { id: result.value.agreementId },
        select: {
          status: true,
          bidId: true,
          providerId: true,
          amountMinorUnits: true,
        },
      }),
    ).resolves.toEqual({
      status: "PENDING_CONFIRMATION",
      bidId: middle.id,
      providerId: middle.providerId,
      amountMinorUnits: 70_000,
    });
    // The audit row records the client as the actor.
    await expect(
      database.auditEvent.findFirstOrThrow({
        where: { targetId: tenderId, action: "TENDER_WINNER_SELECTED" },
        select: { actorId: true },
      }),
    ).resolves.toEqual({ actorId: clientId });
    // Client and chosen contractor are notified; nobody else yet.
    const inbox = await database.inboxNotification.findMany({
      where: { aggregateType: "Tender", aggregateId: tenderId },
      select: { recipientId: true, messageKey: true },
    });
    expect(inbox).toHaveLength(2);
    expect(inbox).toEqual(
      expect.arrayContaining([
        {
          recipientId: clientId,
          messageKey: "notifications.tenderWinnerSelected",
        },
        { recipientId: middle.providerId, messageKey: "notifications.bidWon" },
      ]),
    );
  });

  it("lets the client choose after the sweep moved the tender into selection", async () => {
    const clientId = await seedUser();
    const tenderId = await seedTender(clientId, new Date(Date.now() - 60_000));
    const only = await seedBid(tenderId, 60_000);
    await runDeadlineSelection(tenderId);
    await expect(tender(tenderId)).resolves.toMatchObject({
      status: "AWAITING_SELECTION",
    });

    const result = await chooseWinningBid(tenderId, only.id, { id: clientId });

    expect(result).toMatchObject({
      ok: true,
      value: { winningBidId: only.id },
    });
    await expect(tender(tenderId)).resolves.toEqual({
      status: "CLOSED",
      selectionExpiresAt: null,
    });
  });

  it("refuses a choice once the selection window has passed", async () => {
    const clientId = await seedUser();
    const tenderId = await seedTender(clientId, new Date(Date.now() - 60_000));
    const only = await seedBid(tenderId, 60_000);
    await runDeadlineSelection(tenderId);

    const result = await chooseWinningBid(
      tenderId,
      only.id,
      { id: clientId },
      { now: () => new Date(Date.now() + (WINDOW_DAYS + 1) * DAY_MS) },
    );

    expect(result).toEqual({ ok: false, error: "TENDER_NOT_SELECTABLE" });
    expect(await bidStatus(only.id)).toBe("SUBMITTED");
  });

  it("refuses anyone but the tender's owner", async () => {
    const { tenderId, cheap } = await seedOpenTender();
    const stranger = await seedUser();

    await expect(
      chooseWinningBid(tenderId, cheap.id, { id: stranger }),
    ).resolves.toEqual({ ok: false, error: "NOT_OWNER" });
    // Not even the bidder can choose itself.
    await expect(
      chooseWinningBid(tenderId, cheap.id, { id: cheap.providerId }),
    ).resolves.toEqual({ ok: false, error: "NOT_OWNER" });
    await expect(tender(tenderId)).resolves.toMatchObject({
      status: "PUBLISHED",
    });
  });

  it("refuses withdrawn, ineligible, and foreign offers", async () => {
    const { clientId, tenderId } = await seedOpenTender();
    const withdrawn = await seedBid(tenderId, 10_000, { status: "WITHDRAWN" });
    const wrongCurrency = await seedBid(tenderId, 10_000, { currency: "USD" });
    const other = await seedOpenTender();

    await expect(
      chooseWinningBid(tenderId, withdrawn.id, { id: clientId }),
    ).resolves.toEqual({ ok: false, error: "BID_NOT_SELECTABLE" });
    await expect(
      chooseWinningBid(tenderId, wrongCurrency.id, { id: clientId }),
    ).resolves.toEqual({ ok: false, error: "BID_NOT_SELECTABLE" });
    await expect(
      chooseWinningBid(tenderId, other.cheap.id, { id: clientId }),
    ).resolves.toEqual({ ok: false, error: "BID_NOT_FOUND" });
    await expect(tender(tenderId)).resolves.toMatchObject({
      status: "PUBLISHED",
    });
  });

  it("produces a single winner when choices race each other and the sweep", async () => {
    const clientId = await seedUser();
    const tenderId = await seedTender(clientId, new Date(Date.now() - 60_000));
    const bids = await Promise.all(
      [40_000, 50_000, 60_000].map((amount) => seedBid(tenderId, amount)),
    );

    // Double submits of one offer, competing choices of the others, and
    // deadline sweeps, all at once.
    const [choices] = await Promise.all([
      Promise.all([
        chooseWinningBid(tenderId, bids[0]!.id, { id: clientId }),
        chooseWinningBid(tenderId, bids[0]!.id, { id: clientId }),
        chooseWinningBid(tenderId, bids[1]!.id, { id: clientId }),
        chooseWinningBid(tenderId, bids[2]!.id, { id: clientId }),
      ]),
      runDeadlineSelection(tenderId),
      runDeadlineSelection(tenderId),
    ]);

    const winners = new Set(
      choices.flatMap((result) =>
        result.ok ? [result.value.winningBidId] : [],
      ),
    );
    expect(winners.size).toBe(1);
    for (const result of choices) {
      if (!result.ok) expect(result.error).toBe("TENDER_NOT_SELECTABLE");
    }
    await expect(
      database.bid.count({ where: { tenderId, status: "WINNER" } }),
    ).resolves.toBe(1);
    await expect(
      database.agreement.count({ where: { tenderId } }),
    ).resolves.toBe(1);
    await expect(
      database.tenderSelection.count({
        where: { tenderId, outcome: "WINNER_SELECTED" },
      }),
    ).resolves.toBe(1);
    await expect(
      database.outboxMessage.count({
        where: { aggregateId: tenderId, topic: "BID_WON" },
      }),
    ).resolves.toBe(1);
    await expect(tender(tenderId)).resolves.toMatchObject({
      status: "CLOSED",
    });
  });

  it("answers a repeated choice of the same offer with the original result", async () => {
    const { clientId, tenderId, cheap, dear } = await seedOpenTender();
    const first = await chooseWinningBid(tenderId, cheap.id, { id: clientId });
    const again = await chooseWinningBid(tenderId, cheap.id, { id: clientId });
    const other = await chooseWinningBid(tenderId, dear.id, { id: clientId });

    if (!first.ok) throw new Error("expected a choice");
    expect(again).toEqual({
      ok: true,
      value: { ...first.value, alreadyChosen: true },
    });
    expect(other).toEqual({ ok: false, error: "TENDER_NOT_SELECTABLE" });
  });
});

describe("choosing while a provider changes the same offer", () => {
  const revision = {
    amountMinorUnits: 99_000,
    conditions: CONDITIONS,
  };

  it("records the revised terms when a revision commits while the choice waits", async () => {
    const { clientId, tenderId, cheap } = await seedOpenTender();

    // A revision holds the bid row (uncommitted) while the client chooses.
    let choice: ReturnType<typeof chooseWinningBid> | undefined;
    await database.$transaction(async (transaction) => {
      await transaction.bid.update({
        where: { id: cheap.id },
        data: {
          amountMinorUnits: revision.amountMinorUnits,
          qualifyingSubmittedAt: new Date(),
        },
      });
      choice = chooseWinningBid(tenderId, cheap.id, { id: clientId });
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    const result = await choice!;

    if (!result.ok) throw new Error("expected a choice");
    const [bid, agreement] = await Promise.all([
      database.bid.findUniqueOrThrow({ where: { id: cheap.id } }),
      database.agreement.findUniqueOrThrow({
        where: { id: result.value.agreementId },
      }),
    ]);
    // The agreement records exactly the terms of the WINNER row.
    expect(bid.status).toBe("WINNER");
    expect(bid.amountMinorUnits).toBe(revision.amountMinorUnits);
    expect(agreement.amountMinorUnits).toBe(revision.amountMinorUnits);
  });

  it("refuses a revision once the offer has been chosen", async () => {
    const { clientId, tenderId, cheap } = await seedOpenTender();
    const deadline = new Date(Date.now() + DAY_MS);
    await chooseWinningBid(tenderId, cheap.id, { id: clientId });

    await expect(
      prismaBidRepository.reviseOwnBid(
        tenderId,
        cheap.providerId,
        revision,
        new Date(),
        deadline,
      ),
    ).resolves.toEqual({ ok: false, error: "BID_NOT_ACTIVE" });
  });

  it("never lets a racing revision change the chosen terms", async () => {
    for (let round = 0; round < 5; round += 1) {
      const { clientId, tenderId, cheap } = await seedOpenTender();
      const [choice] = await Promise.all([
        chooseWinningBid(tenderId, cheap.id, { id: clientId }),
        prismaBidRepository.reviseOwnBid(
          tenderId,
          cheap.providerId,
          revision,
          new Date(),
          new Date(Date.now() + DAY_MS),
        ),
      ]);
      if (!choice.ok) {
        expect(choice.error).toBe("BID_NOT_SELECTABLE");
        continue;
      }
      const [bid, agreement] = await Promise.all([
        database.bid.findUniqueOrThrow({ where: { id: cheap.id } }),
        database.agreement.findUniqueOrThrow({
          where: { id: choice.value.agreementId },
        }),
      ]);
      expect(agreement.amountMinorUnits).toBe(bid.amountMinorUnits);
    }
  });

  it("answers a withdrawal racing the choice with a clean refusal, never a 500", async () => {
    for (let round = 0; round < 5; round += 1) {
      const { clientId, tenderId, cheap } = await seedOpenTender();
      const [choice, withdrawal] = await Promise.all([
        chooseWinningBid(tenderId, cheap.id, { id: clientId }),
        prismaBidRepository.withdrawOwnBid(
          tenderId,
          cheap.providerId,
          new Date(),
          new Date(Date.now() + DAY_MS),
        ),
      ]);
      // Exactly one of them wins the bid.
      expect(choice.ok !== withdrawal.ok).toBe(true);
      if (!choice.ok) expect(choice.error).toBe("BID_NOT_SELECTABLE");
      if (!withdrawal.ok) expect(withdrawal.error).toBe("BID_NOT_ACTIVE");
    }
  });
});

describe("after the client's choice", () => {
  it("settles the standby offers as lost once both parties confirm", async () => {
    const { clientId, tenderId, cheap, middle, dear } = await seedOpenTender();
    const chosen = await chooseWinningBid(tenderId, cheap.id, { id: clientId });
    if (!chosen.ok) throw new Error("expected a choice");

    await manage(
      chosen.value.agreementId,
      { type: "CONFIRM" },
      { id: clientId },
    );
    const agreed = await manage(
      chosen.value.agreementId,
      { type: "CONFIRM" },
      { id: cheap.providerId },
    );

    expect(agreed).toMatchObject({ ok: true, value: { status: "AGREED" } });
    expect(await bidStatus(middle.id)).toBe("LOST");
    expect(await bidStatus(dear.id)).toBe("LOST");
    await expect(
      database.inboxNotification.count({
        where: {
          aggregateId: tenderId,
          messageKey: "notifications.bidLost",
          recipientId: { in: [middle.providerId, dear.providerId] },
        },
      }),
    ).resolves.toBe(2);
  });

  it("keeps the tender closed when an agreed agreement is later cancelled", async () => {
    const { clientId, tenderId, cheap, middle } = await seedOpenTender();
    const chosen = await chooseWinningBid(tenderId, cheap.id, { id: clientId });
    if (!chosen.ok) throw new Error("expected a choice");
    await manage(
      chosen.value.agreementId,
      { type: "CONFIRM" },
      { id: clientId },
    );
    await manage(
      chosen.value.agreementId,
      { type: "CONFIRM" },
      { id: cheap.providerId },
    );

    const cancelled = await manage(
      chosen.value.agreementId,
      { type: "CANCEL", reasonCode: "OTHER", explanation: DECLINE_REASON },
      { id: clientId },
    );

    expect(cancelled).toMatchObject({
      ok: true,
      value: { status: "CANCELLED" },
    });
    await expect(tender(tenderId)).resolves.toMatchObject({
      status: "CLOSED",
    });
    expect(await bidStatus(cheap.id)).toBe("WINNER");
    expect(await bidStatus(middle.id)).toBe("LOST");
  });

  it("reopens bidding when the client chose early and the agreement is declined", async () => {
    const { clientId, tenderId, cheap, middle, dear } = await seedOpenTender();
    const first = await chooseWinningBid(tenderId, cheap.id, { id: clientId });
    if (!first.ok) throw new Error("expected a choice");

    await manage(
      first.value.agreementId,
      { type: "DECLINE", explanation: DECLINE_REASON },
      { id: clientId },
    );

    // The deadline is still ahead: bidding simply resumes.
    await expect(tender(tenderId)).resolves.toEqual({
      status: "PUBLISHED",
      selectionExpiresAt: null,
    });
    expect(await bidStatus(cheap.id)).toBe("LOST");
    expect(await bidStatus(middle.id)).toBe("SUBMITTED");
    expect(await bidStatus(dear.id)).toBe("SUBMITTED");
    await expect(
      database.inboxNotification.count({
        where: {
          aggregateId: tenderId,
          recipientId: clientId,
          messageKey: "notifications.tenderReopenedForBidding",
        },
      }),
    ).resolves.toBe(1);
    // The client may still choose a standby offer straight away.
    await expect(
      chooseWinningBid(tenderId, middle.id, { id: clientId }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("returns to selection among the remaining offers when the agreement is declined after the deadline", async () => {
    const { clientId, tenderId, cheap, middle, dear } =
      await seedOpenTender(PAST_DEADLINE());
    const first = await chooseWinningBid(tenderId, cheap.id, { id: clientId });
    if (!first.ok) throw new Error("expected a choice");

    const declined = await manage(
      first.value.agreementId,
      { type: "DECLINE", explanation: DECLINE_REASON },
      { id: clientId },
    );

    expect(declined).toMatchObject({
      ok: true,
      value: { status: "CANCELLED" },
    });
    const reopened = await tender(tenderId);
    expect(reopened.status).toBe("AWAITING_SELECTION");
    // now + N days.
    expect(reopened.selectionExpiresAt!.getTime()).toBeGreaterThan(
      Date.now() + (WINDOW_DAYS - 1) * DAY_MS,
    );
    expect(await bidStatus(cheap.id)).toBe("LOST");
    expect(await bidStatus(middle.id)).toBe("SUBMITTED");
    await expect(
      database.inboxNotification.count({
        where: {
          aggregateId: tenderId,
          recipientId: clientId,
          messageKey: "notifications.tenderReopenedForSelection",
        },
      }),
    ).resolves.toBe(1);

    // The declined contractor cannot be chosen again…
    await expect(
      chooseWinningBid(tenderId, cheap.id, { id: clientId }),
    ).resolves.toEqual({ ok: false, error: "BID_NOT_SELECTABLE" });
    // …but another remaining offer can, with a fresh agreement.
    const second = await chooseWinningBid(tenderId, dear.id, { id: clientId });
    expect(second).toMatchObject({
      ok: true,
      value: { winningBidId: dear.id },
    });
    await expect(
      database.agreement.count({ where: { tenderId } }),
    ).resolves.toBe(2);
    await expect(tender(tenderId)).resolves.toMatchObject({
      status: "CLOSED",
    });
  });

  it("reopens selection when the contractor declines, too", async () => {
    const { clientId, tenderId, cheap } = await seedOpenTender(PAST_DEADLINE());
    const first = await chooseWinningBid(tenderId, cheap.id, { id: clientId });
    if (!first.ok) throw new Error("expected a choice");

    await manage(
      first.value.agreementId,
      { type: "DECLINE", explanation: DECLINE_REASON },
      { id: cheap.providerId },
    );

    await expect(tender(tenderId)).resolves.toMatchObject({
      status: "AWAITING_SELECTION",
    });
  });

  it("expires the tender, saying why, when the declined offer was the last one", async () => {
    const clientId = await seedUser();
    const tenderId = await seedTender(clientId, PAST_DEADLINE());
    const only = await seedBid(tenderId, 60_000);
    const withdrawn = await seedBid(tenderId, 10_000, { status: "WITHDRAWN" });
    const chosen = await chooseWinningBid(tenderId, only.id, { id: clientId });
    if (!chosen.ok) throw new Error("expected a choice");

    await manage(
      chosen.value.agreementId,
      { type: "DECLINE", explanation: DECLINE_REASON },
      { id: clientId },
    );

    await expect(tender(tenderId)).resolves.toMatchObject({
      status: "EXPIRED",
    });
    expect(await bidStatus(only.id)).toBe("LOST");
    expect(await bidStatus(withdrawn.id)).toBe("WITHDRAWN");
    // Offers existed, so neither "no bids" nor "the window ran out".
    await expect(
      database.tenderSelection.findFirstOrThrow({
        where: { tenderId, outcome: { not: "WINNER_SELECTED" } },
        select: { outcome: true },
      }),
    ).resolves.toEqual({ outcome: "SELECTION_EXPIRED" });
    const clientInbox = (
      await database.inboxNotification.findMany({
        where: { aggregateId: tenderId, recipientId: clientId },
        select: { messageKey: true },
      })
    ).map((row) => row.messageKey);
    expect(clientInbox).toContain("notifications.tenderExpiredNoOffersLeft");
    expect(clientInbox).not.toContain("notifications.tenderExpiredNoBids");
  });

  it("reopens selection when the agreement's confirmation window expires", async () => {
    const { clientId, tenderId, cheap, middle } =
      await seedOpenTender(PAST_DEADLINE());
    const chosen = await chooseWinningBid(tenderId, cheap.id, { id: clientId });
    if (!chosen.ok) throw new Error("expected a choice");
    await database.agreement.update({
      where: { id: chosen.value.agreementId },
      data: { confirmDeadline: new Date(Date.now() - 1_000) },
    });

    const expired = await createExpireDueAgreements({
      repository: prismaAgreementGateway,
      now: () => new Date(),
      ids: { next: () => randomUUID() },
      selectionWindowDays: WINDOW_DAYS,
    })(500);

    expect(
      expired.some((agreement) => agreement.id === chosen.value.agreementId),
    ).toBe(true);
    await expect(tender(tenderId)).resolves.toMatchObject({
      status: "AWAITING_SELECTION",
    });
    expect(await bidStatus(cheap.id)).toBe("LOST");
    expect(await bidStatus(middle.id)).toBe("SUBMITTED");
  });

  it("uses the injected selection window when reopening", async () => {
    const { clientId, tenderId, cheap } = await seedOpenTender(PAST_DEADLINE());
    const chosen = await chooseWinningBid(tenderId, cheap.id, { id: clientId });
    if (!chosen.ok) throw new Error("expected a choice");

    await createManageAgreement({
      repository: prismaAgreementGateway,
      now: () => new Date(),
      ids: { next: () => randomUUID() },
      selectionWindowDays: 3,
    })(
      chosen.value.agreementId,
      { type: "DECLINE", explanation: DECLINE_REASON },
      { id: clientId },
    );

    const reopened = await tender(tenderId);
    expect(reopened.selectionExpiresAt!.getTime()).toBeLessThan(
      Date.now() + 3 * DAY_MS + 60_000,
    );
    expect(reopened.selectionExpiresAt!.getTime()).toBeGreaterThan(
      Date.now() + 2 * DAY_MS,
    );
  });

  it("keeps one live agreement when a decline races a new choice", async () => {
    const { clientId, tenderId, cheap, middle } =
      await seedOpenTender(PAST_DEADLINE());
    const first = await chooseWinningBid(tenderId, cheap.id, { id: clientId });
    if (!first.ok) throw new Error("expected a choice");

    const [, choice] = await Promise.all([
      manage(
        first.value.agreementId,
        { type: "DECLINE", explanation: DECLINE_REASON },
        { id: clientId },
      ),
      chooseWinningBid(tenderId, middle.id, { id: clientId }),
    ]);

    // Either the choice landed after the decline, or it was refused while
    // the first agreement was still pending; never two live agreements.
    if (!choice.ok) expect(choice.error).toBe("TENDER_NOT_SELECTABLE");
    await expect(
      database.agreement.count({
        where: { tenderId, status: { not: "CANCELLED" } },
      }),
    ).resolves.toBe(choice.ok ? 1 : 0);
    await expect(
      database.bid.count({ where: { tenderId, status: "WINNER" } }),
    ).resolves.toBe(choice.ok ? 1 : 0);
  });
});

describe("migration: standby bids for agreements pending at deploy", () => {
  const migration = readFileSync(
    fileURLToPath(
      new URL(
        "../../../../prisma/migrations/20261021130000_standby_bids_for_pending_agreements/migration.sql",
        import.meta.url,
      ),
    ),
    "utf8",
  );

  // The state the old auto-selector left behind: tender CLOSED, a WINNER,
  // every other offer LOST, and a pending agreement.
  async function seedLegacy(
    agreementStatus: "PENDING_CONFIRMATION" | "AGREED",
  ) {
    const clientId = await seedUser();
    const tenderId = await seedTender(clientId, PAST_DEADLINE());
    const winner = await seedBid(tenderId, 40_000);
    const loser = await seedBid(tenderId, 50_000);
    const withdrawn = await seedBid(tenderId, 30_000, { status: "WITHDRAWN" });
    await database.bid.update({
      where: { id: winner.id },
      data: { status: "WINNER" },
    });
    await database.bid.update({
      where: { id: loser.id },
      data: { status: "LOST" },
    });
    await database.tender.update({
      where: { id: tenderId },
      data: { status: "CLOSED" },
    });
    const agreementId = randomUUID();
    await database.agreement.create({
      data: {
        id: agreementId,
        tenderId,
        clientId,
        providerId: winner.providerId,
        bidId: winner.id,
        status: agreementStatus,
        amountMinorUnits: 40_000,
        currency: "GEL",
        tenderTitle: "Retile a bathroom",
        snapshot: { tenderId, bidId: winner.id },
        confirmDeadline: new Date(Date.now() + DAY_MS),
      },
    });
    return { clientId, tenderId, winner, loser, withdrawn, agreementId };
  }

  it("puts non-withdrawn losers back on standby, idempotently, so a decline reopens selection", async () => {
    const legacy = await seedLegacy("PENDING_CONFIRMATION");
    const settled = await seedLegacy("AGREED");

    await database.$executeRawUnsafe(migration);
    await database.$executeRawUnsafe(migration);

    expect(await bidStatus(legacy.loser.id)).toBe("SUBMITTED");
    expect(await bidStatus(legacy.winner.id)).toBe("WINNER");
    expect(await bidStatus(legacy.withdrawn.id)).toBe("WITHDRAWN");
    // An agreement already agreed is left exactly as it was.
    expect(await bidStatus(settled.loser.id)).toBe("LOST");

    await manage(
      legacy.agreementId,
      { type: "DECLINE", explanation: DECLINE_REASON },
      { id: legacy.clientId },
    );
    await expect(tender(legacy.tenderId)).resolves.toMatchObject({
      status: "AWAITING_SELECTION",
    });
    expect(await bidStatus(legacy.winner.id)).toBe("LOST");

    // Re-running after the decline must not resurrect the declined winner.
    await database.$executeRawUnsafe(migration);
    expect(await bidStatus(legacy.winner.id)).toBe("LOST");
  });
});
