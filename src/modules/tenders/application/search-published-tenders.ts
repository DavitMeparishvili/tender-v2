import { z } from "zod";
import type { Clock } from "@/src/modules/shared";
import { MAX_BUDGET_MINOR_UNITS } from "../domain/constraints";
import { distanceKilometers } from "../domain/coordinates";
import { toPublicSummary, type PublicTenderSummary } from "../domain/masking";
import type { TenderRecord } from "../domain/tender";
import {
  isServiceForSpecialty,
  isTenderServiceCode,
  isTenderSpecialty,
  type TenderServiceCode,
  type TenderSpecialty,
} from "../domain/service-taxonomy";

const tenderSpecialtySchema = z.custom<TenderSpecialty>(
  (value) => typeof value === "string" && isTenderSpecialty(value),
);
const tenderServiceCodeSchema = z.custom<TenderServiceCode>(
  (value) => typeof value === "string" && isTenderServiceCode(value),
);

export const searchPublishedTendersQuerySchema = z
  .object({
    specialty: tenderSpecialtySchema.optional(),
    serviceCode: tenderServiceCodeSchema.optional(),
    city: z.string().trim().min(1).max(120).optional(),
    district: z.string().trim().min(1).max(120).optional(),
    // A budget bound is only comparable within one currency, since amounts are
    // integer minor units and no conversion rate exists in this phase.
    currency: z.enum(["GEL", "USD"]).optional(),
    minBudgetMinorUnits: z.coerce
      .number()
      .int()
      .nonnegative()
      .max(MAX_BUDGET_MINOR_UNITS)
      .optional(),
    maxBudgetMinorUnits: z.coerce
      .number()
      .int()
      .nonnegative()
      .max(MAX_BUDGET_MINOR_UNITS)
      .optional(),
    publishedAfter: z.coerce.date().optional(),
    deadlineBefore: z.coerce.date().optional(),
    nearLatitude: z.coerce.number().min(-90).max(90).optional(),
    nearLongitude: z.coerce.number().min(-180).max(180).optional(),
    nearRadiusKilometers: z.coerce.number().positive().max(500).optional(),
  })
  .strict()
  .refine(
    (query) =>
      query.serviceCode === undefined ||
      (query.specialty !== undefined &&
        isServiceForSpecialty(query.serviceCode, query.specialty)),
    {
      path: ["serviceCode"],
      message: "A service must belong to the selected category.",
    },
  )
  // The currency-scoping rule belongs to the contract, not to one caller: the
  // API route feeds this schema raw query parameters, so a bound accepted here
  // without a currency would compare a GEL amount against a USD threshold on
  // the same integer. The UI parser rejects the same combination earlier and
  // is unaffected.
  .refine(
    (query) =>
      query.currency !== undefined ||
      (query.minBudgetMinorUnits === undefined &&
        query.maxBudgetMinorUnits === undefined),
    {
      path: ["currency"],
      message: "A budget bound requires a currency to scope the comparison.",
    },
  );
export type SearchPublishedTendersQuery = z.output<
  typeof searchPublishedTendersQuerySchema
>;

// The discovery surface has no pagination affordance yet, so an unbounded
// query would hand back every currently published tender that matches a
// filter — for a public marketplace listing that grows without bound as
// inventory grows. Cap the repository read at a fixed maximum until real
// paging exists; `PrismaTenderRepository.searchPublished` applies this as
// its `take`.
export const MAX_PUBLISHED_TENDER_RESULTS = 50;

export interface SearchPublishedTendersRepository {
  searchPublished(
    filter: SearchPublishedTendersQuery,
    now: Date,
  ): Promise<readonly TenderRecord[]>;
}

export function createSearchPublishedTenders(dependencies: {
  repository: SearchPublishedTendersRepository;
  clock: Clock;
}) {
  return async function searchPublishedTenders(
    input: unknown,
  ): Promise<
    | { ok: true; value: readonly PublicTenderSummary[] }
    | { ok: false; error: "INVALID_INPUT" }
  > {
    const parsed = searchPublishedTendersQuerySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

    const now = dependencies.clock.now();
    const matches = await dependencies.repository.searchPublished(
      parsed.data,
      now,
    );
    const near =
      parsed.data.nearLatitude !== undefined &&
      parsed.data.nearLongitude !== undefined &&
      parsed.data.nearRadiusKilometers !== undefined
        ? {
            latitude: parsed.data.nearLatitude,
            longitude: parsed.data.nearLongitude,
            radiusKilometers: parsed.data.nearRadiusKilometers,
          }
        : null;

    const filtered = near
      ? matches.filter(
          (tender) =>
            distanceKilometers(near, tender.location.public) <=
            near.radiusKilometers,
        )
      : matches;

    return { ok: true, value: filtered.map(toPublicSummary) };
  };
}

export async function searchPublishedTenders(
  input: unknown,
): ReturnType<ReturnType<typeof createSearchPublishedTenders>> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createSearchPublishedTenders({
    repository: prismaTenderRepository,
    clock: { now: () => new Date() },
  })(input);
}
