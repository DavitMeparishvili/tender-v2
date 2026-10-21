import { Prisma, type Tender } from "../../../generated/prisma/client";
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
import type {
  TenderBiddingContext,
  TenderBiddingContextRepository,
} from "../application/get-tender-bidding-context";
import type { GetSettleableTenderRepository } from "../application/get-tender-for-provider";
import type {
  ListOwnedTendersRepository,
  OwnedTenderQuery,
} from "../application/list-owned-tenders";
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
import { readWorkItems } from "../domain/work-item";
import {
  isTenderServiceCode,
  isTenderSpecialty,
} from "../domain/service-taxonomy";
import {
  PUBLISHED_TENDER_STATUSES,
  type TenderCurrency,
  type TenderDraft,
  type TenderLocation,
  type TenderRecord,
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
    GetPublishedTenderRepository,
    GetSettleableTenderRepository,
    TenderBiddingContextRepository {}

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
    // `locationMode` is written by every path that sets a location, and the
    // migration that introduced the column backfilled the rows that predate
    // it, so a located row without a mode cannot occur. ADDRESS is the safe
    // reading if one ever did: it keeps a stored `addressLine` on screen and
    // resubmittable, whereas assuming PIN would discard it.
    mode: row.locationMode ?? "ADDRESS",
    placeId: row.georgianPlaceId,
    city: row.city,
    district: row.district,
    addressLine: row.addressLine,
    exact,
    public: publicCoordinates,
  };
}

// Specialty is shared with provider profiles while serviceCode is the tender's
// precise classification. Keep runtime guards at this persistence boundary so
// generated database values cannot silently escape the application taxonomy.
// Currency remains a plain string column, so it receives the same treatment:
// an unrepresentable row is treated as absent rather than misreported.
function toTenderDraft(row: Tender): TenderDraft | null {
  if (
    !isTenderSpecialty(row.specialty) ||
    !isTenderServiceCode(row.serviceCode)
  ) {
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
    serviceCode: row.serviceCode,
    title: row.title,
    shortDescription: row.shortDescription,
    fullDescription: row.fullDescription,
    scopeOfWork: row.scopeOfWork,
    workItems: readWorkItems(row.workItems),
    areaSquareMeters: row.areaSquareMeters,
    reference: row.reference,
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
    selectionExpiresAt: row.selectionExpiresAt,
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
    draft.status === "DRAFT" ||
    draft.status === "CANCELLED" ||
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
    ...(filter.serviceCode === undefined
      ? {}
      : { serviceCode: filter.serviceCode }),
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
  async isOwnedBy(tenderId: string, userId: string): Promise<boolean> {
    return (
      (await database.tender.count({
        where: { id: tenderId, ownerId: userId },
      })) > 0
    );
  }

  async getClientContact(ownerId: string) {
    const profile = await database.userProfile.findUnique({
      where: { userId: ownerId },
      select: {
        userId: true,
        displayName: true,
        phoneE164: true,
        user: { select: { email: true } },
      },
    });
    return profile === null
      ? null
      : {
          userId: profile.userId,
          displayName: profile.displayName,
          phoneE164: profile.phoneE164,
          email: profile.user.email,
        };
  }

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
        serviceCode: command.serviceCode,
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

  async listOwned(
    actor: TenderActor,
    query: OwnedTenderQuery = {},
  ): Promise<readonly TenderDraft[]> {
    const rows = await database.tender.findMany({
      where: {
        ownerId: actor.id,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                {
                  title: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  city: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  district: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy:
        query.sort === "deadline"
          ? [{ deadline: { sort: "asc", nulls: "last" } }, { id: "asc" }]
          : [
              { createdAt: query.sort === "oldest" ? "asc" : "desc" },
              { id: "asc" },
            ],
      include: {
        attachments: { select: { mimeType: true } },
        _count: { select: { bids: true } },
      },
    });
    return rows
      .map((row) => {
        const tender = toTenderDraft(row);
        return tender
          ? {
              ...tender,
              offerCount: row._count.bids,
              attachmentCounts: {
                photos: row.attachments.filter(
                  (file) =>
                    file.mimeType.startsWith("image/") &&
                    file.mimeType !== "image/vnd.dwg",
                ).length,
                files: row.attachments.filter(
                  (file) =>
                    !file.mimeType.startsWith("image/") ||
                    file.mimeType === "image/vnd.dwg",
                ).length,
              },
            }
          : null;
      })
      .filter((draft) => draft !== null);
  }

  async updateDraft(
    id: string,
    command: UpdateTenderDraftCommand,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, TenderMutationError>> {
    const data = {
      ...(command.workItems === undefined
        ? {}
        : { workItems: command.workItems }),
      ...(command.areaSquareMeters === undefined
        ? {}
        : { areaSquareMeters: command.areaSquareMeters }),
      ...(command.specialty === undefined
        ? {}
        : { specialty: command.specialty }),
      ...(command.serviceCode === undefined
        ? {}
        : { serviceCode: command.serviceCode }),
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
        locationMode: location.mode,
        georgianPlaceId: location.placeId ?? null,
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
    return database.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Tender" WHERE "id" = ${id} FOR UPDATE`,
      );
      const existing = await tx.tender.findUnique({ where: { id } });
      if (!existing) return { ok: false, error: "TENDER_NOT_FOUND" };
      if (existing.ownerId !== actor.id)
        return { ok: false, error: "NOT_OWNER" };
      if (existing.status !== "DRAFT" && existing.status !== "PUBLISHED")
        return { ok: false, error: "ALREADY_CANCELLED" };
      if (
        await tx.bid.count({
          where: { tenderId: id, status: { not: "WITHDRAWN" } },
        })
      )
        return { ok: false, error: "TENDER_HAS_BIDS" };
      const updated = await tx.tender.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelReason: command.reason,
        },
      });
      const draft = toTenderDraft(updated);
      return draft
        ? { ok: true, value: draft }
        : { ok: false, error: "TENDER_NOT_FOUND" };
    });
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

  async getSettleable(
    id: string,
  ): Promise<Result<TenderRecord, "TENDER_NOT_FOUND">> {
    // No deadline predicate and no PUBLISHED-only filter: this is the read
    // that lets a bidder open the tender they competed on after selection.
    const row = await database.tender.findFirst({
      where: { id, status: { in: [...PUBLISHED_TENDER_STATUSES] } },
    });
    if (row === null) return { ok: false, error: "TENDER_NOT_FOUND" };
    const record = toTenderRecord(row);
    return record === null
      ? { ok: false, error: "TENDER_NOT_FOUND" }
      : { ok: true, value: record };
  }

  async getBiddingContext(
    id: string,
  ): Promise<Result<TenderBiddingContext, "TENDER_NOT_FOUND">> {
    const row = await database.tender.findFirst({
      where: { id, status: { in: [...PUBLISHED_TENDER_STATUSES] } },
      select: {
        id: true,
        ownerId: true,
        title: true,
        status: true,
        currency: true,
        budgetMinorUnits: true,
        deadline: true,
      },
    });
    // A settled tender keeps a non-null currency, budget, and deadline —
    // publication required all three — so a row failing these checks has
    // drifted outside what this module can model and is reported as absent,
    // exactly as `toTenderDraft` treats an unrepresentable row.
    if (
      row === null ||
      row.deadline === null ||
      row.budgetMinorUnits === null ||
      (row.currency !== "GEL" && row.currency !== "USD") ||
      row.status === "DRAFT" ||
      row.status === "CANCELLED"
    ) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    return {
      ok: true,
      value: {
        id: row.id,
        ownerId: row.ownerId,
        title: row.title,
        status: row.status,
        currency: row.currency,
        budgetMinorUnits: row.budgetMinorUnits,
        deadline: row.deadline,
      },
    };
  }
}

export const prismaTenderRepository = new PrismaTenderRepository();
