import { z } from "zod";
import type { Clock, IdGenerator, Result } from "../../shared";
import type { Bid, BidCurrency } from "../domain/bid";
import {
  MAX_BID_AMOUNT_MINOR_UNITS,
  MAX_BID_CONDITIONS_LENGTH,
  MAX_BID_DURATION_DAYS,
  MAX_BID_TERM_LENGTH,
  MIN_BID_CONDITIONS_LENGTH,
} from "../domain/constraints";

// The bid carries no currency: it always settles in the tender's currency,
// which the use case reads from the tender context. Accepting one from the
// client would let a bidder claim a cheaper unit of account.
export const submitBidCommandSchema = z
  .object({
    amountMinorUnits: z
      .number()
      .int()
      .positive()
      .max(MAX_BID_AMOUNT_MINOR_UNITS),
    proposedStartDate: z.coerce.date().optional(),
    durationDays: z
      .number()
      .int()
      .positive()
      .max(MAX_BID_DURATION_DAYS)
      .optional(),
    includedCosts: z.string().trim().min(1).max(MAX_BID_TERM_LENGTH).optional(),
    exclusions: z.string().trim().min(1).max(MAX_BID_TERM_LENGTH).optional(),
    conditions: z
      .string()
      .trim()
      .min(MIN_BID_CONDITIONS_LENGTH)
      .max(MAX_BID_CONDITIONS_LENGTH),
  })
  .strict();

export type SubmitBidCommand = z.output<typeof submitBidCommandSchema>;
export type BidActor = Readonly<{ id: string }>;

export type SubmitBidError =
  | "INVALID_INPUT"
  | "TENDER_NOT_FOUND"
  | "TENDER_NOT_OPEN"
  | "DEADLINE_PASSED"
  | "NOT_ENTITLED"
  | "OWN_TENDER"
  | "BID_ALREADY_EXISTS";

export type TenderContextLookup = (id: string) => Promise<
  Result<
    Readonly<{
      id: string;
      ownerId: string;
      status: "PUBLISHED" | "CLOSED" | "EXPIRED";
      currency: BidCurrency;
      deadline: Date;
    }>,
    "TENDER_NOT_FOUND"
  >
>;

export type EntitlementCheck = (
  providerId: string,
  tenderId: string,
  now: Date,
) => Promise<boolean>;

export interface SubmitBidRepository {
  insertBid(
    bid: Readonly<{
      id: string;
      tenderId: string;
      providerId: string;
      amountMinorUnits: number;
      currency: BidCurrency;
      command: SubmitBidCommand;
      qualifyingSubmittedAt: Date;
    }>,
    // Re-asserted inside the write, so a deadline that elapses between the
    // check below and the INSERT is caught by the write itself.
    deadline: Date,
  ): Promise<Result<Bid, "BID_ALREADY_EXISTS" | "DEADLINE_PASSED">>;
}

export function createSubmitBid(dependencies: {
  repository: SubmitBidRepository;
  tenders: TenderContextLookup;
  isEntitled: EntitlementCheck;
  ids: IdGenerator;
  clock: Clock;
}) {
  return async function submitBid(
    tenderId: string,
    input: unknown,
    actor: BidActor,
  ): Promise<Result<Bid, SubmitBidError>> {
    const parsed = submitBidCommandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

    const tender = await dependencies.tenders(tenderId);
    if (!tender.ok) return { ok: false, error: "TENDER_NOT_FOUND" };
    // A dual-capability company holds both CUSTOMER and PROVIDER, so nothing
    // in the capability check stops it bidding on its own tender. Price
    // competition requires that it cannot.
    if (tender.value.ownerId === actor.id) {
      return { ok: false, error: "OWN_TENDER" };
    }
    if (tender.value.status !== "PUBLISHED") {
      return { ok: false, error: "TENDER_NOT_OPEN" };
    }

    const now = dependencies.clock.now();
    if (now.getTime() >= tender.value.deadline.getTime()) {
      return { ok: false, error: "DEADLINE_PASSED" };
    }
    // Sending an offer is free, but only after access has been gained
    // (Product_description, "Application Viewing System").
    if (!(await dependencies.isEntitled(actor.id, tenderId, now))) {
      return { ok: false, error: "NOT_ENTITLED" };
    }

    return dependencies.repository.insertBid(
      {
        id: dependencies.ids.next(),
        tenderId,
        providerId: actor.id,
        amountMinorUnits: parsed.data.amountMinorUnits,
        currency: tender.value.currency,
        command: parsed.data,
        qualifyingSubmittedAt: now,
      },
      tender.value.deadline,
    );
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function submitBid(
  tenderId: string,
  input: unknown,
  actor: BidActor,
): Promise<Result<Bid, SubmitBidError>> {
  const [
    { prismaBidRepository },
    { getTenderBiddingContext },
    { hasTenderEntitlement },
  ] = await Promise.all([
    import("../infrastructure/prisma-bid-repository"),
    import("../../tenders/application/get-tender-bidding-context"),
    import("../../access/application/has-tender-entitlement"),
  ]);
  return createSubmitBid({
    repository: prismaBidRepository,
    tenders: getTenderBiddingContext,
    isEntitled: hasTenderEntitlement,
    ids: systemIds,
    clock: systemClock,
  })(tenderId, input, actor);
}
