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
    ListOwnedTendersRepository {}

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
// row that fails either check means the stored data has drifted outside what
// this module can safely model. Coercing it into a `TenderDraft` anyway would
// silently hide that corruption, so we throw instead of returning a value.
function toTenderDraft(row: Tender): TenderDraft {
  if (row.specialty !== "CONSTRUCTION_REPAIR") {
    throw new Error(
      `Tender ${row.id} has unsupported specialty "${row.specialty}"; only CONSTRUCTION_REPAIR tenders are representable as a TenderDraft.`,
    );
  }
  if (!isRepresentableCurrency(row.currency)) {
    throw new Error(
      `Tender ${row.id} has unsupported currency "${row.currency}"; only GEL and USD are representable as a TenderDraft.`,
    );
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
    return { ok: true, value: toTenderDraft(created) };
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
    return { ok: true, value: toTenderDraft(row) };
  }

  async listOwned(actor: TenderActor): Promise<readonly TenderDraft[]> {
    const rows = await database.tender.findMany({
      where: { ownerId: actor.id },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toTenderDraft);
  }

  async updateDraft(
    id: string,
    command: UpdateTenderDraftCommand,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, TenderMutationError>> {
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

    const updated = await database.tender.update({
      where: { id },
      data: {
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
        ...(command.currency === undefined
          ? {}
          : { currency: command.currency }),
        ...(command.desiredStartDate === undefined
          ? {}
          : { desiredStartDate: command.desiredStartDate }),
        ...(command.deadline === undefined
          ? {}
          : { deadline: command.deadline }),
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
      },
    });
    return { ok: true, value: toTenderDraft(updated) };
  }
}

export const prismaTenderRepository = new PrismaTenderRepository();
