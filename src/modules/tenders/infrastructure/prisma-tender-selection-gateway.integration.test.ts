import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { prismaTenderSelectionGateway } from "./prisma-tender-selection-gateway";

async function seedTender(deadline: Date, status: "PUBLISHED" | "CLOSED") {
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

afterAll(async () => {
  await database.$disconnect();
});

describe("prismaTenderSelectionGateway", () => {
  it("refuses to lock a tender whose deadline has not arrived", async () => {
    const future = new Date(Date.now() + 60_000);
    const tenderId = await seedTender(future, "PUBLISHED");

    const locked = await database.$transaction((transaction) =>
      prismaTenderSelectionGateway.lockDueTender(
        transaction,
        tenderId,
        new Date(),
      ),
    );

    expect(locked).toEqual({ ok: false, error: "NOT_DUE" });
  });

  it("locks a due tender and reports its settlement terms", async () => {
    const past = new Date(Date.now() - 60_000);
    const tenderId = await seedTender(past, "PUBLISHED");

    const locked = await database.$transaction((transaction) =>
      prismaTenderSelectionGateway.lockDueTender(
        transaction,
        tenderId,
        new Date(),
      ),
    );

    expect(locked).toMatchObject({
      ok: true,
      value: { id: tenderId, currency: "GEL", status: "PUBLISHED" },
    });
  });

  it("refuses to lock a tender selection has already closed", async () => {
    const past = new Date(Date.now() - 60_000);
    const tenderId = await seedTender(past, "CLOSED");

    const locked = await database.$transaction((transaction) =>
      prismaTenderSelectionGateway.lockDueTender(
        transaction,
        tenderId,
        new Date(),
      ),
    );

    expect(locked).toEqual({ ok: false, error: "NOT_DUE" });
  });

  it("closes to CLOSED on a winner and EXPIRED without one", async () => {
    const past = new Date(Date.now() - 60_000);
    const withWinner = await seedTender(past, "PUBLISHED");
    const withoutBids = await seedTender(past, "PUBLISHED");

    await database.$transaction(async (transaction) => {
      await prismaTenderSelectionGateway.closeAfterSelection(
        transaction,
        withWinner,
        "WINNER_SELECTED",
      );
      await prismaTenderSelectionGateway.closeAfterSelection(
        transaction,
        withoutBids,
        "EXPIRED_NO_BIDS",
      );
    });

    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: withWinner },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "CLOSED" });
    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: withoutBids },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "EXPIRED" });
  });

  it("lists only tenders that are due, oldest deadline first", async () => {
    const older = await seedTender(new Date(Date.now() - 120_000), "PUBLISHED");
    const newer = await seedTender(new Date(Date.now() - 60_000), "PUBLISHED");
    await seedTender(new Date(Date.now() + 60_000), "PUBLISHED");

    const due = await prismaTenderSelectionGateway.listDueTenderIds(
      new Date(),
      50,
    );

    const relevant = due.filter((id) => id === older || id === newer);
    expect(relevant).toEqual([older, newer]);
  });
});
