import type {
  PublishedTenderStatus,
  TenderCurrency,
  TenderRecord,
  TenderSpecialty,
} from "./tender";

export type PublicTenderSummary = Readonly<{
  id: string;
  title: string;
  shortDescription: string;
  specialty: TenderSpecialty;
  status: PublishedTenderStatus;
  budgetMinorUnits: number;
  currency: TenderCurrency;
  city: string;
  district: string | null;
  publicLatitude: number;
  publicLongitude: number;
  publishedAt: string;
  deadline: string;
}>;

export type PublicTenderDetail = PublicTenderSummary &
  Readonly<{
    fullDescription: string;
    scopeOfWork: string;
    workerNotes: string | null;
    equipmentNotes: string | null;
    materialNotes: string | null;
    desiredStartDate: string | null;
  }>;

export function toPublicSummary(tender: TenderRecord): PublicTenderSummary {
  return {
    id: tender.id,
    title: tender.title,
    shortDescription: tender.shortDescription,
    specialty: tender.specialty,
    status: tender.status,
    budgetMinorUnits: tender.budgetMinorUnits,
    currency: tender.currency,
    city: tender.location.city,
    district: tender.location.district,
    publicLatitude: tender.location.public.latitude,
    publicLongitude: tender.location.public.longitude,
    publishedAt: tender.publishedAt.toISOString(),
    deadline: tender.deadline.toISOString(),
  };
}

export function toPublicDetail(tender: TenderRecord): PublicTenderDetail {
  return {
    ...toPublicSummary(tender),
    fullDescription: tender.fullDescription,
    scopeOfWork: tender.scopeOfWork,
    workerNotes: tender.workerNotes,
    equipmentNotes: tender.equipmentNotes,
    materialNotes: tender.materialNotes,
    desiredStartDate: tender.desiredStartDate?.toISOString() ?? null,
  };
}

// Everything an entitlement buys, and nothing else. Deriving this from the
// masked projection by spreading guarantees the two can never disagree about
// a shared field, and makes the added fields the complete, reviewable list of
// what entitlement discloses.
export type FullTenderDetail = PublicTenderDetail &
  Readonly<{
    addressLine: string;
    exactLatitude: number;
    exactLongitude: number;
    conditions: string | null;
  }>;

export function toFullDetail(tender: TenderRecord): FullTenderDetail {
  return {
    ...toPublicDetail(tender),
    addressLine: tender.location.addressLine,
    exactLatitude: tender.location.exact.latitude,
    exactLongitude: tender.location.exact.longitude,
    conditions: tender.conditions,
  };
}
