import type { Coordinates } from "./coordinates";

export type TenderStatus =
  | "DRAFT"
  | "PUBLISHED"
  // Selection ran and produced a winner.
  | "CLOSED"
  // The deadline passed with no eligible bid.
  | "EXPIRED"
  | "CANCELLED";
export type TenderSpecialty = "CONSTRUCTION_REPAIR";
export type TenderCurrency = "GEL" | "USD";

// How the client located the job: by typing a street address, or by placing a
// pin. The two carry different authoritative fields — `addressLine` for
// ADDRESS, `exact` for PIN, with the other derived by the geocoder — so the
// mode has to travel with the location rather than be guessed from it.
export type TenderLocationMode = "ADDRESS" | "PIN";

export type TenderLocation = Readonly<{
  countryCode: "GE";
  mode: TenderLocationMode;
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
