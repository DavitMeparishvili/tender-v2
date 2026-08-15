import type { Coordinates } from "./coordinates";

export type TenderStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
export type TenderSpecialty = "CONSTRUCTION_REPAIR";
export type TenderCurrency = "GEL" | "USD";

export type TenderLocation = Readonly<{
  countryCode: "GE";
  city: string;
  district: string | null;
  addressLine: string;
  exact: Coordinates;
  public: Coordinates;
}>;

export type TenderDraft = Readonly<{
  id: string;
  ownerId: string;
  status: TenderStatus;
  specialty: TenderSpecialty;
  title: string;
  shortDescription: string | null;
  fullDescription: string | null;
  scopeOfWork: string | null;
  budgetMinorUnits: number | null;
  currency: TenderCurrency | null;
  desiredStartDate: Date | null;
  deadline: Date | null;
  workerNotes: string | null;
  equipmentNotes: string | null;
  materialNotes: string | null;
  location: TenderLocation | null;
  conditions: string | null;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;

// A published projection: every field publication requires is non-null. A
// cancelled draft that was never published cannot satisfy `publishedAt: Date`,
// so `TenderRecord` deliberately narrows `status` to `"PUBLISHED"` only.
export type TenderRecord = TenderDraft &
  Readonly<{
    status: "PUBLISHED";
    shortDescription: string;
    fullDescription: string;
    scopeOfWork: string;
    budgetMinorUnits: number;
    currency: TenderCurrency;
    deadline: Date;
    location: TenderLocation;
    publishedAt: Date;
  }>;
