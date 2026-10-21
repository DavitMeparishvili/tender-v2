import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { prismaTenderSelectionGateway } from "./prisma-tender-selection-gateway";

async function seedTender(
  deadline: Date,
  status: "PUBLISHED" | "AWAITING_SELECTION" | "CLOSED",
  selectionExpiresAt: Date | null = null,
) {
  const ownerId = randomUUID();
  await database.user.create({
    data: {
      id: ownerId,
      name: "Owner",
      email: `${ownerId}@tender.test`,
      emailVerified: true,
    },
  });
  const id = randomUUID();
  await database.tender.create({
    data: {
      id,
      ownerId,
      status,
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
      publishedAt: new Date(),
      selectionExpiresAt,
    },
  });
  return id;
}

afterAll(async () => {
  await database.$disconnect();
});

describe("prismaTenderSelectionGateway", () => {
  it("locks a published tender and reports its selection terms", async () => {
    const past = new Date(Date.now() - 60_000);
    const tenderId = await seedTender(past, "PUBLISHED");

    const locked = await database.$transaction((transaction) =>
      prismaTenderSelectionGateway.lockTender(transaction, tenderId),
    );

    expect(locked).toMatchObject({
      ok: true,
      value: {
        id: tenderId,
        currency: "GEL",
        status: "PUBLISHED",
        selectionExpiresAt: null,
      },
    });
  });

  it("refuses to lock a tender that does not exist", async () => {
    const locked = await database.$transaction((transaction) =>
      prismaTenderSelectionGateway.lockTender(transaction, randomUUID()),
    );

    expect(locked).toEqual({ ok: false, error: "TENDER_NOT_FOUND" });
  });

  it("opens the selection window, then closes to CLOSED or EXPIRED", async () => {
    const past = new Date(Date.now() - 60_000);
    const withWinner = await seedTender(past, "PUBLISHED");
    const withoutChoice = await seedTender(past, "PUBLISHED");
    const expiresAt = new Date(Date.now() + 60_000);

    await database.$transaction(async (transaction) => {
      await prismaTenderSelectionGateway.awaitSelection(
        transaction,
        withWinner,
        expiresAt,
      );
    });
    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: withWinner },
        select: { status: true, selectionExpiresAt: true },
      }),
    ).resolves.toEqual({
      status: "AWAITING_SELECTION",
      selectionExpiresAt: expiresAt,
    });

    await database.$transaction(async (transaction) => {
      await prismaTenderSelectionGateway.closeAfterSelection(
        transaction,
        withWinner,
        "WINNER_SELECTED",
      );
      await prismaTenderSelectionGateway.closeAfterSelection(
        transaction,
        withoutChoice,
        "EXPIRED",
      );
    });

    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: withWinner },
        select: { status: true, selectionExpiresAt: true },
      }),
    ).resolves.toEqual({ status: "CLOSED", selectionExpiresAt: null });
    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: withoutChoice },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "EXPIRED" });
  });

  it("lists tenders whose bidding or selection window is due", async () => {
    const older = await seedTender(new Date(Date.now() - 120_000), "PUBLISHED");
    const newer = await seedTender(new Date(Date.now() - 60_000), "PUBLISHED");
    await seedTender(new Date(Date.now() + 60_000), "PUBLISHED");
    const windowOver = await seedTender(
      new Date(Date.now() - 90_000),
      "AWAITING_SELECTION",
      new Date(Date.now() - 1_000),
    );
    const windowOpen = await seedTender(
      new Date(Date.now() - 90_000),
      "AWAITING_SELECTION",
      new Date(Date.now() + 60_000),
    );
    const closed = await seedTender(new Date(Date.now() - 90_000), "CLOSED");

    const due = await prismaTenderSelectionGateway.listDueTenderIds(
      new Date(),
      500,
    );

    const seeded: readonly string[] = [
      older,
      newer,
      windowOver,
      windowOpen,
      closed,
    ];
    const relevant = due.filter((id) => seeded.includes(id));
    // Oldest deadline first.
    expect(relevant).toEqual([older, windowOver, newer]);
  });
});
