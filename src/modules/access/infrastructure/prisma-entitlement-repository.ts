import { Prisma } from "../../../generated/prisma/client";
import type { AccessEntitlement } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import type {
  ConfirmAccessCheckoutRepository,
  PendingCheckout,
} from "../application/confirm-access-checkout";
import type { ListEntitlementsRepository } from "../application/list-active-entitlements";
import type { StartAccessCheckoutRepository } from "../application/start-access-checkout";
import type { Entitlement } from "../domain/entitlement";

function toEntitlement(row: AccessEntitlement): Entitlement {
  return {
    id: row.id,
    providerId: row.providerId,
    kind: row.kind,
    tenderId: row.tenderId,
    grantedAt: row.grantedAt,
    expiresAt: row.expiresAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export class PrismaEntitlementRepository
  implements
    StartAccessCheckoutRepository,
    ConfirmAccessCheckoutRepository,
    ListEntitlementsRepository
{
  async publishedTenderExists(tenderId: string): Promise<boolean> {
    const tender = await database.tender.findFirst({
      where: {
        id: tenderId,
        status: { in: ["PUBLISHED", "CLOSED", "EXPIRED"] },
      },
      select: { id: true },
    });
    return tender !== null;
  }

  async listEntitlements(providerId: string): Promise<readonly Entitlement[]> {
    const rows = await database.accessEntitlement.findMany({
      where: { providerId },
      orderBy: { grantedAt: "desc" },
    });
    return rows.map(toEntitlement);
  }

  async createCheckout(
    intent: Readonly<{
      checkoutId: string;
      providerId: string;
      product: string;
      tenderId: string | null;
      amountMinorUnits: number;
      currency: string;
    }>,
    now: Date,
  ): Promise<void> {
    await database.paymentEvent.create({
      data: {
        // A checkout that has not been confirmed yet is a PENDING event with
        // a placeholder key; confirming replaces it with the gateway's real
        // idempotency key by creating the SUCCEEDED row.
        externalEventId: `checkout-${intent.checkoutId}`,
        checkoutId: intent.checkoutId,
        providerId: intent.providerId,
        product: intent.product,
        tenderId: intent.tenderId,
        amountMinorUnits: intent.amountMinorUnits,
        currency: intent.currency,
        status: "PENDING",
        rawPayload: { gateway: "mock", stage: "checkout" },
        receivedAt: now,
      },
    });
  }

  async findCheckout(checkoutId: string): Promise<PendingCheckout | null> {
    const row = await database.paymentEvent.findUnique({
      where: { checkoutId },
    });
    if (row === null) return null;
    return {
      checkoutId: row.checkoutId,
      providerId: row.providerId,
      product: row.product,
      tenderId: row.tenderId,
      amountMinorUnits: row.amountMinorUnits,
      currency: row.currency === "USD" ? "USD" : "GEL",
    };
  }

  async applyPaymentEvent(
    event: Readonly<{
      externalEventId: string;
      checkoutId: string;
      rawPayload: Readonly<Record<string, unknown>>;
    }>,
    grant: Readonly<{
      entitlementId: string;
      providerId: string;
      kind: Entitlement["kind"];
      tenderId: string | null;
      grantedAt: Date;
      expiresAt: Date | null;
    }>,
  ): Promise<Entitlement> {
    // `sourceEventId` is UNIQUE, so a replayed event cannot insert a second
    // entitlement even if two requests race past the existence check below.
    const existing = await database.accessEntitlement.findUnique({
      where: { sourceEventId: event.externalEventId },
    });
    if (existing !== null) return toEntitlement(existing);

    try {
      return await database.$transaction(async (transaction) => {
        await transaction.paymentEvent.update({
          where: { checkoutId: event.checkoutId },
          data: {
            externalEventId: event.externalEventId,
            status: "SUCCEEDED",
            rawPayload: event.rawPayload as Prisma.InputJsonValue,
            appliedAt: grant.grantedAt,
          },
        });
        const created = await transaction.accessEntitlement.create({
          data: {
            id: grant.entitlementId,
            providerId: grant.providerId,
            kind: grant.kind,
            tenderId: grant.tenderId,
            grantedAt: grant.grantedAt,
            expiresAt: grant.expiresAt,
            sourceEventId: event.externalEventId,
          },
        });
        return toEntitlement(created);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // The concurrent apply won. Return its entitlement rather than
        // surfacing a constraint error for what is a successful outcome.
        const winner = await database.accessEntitlement.findUniqueOrThrow({
          where: { sourceEventId: event.externalEventId },
        });
        return toEntitlement(winner);
      }
      throw error;
    }
  }
}

export const prismaEntitlementRepository = new PrismaEntitlementRepository();
