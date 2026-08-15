import type { TenderCurrency, TenderRecord, TenderSpecialty } from "./tender";

export type PublicTenderSummary = Readonly<{
  id: string;
  title: string;
  shortDescription: string;
  specialty: TenderSpecialty;
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
