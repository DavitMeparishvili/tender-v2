import type { Prisma, Tender } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import type { Result } from "../../shared";
import type {
  CancelTenderCommand,
  CancelError,
  CancelTenderRepository,
} from "../application/cancel-tender";
import type {
  CreateTenderDraftCommand,
  CreateTenderDraftRepository,
  TenderActor,
} from "../application/create-tender-draft";
import type { GetOwnedTenderRepository } from "../application/get-owned-tender";
import type { GetPublishedTenderRepository } from "../application/get-published-tender";
import type { ListOwnedTendersRepository } from "../application/list-owned-tenders";
import type { PublishTenderRepository } from "../application/publish-tender";
import {
  MAX_PUBLISHED_TENDER_RESULTS,
  type SearchPublishedTendersQuery,
  type SearchPublishedTendersRepository,
} from "../application/search-published-tenders";
import type { SyncTenderLocationRepository } from "../application/sync-tender-location";
import type {
  TenderMutationError,
  UpdateTenderDraftCommand,
  UpdateTenderDraftRepository,
} from "../application/update-tender-draft";
import { coarsenCoordinates } from "../domain/coordinates";
import type {
  TenderCurrency,
  TenderDraft,
  TenderLocation,
  TenderRecord,
} from "../domain/tender";

export interface TenderRepository
  extends
    CreateTenderDraftRepository,
    UpdateTenderDraftRepository,
    GetOwnedTenderRepository,
    ListOwnedTendersRepository,
    SyncTenderLocationRepository,
    PublishTenderRepository,
    CancelTenderRepository,
    SearchPublishedTendersRepository,
    GetPublishedTenderRepository {}

function isRepresentableCurrency(
  value: string | null,
): value is TenderCurrency | null {
  return value === null || value === "GEL" || value === "USD";
}

function toTenderLocation(row: Tender): TenderLocation | null {
  if (
    row.city === null ||
    row.addressLine === null ||
    row.exactLatitude === null ||
    row.exactLongitude === null
  ) {
    return null;
  }

  const exact = { latitude: row.exactLatitude, longitude: row.exactLongitude };
  const publicCoordinates =
    row.publicLatitude !== null && row.publicLongitude !== null
      ? { latitude: row.publicLatitude, longitude: row.publicLongitude }
      : coarsenCoordinates(exact);

  return {
    countryCode: "GE",
    city: row.city,
    district: row.district,
    addressLine: row.addressLine,
    exact,
    public: publicCoordinates,
  };
}

// `Tender.specialty` is the five-value `ProviderSpecialtyCode` enum shared with
// provider profiles, and `Tender.currency` is a plain, unconstrained string
// column — both wider than what `TenderDraft` can represent. This module only
// ever writes `CONSTRUCTION_REPAIR` specialties and `GEL`/`USD` currencies, so a
// row that fails either check has drifted outside what this module can safely
// model. Such a row is dropped (mapped to `null`) rather than coerced to a
// default: money is stored in integer minor units, so silently coercing an
// unrecognized currency to e.g. "GEL" would misreport an amount, which is
// worse than treating the tender as absent.
function toTenderDraft(row: Tender): TenderDraft | null {
  if (row.specialty !== "CONSTRUCTION_REPAIR") {
    return null;
  }
  if (!isRepresentableCurrency(row.currency)) {
    return null;
  }

  return {
    id: row.id,
    ownerId: row.ownerId,
    status: row.status,
    specialty: row.specialty,
    title: row.title,
    shortDescription: row.shortDescription,
    fullDescription: row.fullDescription,
    scopeOfWork: row.scopeOfWork,
    budgetMinorUnits: row.budgetMinorUnits,
    currency: row.currency,
    desiredStartDate: row.desiredStartDate,
    deadline: row.deadline,
    workerNotes: row.workerNotes,
    equipmentNotes: row.equipmentNotes,
    materialNotes: row.materialNotes,
    location: toTenderLocation(row),
    conditions: row.conditions,
    publishedAt: row.publishedAt,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Maps a row already flipped to PUBLISHED to the narrower `TenderRecord`
// projection. `evaluateDraftForPublication` guarantees every field below is
// non-null at the moment `publish` runs, and none of the update paths in this
// module ever unset a field once it is set, so this mapping cannot fail in
// practice. It still follows the never-throw convention of `toTenderDraft`:
// a row this module cannot represent as a `TenderRecord` is treated the same
// way an unrepresentable row is treated elsewhere in this file — as absent.
function toTenderRecord(row: Tender): TenderRecord | null {
  const draft = toTenderDraft(row);
  if (draft === null) {
    return null;
  }
  if (
    draft.status !== "PUBLISHED" ||
    draft.shortDescription === null ||
    draft.fullDescription === null ||
    draft.scopeOfWork === null ||
    draft.budgetMinorUnits === null ||
    draft.currency === null ||
    draft.deadline === null ||
    draft.location === null ||
    draft.publishedAt === null
  ) {
    return null;
  }

  return {
    ...draft,
    status: draft.status,
    shortDescription: draft.shortDescription,
    fullDescription: draft.fullDescription,
    scopeOfWork: draft.scopeOfWork,
    budgetMinorUnits: draft.budgetMinorUnits,
    currency: draft.currency,
    deadline: draft.deadline,
    location: draft.location,
    publishedAt: draft.publishedAt,
  };
}

// Shared by `searchPublished` and `getPublished`: both discovery query
// methods only ever see rows that are currently PUBLISHED and whose
// deadline has not yet elapsed, so the base predicate lives in one place.
// The optional filters are merged into the same `deadline`/`budgetMinorUnits`
// keys the base predicate uses (rather than spread as sibling keys) because a
// second spread of the same key would silently overwrite the first instead
// of combining both bounds.
function publishedFilterWhere(
  filter: SearchPublishedTendersQuery,
  now: Date,
): Prisma.TenderWhereInput {
  return {
    status: "PUBLISHED",
    deadline: {
      gt: now,
      ...(filter.deadlineBefore === undefined
        ? {}
        : { lt: filter.deadlineBefore }),
    },
    ...(filter.specialty === undefined ? {} : { specialty: filter.specialty }),
    // City and district reach this query as free text a provider typed, so
    // they match case-insensitively; an exact match would silently return
    // nothing for "batumi".
    ...(filter.city === undefined
      ? {}
      : { city: { equals: filter.city, mode: "insensitive" as const } }),
    ...(filter.district === undefined
      ? {}
      : {
          district: { equals: filter.district, mode: "insensitive" as const },
        }),
    ...(filter.currency === undefined ? {} : { currency: filter.currency }),
    ...(filter.minBudgetMinorUnits === undefined &&
    filter.maxBudgetMinorUnits === undefined
      ? {}
      : {
          budgetMinorUnits: {
            ...(filter.minBudgetMinorUnits === undefined
              ? {}
              : { gte: filter.minBudgetMinorUnits }),
            ...(filter.maxBudgetMinorUnits === undefined
              ? {}
              : { lte: filter.maxBudgetMinorUnits }),
          },
        }),
    ...(filter.publishedAfter === undefined
      ? {}
      : { publishedAt: { gt: filter.publishedAfter } }),
  };
}

export class PrismaTenderRepository implements TenderRepository {
  async createDraft(
    command: CreateTenderDraftCommand,
    actor: TenderActor,
    ids: Readonly<{ tenderId: string }>,
    now: Date,
  ): Promise<Result<TenderDraft, never>> {
    const created = await database.tender.create({
      data: {
        id: ids.tenderId,
        ownerId: actor.id,
        status: "DRAFT",
        specialty: command.specialty,
        title: command.title,
        createdAt: now,
        updatedAt: now,
      },
    });
    const draft = toTenderDraft(created);
    if (draft === null) {
      // Cannot happen: this call always writes a supported specialty and no
      // currency, so the row it just created is always representable.
      throw new Error(
        `Failed to map newly created tender ${created.id} to a TenderDraft.`,
      );
    }
    return { ok: true, value: draft };
  }

  async getOwned(
    id: string,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, "TENDER_NOT_FOUND" | "NOT_OWNER">> {
    const row = await database.tender.findUnique({ where: { id } });
    if (row === null) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    if (row.ownerId !== actor.id) {
      return { ok: false, error: "NOT_OWNER" };
    }
    const draft = toTenderDraft(row);
    if (draft === null) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    return { ok: true, value: draft };
  }

  async listOwned(actor: TenderActor): Promise<readonly TenderDraft[]> {
    const rows = await database.tender.findMany({
      where: { ownerId: actor.id },
      orderBy: { createdAt: "desc" },
    });
    return rows
      .map(toTenderDraft)
      .filter((draft): draft is TenderDraft => draft !== null);
  }

  async updateDraft(
    id: string,
    command: UpdateTenderDraftCommand,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, TenderMutationError>> {
    const data = {
      ...(command.title === undefined ? {} : { title: command.title }),
      ...(command.shortDescription === undefined
        ? {}
        : { shortDescription: command.shortDescription }),
      ...(command.fullDescription === undefined
        ? {}
        : { fullDescription: command.fullDescription }),
      ...(command.scopeOfWork === undefined
        ? {}
        : { scopeOfWork: command.scopeOfWork }),
      ...(command.budgetMinorUnits === undefined
        ? {}
        : { budgetMinorUnits: command.budgetMinorUnits }),
      ...(command.currency === undefined ? {} : { currency: command.currency }),
      ...(command.desiredStartDate === undefined
        ? {}
        : { desiredStartDate: command.desiredStartDate }),
      ...(command.deadline === undefined ? {} : { deadline: command.deadline }),
      ...(command.workerNotes === undefined
        ? {}
        : { workerNotes: command.workerNotes }),
      ...(command.equipmentNotes === undefined
        ? {}
        : { equipmentNotes: command.equipmentNotes }),
      ...(command.materialNotes === undefined
        ? {}
        : { materialNotes: command.materialNotes }),
      ...(command.conditions === undefined
        ? {}
        : { conditions: command.conditions }),
    };

    // The state transition is the guard: only a row that is still owned by
    // this actor and still a DRAFT gets updated, in one atomic statement, so
    // there is no window between reading `status` and writing where a
    // concurrent publish/cancel could let a published tender's material
    // fields be edited in place.
    const { count } = await database.tender.updateMany({
      where: { id, ownerId: actor.id, status: "DRAFT" },
      data,
    });

    if (count === 0) {
      const existing = await database.tender.findUnique({ where: { id } });
      if (existing === null) {
        return { ok: false, error: "TENDER_NOT_FOUND" };
      }
      if (existing.ownerId !== actor.id) {
        return { ok: false, error: "NOT_OWNER" };
      }
      return { ok: false, error: "NOT_DRAFT" };
    }

    const updated = await database.tender.findUniqueOrThrow({ where: { id } });
    const draft = toTenderDraft(updated);
    if (draft === null) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    return { ok: true, value: draft };
  }

  async updateLocation(
    id: string,
    location: TenderLocation,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, TenderMutationError>> {
    // Same atomic guard as `updateDraft`: the conditional `updateMany` is the
    // state transition and the ownership/draft check in one statement, so
    // there is no read-then-write window a concurrent publish/cancel could
    // slip through.
    const { count } = await database.tender.updateMany({
      where: { id, ownerId: actor.id, status: "DRAFT" },
      data: {
        countryCode: location.countryCode,
        city: location.city,
        district: location.district,
        addressLine: location.addressLine,
        exactLatitude: location.exact.latitude,
        exactLongitude: location.exact.longitude,
        publicLatitude: location.public.latitude,
        publicLongitude: location.public.longitude,
      },
    });

    if (count === 0) {
      const existing = await database.tender.findUnique({ where: { id } });
      if (existing === null) {
        return { ok: false, error: "TENDER_NOT_FOUND" };
      }
      if (existing.ownerId !== actor.id) {
        return { ok: false, error: "NOT_OWNER" };
      }
      return { ok: false, error: "NOT_DRAFT" };
    }

    const updated = await database.tender.findUniqueOrThrow({ where: { id } });
    const draft = toTenderDraft(updated);
    if (draft === null) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    return { ok: true, value: draft };
  }

  async publish(
    id: string,
    actor: TenderActor,
    now: Date,
  ): Promise<
    Result<TenderRecord, TenderMutationError | "DEADLINE_NOT_FUTURE">
  > {
    // Same atomic guard as `updateDraft`/`updateLocation`: the conditional
    // `updateMany` is the state transition itself, so two concurrent
    // publishes race on this single statement and exactly one of them
    // reports `count === 1`. The `where` clause also re-asserts
    // `deadline: { gt: now }` — the same predicate
    // `evaluateDraftForPublication` already checked before this call — so a
    // deadline that elapses during the round trip between that check and
    // this write is caught by the write itself, not just by the earlier,
    // now-stale, in-memory check.
    const { count } = await database.tender.updateMany({
      where: {
        id,
        ownerId: actor.id,
        status: "DRAFT",
        deadline: { gt: now },
      },
      data: { status: "PUBLISHED", publishedAt: now },
    });

    if (count === 0) {
      const existing = await database.tender.findUnique({ where: { id } });
      if (existing === null) {
        return { ok: false, error: "TENDER_NOT_FOUND" };
      }
      if (existing.ownerId !== actor.id) {
        return { ok: false, error: "NOT_OWNER" };
      }
      if (existing.status !== "DRAFT") {
        return { ok: false, error: "NOT_DRAFT" };
      }
      // Still a DRAFT, still owned by this actor: the only remaining reason
      // the `where` clause could have matched zero rows is the deadline
      // predicate, i.e. the deadline elapsed between
      // `evaluateDraftForPublication` and this write.
      return { ok: false, error: "DEADLINE_NOT_FUTURE" };
    }

    const updated = await database.tender.findUniqueOrThrow({ where: { id } });
    const record = toTenderRecord(updated);
    if (record === null) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    return { ok: true, value: record };
  }

  async cancel(
    id: string,
    command: CancelTenderCommand,
    actor: TenderActor,
    now: Date,
  ): Promise<Result<TenderDraft, CancelError>> {
    // Cancellation is legal from DRAFT and PUBLISHED alike, so the guard
    // condition differs from `updateDraft`/`publish`: any status other than
    // CANCELLED is eligible. The conditional `updateMany` is still the sole
    // state transition, so two concurrent cancellations race on this one
    // statement and exactly one of them reports `count === 1`; the loser
    // re-reads the row and observes `status === "CANCELLED"`, reporting
    // `ALREADY_CANCELLED`.
    const { count } = await database.tender.updateMany({
      where: { id, ownerId: actor.id, status: { in: ["DRAFT", "PUBLISHED"] } },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelReason: command.reason,
      },
    });

    if (count === 0) {
      const existing = await database.tender.findUnique({ where: { id } });
      if (existing === null) {
        return { ok: false, error: "TENDER_NOT_FOUND" };
      }
      if (existing.ownerId !== actor.id) {
        return { ok: false, error: "NOT_OWNER" };
      }
      return { ok: false, error: "ALREADY_CANCELLED" };
    }

    const updated = await database.tender.findUniqueOrThrow({ where: { id } });
    const draft = toTenderDraft(updated);
    if (draft === null) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    return { ok: true, value: draft };
  }

  async searchPublished(
    filter: SearchPublishedTendersQuery,
    now: Date,
  ): Promise<readonly TenderRecord[]> {
    const rows = await database.tender.findMany({
      where: publishedFilterWhere(filter, now),
      orderBy: { publishedAt: "desc" },
      take: MAX_PUBLISHED_TENDER_RESULTS,
    });
    return rows
      .map(toTenderRecord)
      .filter((record): record is TenderRecord => record !== null);
  }

  async getPublished(
    id: string,
    now: Date,
  ): Promise<Result<TenderRecord, "TENDER_NOT_FOUND">> {
    const row = await database.tender.findFirst({
      where: { id, status: "PUBLISHED", deadline: { gt: now } },
    });
    if (row === null) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    const record = toTenderRecord(row);
    if (record === null) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    return { ok: true, value: record };
  }
}

export const prismaTenderRepository = new PrismaTenderRepository();
