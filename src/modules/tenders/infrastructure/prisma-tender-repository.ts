import type { Tender } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import type { Result } from "../../shared";
import type {
  CreateTenderDraftCommand,
  CreateTenderDraftRepository,
  TenderActor,
} from "../application/create-tender-draft";
import type { GetOwnedTenderRepository } from "../application/get-owned-tender";
import type { ListOwnedTendersRepository } from "../application/list-owned-tenders";
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
} from "../domain/tender";

export interface TenderRepository
  extends
    CreateTenderDraftRepository,
    UpdateTenderDraftRepository,
    GetOwnedTenderRepository,
    ListOwnedTendersRepository,
    SyncTenderLocationRepository {}

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
}

export const prismaTenderRepository = new PrismaTenderRepository();
