import type { Coordinates } from "./coordinates";
import type { TenderServiceCode, TenderSpecialty } from "./service-taxonomy";

export type { TenderServiceCode, TenderSpecialty } from "./service-taxonomy";

export type TenderStatus =
  | "DRAFT"
  | "PUBLISHED"
  // Selection ran and produced a winner.
  | "CLOSED"
  // The deadline passed with no eligible bid.
  | "EXPIRED"
  | "CANCELLED";

// The statuses for which every publication-required field is guaranteed
// non-null. A settled tender is still fully readable — its winner and its
// losers both need to see the record they competed on.
export type PublishedTenderStatus = "PUBLISHED" | "CLOSED" | "EXPIRED";

export type TenderCurrency = "GEL" | "USD";

// How the client located the job: by typing a street address, or by placing a
// pin. The two carry different authoritative fields — `addressLine` for
// ADDRESS, `exact` for PIN, with the other derived by the geocoder — so the
// mode has to travel with the location rather than be guessed from it.
export type TenderLocationMode = "ADDRESS" | "PIN";

export type TenderLocation = Readonly<{
  countryCode: "GE";
  mode: TenderLocationMode;
  placeId?: number | null;
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
  serviceCode: TenderServiceCode;
  title: string;
  shortDescription: string | null;
  fullDescription: string | null;
  scopeOfWork: string | null;
  workItems?: readonly import("./work-item").WorkItem[];
  areaSquareMeters?: number | null;
  reference?: string | null;
  attachmentCounts?: Readonly<{ photos: number; files: number }>;
  offerCount?: number;
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
// so `TenderRecord` deliberately narrows `status` to a `PublishedTenderStatus`.
export type TenderRecord = TenderDraft &
  Readonly<{
    status: PublishedTenderStatus;
    shortDescription: string;
    fullDescription: string;
    scopeOfWork: string;
    budgetMinorUnits: number;
    currency: TenderCurrency;
    deadline: Date;
    location: TenderLocation;
    publishedAt: Date;
  }>;
