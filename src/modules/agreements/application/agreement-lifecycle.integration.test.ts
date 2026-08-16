import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";

async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: "Agreement party",
      email: `${id}@tender.test`,
      emailVerified: true,
    },
  });
  return id;
}

describe("phase 3 agreement migration compatibility", () => {
  it("preserves a pending snapshot with all new lifecycle fields unset", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = randomUUID();
    const bidId = randomUUID();
    const now = new Date();
    await database.tender.create({
      data: {
        id: tenderId,
        ownerId: clientId,
        status: "CLOSED",
        specialty: "CONSTRUCTION_REPAIR",
        serviceCode: "GENERAL_CONSTRUCTION",
        title: "Phase 3 snapshot tender",
      },
    });
    await database.bid.create({
      data: {
        id: bidId,
        tenderId,
        providerId,
        amountMinorUnits: 10_000,
        currency: "GEL",
        status: "WINNER",
        conditions: "A substantive winning offer condition for the snapshot.",
        qualifyingSubmittedAt: now,
      },
    });
    const agreementId = randomUUID();
    const snapshot = { tenderId, clientId, providerId, bidId };
    const confirmDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1_000);
    // This deliberately omits every Phase 4 column, mirroring a still-live
    // Phase 3 Prisma client during a rolling deployment.
    await database.$executeRaw(
      Prisma.sql`
        INSERT INTO "Agreement" (
          "id", "tenderId", "clientId", "providerId", "bidId", "status",
          "amountMinorUnits", "currency", "tenderTitle", "snapshot", "confirmDeadline"
        ) VALUES (
          ${agreementId}, ${tenderId}, ${clientId}, ${providerId}, ${bidId},
          'PENDING_CONFIRMATION', 10000, 'GEL', 'Phase 3 snapshot tender',
          ${JSON.stringify(snapshot)}::jsonb, ${confirmDeadline}
        )
      `,
    );
    const agreement = await database.agreement.findUniqueOrThrow({
      where: { id: agreementId },
      select: {
        id: true,
        tenderId: true,
        clientId: true,
        providerId: true,
        bidId: true,
        amountMinorUnits: true,
        currency: true,
        tenderTitle: true,
        snapshot: true,
        confirmDeadline: true,
        createdAt: true,
        updatedAt: true,
        status: true,
        clientConfirmedAt: true,
        providerConfirmedAt: true,
        clientStartedAt: true,
        providerStartedAt: true,
        clientCompletedAt: true,
        providerCompletedAt: true,
        cancelledAt: true,
        cancelledById: true,
        cancellationReasonCode: true,
        cancellationExplanation: true,
        completedAt: true,
      },
    });
    expect(agreement).toMatchObject({
      id: agreementId,
      tenderId,
      clientId,
      providerId,
      bidId,
      amountMinorUnits: 10_000,
      currency: "GEL",
      tenderTitle: "Phase 3 snapshot tender",
      snapshot,
      confirmDeadline,
      status: "PENDING_CONFIRMATION",
      clientConfirmedAt: null,
      providerConfirmedAt: null,
      clientStartedAt: null,
      providerStartedAt: null,
      clientCompletedAt: null,
      providerCompletedAt: null,
      cancelledAt: null,
      cancelledById: null,
      cancellationReasonCode: null,
      cancellationExplanation: null,
      completedAt: null,
    });
    expect(agreement.createdAt).toBeInstanceOf(Date);
    expect(agreement.updatedAt).toBeInstanceOf(Date);
  });
});

afterAll(async () => {
  await database.$disconnect();
});
