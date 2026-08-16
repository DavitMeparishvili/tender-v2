import type { Prisma } from "../../../generated/prisma/client";
import {
  confirmationDeadline,
  type AgreementSnapshot,
} from "../domain/agreement";

// The same transaction-participating gateway pattern as
// `prismaTenderSelectionGateway`: `bidding` needs the snapshot created inside
// its selection transaction, and `agreements` stays the only module that
// writes the Agreement table.
export interface AgreementGateway {
  createPending(
    transaction: Prisma.TransactionClient,
    agreementId: string,
    snapshot: AgreementSnapshot,
    now: Date,
  ): Promise<string>;
}

export class PrismaAgreementGateway implements AgreementGateway {
  async createPending(
    transaction: Prisma.TransactionClient,
    agreementId: string,
    snapshot: AgreementSnapshot,
    now: Date,
  ): Promise<string> {
    const created = await transaction.agreement.create({
      data: {
        id: agreementId,
        tenderId: snapshot.tenderId,
        clientId: snapshot.clientId,
        providerId: snapshot.providerId,
        bidId: snapshot.bidId,
        status: "PENDING_CONFIRMATION",
        amountMinorUnits: snapshot.amountMinorUnits,
        currency: snapshot.currency,
        tenderTitle: snapshot.tenderTitle,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        confirmDeadline: confirmationDeadline(now),
      },
      select: { id: true },
    });
    return created.id;
  }
}

export const prismaAgreementGateway = new PrismaAgreementGateway();
