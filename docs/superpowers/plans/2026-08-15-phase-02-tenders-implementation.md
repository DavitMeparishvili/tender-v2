# Phase 2 Tender Authoring and Masked Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a verified client author, preview, publish, and cancel a free construction/repair tender with private attachments and a map-synced location, while a verified construction provider discovers only masked summary/detail data and filters published tenders by specialty, place, budget, and timing.

**Architecture:** A new `tenders` vertical-slice module follows the Phase 1 layering exactly: a dependency-free `domain` (draft shape, publication policy, coordinate coarsening, masking, MIME sniffing, distance), an `application` layer (Zod command contracts, repository interfaces, factories wired with `Clock`/`IdGenerator`), a `ports` folder for the two outbound adapters this phase introduces (object storage, geocoding), an `infrastructure` layer (Prisma repository, S3-compatible object storage adapter, a deterministic in-repo geocoder adapter), an `http` layer (Next.js route handlers), and a `ui` layer (authoring wizard, client list/detail, provider masked list/detail). Owner-only full data and provider-only masked data are two distinct repository query paths so a masking bug cannot leak into the owner path by accident.

**Tech Stack:** Phase 1 stack plus `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` against a local MinIO container (S3-compatible), a dependency-free deterministic Georgian-city geocoder adapter (no external geocoding vendor is introduced in this phase — see Architecture Decision below), Zod route contracts, PostgreSQL integration tests, and Playwright.

**Spec:** `docs/superpowers/plans/2026-08-14-tender-marketplace-roadmap.md` (Phase 2 section), read together with `Product_description.md` and `Specs.md` at the repository root. No dedicated Phase 2 UI/design spec exists yet (deferred by user decision); this plan reuses the approved Phase 1 tokens in `DESIGN.md` rather than introducing a new visual system.

## Global Constraints

- `Product_description.md` and `Specs.md` are the source of truth; first market is Georgia (`GE`), locales `ka`/`en`, currencies `GEL`/`USD`.
- Client tender posting is free — publication must never create a billing/payment record.
- Money is stored in integer minor units; time is stored in UTC.
- Prisma migrations are committed and forward-only.
- No source module imports Prisma except database adapters; domain files import nothing but their own module's `domain` folder and `src/modules/shared`.
- Every authorization decision is server-side; ownership (`ownerId === actor.id`) is enforced in the repository/application layer, never trusted from client input.
- WCAG 2.2 AA is the accessibility target; UI reuses the `Field`, `ErrorSummary`, and `SubmitButton` primitives and the token set in `DESIGN.md` rather than inventing new colors, type, or motion.
- Reference app logic may be consulted; reference app design must not be copied.

**Architecture decisions for this phase (recorded per the roadmap's change-control rule):**

1. **Geocoding vendor deferred.** The roadmap requires geocoding/reverse-geocoding _ports_ but does not name a vendor, and no managed external account is approved yet. This plan ships a dependency-free deterministic adapter (`GazetteerGeocoder`) backed by a static table of Georgian cities, exactly like Phase 1 deferred real email delivery behind `LogMailSender`. Swapping in a paid geocoding API is a later, separately approved infrastructure change behind the same `Geocoder` port.
2. **`TenderStatus` has three values in this phase: `DRAFT`, `PUBLISHED`, `CANCELLED`.** `EXPIRED` is Phase 3's concern (it owns the "expired-without-bids" path per the roadmap). Discovery and listing queries filter `deadline > now` at query time so a past-deadline tender never appears as available, without this phase persisting an expiry transition or running a background job.
3. **Object storage runs against a local MinIO container** (S3-compatible) in dev/test/CI, matching the roadmap's "S3-compatible storage adapter" requirement without waiting on a managed provider decision (mirrors Phase 5's deferred real-payment-provider evaluation).

4. **Maps render with Leaflet against OpenStreetMap tiles** (added 2026-08-15, after this plan shipped `Choose on map` as two numeric inputs with no map). The roadmap's Phase 2 scope requires "map pin synchronization" and its automated proof requires Playwright to "select a map location"; neither was satisfied. A tile layer needs no API key, account, or vendor contract, so it does not reopen the geocoding-vendor deferral in decision 1 — that stub remains. See `docs/superpowers/specs/2026-08-15-phase-02-map-design.md` for the masking rule, visual treatment, and the production tile-source constraint.

---

## Planned file structure

```text
compose.yaml                                        + minio, minio-init services
package.json                                        + storage deps, seed:phase-2, verify:phase-2
.env.example, .env.test.example                     + STORAGE_* entries
.github/workflows/verify.yml                        + phase-2 job with a MinIO service
app/globals.css                                     + four-column wizard rail
src/config/env.ts                                   + STORAGE_* schema entries
src/config/env.test.ts                              + STORAGE_* in the accepted fixture
prisma/schema.prisma                                 + TenderStatus, Tender, TenderAttachment
app/
  api/tenders/route.ts                                POST create draft, GET list mine
  api/tenders/[id]/route.ts                            GET own detail, PATCH update draft
  api/tenders/[id]/location/route.ts                   PATCH geocode/pin sync
  api/tenders/[id]/publish/route.ts                    POST publish
  api/tenders/[id]/cancel/route.ts                     POST cancel
  api/tenders/[id]/attachments/route.ts                POST upload, GET list
  api/tenders/[id]/attachments/[attachmentId]/download/route.ts   GET signed URL
  api/tenders/discover/route.ts                        GET masked search list (provider)
  api/tenders/discover/[id]/route.ts                    GET masked detail (provider)
  [locale]/(workspace)/client/tenders/page.tsx          client tender list
  [locale]/(workspace)/client/tenders/new/page.tsx       authoring wizard (create)
  [locale]/(workspace)/client/tenders/[id]/page.tsx      draft/published detail, edit, publish, cancel
  [locale]/(workspace)/provider/tenders/page.tsx         masked list + filters
  [locale]/(workspace)/provider/tenders/[id]/page.tsx    masked detail
src/modules/tenders/
  domain/tender.ts                                    core record/draft types
  domain/coordinates.ts + coordinates.test.ts          coarsening + haversine distance
  domain/mime-sniff.ts + mime-sniff.test.ts            magic-byte MIME detection
  domain/publication-policy.ts + publication-policy.test.ts   completeness + deadline check
  domain/masking.ts + masking.test.ts                  full -> public projection
  domain/constraints.ts                                shared numeric/format limits
  application/create-tender-draft.ts
  application/update-tender-draft.ts
  application/sync-tender-location.ts
  application/publish-tender.ts + publish-tender.integration.test.ts
  application/cancel-tender.ts
  application/list-owned-tenders.ts
  application/get-owned-tender.ts
  application/upload-tender-attachment.ts
  application/list-tender-attachments.ts
  application/get-attachment-download.ts
  application/search-published-tenders.ts + search-published-tenders.integration.test.ts
  application/get-published-tender.ts
  ports/object-storage.ts
  ports/geocoder.ts
  infrastructure/prisma-tender-repository.ts + prisma-tender-repository.integration.test.ts
  infrastructure/prisma-attachment-repository.ts + prisma-attachment-repository.integration.test.ts
  infrastructure/s3-object-storage.ts
  infrastructure/gazetteer-geocoder.ts + gazetteer-geocoder.test.ts
  http/tender-handlers.ts + tender-handlers.test.ts
  http/attachment-handlers.ts
  http/discovery-handlers.ts
  http/map-tender-error.ts
  ui/tender-wizard.tsx + tender-wizard.test.tsx
  ui/tender-detail.tsx
  ui/tender-list.tsx
  ui/discovery-list.tsx
  ui/discovery-filters.tsx
src/modules/localization/messages/{ka,en}.json          + tenders.* keys
src/modules/localization/messages.test.ts               + "tenders" in the required-group list
src/modules/identity/ui/workspace-view.tsx              empty states link into the tender surfaces
scripts/seed-phase-02.ts
src/test/e2e/fixtures/tenders.ts
src/test/e2e/fixtures/files/{valid.pdf,valid.jpg,oversized.jpg,spoofed.pdf}
src/test/e2e/phase-02-authoring.spec.ts
src/test/e2e/phase-02-discovery.spec.ts
```

---

### Task 1: Tender domain model, coordinate math, and Prisma schema

**Files:**

- Create: `src/modules/tenders/domain/tender.ts`
- Create: `src/modules/tenders/domain/constraints.ts`
- Create: `src/modules/tenders/domain/coordinates.ts`
- Create: `src/modules/tenders/domain/coordinates.test.ts`
- Create: `src/modules/tenders/domain/publication-policy.ts`
- Create: `src/modules/tenders/domain/publication-policy.test.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_tenders/migration.sql`

**Interfaces:**

- Consumes: `Result<T, E>` from `@/src/modules/shared`.
- Produces: `TenderSpecialty`, `TenderCurrency`, `TenderLocation`, `TenderDraft`, `TenderRecord`, `Coordinates`, `coarsenCoordinates`, `distanceKilometers`, `PublicationBlockingReason`, `evaluateDraftForPublication`.

- [ ] **Step 1: Write failing coordinate tests**

```ts
// src/modules/tenders/domain/coordinates.test.ts
import { describe, expect, it } from "vitest";
import { coarsenCoordinates, distanceKilometers } from "./coordinates";

describe("coarsenCoordinates", () => {
  it("rounds to two decimal places (~1.1km grid)", () => {
    expect(
      coarsenCoordinates({ latitude: 41.715138, longitude: 44.827096 }),
    ).toEqual({
      latitude: 41.72,
      longitude: 44.83,
    });
  });

  it("never returns the exact input for a fractional coordinate", () => {
    const exact = { latitude: 41.715138, longitude: 44.827096 };
    expect(coarsenCoordinates(exact)).not.toEqual(exact);
  });
});

describe("distanceKilometers", () => {
  it("returns ~0 for the same point", () => {
    const point = { latitude: 41.7151, longitude: 44.8271 };
    expect(distanceKilometers(point, point)).toBeCloseTo(0, 3);
  });

  it("returns the known great-circle distance between Tbilisi and Batumi", () => {
    const tbilisi = { latitude: 41.7151, longitude: 44.8271 };
    const batumi = { latitude: 41.6168, longitude: 41.6367 };
    expect(distanceKilometers(tbilisi, batumi)).toBeCloseTo(280, -1);
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm vitest run src/modules/tenders/domain/coordinates.test.ts`
Expected: FAIL because `./coordinates` does not exist.

- [ ] **Step 3: Implement coordinate math**

```ts
// src/modules/tenders/domain/coordinates.ts
export type Coordinates = Readonly<{ latitude: number; longitude: number }>;

const EARTH_RADIUS_KILOMETERS = 6371;

export function coarsenCoordinates(exact: Coordinates): Coordinates {
  return {
    latitude: Math.round(exact.latitude * 100) / 100,
    longitude: Math.round(exact.longitude * 100) / 100,
  };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceKilometers(a: Coordinates, b: Coordinates): number {
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KILOMETERS * Math.asin(Math.sqrt(haversine));
}
```

- [ ] **Step 4: Run tests and confirm pass**

Run: `pnpm vitest run src/modules/tenders/domain/coordinates.test.ts`
Expected: PASS.

- [ ] **Step 5: Add domain constants and core types**

```ts
// src/modules/tenders/domain/constraints.ts
export const MAX_ATTACHMENTS_PER_TENDER = 10;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AllowedAttachmentMimeType =
  (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];
```

```ts
// src/modules/tenders/domain/tender.ts
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
```

- [ ] **Step 6: Write failing publication-policy tests**

```ts
// src/modules/tenders/domain/publication-policy.test.ts
import { describe, expect, it } from "vitest";
import { evaluateDraftForPublication } from "./publication-policy";
import type { TenderDraft } from "./tender";

const now = new Date("2026-08-15T12:00:00.000Z");
const future = new Date("2026-09-01T12:00:00.000Z");
const past = new Date("2026-08-01T12:00:00.000Z");

const complete: TenderDraft = {
  id: "tender-1",
  ownerId: "user-1",
  status: "DRAFT",
  specialty: "CONSTRUCTION_REPAIR",
  title: "Renovate a two-bedroom apartment",
  shortDescription: "Full interior renovation",
  fullDescription: "Strip and rebuild kitchen and bathroom finishes.",
  scopeOfWork: "Demolition, plumbing, tiling, painting",
  budgetMinorUnits: 500_000,
  currency: "GEL",
  desiredStartDate: null,
  deadline: future,
  workerNotes: null,
  equipmentNotes: null,
  materialNotes: null,
  location: {
    countryCode: "GE",
    city: "Tbilisi",
    district: "Vake",
    addressLine: "1 Chavchavadze Ave",
    exact: { latitude: 41.71, longitude: 44.75 },
    public: { latitude: 41.71, longitude: 44.75 },
  },
  conditions: null,
  publishedAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: now,
  updatedAt: now,
};

describe("evaluateDraftForPublication", () => {
  it("allows a fully populated draft with a future deadline", () => {
    expect(evaluateDraftForPublication(complete, now)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it.each([
    [{ ...complete, shortDescription: null }, "SHORT_DESCRIPTION_REQUIRED"],
    [{ ...complete, fullDescription: null }, "FULL_DESCRIPTION_REQUIRED"],
    [{ ...complete, scopeOfWork: null }, "SCOPE_REQUIRED"],
    [{ ...complete, budgetMinorUnits: null }, "BUDGET_REQUIRED"],
    [{ ...complete, currency: null }, "BUDGET_REQUIRED"],
    [{ ...complete, location: null }, "LOCATION_REQUIRED"],
    [{ ...complete, deadline: null }, "DEADLINE_REQUIRED"],
    [{ ...complete, deadline: past }, "DEADLINE_NOT_FUTURE"],
  ] as const)("rejects an incomplete draft", (draft, reason) => {
    expect(evaluateDraftForPublication(draft, now)).toEqual({
      ok: false,
      error: reason,
    });
  });
});
```

- [ ] **Step 7: Run tests and confirm failure**

Run: `pnpm vitest run src/modules/tenders/domain/publication-policy.test.ts`
Expected: FAIL because `./publication-policy` does not exist.

- [ ] **Step 8: Implement the publication policy**

```ts
// src/modules/tenders/domain/publication-policy.ts
import type { Result } from "@/src/modules/shared";
import type { TenderDraft } from "./tender";

export type PublicationBlockingReason =
  | "TITLE_REQUIRED"
  | "SHORT_DESCRIPTION_REQUIRED"
  | "FULL_DESCRIPTION_REQUIRED"
  | "SCOPE_REQUIRED"
  | "BUDGET_REQUIRED"
  | "LOCATION_REQUIRED"
  | "DEADLINE_REQUIRED"
  | "DEADLINE_NOT_FUTURE";

export function evaluateDraftForPublication(
  draft: TenderDraft,
  now: Date,
): Result<void, PublicationBlockingReason> {
  if (draft.title.trim().length === 0) {
    return { ok: false, error: "TITLE_REQUIRED" };
  }
  if (!draft.shortDescription) {
    return { ok: false, error: "SHORT_DESCRIPTION_REQUIRED" };
  }
  if (!draft.fullDescription) {
    return { ok: false, error: "FULL_DESCRIPTION_REQUIRED" };
  }
  if (!draft.scopeOfWork) {
    return { ok: false, error: "SCOPE_REQUIRED" };
  }
  if (draft.budgetMinorUnits === null || draft.currency === null) {
    return { ok: false, error: "BUDGET_REQUIRED" };
  }
  if (!draft.location) {
    return { ok: false, error: "LOCATION_REQUIRED" };
  }
  if (!draft.deadline) {
    return { ok: false, error: "DEADLINE_REQUIRED" };
  }
  if (draft.deadline.getTime() <= now.getTime()) {
    return { ok: false, error: "DEADLINE_NOT_FUTURE" };
  }

  return { ok: true, value: undefined };
}
```

- [ ] **Step 9: Run tests and confirm pass**

Run: `pnpm vitest run src/modules/tenders/domain/publication-policy.test.ts src/modules/tenders/domain/coordinates.test.ts`
Expected: PASS.

- [ ] **Step 10: Add the Prisma schema**

Append to `prisma/schema.prisma` (add `tenders Tender[]` to the existing `User` model's relation list alongside `providerProfile`):

```prisma
enum TenderStatus {
  DRAFT
  PUBLISHED
  CANCELLED
}

model Tender {
  id               String        @id
  ownerId          String
  owner            User          @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  status           TenderStatus  @default(DRAFT)
  specialty        ProviderSpecialtyCode
  title            String
  shortDescription String?
  fullDescription  String?
  scopeOfWork      String?
  budgetMinorUnits Int?
  currency         String?
  desiredStartDate DateTime?
  deadline         DateTime?
  workerNotes      String?
  equipmentNotes   String?
  materialNotes    String?
  countryCode      String?
  city             String?
  district         String?
  addressLine      String?
  exactLatitude    Float?
  exactLongitude   Float?
  publicLatitude   Float?
  publicLongitude  Float?
  conditions       String?
  publishedAt      DateTime?
  cancelledAt      DateTime?
  cancelReason     String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  attachments      TenderAttachment[]

  @@index([ownerId, status])
  @@index([status, specialty, city, deadline])
}

model TenderAttachment {
  id               String   @id
  tenderId         String
  tender           Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  objectKey        String   @unique
  originalFileName String
  mimeType         String
  sizeBytes        Int
  createdAt        DateTime @default(now())

  @@index([tenderId])
}
```

`Tender.specialty` reuses the existing five-value `ProviderSpecialtyCode` enum while `TenderSpecialty` is the single literal `"CONSTRUCTION_REPAIR"`, and `Tender.currency` is a plain `String` like `UserProfile.preferredCurrency`. The row-to-domain mapper therefore narrows both on read exactly as `toSafeProfile` in `PrismaProfileRepository` narrows `accountKind`/`preferredCurrency`/`specialties` today: rows whose `specialty` is not `CONSTRUCTION_REPAIR` or whose `currency` is neither `GEL` nor `USD` are not representable and must not be mapped into a `TenderDraft`/`TenderRecord`.

- [ ] **Step 11: Migrate and re-run domain tests**

Run: `pnpm db:migrate --name tenders; pnpm db:migrate:test; pnpm test:unit`
Expected: migration succeeds; all unit tests including the new domain tests PASS.

- [ ] **Step 12: Commit**

```powershell
git add prisma src/modules/tenders/domain
git commit -m "feat: model tender drafts, coordinates, and publication policy"
```

### Task 2: Draft creation, update, and owned queries (repository + application)

**Files:**

- Create: `src/modules/tenders/application/create-tender-draft.ts`
- Create: `src/modules/tenders/application/update-tender-draft.ts`
- Create: `src/modules/tenders/application/list-owned-tenders.ts`
- Create: `src/modules/tenders/application/get-owned-tender.ts`
- Create: `src/modules/tenders/infrastructure/prisma-tender-repository.ts`
- Create: `src/modules/tenders/infrastructure/prisma-tender-repository.integration.test.ts`

**Interfaces:**

- Consumes: `Clock`, `IdGenerator`, `Result` from `@/src/modules/shared`; `TenderDraft`, `TenderStatus` from `../domain/tender`; `database` from `@/src/infrastructure/db/client`.
- Produces: `TenderRepository` interface, `createTenderDraft(input, actor)`, `updateTenderDraft(id, input, actor)`, `listOwnedTenders(actor)`, `getOwnedTender(id, actor)`, `TenderActor`, `TenderMutationError = "TENDER_NOT_FOUND" | "NOT_OWNER" | "NOT_DRAFT"`.

- [ ] **Step 1: Write a failing integration test for draft creation and ownership**

```ts
// src/modules/tenders/infrastructure/prisma-tender-repository.integration.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "@/src/infrastructure/db/client";
import { PrismaTenderRepository } from "./prisma-tender-repository";

const repository = new PrismaTenderRepository();

async function createOwner(): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: "Owner",
      email: `${id}@tender.test`,
      emailVerified: true,
    },
  });
  return id;
}

afterAll(async () => {
  await database.$disconnect();
});

describe("PrismaTenderRepository", () => {
  it("creates a draft owned by the actor and rejects updates from a different owner", async () => {
    const ownerId = await createOwner();
    const otherId = await createOwner();
    const now = new Date();

    const created = await repository.createDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
      { id: ownerId },
      { tenderId: randomUUID() },
      now,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const ownerRead = await repository.getOwned(created.value.id, {
      id: ownerId,
    });
    expect(ownerRead).toEqual({ ok: true, value: created.value });

    const otherRead = await repository.getOwned(created.value.id, {
      id: otherId,
    });
    expect(otherRead).toEqual({ ok: false, error: "NOT_OWNER" });

    const otherUpdate = await repository.updateDraft(
      created.value.id,
      { budgetMinorUnits: 100_000, currency: "GEL" },
      { id: otherId },
    );
    expect(otherUpdate).toEqual({ ok: false, error: "NOT_OWNER" });
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test:integration -- prisma-tender-repository`
Expected: FAIL because `PrismaTenderRepository` does not exist.

- [ ] **Step 3: Define the application-layer commands and repository interface**

```ts
// src/modules/tenders/application/create-tender-draft.ts
import { z } from "zod";
import type { Clock, IdGenerator, Result } from "@/src/modules/shared";
import type { TenderDraft } from "../domain/tender";

export const createTenderDraftCommandSchema = z
  .object({
    specialty: z.literal("CONSTRUCTION_REPAIR"),
    title: z.string().trim().min(5).max(160),
  })
  .strict();

export type CreateTenderDraftCommand = z.output<
  typeof createTenderDraftCommandSchema
>;
export type TenderActor = Readonly<{ id: string }>;

export interface CreateTenderDraftRepository {
  createDraft(
    command: CreateTenderDraftCommand,
    actor: TenderActor,
    ids: Readonly<{ tenderId: string }>,
    now: Date,
  ): Promise<Result<TenderDraft, never>>;
}

export function createCreateTenderDraft(dependencies: {
  repository: CreateTenderDraftRepository;
  ids: IdGenerator;
  clock: Clock;
}) {
  return async function createTenderDraft(
    input: unknown,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, "INVALID_INPUT">> {
    const parsed = createTenderDraftCommandSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "INVALID_INPUT" };
    }
    return dependencies.repository.createDraft(
      parsed.data,
      actor,
      { tenderId: dependencies.ids.next() },
      dependencies.clock.now(),
    );
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function createTenderDraft(
  input: unknown,
  actor: TenderActor,
): Promise<Result<TenderDraft, "INVALID_INPUT">> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createCreateTenderDraft({
    repository: prismaTenderRepository,
    ids: systemIds,
    clock: systemClock,
  })(input, actor);
}
```

```ts
// src/modules/tenders/application/update-tender-draft.ts
import { z } from "zod";
import type { Result } from "@/src/modules/shared";
import type { TenderDraft } from "../domain/tender";
import type { TenderActor } from "./create-tender-draft";

export const updateTenderDraftCommandSchema = z
  .object({
    title: z.string().trim().min(5).max(160).optional(),
    shortDescription: z.string().trim().min(10).max(240).optional(),
    fullDescription: z.string().trim().min(20).max(5_000).optional(),
    scopeOfWork: z.string().trim().min(10).max(2_000).optional(),
    budgetMinorUnits: z.number().int().positive().optional(),
    currency: z.enum(["GEL", "USD"]).optional(),
    desiredStartDate: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
    workerNotes: z.string().trim().max(1_000).nullable().optional(),
    equipmentNotes: z.string().trim().max(1_000).nullable().optional(),
    materialNotes: z.string().trim().max(1_000).nullable().optional(),
    conditions: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict()
  .refine((command) => Object.keys(command).length > 0);

export type UpdateTenderDraftCommand = z.output<
  typeof updateTenderDraftCommandSchema
>;
export type TenderMutationError =
  "TENDER_NOT_FOUND" | "NOT_OWNER" | "NOT_DRAFT";

export interface UpdateTenderDraftRepository {
  updateDraft(
    id: string,
    command: UpdateTenderDraftCommand,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, TenderMutationError>>;
}

export function createUpdateTenderDraft(
  repository: UpdateTenderDraftRepository,
) {
  return async function updateTenderDraft(
    id: string,
    input: unknown,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, TenderMutationError | "INVALID_INPUT">> {
    const parsed = updateTenderDraftCommandSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "INVALID_INPUT" };
    }
    return repository.updateDraft(id, parsed.data, actor);
  };
}

export async function updateTenderDraft(
  id: string,
  input: unknown,
  actor: TenderActor,
): Promise<Result<TenderDraft, TenderMutationError | "INVALID_INPUT">> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createUpdateTenderDraft(prismaTenderRepository)(id, input, actor);
}
```

```ts
// src/modules/tenders/application/get-owned-tender.ts
import type { Result } from "@/src/modules/shared";
import type { TenderDraft } from "../domain/tender";
import type { TenderActor } from "./create-tender-draft";

export interface GetOwnedTenderRepository {
  getOwned(
    id: string,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, "TENDER_NOT_FOUND" | "NOT_OWNER">>;
}

export function createGetOwnedTender(repository: GetOwnedTenderRepository) {
  return (id: string, actor: TenderActor) => repository.getOwned(id, actor);
}

export async function getOwnedTender(
  id: string,
  actor: TenderActor,
): Promise<Result<TenderDraft, "TENDER_NOT_FOUND" | "NOT_OWNER">> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createGetOwnedTender(prismaTenderRepository)(id, actor);
}
```

```ts
// src/modules/tenders/application/list-owned-tenders.ts
import type { TenderDraft } from "../domain/tender";
import type { TenderActor } from "./create-tender-draft";

export interface ListOwnedTendersRepository {
  listOwned(actor: TenderActor): Promise<readonly TenderDraft[]>;
}

export function createListOwnedTenders(repository: ListOwnedTendersRepository) {
  return (actor: TenderActor) => repository.listOwned(actor);
}

export async function listOwnedTenders(
  actor: TenderActor,
): Promise<readonly TenderDraft[]> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createListOwnedTenders(prismaTenderRepository)(actor);
}
```

- [ ] **Step 4: Implement the Prisma repository**

Map a persisted row to `TenderDraft` (location fields become a nested `TenderLocation` only when `city`, `addressLine`, `exactLatitude`, and `exactLongitude` are all non-null; otherwise `location: null`). `updateDraft` and `getOwned` return `NOT_OWNER` when `ownerId !== actor.id` and `TENDER_NOT_FOUND` when no row matches; `updateDraft` returns `NOT_DRAFT` when `status !== "DRAFT"` so published/cancelled material fields are immutable in place, matching the Phase 2 exit criterion. Use `database.tender.findUnique`/`update`/`create`/`findMany` exactly like `PrismaProfileRepository`, and export a singleton `prismaTenderRepository` implementing every repository interface this module defines (this task's three plus the ones added in later tasks).

- [ ] **Step 5: Run integration test and confirm pass**

Run: `pnpm test:integration -- prisma-tender-repository`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/tenders/application src/modules/tenders/infrastructure
git commit -m "feat: add tender draft creation, update, and owned queries"
```

### Task 3: Object storage port, S3-compatible adapter, and attachment uploads

**Files:**

- Modify: `compose.yaml`
- Modify: `package.json`
- Modify: `.env.example`, `.env.test.example`
- Modify: `src/config/env.ts`
- Create: `src/modules/tenders/domain/mime-sniff.ts`
- Create: `src/modules/tenders/domain/mime-sniff.test.ts`
- Create: `src/modules/tenders/ports/object-storage.ts`
- Create: `src/modules/tenders/infrastructure/s3-object-storage.ts`
- Create: `src/modules/tenders/application/upload-tender-attachment.ts`
- Create: `src/modules/tenders/application/list-tender-attachments.ts`
- Create: `src/modules/tenders/application/get-attachment-download.ts`
- Create: `src/modules/tenders/infrastructure/prisma-attachment-repository.ts`
- Create: `src/modules/tenders/infrastructure/prisma-attachment-repository.integration.test.ts`
- Modify: `src/config/env.test.ts`
- Modify: `.github/workflows/verify.yml`

**Interfaces:**

- Consumes: `MAX_ATTACHMENTS_PER_TENDER`, `MAX_ATTACHMENT_BYTES`, `ALLOWED_ATTACHMENT_MIME_TYPES` from `../domain/constraints`.
- Produces: `sniffAttachmentMimeType(bytes)`, `ObjectStorage`, `uploadTenderAttachment(tenderId, upload, actor)`, `listTenderAttachments(tenderId, actor)`, `getAttachmentDownload(tenderId, attachmentId, actor)`, `AttachmentRecord`.

- [ ] **Step 1: Add the MinIO service**

```yaml
# compose.yaml (add under services:)
minio:
  image: minio/minio:<current RELEASE tag>
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: tender_local
    MINIO_ROOT_PASSWORD: tender_local_only
  ports:
    - "9000:9000"
    - "9001:9001"
  volumes:
    - tender_minio_data:/data
  healthcheck:
    test: ["CMD", "mc", "ready", "local"]
    interval: 2s
    timeout: 3s
    retries: 20

minio-init:
  image: minio/mc:<current RELEASE tag>
  depends_on:
    minio:
      condition: service_healthy
  entrypoint: >
    /bin/sh -c "
    mc alias set local http://minio:9000 tender_local tender_local_only &&
    mc mb --ignore-existing local/tender-dev local/tender-test
    "
```

Pin both images to a real, currently published `RELEASE.*` tag looked up at implementation time (`docker image ls`/registry check) rather than a guessed one — every other service in `compose.yaml` is pinned exactly (`postgres:17`), and an invented tag fails the first `pnpm db:up`.

Add `tender_minio_data:` under the top-level `volumes:` key alongside `tender_dev_data`.

`minio-init` is a one-shot container that exits after creating the buckets, and `db:up` is `docker compose up -d --wait`, which fails when a waited-on service exits. Change the script so the long-running services are waited on and the initializer runs to completion separately:

```json
"db:up": "docker compose up -d --wait postgres-dev postgres-test minio && docker compose run --rm minio-init"
```

- [ ] **Step 2: Add storage dependencies and env vars**

Run:

```powershell
pnpm add --save-exact @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Extend `src/config/env.ts`'s `serverEnvSchema` with:

```ts
STORAGE_ENDPOINT: z.string().url(),
STORAGE_REGION: z.string().min(1),
STORAGE_BUCKET: z.string().min(1),
STORAGE_ACCESS_KEY_ID: z.string().min(1),
STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
STORAGE_FORCE_PATH_STYLE: z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true"),
```

`z.coerce.boolean()` is deliberately avoided: it turns the string `"false"` into `true`, so a deployment that disables path-style addressing could not express that.

Add matching entries to `.env.example` (`STORAGE_BUCKET=tender-dev`, endpoint `http://localhost:9000`) and `.env.test.example` (`STORAGE_BUCKET=tender-test`), reusing the `tender_local`/`tender_local_only` credentials already used for Postgres-local development.

These five variables are required with no fallback (Phase 0's "no missing-environment fallback for required secrets" exit criterion), so every environment that parses `serverEnvSchema` must supply them. Also update, in the same step:

- `src/config/env.test.ts` — the "accepts explicit test configuration" fixture gains the five `STORAGE_*` values; without this the existing unit test fails.
- `.github/workflows/verify.yml` — the job-level `env:` block gains the five `STORAGE_*` values (see Task 12, which adds the Phase 2 job and its MinIO service).

- [ ] **Step 3: Write failing MIME-sniff tests**

```ts
// src/modules/tenders/domain/mime-sniff.test.ts
import { describe, expect, it } from "vitest";
import { sniffAttachmentMimeType } from "./mime-sniff";

describe("sniffAttachmentMimeType", () => {
  it("detects a PDF by its magic bytes", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\n...");
    expect(sniffAttachmentMimeType(bytes)).toBe("application/pdf");
  });

  it("detects a JPEG by its magic bytes", () => {
    expect(
      sniffAttachmentMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])),
    ).toBe("image/jpeg");
  });

  it("detects a PNG by its magic bytes", () => {
    expect(
      sniffAttachmentMimeType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
  });

  it("reports the true type of a payload whose name or declared type claims PDF", () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0]);
    expect(sniffAttachmentMimeType(jpegBytes)).toBe("image/jpeg");
  });

  it("returns null for a text payload named like a PDF", () => {
    expect(
      sniffAttachmentMimeType(new TextEncoder().encode("not really a pdf")),
    ).toBeNull();
  });

  it("returns null for unrecognized bytes", () => {
    expect(sniffAttachmentMimeType(new Uint8Array([0, 1, 2, 3]))).toBeNull();
  });
});
```

- [ ] **Step 4: Run and confirm failure**

Run: `pnpm vitest run src/modules/tenders/domain/mime-sniff.test.ts`
Expected: FAIL because `./mime-sniff` does not exist.

- [ ] **Step 5: Implement MIME sniffing**

```ts
// src/modules/tenders/domain/mime-sniff.ts
import type { AllowedAttachmentMimeType } from "./constraints";

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

export function sniffAttachmentMimeType(
  bytes: Uint8Array,
): AllowedAttachmentMimeType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return "application/pdf"; // %PDF-
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"; // RIFF....WEBP
  }
  return null;
}
```

- [ ] **Step 6: Run and confirm pass**

Run: `pnpm vitest run src/modules/tenders/domain/mime-sniff.test.ts`
Expected: PASS.

- [ ] **Step 7: Define the object storage port and S3-compatible adapter**

```ts
// src/modules/tenders/ports/object-storage.ts
import type { Result } from "@/src/modules/shared";
import type { AllowedAttachmentMimeType } from "../domain/constraints";

export type StoredObject = Readonly<{ objectKey: string; sizeBytes: number }>;

export interface ObjectStorage {
  putObject(input: {
    objectKey: string;
    body: Uint8Array;
    contentType: AllowedAttachmentMimeType;
  }): Promise<Result<StoredObject, "OBJECT_TOO_LARGE">>;
  getSignedDownloadUrl(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<string>;
}
```

Implement `S3ObjectStorage` in `src/modules/tenders/infrastructure/s3-object-storage.ts` using `S3Client` (constructed from `STORAGE_*` env vars, `forcePathStyle: STORAGE_FORCE_PATH_STYLE`), `PutObjectCommand` for `putObject` (reject with `OBJECT_TOO_LARGE` when `body.byteLength > MAX_ATTACHMENT_BYTES` before calling S3), and `getSignedUrl` from `@aws-sdk/s3-request-presigner` with `GetObjectCommand` for `getSignedDownloadUrl`. Export a singleton `s3ObjectStorage`.

- [ ] **Step 8: Define attachment application commands and repository**

```ts
// src/modules/tenders/application/upload-tender-attachment.ts
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENTS_PER_TENDER,
  MAX_ATTACHMENT_BYTES,
} from "../domain/constraints";
import { sniffAttachmentMimeType } from "../domain/mime-sniff";
import type { IdGenerator, Result } from "@/src/modules/shared";
import type { ObjectStorage } from "../ports/object-storage";
import type { TenderActor } from "./create-tender-draft";

export type AttachmentRecord = Readonly<{
  id: string;
  tenderId: string;
  objectKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}>;

export type UploadAttachmentError =
  | "TENDER_NOT_FOUND"
  | "NOT_OWNER"
  | "NOT_DRAFT"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_ATTACHMENTS";

export interface UploadAttachmentRepository {
  countForOwnedDraft(
    tenderId: string,
    actor: TenderActor,
  ): Promise<Result<number, "TENDER_NOT_FOUND" | "NOT_OWNER" | "NOT_DRAFT">>;
  create(
    tenderId: string,
    meta: Readonly<{
      objectKey: string;
      originalFileName: string;
      mimeType: string;
      sizeBytes: number;
    }>,
    id: string,
  ): Promise<AttachmentRecord>;
}

export function createUploadTenderAttachment(dependencies: {
  repository: UploadAttachmentRepository;
  storage: ObjectStorage;
  ids: IdGenerator;
}) {
  return async function uploadTenderAttachment(
    tenderId: string,
    upload: Readonly<{ originalFileName: string; body: Uint8Array }>,
    actor: TenderActor,
  ): Promise<Result<AttachmentRecord, UploadAttachmentError>> {
    const count = await dependencies.repository.countForOwnedDraft(
      tenderId,
      actor,
    );
    if (!count.ok) return count;
    if (count.value >= MAX_ATTACHMENTS_PER_TENDER) {
      return { ok: false, error: "TOO_MANY_ATTACHMENTS" };
    }
    if (upload.body.byteLength > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: "FILE_TOO_LARGE" };
    }

    const sniffed = sniffAttachmentMimeType(upload.body);
    if (sniffed === null || !ALLOWED_ATTACHMENT_MIME_TYPES.includes(sniffed)) {
      return { ok: false, error: "UNSUPPORTED_FILE_TYPE" };
    }

    const objectKey = `tenders/${tenderId}/${dependencies.ids.next()}`;
    const stored = await dependencies.storage.putObject({
      objectKey,
      body: upload.body,
      contentType: sniffed,
    });
    if (!stored.ok) return { ok: false, error: "FILE_TOO_LARGE" };

    const record = await dependencies.repository.create(
      tenderId,
      {
        objectKey,
        originalFileName: upload.originalFileName,
        mimeType: sniffed,
        sizeBytes: stored.value.sizeBytes,
      },
      dependencies.ids.next(),
    );
    return { ok: true, value: record };
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };

export async function uploadTenderAttachment(
  tenderId: string,
  upload: Readonly<{ originalFileName: string; body: Uint8Array }>,
  actor: TenderActor,
): Promise<Result<AttachmentRecord, UploadAttachmentError>> {
  const [{ prismaAttachmentRepository }, { s3ObjectStorage }] =
    await Promise.all([
      import("../infrastructure/prisma-attachment-repository"),
      import("../infrastructure/s3-object-storage"),
    ]);
  return createUploadTenderAttachment({
    repository: prismaAttachmentRepository,
    storage: s3ObjectStorage,
    ids: systemIds,
  })(tenderId, upload, actor);
}
```

```ts
// src/modules/tenders/application/get-attachment-download.ts
import type { Result } from "@/src/modules/shared";
import type { ObjectStorage } from "../ports/object-storage";
import type { TenderActor } from "./create-tender-draft";

const DOWNLOAD_URL_TTL_SECONDS = 60;

export interface GetAttachmentDownloadRepository {
  findOwnedAttachment(
    tenderId: string,
    attachmentId: string,
    actor: TenderActor,
  ): Promise<
    Result<Readonly<{ objectKey: string }>, "NOT_FOUND" | "NOT_OWNER">
  >;
}

export function createGetAttachmentDownload(dependencies: {
  repository: GetAttachmentDownloadRepository;
  storage: ObjectStorage;
}) {
  return async function getAttachmentDownload(
    tenderId: string,
    attachmentId: string,
    actor: TenderActor,
  ): Promise<Result<string, "NOT_FOUND" | "NOT_OWNER">> {
    const attachment = await dependencies.repository.findOwnedAttachment(
      tenderId,
      attachmentId,
      actor,
    );
    if (!attachment.ok) return attachment;
    const url = await dependencies.storage.getSignedDownloadUrl(
      attachment.value.objectKey,
      DOWNLOAD_URL_TTL_SECONDS,
    );
    return { ok: true, value: url };
  };
}

export async function getAttachmentDownload(
  tenderId: string,
  attachmentId: string,
  actor: TenderActor,
): Promise<Result<string, "NOT_FOUND" | "NOT_OWNER">> {
  const [{ prismaAttachmentRepository }, { s3ObjectStorage }] =
    await Promise.all([
      import("../infrastructure/prisma-attachment-repository"),
      import("../infrastructure/s3-object-storage"),
    ]);
  return createGetAttachmentDownload({
    repository: prismaAttachmentRepository,
    storage: s3ObjectStorage,
  })(tenderId, attachmentId, actor);
}
```

```ts
// src/modules/tenders/application/list-tender-attachments.ts
import type { Result } from "@/src/modules/shared";
import type { TenderActor } from "./create-tender-draft";
import type { AttachmentRecord } from "./upload-tender-attachment";

export type ListAttachmentsError = "TENDER_NOT_FOUND" | "NOT_OWNER";

export interface ListTenderAttachmentsRepository {
  listForOwnedTender(
    tenderId: string,
    actor: TenderActor,
  ): Promise<Result<readonly AttachmentRecord[], ListAttachmentsError>>;
}

export function createListTenderAttachments(
  repository: ListTenderAttachmentsRepository,
) {
  return (tenderId: string, actor: TenderActor) =>
    repository.listForOwnedTender(tenderId, actor);
}

export async function listTenderAttachments(
  tenderId: string,
  actor: TenderActor,
): Promise<Result<readonly AttachmentRecord[], ListAttachmentsError>> {
  const { prismaAttachmentRepository } =
    await import("../infrastructure/prisma-attachment-repository");
  return createListTenderAttachments(prismaAttachmentRepository)(
    tenderId,
    actor,
  );
}
```

`listForOwnedTender` accepts any status (the owner must still see attachments on a published or cancelled tender), unlike `countForOwnedDraft`, which is draft-only because it guards uploads.

Note (exit criterion): only the owning client can list or request a download in this phase — there is no provider entitlement mechanism until Phase 3, so `findOwnedAttachment` and `listForOwnedTender` must require `ownerId === actor.id` unconditionally, with no provider path at all.

- [ ] **Step 9: Write a failing integration test proving upload limits**

Four cases, one per roadmap "upload tests reject …" proof: spoofed MIME type, oversized file, excess count, and unauthorized download.

```ts
// src/modules/tenders/infrastructure/prisma-attachment-repository.integration.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "@/src/infrastructure/db/client";
import { MAX_ATTACHMENT_BYTES } from "../domain/constraints";
import { getAttachmentDownload } from "../application/get-attachment-download";
import { uploadTenderAttachment } from "../application/upload-tender-attachment";
import { PrismaTenderRepository } from "./prisma-tender-repository";

const tenders = new PrismaTenderRepository();

async function seedOwnedDraft(): Promise<{
  ownerId: string;
  tenderId: string;
}> {
  const ownerId = randomUUID();
  await database.user.create({
    data: {
      id: ownerId,
      name: "Owner",
      email: `${ownerId}@tender.test`,
      emailVerified: true,
    },
  });
  const created = await tenders.createDraft(
    { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
    { id: ownerId },
    { tenderId: randomUUID() },
    new Date(),
  );
  if (!created.ok) throw new Error("seed failed");
  return { ownerId, tenderId: created.value.id };
}

afterAll(async () => {
  await database.$disconnect();
});

describe("tender attachment uploads", () => {
  it("rejects a file whose bytes do not match any allowed signature", async () => {
    const { ownerId, tenderId } = await seedOwnedDraft();
    const result = await uploadTenderAttachment(
      tenderId,
      {
        originalFileName: "notes.txt",
        body: new TextEncoder().encode("plain text"),
      },
      { id: ownerId },
    );
    expect(result).toEqual({ ok: false, error: "UNSUPPORTED_FILE_TYPE" });
  });

  it("rejects the eleventh attachment for the same tender", async () => {
    const { ownerId, tenderId } = await seedOwnedDraft();
    const pdfBytes = new TextEncoder().encode("%PDF-1.7\n%%EOF");
    for (let index = 0; index < 10; index += 1) {
      const uploaded = await uploadTenderAttachment(
        tenderId,
        { originalFileName: `doc-${index}.pdf`, body: pdfBytes },
        { id: ownerId },
      );
      expect(uploaded.ok).toBe(true);
    }
    const eleventh = await uploadTenderAttachment(
      tenderId,
      { originalFileName: "doc-11.pdf", body: pdfBytes },
      { id: ownerId },
    );
    expect(eleventh).toEqual({ ok: false, error: "TOO_MANY_ATTACHMENTS" });
  });

  it("rejects a file larger than the per-attachment limit", async () => {
    const { ownerId, tenderId } = await seedOwnedDraft();
    const oversized = new Uint8Array(MAX_ATTACHMENT_BYTES + 1);
    oversized.set([0xff, 0xd8, 0xff, 0xe0]);
    const result = await uploadTenderAttachment(
      tenderId,
      { originalFileName: "huge.jpg", body: oversized },
      { id: ownerId },
    );
    expect(result).toEqual({ ok: false, error: "FILE_TOO_LARGE" });
  });

  it("refuses a download to anyone but the owning client", async () => {
    const { ownerId, tenderId } = await seedOwnedDraft();
    const { ownerId: strangerId } = await seedOwnedDraft();
    const uploaded = await uploadTenderAttachment(
      tenderId,
      {
        originalFileName: "plan.pdf",
        body: new TextEncoder().encode("%PDF-1.7\n%%EOF"),
      },
      { id: ownerId },
    );
    if (!uploaded.ok) throw new Error("upload failed");

    const denied = await getAttachmentDownload(tenderId, uploaded.value.id, {
      id: strangerId,
    });
    expect(denied.ok).toBe(false);
  });
});
```

- [ ] **Step 10: Run and confirm failure**

Run: `pnpm db:up; pnpm test:integration -- prisma-attachment-repository`
Expected: FAIL because `PrismaAttachmentRepository` does not exist.

- [ ] **Step 11: Implement the Prisma attachment repository**

`PrismaAttachmentRepository` in `src/modules/tenders/infrastructure/prisma-attachment-repository.ts` implements `UploadAttachmentRepository`, `ListTenderAttachmentsRepository`, and `GetAttachmentDownloadRepository`. `countForOwnedDraft` loads the tender, returns `TENDER_NOT_FOUND`/`NOT_OWNER`/`NOT_DRAFT` exactly like `updateDraft`, then returns `database.tenderAttachment.count({ where: { tenderId } })`. `create` inserts the row and returns the mapped `AttachmentRecord`. `listForOwnedTender` checks ownership without the draft guard and returns the mapped rows ordered by `createdAt`. `findOwnedAttachment` joins through `tender.ownerId` to reject cross-owner reads. Export the singleton `prismaAttachmentRepository`.

- [ ] **Step 12: Run and confirm pass**

Run: `pnpm test:integration -- prisma-attachment-repository`
Expected: PASS.

- [ ] **Step 13: Commit**

```powershell
git add compose.yaml package.json .env.example .env.test.example src/config .github/workflows/verify.yml src/modules/tenders
git commit -m "feat: add S3-compatible attachment storage and MIME sniffing"
```

### Task 4: Geocoding port, deterministic adapter, and location sync

**Files:**

- Create: `src/modules/tenders/ports/geocoder.ts`
- Create: `src/modules/tenders/infrastructure/gazetteer-geocoder.ts`
- Create: `src/modules/tenders/infrastructure/gazetteer-geocoder.test.ts`
- Create: `src/modules/tenders/application/sync-tender-location.ts`

**Interfaces:**

- Consumes: `Coordinates`, `distanceKilometers` from `../domain/coordinates`; `coarsenCoordinates`.
- Produces: `Geocoder`, `GazetteerGeocoder`, `syncTenderLocation(id, input, actor)`.

- [ ] **Step 1: Write failing gazetteer tests**

```ts
// src/modules/tenders/infrastructure/gazetteer-geocoder.test.ts
import { describe, expect, it } from "vitest";
import { GazetteerGeocoder } from "./gazetteer-geocoder";

const geocoder = new GazetteerGeocoder();

describe("GazetteerGeocoder", () => {
  it("geocodes a known city case-insensitively", async () => {
    const result = await geocoder.geocode({
      countryCode: "GE",
      city: "tbilisi",
      addressLine: "1 Chavchavadze Ave",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.latitude).toBeCloseTo(41.7151, 1);
      expect(result.value.longitude).toBeCloseTo(44.8271, 1);
    }
  });

  it("returns ADDRESS_NOT_FOUND for an unknown city", async () => {
    const result = await geocoder.geocode({
      countryCode: "GE",
      city: "Nonexistentville",
      addressLine: "1 Main St",
    });
    expect(result).toEqual({ ok: false, error: "ADDRESS_NOT_FOUND" });
  });

  it("reverse-geocodes to the nearest gazetteer city", async () => {
    const result = await geocoder.reverseGeocode({
      latitude: 41.72,
      longitude: 44.83,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.normalizedAddress).toContain("Tbilisi");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run src/modules/tenders/infrastructure/gazetteer-geocoder.test.ts`
Expected: FAIL because `./gazetteer-geocoder` does not exist.

- [ ] **Step 3: Define the geocoder port**

```ts
// src/modules/tenders/ports/geocoder.ts
import type { Result } from "@/src/modules/shared";
import type { Coordinates } from "../domain/coordinates";

export type GeocodeQuery = Readonly<{
  countryCode: "GE";
  city: string;
  addressLine: string;
}>;

export type GeocodeResult = Readonly<{
  latitude: number;
  longitude: number;
  normalizedAddress: string;
}>;

export interface Geocoder {
  geocode(
    query: GeocodeQuery,
  ): Promise<Result<GeocodeResult, "ADDRESS_NOT_FOUND">>;
  reverseGeocode(
    coordinates: Coordinates,
  ): Promise<Result<GeocodeResult, "COORDINATES_NOT_FOUND">>;
}
```

- [ ] **Step 4: Implement the deterministic gazetteer adapter**

```ts
// src/modules/tenders/infrastructure/gazetteer-geocoder.ts
import { distanceKilometers, type Coordinates } from "../domain/coordinates";
import type { Geocoder, GeocodeQuery, GeocodeResult } from "../ports/geocoder";

const GEORGIAN_CITIES: ReadonlyArray<
  Readonly<{ name: string; latitude: number; longitude: number }>
> = [
  { name: "Tbilisi", latitude: 41.7151, longitude: 44.8271 },
  { name: "Batumi", latitude: 41.6168, longitude: 41.6367 },
  { name: "Kutaisi", latitude: 42.2679, longitude: 42.6946 },
  { name: "Rustavi", latitude: 41.5492, longitude: 45.0006 },
  { name: "Gori", latitude: 41.9847, longitude: 44.1116 },
  { name: "Zugdidi", latitude: 42.5088, longitude: 41.8709 },
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export class GazetteerGeocoder implements Geocoder {
  async geocode(query: GeocodeQuery): ReturnType<Geocoder["geocode"]> {
    const match = GEORGIAN_CITIES.find(
      (city) => normalize(city.name) === normalize(query.city),
    );
    if (!match) return { ok: false, error: "ADDRESS_NOT_FOUND" };

    return {
      ok: true,
      value: {
        latitude: match.latitude,
        longitude: match.longitude,
        normalizedAddress: `${query.addressLine}, ${match.name}, Georgia`,
      },
    };
  }

  async reverseGeocode(
    coordinates: Coordinates,
  ): ReturnType<Geocoder["reverseGeocode"]> {
    let nearest: {
      city: (typeof GEORGIAN_CITIES)[number];
      distance: number;
    } | null = null;
    for (const city of GEORGIAN_CITIES) {
      const distance = distanceKilometers(coordinates, city);
      if (nearest === null || distance < nearest.distance) {
        nearest = { city, distance };
      }
    }
    if (nearest === null) return { ok: false, error: "COORDINATES_NOT_FOUND" };

    const result: GeocodeResult = {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      normalizedAddress: `Near ${nearest.city.name}, Georgia`,
    };
    return { ok: true, value: result };
  }
}

export const gazetteerGeocoder = new GazetteerGeocoder();
```

- [ ] **Step 5: Run and confirm pass**

Run: `pnpm vitest run src/modules/tenders/infrastructure/gazetteer-geocoder.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement the location-sync application command**

```ts
// src/modules/tenders/application/sync-tender-location.ts
import { z } from "zod";
import type { Result } from "@/src/modules/shared";
import { coarsenCoordinates } from "../domain/coordinates";
import type { TenderDraft, TenderLocation } from "../domain/tender";
import type { Geocoder } from "../ports/geocoder";
import type { TenderActor } from "./create-tender-draft";
import type { TenderMutationError } from "./update-tender-draft";

const addressInputSchema = z.object({
  mode: z.literal("ADDRESS"),
  city: z.string().trim().min(2).max(120),
  district: z.string().trim().min(1).max(120).nullable().optional(),
  addressLine: z.string().trim().min(3).max(240),
});
const pinInputSchema = z.object({
  mode: z.literal("PIN"),
  city: z.string().trim().min(2).max(120),
  district: z.string().trim().min(1).max(120).nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const syncTenderLocationCommandSchema = z.discriminatedUnion("mode", [
  addressInputSchema,
  pinInputSchema,
]);
export type SyncTenderLocationCommand = z.output<
  typeof syncTenderLocationCommandSchema
>;
export type SyncLocationError =
  TenderMutationError | "ADDRESS_NOT_FOUND" | "COORDINATES_NOT_FOUND";

export interface SyncTenderLocationRepository {
  updateLocation(
    id: string,
    location: TenderLocation,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, TenderMutationError>>;
}

export function createSyncTenderLocation(dependencies: {
  repository: SyncTenderLocationRepository;
  geocoder: Geocoder;
}) {
  return async function syncTenderLocation(
    id: string,
    input: unknown,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, SyncLocationError | "INVALID_INPUT">> {
    const parsed = syncTenderLocationCommandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

    const resolved =
      parsed.data.mode === "ADDRESS"
        ? await dependencies.geocoder.geocode({
            countryCode: "GE",
            city: parsed.data.city,
            addressLine: parsed.data.addressLine,
          })
        : await dependencies.geocoder.reverseGeocode({
            latitude: parsed.data.latitude,
            longitude: parsed.data.longitude,
          });
    if (!resolved.ok) return resolved;

    const exact =
      parsed.data.mode === "PIN"
        ? { latitude: parsed.data.latitude, longitude: parsed.data.longitude }
        : {
            latitude: resolved.value.latitude,
            longitude: resolved.value.longitude,
          };

    const location: TenderLocation = {
      countryCode: "GE",
      city: parsed.data.city,
      district: parsed.data.district ?? null,
      addressLine:
        parsed.data.mode === "ADDRESS"
          ? parsed.data.addressLine
          : resolved.value.normalizedAddress,
      exact,
      public: coarsenCoordinates(exact),
    };

    return dependencies.repository.updateLocation(id, location, actor);
  };
}

export async function syncTenderLocation(
  id: string,
  input: unknown,
  actor: TenderActor,
): Promise<Result<TenderDraft, SyncLocationError | "INVALID_INPUT">> {
  const [{ prismaTenderRepository }, { gazetteerGeocoder }] = await Promise.all(
    [
      import("../infrastructure/prisma-tender-repository"),
      import("../infrastructure/gazetteer-geocoder"),
    ],
  );
  return createSyncTenderLocation({
    repository: prismaTenderRepository,
    geocoder: gazetteerGeocoder,
  })(id, input, actor);
}
```

Add `updateLocation` to `PrismaTenderRepository` (Task 2's repository): same ownership/`NOT_DRAFT` guard as `updateDraft`, persisting `city`, `district`, `addressLine`, `exactLatitude`/`exactLongitude`, `publicLatitude`/`publicLongitude`.

- [ ] **Step 7: Add an integration test for the address and pin paths**

Extend `prisma-tender-repository.integration.test.ts` with a case that calls `syncTenderLocation` in `"ADDRESS"` mode for a known city and asserts the returned draft's `location.public` differs from `location.exact` (coarsened), and a case using an unknown city that asserts `{ ok: false, error: "ADDRESS_NOT_FOUND" }`.

- [ ] **Step 8: Run and confirm pass**

Run: `pnpm test:integration -- prisma-tender-repository`
Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add src/modules/tenders
git commit -m "feat: add deterministic geocoding and tender location sync"
```

### Task 5: Publish and cancel commands

**Files:**

- Create: `src/modules/tenders/application/publish-tender.ts`
- Create: `src/modules/tenders/application/publish-tender.integration.test.ts`
- Create: `src/modules/tenders/application/cancel-tender.ts`

**Interfaces:**

- Consumes: `evaluateDraftForPublication` from `../domain/publication-policy`.
- Produces: `publishTender(id, actor)`, `cancelTender(id, input, actor)`, `PublishError`, `CancelError`.

- [ ] **Step 1: Write a failing integration test proving publication rejects incomplete/expired drafts and blocks re-editing after publish**

```ts
// src/modules/tenders/application/publish-tender.integration.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "@/src/infrastructure/db/client";
import { updateTenderDraft } from "./update-tender-draft";
import { publishTender } from "./publish-tender";
import { PrismaTenderRepository } from "../infrastructure/prisma-tender-repository";

const tenders = new PrismaTenderRepository();

async function seedOwner(): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: "Owner",
      email: `${id}@tender.test`,
      emailVerified: true,
    },
  });
  return id;
}

afterAll(async () => {
  await database.$disconnect();
});

describe("publishTender", () => {
  it("rejects publication while required fields are missing", async () => {
    const ownerId = await seedOwner();
    const created = await tenders.createDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
      { id: ownerId },
      { tenderId: randomUUID() },
      new Date(),
    );
    if (!created.ok) throw new Error("seed failed");

    const result = await publishTender(created.value.id, { id: ownerId });
    expect(result.ok).toBe(false);
  });

  it("publishes a complete draft and then blocks in-place edits", async () => {
    const ownerId = await seedOwner();
    const created = await tenders.createDraft(
      { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
      { id: ownerId },
      { tenderId: randomUUID() },
      new Date(),
    );
    if (!created.ok) throw new Error("seed failed");
    const tenderId = created.value.id;

    await updateTenderDraft(
      tenderId,
      {
        shortDescription: "Interior repaint, two bedrooms",
        fullDescription: "Sand, prime, and repaint two bedrooms and a hallway.",
        scopeOfWork: "Sanding, priming, two coats of paint",
        budgetMinorUnits: 80_000,
        currency: "GEL",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      { id: ownerId },
    );
    await tenders.updateLocation(
      tenderId,
      {
        countryCode: "GE",
        city: "Tbilisi",
        district: null,
        addressLine: "1 Chavchavadze Ave",
        exact: { latitude: 41.7151, longitude: 44.8271 },
        public: { latitude: 41.72, longitude: 44.83 },
      },
      { id: ownerId },
    );

    const published = await publishTender(tenderId, { id: ownerId });
    expect(published.ok).toBe(true);

    const blockedEdit = await updateTenderDraft(
      tenderId,
      { title: "Retitled after publish" },
      { id: ownerId },
    );
    expect(blockedEdit).toEqual({ ok: false, error: "NOT_DRAFT" });
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test:integration -- publish-tender`
Expected: FAIL because `./publish-tender` does not exist.

- [ ] **Step 3: Implement the publish command**

```ts
// src/modules/tenders/application/publish-tender.ts
import type { Clock, Result } from "@/src/modules/shared";
import {
  evaluateDraftForPublication,
  type PublicationBlockingReason,
} from "../domain/publication-policy";
import type { TenderRecord } from "../domain/tender";
import type { TenderActor } from "./create-tender-draft";
import type { TenderMutationError } from "./update-tender-draft";

export type PublishError = TenderMutationError | PublicationBlockingReason;

export interface PublishTenderRepository {
  getOwned(
    id: string,
    actor: TenderActor,
  ): ReturnType<
    import("./get-owned-tender").GetOwnedTenderRepository["getOwned"]
  >;
  publish(
    id: string,
    actor: TenderActor,
    now: Date,
  ): Promise<Result<TenderRecord, TenderMutationError>>;
}

export function createPublishTender(dependencies: {
  repository: PublishTenderRepository;
  clock: Clock;
}) {
  return async function publishTender(
    id: string,
    actor: TenderActor,
  ): Promise<Result<TenderRecord, PublishError>> {
    const now = dependencies.clock.now();
    const draft = await dependencies.repository.getOwned(id, actor);
    if (!draft.ok) return draft;

    const evaluation = evaluateDraftForPublication(draft.value, now);
    if (!evaluation.ok) return { ok: false, error: evaluation.error };

    return dependencies.repository.publish(id, actor, now);
  };
}

const systemClock: Clock = { now: () => new Date() };

export async function publishTender(
  id: string,
  actor: TenderActor,
): Promise<Result<TenderRecord, PublishError>> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createPublishTender({
    repository: prismaTenderRepository,
    clock: systemClock,
  })(id, actor);
}
```

Add `publish` to `PrismaTenderRepository`. Prisma exposes no `FOR UPDATE` API, so make the state transition itself the guard: run a single conditional `database.tender.updateMany({ where: { id, ownerId: actor.id, status: "DRAFT" }, data: { status: "PUBLISHED", publishedAt: now } })` and treat `count === 0` as a lost race — re-read the row to distinguish `TENDER_NOT_FOUND`, `NOT_OWNER`, and `NOT_DRAFT` — then return the mapped `TenderRecord`. Two concurrent publishes therefore produce exactly one transition. No billing/payment table is touched here — this satisfies the "free publication creates no billing record" exit criterion by construction, since no such table exists yet (introduced in Phase 5).

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm test:integration -- publish-tender`
Expected: PASS.

- [ ] **Step 5: Implement the cancel command**

```ts
// src/modules/tenders/application/cancel-tender.ts
import { z } from "zod";
import type { Clock, Result } from "@/src/modules/shared";
import type { TenderDraft } from "../domain/tender";
import type { TenderActor } from "./create-tender-draft";
import type { TenderMutationError } from "./update-tender-draft";

export const cancelTenderCommandSchema = z
  .object({ reason: z.string().trim().min(5).max(500) })
  .strict();
export type CancelTenderCommand = z.output<typeof cancelTenderCommandSchema>;
// Cancellation is legal from DRAFT and PUBLISHED alike, so `NOT_DRAFT` is not
// part of this surface — only a second cancellation is refused.
export type CancelError =
  Exclude<TenderMutationError, "NOT_DRAFT"> | "ALREADY_CANCELLED";

export interface CancelTenderRepository {
  cancel(
    id: string,
    command: CancelTenderCommand,
    actor: TenderActor,
    now: Date,
  ): Promise<Result<TenderDraft, CancelError>>;
}

export function createCancelTender(dependencies: {
  repository: CancelTenderRepository;
  clock: Clock;
}) {
  return async function cancelTender(
    id: string,
    input: unknown,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, CancelError | "INVALID_INPUT">> {
    const parsed = cancelTenderCommandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
    return dependencies.repository.cancel(
      id,
      parsed.data,
      actor,
      dependencies.clock.now(),
    );
  };
}

const systemClock: Clock = { now: () => new Date() };

export async function cancelTender(
  id: string,
  input: unknown,
  actor: TenderActor,
): Promise<Result<TenderDraft, CancelError | "INVALID_INPUT">> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createCancelTender({
    repository: prismaTenderRepository,
    clock: systemClock,
  })(id, input, actor);
}
```

`PrismaTenderRepository.cancel` does not reuse the `updateDraft` status guard: cancellation is legal from both `DRAFT` and `PUBLISHED`. It returns `TENDER_NOT_FOUND` when no row matches, `NOT_OWNER` when `ownerId !== actor.id`, `ALREADY_CANCELLED` when `status === "CANCELLED"`, and otherwise sets `status: "CANCELLED"`, `cancelledAt: now`, `cancelReason: reason`.

- [ ] **Step 6: Extend the integration test with the cancel surface and run all tender tests**

Add to `publish-tender.integration.test.ts`: cancelling a published tender succeeds and a second cancellation returns `{ ok: false, error: "ALREADY_CANCELLED" }`; a non-owner cancellation returns `NOT_OWNER`.

Run: `pnpm test:unit; pnpm test:integration -- tenders publish-tender`
Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/modules/tenders
git commit -m "feat: add tender publication and permitted cancellation"
```

### Task 6: HTTP routes for authoring, location, publish, cancel, and attachments

**Files:**

- Create: `src/modules/tenders/http/map-tender-error.ts`
- Create: `src/modules/tenders/http/tender-handlers.ts`
- Create: `src/modules/tenders/http/attachment-handlers.ts`
- Create: `app/api/tenders/route.ts`
- Create: `app/api/tenders/[id]/route.ts`
- Create: `app/api/tenders/[id]/location/route.ts`
- Create: `app/api/tenders/[id]/publish/route.ts`
- Create: `app/api/tenders/[id]/cancel/route.ts`
- Create: `app/api/tenders/[id]/attachments/route.ts`
- Create: `app/api/tenders/[id]/attachments/[attachmentId]/download/route.ts`
- Create: `src/modules/tenders/http/tender-handlers.test.ts`

**Interfaces:**

- Consumes: every application function from Tasks 2–5; `requireCapability` and `AuthError` from `@/src/modules/identity/application/require-capability`.
- Produces: `createTenderHandlers(dependencies)`, `createOwnedTenderHandlers(dependencies)`, `createAttachmentHandlers(dependencies)`, `mapTenderError(error): Response`.
- `RequireCustomer = (headers: Headers) => Promise<Result<TenderActor, AuthError>>`. `requireCapability` returns `Result<CurrentUser, AuthError>` and `CurrentUser` structurally satisfies `TenderActor`, so it is assignable without an adapter.

- [ ] **Step 1: Write a failing route-mapping test**

```ts
// src/modules/tenders/http/tender-handlers.test.ts
import { describe, expect, it } from "vitest";
import { createTenderHandlers } from "./tender-handlers";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/tenders", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("tender handlers", () => {
  it("returns 401 when the caller has no authorized customer session", async () => {
    const handlers = createTenderHandlers({
      requireCustomer: async () => ({ ok: false, error: "UNAUTHENTICATED" }),
      createDraft: async () => ({ ok: true, value: {} as never }),
      listOwned: async () => [],
    });
    const response = await handlers.POST(
      jsonRequest({ specialty: "CONSTRUCTION_REPAIR", title: "x" }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 when an authenticated caller lacks the customer capability", async () => {
    const handlers = createTenderHandlers({
      requireCustomer: async () => ({ ok: false, error: "CAPABILITY_MISSING" }),
      createDraft: async () => ({ ok: true, value: {} as never }),
      listOwned: async () => [],
    });
    const response = await handlers.POST(
      jsonRequest({
        specialty: "CONSTRUCTION_REPAIR",
        title: "Repaint two rooms",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 for a malformed create body once authorized", async () => {
    const handlers = createTenderHandlers({
      requireCustomer: async () => ({ ok: true, value: { id: "user-1" } }),
      createDraft: async () => ({ ok: false, error: "INVALID_INPUT" }),
      listOwned: async () => [],
    });
    const response = await handlers.POST(jsonRequest({}));
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run src/modules/tenders/http/tender-handlers.test.ts`
Expected: FAIL because `./tender-handlers` does not exist.

- [ ] **Step 3: Implement the error mapper and handlers**

```ts
// src/modules/tenders/http/map-tender-error.ts
// Every `AuthError` value from `require-capability` is listed so an access
// denial can never fall through to the 400 default, matching the statuses
// `src/modules/identity/http/map-access-denial.ts` already assigns.
const STATUS_BY_ERROR: Readonly<Record<string, number>> = {
  UNAUTHENTICATED: 401,
  EMAIL_UNVERIFIED: 403,
  ONBOARDING_INCOMPLETE: 403,
  ACCOUNT_DISABLED: 403,
  ACCOUNT_RESTRICTED: 403,
  CAPABILITY_MISSING: 403,
  NOT_OWNER: 403,
  TENDER_NOT_FOUND: 404,
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  NOT_DRAFT: 409,
  ALREADY_CANCELLED: 409,
  TOO_MANY_ATTACHMENTS: 409,
  UNSUPPORTED_FILE_TYPE: 422,
  FILE_TOO_LARGE: 413,
  ADDRESS_NOT_FOUND: 422,
  COORDINATES_NOT_FOUND: 422,
};

export function mapTenderError(error: string): Response {
  const status = STATUS_BY_ERROR[error] ?? 400;
  return Response.json(
    { code: error, messageKey: `tenders.errors.${error}` },
    { status },
  );
}
```

`messageKey` is an advisory hint in the response body, exactly as in `profile-handlers.ts` (which emits `errors.INVALID_INPUT` while the catalog key is `errors.invalidInput`). The UI maps codes to catalog copy itself; Task 8 adds the `tenders.errors.*` group those mappings read.

`createTenderHandlers` in `src/modules/tenders/http/tender-handlers.ts` takes `{ requireCustomer, createDraft, listOwned }` and exposes `{ POST, GET }` for `app/api/tenders/route.ts` (create/list) following exactly the shape of `createProfileHandlers`: resolve the actor through `requireCustomer(request.headers)`, return `mapTenderError(access.error)` when denied, parse the JSON body, call the command, and map `Result` failures through `mapTenderError`. Add a second export `createOwnedTenderHandlers({ requireCustomer, getOwned, updateDraft })` returning `{ GET, PATCH }` for `app/api/tenders/[id]/route.ts`, and small dedicated handler factories for `location`, `publish`, and `cancel` following the same pattern (each wraps exactly one application function).

`createAttachmentHandlers({ requireCustomer, upload, list })` in `src/modules/tenders/http/attachment-handlers.ts` exposes `{ POST, GET }` for `app/api/tenders/[id]/attachments/route.ts` — `POST` reads `await request.formData()`, extracts the `file` entry, converts it with `new Uint8Array(await file.arrayBuffer())`, and calls `uploadTenderAttachment`; `GET` calls `listTenderAttachments` and responds `Response.json({ attachments })` with `objectKey` omitted from each item (it is an internal storage address, never a client-facing field). A separate `createAttachmentDownloadHandler({ requireCustomer, getDownload })` exposes `{ GET }` for the `download` route, calling `getAttachmentDownload` and responding `Response.json({ url })` on success.

Wire `requireCustomer = (headers: Headers) => requireCapability(headers, "CUSTOMER")` in each route file, matching `app/api/profile/me/route.ts`'s dynamic-import pattern for `getCurrentUser`. Route files under `app/api/**` use relative specifiers (`../../../src/modules/...`) like the existing Phase 1 route files, not the `@/` alias — the alias is used in `app/[locale]/**` pages.

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm vitest run src/modules/tenders/http/tender-handlers.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the Next.js route files**

Each `app/api/tenders/**/route.ts` file imports its application functions and the relevant handler factory and re-exports the returned methods, exactly like `app/api/profile/me/route.ts`. Keep every route file under 20 lines — all behavior lives in `src/modules/tenders/http`.

- [ ] **Step 6: Run the full unit suite and boundary check**

Run: `pnpm test:unit; pnpm verify:boundaries`
Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add app/api/tenders src/modules/tenders/http
git commit -m "feat: add tender authoring, location, lifecycle, and attachment routes"
```

### Task 7: Masking, provider discovery search, and discovery routes

**Files:**

- Create: `src/modules/tenders/domain/masking.ts`
- Create: `src/modules/tenders/domain/masking.test.ts`
- Create: `src/modules/tenders/application/search-published-tenders.ts`
- Create: `src/modules/tenders/application/get-published-tender.ts`
- Create: `src/modules/tenders/application/search-published-tenders.integration.test.ts`
- Create: `src/modules/tenders/http/discovery-handlers.ts`
- Create: `app/api/tenders/discover/route.ts`
- Create: `app/api/tenders/discover/[id]/route.ts`

**Interfaces:**

- Consumes: `TenderRecord`, `distanceKilometers`.
- Produces: `PublicTenderSummary`, `PublicTenderDetail`, `toPublicSummary`, `toPublicDetail`, `searchPublishedTenders(input)`, `getPublishedTender(id)`.
- Neither discovery command takes an actor: they return the same masked projection to every caller, and the `PROVIDER` capability check lives in the route handlers (Step 8). Keeping the actor out of these functions means there is no parameter a future change could branch on to widen disclosure.

- [ ] **Step 1: Write failing masking tests**

```ts
// src/modules/tenders/domain/masking.test.ts
import { describe, expect, it } from "vitest";
import { toPublicDetail, toPublicSummary } from "./masking";
import type { TenderRecord } from "./tender";

const published: TenderRecord = {
  id: "tender-1",
  ownerId: "owner-1",
  status: "PUBLISHED",
  specialty: "CONSTRUCTION_REPAIR",
  title: "Renovate a two-bedroom apartment",
  shortDescription: "Full interior renovation",
  fullDescription: "Strip and rebuild kitchen and bathroom finishes.",
  scopeOfWork: "Demolition, plumbing, tiling, painting",
  budgetMinorUnits: 500_000,
  currency: "GEL",
  desiredStartDate: null,
  deadline: new Date("2026-09-01T00:00:00.000Z"),
  workerNotes: "Need two tilers",
  equipmentNotes: null,
  materialNotes: null,
  location: {
    countryCode: "GE",
    city: "Tbilisi",
    district: "Vake",
    addressLine: "1 Chavchavadze Ave",
    exact: { latitude: 41.7151, longitude: 44.8271 },
    public: { latitude: 41.72, longitude: 44.83 },
  },
  conditions: "Client supplies parking access",
  publishedAt: new Date("2026-08-15T00:00:00.000Z"),
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date("2026-08-15T00:00:00.000Z"),
  updatedAt: new Date("2026-08-15T00:00:00.000Z"),
};

describe("toPublicSummary / toPublicDetail", () => {
  it("never exposes exact coordinates, address line, owner id, or conditions", () => {
    const summary = toPublicSummary(published);
    const detail = toPublicDetail(published);
    const serialized = JSON.stringify({ summary, detail });

    expect(serialized).not.toContain("41.7151");
    expect(serialized).not.toContain("44.8271");
    expect(serialized).not.toContain("Chavchavadze");
    expect(serialized).not.toContain("owner-1");
    expect(serialized).not.toContain("parking access");
    expect((summary as Record<string, unknown>).attachments).toBeUndefined();
  });

  it("exposes only the coarsened public coordinates", () => {
    expect(toPublicSummary(published)).toMatchObject({
      city: "Tbilisi",
      district: "Vake",
      publicLatitude: 41.72,
      publicLongitude: 44.83,
    });
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run src/modules/tenders/domain/masking.test.ts`
Expected: FAIL because `./masking` does not exist.

- [ ] **Step 3: Implement masking**

```ts
// src/modules/tenders/domain/masking.ts
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
```

Never add `ownerId`, `addressLine`, `exact`, `conditions`, or an `attachments` field to either return type — this is the enforcement point for the "exact address, client identity/contact, attachments, and full conditions are absent" proof.

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm vitest run src/modules/tenders/domain/masking.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement search and detail application commands**

```ts
// src/modules/tenders/application/search-published-tenders.ts
import { z } from "zod";
import type { Clock } from "@/src/modules/shared";
import { distanceKilometers } from "../domain/coordinates";
import { toPublicSummary, type PublicTenderSummary } from "../domain/masking";
import type { TenderRecord } from "../domain/tender";

export const searchPublishedTendersQuerySchema = z
  .object({
    specialty: z.literal("CONSTRUCTION_REPAIR").optional(),
    city: z.string().trim().min(1).max(120).optional(),
    district: z.string().trim().min(1).max(120).optional(),
    minBudgetMinorUnits: z.coerce.number().int().nonnegative().optional(),
    maxBudgetMinorUnits: z.coerce.number().int().nonnegative().optional(),
    publishedAfter: z.coerce.date().optional(),
    deadlineBefore: z.coerce.date().optional(),
    nearLatitude: z.coerce.number().min(-90).max(90).optional(),
    nearLongitude: z.coerce.number().min(-180).max(180).optional(),
    nearRadiusKilometers: z.coerce.number().positive().max(500).optional(),
  })
  .strict();
export type SearchPublishedTendersQuery = z.output<
  typeof searchPublishedTendersQuerySchema
>;

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
```

```ts
// src/modules/tenders/application/get-published-tender.ts
import type { Clock, Result } from "@/src/modules/shared";
import { toPublicDetail, type PublicTenderDetail } from "../domain/masking";
import type { TenderRecord } from "../domain/tender";

export interface GetPublishedTenderRepository {
  getPublished(
    id: string,
    now: Date,
  ): Promise<Result<TenderRecord, "TENDER_NOT_FOUND">>;
}

export function createGetPublishedTender(dependencies: {
  repository: GetPublishedTenderRepository;
  clock: Clock;
}) {
  return async function getPublishedTender(
    id: string,
  ): Promise<Result<PublicTenderDetail, "TENDER_NOT_FOUND">> {
    const result = await dependencies.repository.getPublished(
      id,
      dependencies.clock.now(),
    );
    return result.ok
      ? { ok: true, value: toPublicDetail(result.value) }
      : result;
  };
}

export async function getPublishedTender(
  id: string,
): Promise<Result<PublicTenderDetail, "TENDER_NOT_FOUND">> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createGetPublishedTender({
    repository: prismaTenderRepository,
    clock: { now: () => new Date() },
  })(id);
}
```

Add `searchPublished(filter, now)` and `getPublished(id, now)` to `PrismaTenderRepository`: both query `where: { status: "PUBLISHED", deadline: { gt: now } }` plus the optional `specialty`/`city`/`district`/budget-range/`publishedAfter`/`deadlineBefore` filters, and both map rows through the same `TenderRecord` mapper Task 1/2 already established (never the draft mapper, so a masking bug in the owner path cannot leak here — these are separate query methods end to end).

- [ ] **Step 6: Write a failing integration test proving deadline and specialty filtering**

```ts
// src/modules/tenders/application/search-published-tenders.integration.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "@/src/infrastructure/db/client";
import { searchPublishedTenders } from "./search-published-tenders";
// ...seed one published tender with a future deadline and one with a past deadline
// (reuse createDraft + updateDraft + updateLocation + publishTender from earlier tasks,
// back-dating the second tender's deadline directly via `database.tender.update`
// since publishTender itself refuses a past deadline).

afterAll(async () => {
  await database.$disconnect();
});

describe("searchPublishedTenders", () => {
  it("excludes a published tender whose deadline has passed", async () => {
    // Arrange two tenders as described above, one with deadline in the past.
    const result = await searchPublishedTenders({ city: "Tbilisi" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.value.some((tender) => tender.title === "Past-deadline tender"),
      ).toBe(false);
    }
  });
});
```

Fill in the arrange steps using the same helper pattern as `publish-tender.integration.test.ts` (create draft, fill required fields, sync location, publish, then for the expired case directly `database.tender.update({ where: { id }, data: { deadline: past } })` after publishing, since business commands correctly refuse to create that state).

- [ ] **Step 7: Run and confirm pass**

Run: `pnpm test:integration -- search-published-tenders`
Expected: PASS.

- [ ] **Step 8: Add discovery HTTP routes**

`createDiscoveryHandlers({ requireProvider, search, getDetail })` in `src/modules/tenders/http/discovery-handlers.ts` exposes `{ GET }` for `app/api/tenders/discover/route.ts` (parses `new URL(request.url).searchParams` into the query object before calling `searchPublishedTenders`) and `{ GET }` for `app/api/tenders/discover/[id]/route.ts`, both requiring `requireCapability(headers, "PROVIDER")`.

- [ ] **Step 9: Run the full unit and integration suites**

Run: `pnpm test:unit; pnpm test:integration -- tenders`
Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add src/modules/tenders app/api/tenders/discover
git commit -m "feat: add masked tender discovery, search, and detail"
```

### Task 8: Localization messages for tender authoring and discovery

**Files:**

- Modify: `src/modules/localization/messages/en.json`
- Modify: `src/modules/localization/messages/ka.json`
- Modify: `src/modules/localization/messages.test.ts` — it asserts `Object.keys(en).sort()` equals an explicit list, so `"tenders"` must be added to that list (in sorted position, after `"profile"`) or the test fails.

**Interfaces:**

- Produces: a `tenders` message namespace with identical non-empty key sets in both catalogs, matching every key referenced by Tasks 9–11's UI.
- Reuses, rather than duplicates, the existing shared copy: `common.continue`, `common.back`, `common.save`, `common.working`, and `errors.summaryOne`/`errors.summaryMany` already exist and are what the wizard's navigation, pending states, and error summary use.

- [ ] **Step 1: Add the `tenders` namespace to `en.json`**

```json
"tenders": {
  "clientListTitle": "Your tenders",
  "clientListEmpty": "You have not published a tender yet.",
  "newTender": "Publish a new tender",
  "wizardBasicsStep": "Basics",
  "wizardScopeStep": "Scope & budget",
  "wizardLocationStep": "Location",
  "wizardReviewStep": "Review",
  "title": "Title",
  "shortDescription": "Short description",
  "fullDescription": "Full description",
  "scopeOfWork": "Scope of work",
  "budget": "Budget",
  "currency": "Currency",
  "deadline": "Bidding deadline",
  "desiredStartDate": "Desired start date",
  "workerNotes": "Worker notes",
  "equipmentNotes": "Equipment notes",
  "materialNotes": "Material notes",
  "conditions": "Additional conditions",
  "city": "City",
  "district": "District",
  "addressLine": "Address",
  "chooseOnMap": "Choose on map",
  "attachments": "Attachments",
  "uploadAttachment": "Upload file",
  "attachmentHint": "PDF, JPEG, PNG, or WebP, up to 15 MB, up to 10 files.",
  "publish": "Publish tender",
  "publishing": "Publishing",
  "cancel": "Cancel tender",
  "cancelling": "Cancelling",
  "cancelReason": "Reason for cancellation",
  "statusDraft": "Draft",
  "statusPublished": "Published",
  "statusCancelled": "Cancelled",
  "providerListTitle": "Discover tenders",
  "providerListEmpty": "No published tenders match your filters yet.",
  "filterSpecialty": "Specialty",
  "filterCity": "City",
  "filterBudget": "Budget range",
  "filterDeadline": "Deadline before",
  "filterNear": "Near a location",
  "applyFilters": "Apply filters",
  "viewDetail": "View details",
  "errors": {
    "invalidInput": "Review the highlighted fields and try again.",
    "notFound": "That tender is no longer available.",
    "notOwner": "That tender belongs to another account.",
    "notDraft": "A published tender can no longer be edited.",
    "alreadyCancelled": "That tender is already cancelled.",
    "tooManyAttachments": "You can attach up to 10 files.",
    "unsupportedFileType": "Attach a PDF, JPEG, PNG, or WebP file.",
    "fileTooLarge": "Each file must be 15 MB or smaller.",
    "addressNotFound": "We could not find that address. Choose a city we cover or place a pin.",
    "shortDescriptionRequired": "Add a short description before publishing.",
    "fullDescriptionRequired": "Add a full description before publishing.",
    "scopeRequired": "Describe the scope of work before publishing.",
    "budgetRequired": "Add a budget and currency before publishing.",
    "locationRequired": "Add a location before publishing.",
    "deadlineRequired": "Add a bidding deadline before publishing.",
    "deadlineNotFuture": "Choose a bidding deadline in the future."
  }
},
```

The `errors` group covers every code `mapTenderError` can emit for a tender-specific failure, in the same camelCase style as the existing top-level `errors` namespace; the UI maps response codes onto these keys the way `profile-form.tsx` maps `PHONE_CONFLICT` onto `errors.phoneConflict`. Access denials (`UNAUTHENTICATED`, `CAPABILITY_MISSING`, …) keep using the existing `access.*` copy and need no new keys. `TITLE_REQUIRED` and `COORDINATES_NOT_FOUND` are unreachable from the UI (the title is validated client-side before the draft is created, and the pin fallback always resolves to the nearest gazetteer city), so they map to `errors.invalidInput` and `tenders.errors.addressNotFound` respectively rather than adding dead copy.

- [ ] **Step 2: Add the matching `tenders` namespace to `ka.json`**

Translate every key from Step 1 into Georgian, keeping identical key names and no empty strings (mirror the register/onboarding sections' existing ka.json translation style for tone and formality).

- [ ] **Step 3: Add `"tenders"` to the required-group list in `messages.test.ts`**

The existing assertion is an exact-equality check against `["access", "auth", "common", "errors", "onboarding", "profile", "workspace"]`; insert `"tenders"` so the sorted list still matches.

- [ ] **Step 4: Run the catalog-parity test**

Run: `pnpm vitest run src/modules/localization/messages.test.ts`
Expected: PASS (identical non-empty key sets in both locales).

- [ ] **Step 5: Commit**

```powershell
git add src/modules/localization
git commit -m "feat: add bilingual tender authoring and discovery copy"
```

### Task 9: Authoring wizard UI

**Files:**

- Create: `src/modules/tenders/ui/tender-wizard.tsx`
- Create: `src/modules/tenders/ui/tender-wizard.test.tsx`
- Create: `app/[locale]/(workspace)/client/tenders/new/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**

- Consumes: `Field` from `@/src/modules/identity/ui/field`; `ErrorSummary`, `SubmitButton`, `focusErrorSummary` from `@/src/modules/identity/ui/identity-form`; `IdentityShell` from `@/src/modules/identity/ui/identity-shell`.
- Layout: the wizard stays inside the existing 460px `IdentityShell` frame. `DESIGN.md` applies that measure to identity **and workspace** surfaces, and the Stable Anchor Rule expects state changes to replace content inside the same frame — which is exactly what a one-step-at-a-time wizard does. No wider shell and no new visual system is introduced in this phase.
- `IdentityShell`'s `progress` prop is typed `current: 1 | 2 | 3` and `.progress-rail` is `grid-template-columns: repeat(3, 1fr)`, both specific to the Phase 1 account/verification/profile rail. The wizard therefore renders its own four-step rail with a `wizard-rail` class added to `app/globals.css` (same hairline, tokens, and `is-complete` treatment, four columns) and does not pass `progress` to `IdentityShell` or change its type.
- Produces: `TenderWizard` client component posting to `POST /api/tenders`, `PATCH /api/tenders/:id`, `PATCH /api/tenders/:id/location`, and `POST /api/tenders/:id/attachments` across four steps (Basics, Scope & budget, Location, Review), reusing the existing error-summary-focus and double-submit-protection behavior already proven in `identity-form.tsx`.
- Props: `Readonly<{ locale: Locale; messages: Messages; api?: Partial<TenderWizardApi> }>`, where `TenderWizardApi` is the record of the four `fetch` calls above. The route page passes only `locale` and `messages` and gets the real `fetch` implementations; tests inject fakes through `api`.

- [ ] **Step 1: Write failing step-validation and render-contract tests**

Phase 1's component tests (`render-contract.test.tsx`, `workspace-switcher.test.tsx`) use `renderToStaticMarkup` from `react-dom/server`; there is no jsdom environment configured in `vitest.config.ts` and no Testing Library dependency. Follow that pattern rather than adding `@testing-library/react` + `jsdom` and switching the unit environment — interaction coverage for the wizard belongs to Playwright (Task 13). To keep step gating testable without a DOM, the wizard exports its validation as a pure function.

```tsx
// src/modules/tenders/ui/tender-wizard.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getMessages } from "@/src/modules/localization/get-messages";
import { TenderWizard, validateWizardStep } from "./tender-wizard";

const messages = getMessages("en");

describe("validateWizardStep", () => {
  it("blocks the basics step without a title", () => {
    expect(validateWizardStep(0, { title: "" }, messages)).toEqual([
      { field: "title", message: messages.errors.required },
    ]);
  });

  it("allows the basics step once a title is present", () => {
    expect(
      validateWizardStep(0, { title: "Repaint two bedrooms" }, messages),
    ).toEqual([]);
  });
});

describe("TenderWizard", () => {
  it("renders a four-step rail with the first step current", () => {
    const html = renderToStaticMarkup(
      <TenderWizard locale="en" messages={messages} />,
    );

    expect(html).toContain("wizard-rail");
    expect(html).toContain(messages.tenders.wizardBasicsStep);
    expect(html).toContain(messages.tenders.wizardReviewStep);
    expect(html).toContain('aria-current="step"');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run src/modules/tenders/ui/tender-wizard.test.tsx`
Expected: FAIL because `./tender-wizard` does not exist.

- [ ] **Step 3: Implement the wizard**

Build `TenderWizard` as a `"use client"` component holding one `useState` step index (`0..3`) and one form-state object mirroring `UpdateTenderDraftCommand` plus location/attachment sub-state, with `validateWizardStep` exported as a pure function over `(stepIndex, formState, messages)` returning `FormIssue[]`. Step 1 (Basics) collects `specialty` (fixed to `CONSTRUCTION_REPAIR` with copy explaining it is the only Phase 2 specialty) and `title`, and on first "Continue" press calls `api.createDraft` (wired to `POST /api/tenders`) to obtain a `tenderId` used by every subsequent step. Step 2 (Scope & budget) collects `shortDescription`, `fullDescription`, `scopeOfWork`, budget, `currency`, `deadline`, `desiredStartDate`, `workerNotes`, `equipmentNotes`, `materialNotes`, `conditions`, submitted via `PATCH /api/tenders/:id`. The budget field is entered in **major** units (`800` GEL) because that is what a client types; the wizard multiplies by 100 into `budgetMinorUnits` before the PATCH, matching the "money is stored in integer minor units" constraint. `currency` is a select defaulting to the signed-in profile's `preferredCurrency`. Step 3 (Location) offers an address form and a "Choose on map" toggle, submitted via `PATCH /api/tenders/:id/location`, plus a file input calling `POST /api/tenders/:id/attachments` for each selected file with a live count against `attachmentHint`. Step 4 (Review) renders every field read-only and a `SubmitButton` calling `POST /api/tenders/:id/publish`; a server-mapped error re-renders the specific step whose field is blocking (using the `PublicationBlockingReason` returned in the error body) with `focusErrorSummary()` called after the DOM updates, exactly like `identity-form.tsx` does today. Reuse `Field` for every input and `ErrorSummary`/`SubmitButton` unmodified.

For the map, do not add a mapping SDK dependency in this task — provide a plain latitude/longitude number-input fallback behind the "Choose on map" toggle now, and leave a named seam (`onPinSelected(coordinates)`) for a later, separately scoped mapping-library integration. This keeps the phase's actual requirement (a synced pin producing `PIN` mode input to `syncTenderLocation`) satisfied without taking on an unreviewed new UI dependency.

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm vitest run src/modules/tenders/ui/tender-wizard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the route page**

```tsx
// app/[locale]/(workspace)/client/tenders/new/page.tsx
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { TenderWizard } from "@/src/modules/tenders/ui/tender-wizard";

export default async function NewTenderPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
  if (!isLocale(locale)) notFound();
  const access = await requireCapability(requestHeaders, "CUSTOMER");
  if (!access.ok) redirect("/" + locale + "/login");
  return <TenderWizard locale={locale} messages={getMessages(locale)} />;
}
```

- [ ] **Step 6: Add the four-column rail style**

Add `.wizard-rail` to `app/globals.css` next to `.progress-rail`, reusing the same border, token colors, and `is-complete` rule with `grid-template-columns: repeat(4, 1fr)`. Leave `.progress-rail` untouched — Phase 1's three-column identity rail still uses it.

- [ ] **Step 7: Commit**

```powershell
git add src/modules/tenders/ui app/[locale]/(workspace)/client/tenders/new app/globals.css
git commit -m "feat: add construction tender authoring wizard"
```

### Task 10: Client tender list and detail UI (with publish/cancel controls)

**Files:**

- Create: `src/modules/tenders/ui/tender-list.tsx`
- Create: `src/modules/tenders/ui/tender-detail.tsx`
- Create: `app/[locale]/(workspace)/client/tenders/page.tsx`
- Create: `app/[locale]/(workspace)/client/tenders/[id]/page.tsx`
- Modify: `src/modules/identity/ui/workspace-view.tsx` (replace the client empty-state body with a link to `/${locale}/client/tenders`, matching the existing `en.json`/`ka.json` copy that already promises "the next phase")

**Interfaces:**

- Consumes: `listOwnedTenders`, `getOwnedTender`, `cancelTender` server actions or fetch calls; `TenderDraft`.
- Produces: `TenderList` (server component, renders `title`, `statusDraft/Published/Cancelled`, `deadline`, `budget`, edit/publish/cancel entry points), `TenderDetail` (server-rendered read view plus a client "Cancel tender" control reusing `SubmitButton`).

- [ ] **Step 1: Implement `TenderList` and `TenderDetail` as server components**

`TenderList` calls `listOwnedTenders(actor)` directly (server component, no route handler needed for the owner's own read) and renders a semantic `<ul>` of tenders with locale-aware currency/date formatting (`Intl.NumberFormat`/`Intl.DateTimeFormat` keyed by `locale`), each item a `Link` to `/${locale}/client/tenders/${id}`, plus a "Publish a new tender" link to `/${locale}/client/tenders/new`, plus `clientListEmpty` copy exactly like `WorkspaceView`'s existing empty states. `TenderDetail` calls `getOwnedTender(id, actor)`, renders every field, and — only while `status !== "CANCELLED"` — a client-side cancel form posting to `POST /api/tenders/:id/cancel` with a required `cancelReason` field using `Field`/`ErrorSummary`/`SubmitButton`.

- [ ] **Step 2: Wire the route pages**

Both pages follow the exact `requireCapability(requestHeaders, "CUSTOMER")` → `redirect`/`WorkspaceDenied` → render pattern already used in `app/[locale]/(workspace)/client/page.tsx`; `[id]/page.tsx` additionally calls `notFound()` when `getOwnedTender` returns `TENDER_NOT_FOUND` or `NOT_OWNER`.

- [ ] **Step 3: Update the workspace empty state**

In `workspace-view.tsx`, replace the `clientEmptyBody` paragraph with a `Link` to `/${locale}/client/tenders` using the existing `clientEmptyBody` message updated to reference the tenders list (update `en.json`/`ka.json` `workspace.clientEmptyBody` copy accordingly and re-run `messages.test.ts`).

- [ ] **Step 4: Run unit tests**

Run: `pnpm test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/tenders/ui app/[locale]/(workspace)/client/tenders src/modules/identity/ui/workspace-view.tsx src/modules/localization/messages
git commit -m "feat: add client tender list, detail, and cancellation UI"
```

### Task 11: Provider masked discovery UI

**Files:**

- Create: `src/modules/tenders/ui/discovery-list.tsx`
- Create: `src/modules/tenders/ui/discovery-filters.tsx`
- Create: `app/[locale]/(workspace)/provider/tenders/page.tsx`
- Create: `app/[locale]/(workspace)/provider/tenders/[id]/page.tsx`
- Modify: `src/modules/identity/ui/workspace-view.tsx` (provider empty-state link, mirroring Task 10 Step 3)

**Interfaces:**

- Consumes: `searchPublishedTenders`, `getPublishedTender`, `PublicTenderSummary`, `PublicTenderDetail`.
- Produces: `DiscoveryFilters` (client component reading/writing URL search params for `specialty`, `city`, budget range, `deadlineBefore`), `DiscoveryList` (server component rendering the masked summaries for the current search params).

- [ ] **Step 1: Implement `DiscoveryFilters` and `DiscoveryList`**

`DiscoveryFilters` is a `"use client"` form using `useRouter`/`usePathname`/`useSearchParams` from `next/navigation` to push an updated query string on submit (city text input, min/max budget number inputs, deadline-before date input), reusing `Field` and a `SubmitButton` labelled `tenders.applyFilters`. `DiscoveryList` is a server component that reads `searchParams`, calls `searchPublishedTenders` with them, and renders each `PublicTenderSummary` as a semantic `<ul>` row showing `title`, `shortDescription`, `budgetMinorUnits`/`currency`, `city`/`district`, `publishedAt`, `deadline` — and explicitly never `id`-adjacent owner data, since `PublicTenderSummary` has no such field to render even by mistake. Rows are separated by one-pixel hairline rules with whitespace, matching Task 10's client list and `DESIGN.md`'s Flat-by-Default Rule; no cards, shadows, or fabricated metrics.

- [ ] **Step 2: Implement the masked detail page**

`app/[locale]/(workspace)/provider/tenders/[id]/page.tsx` calls `requireCapability(requestHeaders, "PROVIDER")`, then `getPublishedTender(id)`, rendering every `PublicTenderDetail` field with no attachments section and no address/contact section (there is nothing to render — the type does not carry them).

- [ ] **Step 3: Wire the list page and update the provider empty state**

`app/[locale]/(workspace)/provider/tenders/page.tsx` renders `DiscoveryFilters` above `DiscoveryList`. Update `workspace-view.tsx`'s `providerEmptyBody` link to `/${locale}/provider/tenders`, mirroring Task 10 Step 3.

- [ ] **Step 4: Run unit tests**

Run: `pnpm test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/tenders/ui app/[locale]/(workspace)/provider/tenders src/modules/identity/ui/workspace-view.tsx src/modules/localization/messages
git commit -m "feat: add provider masked tender discovery UI"
```

### Task 12: Seed script and phase-gate wiring

**Files:**

- Create: `scripts/seed-phase-02.ts`
- Modify: `package.json`
- Modify: `.github/workflows/verify.yml`

**Interfaces:**

- Produces: `pnpm seed:phase-2`, `pnpm verify:phase-2`; updates `verify:phase-0`'s e2e exclusion so it does not run Phase 2 specs before Phase 2 fixtures exist; adds the CI job that can actually run the new gate.

- [ ] **Step 1: Write the seed script**

Mirror `scripts/seed-phase-01.ts`'s structure — `import "dotenv/config"`, `getTestDatabaseServerEnv`, refuse to run when `NODE_ENV === "production"`, point `process.env.DATABASE_URL` at `DATABASE_URL_TEST`, dynamic-import the application modules, and `await database.$disconnect()` in a `finally`.

It does **not** re-create the Phase 1 accounts. `seed-phase-01.ts` starts by deleting those users, and `Tender.ownerId` cascades on delete, so re-running it would silently destroy the tenders seeded here. Instead look up `phase1.client@tender.test` and `phase1.provider@tender.test` with `database.user.findUniqueOrThrow` and fail with a message telling the operator to run `pnpm seed:phase-1` first. `verify:phase-2` already runs `verify:phase-1` (which seeds them) beforehand, so the ordering holds inside the gate.

Then, using `createTenderDraft`/`updateTenderDraft`/`syncTenderLocation`/`publishTender` directly against the test database, delete any tenders already owned by the seeded client (so the script is re-runnable) and create: one published Tbilisi tender owned by the seeded client with a 30-day-future deadline; one `DRAFT` tender owned by the seeded client (incomplete, for the authoring-resume journey); one `CANCELLED` tender owned by the seeded client. Log a one-line summary on success, matching `seed-phase-01.ts`'s final `console.log`.

- [ ] **Step 2: Wire package.json scripts**

```json
"seed:phase-2": "tsx scripts/seed-phase-02.ts",
"verify:phase-0": "pnpm format:check && pnpm lint && pnpm verify:boundaries && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm build && pnpm test:e2e --grep-invert \"@phase-1|@phase-2\"",
"verify:phase-2": "pnpm verify:phase-1 && pnpm db:migrate:test && pnpm test:integration -- tenders && pnpm build && pnpm seed:phase-2 && pnpm test:e2e --grep @phase-2"
```

(`verify:phase-0` currently reads `--grep-invert @phase-1`; it becomes the quoted alternation above. `db:up` also changes in Task 3 to start MinIO and run the bucket initializer.)

- [ ] **Step 3: Add the Phase 2 CI job**

`.github/workflows/verify.yml` currently has one `phase-1` job with a `postgres` service. Add a `phase-2` job copied from it, with:

- a `minio` service alongside `postgres`, using the same image tag pinned in `compose.yaml` and `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` matching the job env;
- the five `STORAGE_*` variables in the job-level `env:` block (`STORAGE_ENDPOINT: http://127.0.0.1:9000`, `STORAGE_BUCKET: tender_ci_test` — buckets are created by a step running `mc mb --ignore-existing`, since GitHub service containers cannot run the compose initializer);
- the same `PHASE_1_SEED_PASSWORD` generation step (Phase 2 e2e signs in as the Phase 1 seeded accounts);
- `run: pnpm verify:phase-2` in place of `pnpm verify:phase-1`.

Add the same `STORAGE_*` entries to the existing `phase-1` job's `env:` block too: once `serverEnvSchema` requires them, every command that boots the app — including the Phase 1 gate's build and e2e — fails without them.

- [ ] **Step 4: Run the seed script against the test database and confirm it succeeds**

Run: `pnpm db:up; pnpm db:migrate:test; pnpm seed:phase-1; pnpm seed:phase-2`
Expected: Script completes, printing the seeded tender summary.

- [ ] **Step 5: Commit**

```powershell
git add scripts/seed-phase-02.ts package.json .github/workflows/verify.yml
git commit -m "chore: seed phase 2 tender fixtures and wire the phase gate"
```

### Task 13: Playwright end-to-end authoring and discovery journeys

**Files:**

- Create: `src/test/e2e/fixtures/tenders.ts`
- Create: `src/test/e2e/fixtures/files/valid.pdf`
- Create: `src/test/e2e/fixtures/files/valid.jpg`
- Create: `src/test/e2e/fixtures/files/oversized.jpg`
- Create: `src/test/e2e/fixtures/files/spoofed.pdf`
- Create: `src/test/e2e/phase-02-authoring.spec.ts`
- Create: `src/test/e2e/phase-02-discovery.spec.ts`

**Interfaces:**

- Consumes: `signInSeededAccount(page, account, locale)`, `messagesFor(locale)`, and `seededAccounts` already exported by `src/test/e2e/fixtures/accounts.ts`; the phase-2 seeded tenders from Task 12.
- `src/test/e2e/fixtures/tenders.ts` holds only what is genuinely new (fixture file paths, the seeded tender's title constants, and a `fillScopeStep` helper). It does **not** define new sign-in helpers — `signInSeededAccount(page, "client", locale)` and `signInSeededAccount(page, "provider", locale)` already do exactly that, and duplicating them would fork the login flow across phases.

- [ ] **Step 1: Generate small deterministic fixture files**

Add a one-off Node script step (run once, not part of CI) that writes: `valid.pdf` as `%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF` bytes; `valid.jpg` as a minimal valid JPEG (`FF D8 FF E0 00 10 4A 46 49 46 00 01 ... FF D9`); `oversized.jpg` as the same valid JPEG header followed by zero-padding until the file exceeds `MAX_ATTACHMENT_BYTES` (15 MB + 1 byte); `spoofed.pdf` as **plain text bytes** (`"This is not a PDF."`) saved with a `.pdf` extension and uploaded with a `application/pdf` content type. The spoof fixture must carry a payload no allowed signature matches — a real JPEG renamed `.pdf` would be _accepted_, since sniffing (correctly) sees an allowed `image/jpeg` and ignores the name. Commit the resulting binary fixtures directly (they are small and deterministic).

- [ ] **Step 2: Write the authoring journey spec**

Every selector resolves through `messagesFor(locale)`, exactly like `fixtures/accounts.ts` does — English regexes would fail the `ka` run of the same loop.

```ts
// src/test/e2e/phase-02-authoring.spec.ts
import path from "node:path";
import { expect, test } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";
import { fillScopeStep, fixtureFile } from "./fixtures/tenders";

for (const locale of ["ka", "en"] as const) {
  const messages = messagesFor(locale);

  test(`@phase-2 client authors, uploads, pins, and publishes a tender (${locale})`, async ({
    page,
  }) => {
    await signInSeededAccount(page, "client", locale);
    await page.goto(`/${locale}/client/tenders/new`);

    await page.getByLabel(messages.tenders.title).fill("Repaint two bedrooms");
    await page.getByRole("button", { name: messages.common.continue }).click();

    await fillScopeStep(page, locale);
    await page.getByRole("button", { name: messages.common.continue }).click();

    await page.getByLabel(messages.tenders.city).fill("Tbilisi");
    await page
      .getByLabel(messages.tenders.addressLine)
      .fill("1 Chavchavadze Ave");
    await page
      .getByLabel(messages.tenders.uploadAttachment)
      .setInputFiles(fixtureFile("valid.pdf"));
    await expect(page.getByText("valid.pdf")).toBeVisible();
    await page
      .getByLabel(messages.tenders.uploadAttachment)
      .setInputFiles(fixtureFile("valid.jpg"));
    await expect(page.getByText("valid.jpg")).toBeVisible();
    await page.getByRole("button", { name: messages.common.continue }).click();

    await page.getByRole("button", { name: messages.tenders.publish }).click();
    await expect(
      page.getByText(messages.tenders.statusPublished),
    ).toBeVisible();
  });

  test(`@phase-2 rejects an oversized and a spoofed attachment (${locale})`, async ({
    page,
  }) => {
    await signInSeededAccount(page, "client", locale);
    await page.goto(`/${locale}/client/tenders/new`);
    await page.getByLabel(messages.tenders.title).fill("Small repair job");
    await page.getByRole("button", { name: messages.common.continue }).click();
    await fillScopeStep(page, locale);
    await page.getByRole("button", { name: messages.common.continue }).click();

    await page
      .getByLabel(messages.tenders.uploadAttachment)
      .setInputFiles(fixtureFile("oversized.jpg"));
    await expect(page.getByRole("alert")).toContainText(
      messages.tenders.errors.fileTooLarge,
    );

    await page
      .getByLabel(messages.tenders.uploadAttachment)
      .setInputFiles(fixtureFile("spoofed.pdf"));
    await expect(page.getByRole("alert")).toContainText(
      messages.tenders.errors.unsupportedFileType,
    );
  });
}
```

- [ ] **Step 3: Write the discovery journey spec**

```ts
// src/test/e2e/phase-02-discovery.spec.ts
import { expect, test } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";
import { SEEDED_PUBLISHED_TENDER } from "./fixtures/tenders";

for (const locale of ["ka", "en"] as const) {
  const messages = messagesFor(locale);

  test(`@phase-2 provider discovers only masked tender data (${locale})`, async ({
    page,
  }) => {
    await signInSeededAccount(page, "provider", locale);
    await page.goto(`/${locale}/provider/tenders`);
    await page.getByLabel(messages.tenders.filterCity).fill("Tbilisi");
    await page
      .getByRole("button", { name: messages.tenders.applyFilters })
      .click();
    await expect(page.getByText(SEEDED_PUBLISHED_TENDER.title)).toBeVisible();

    await page
      .getByRole("link", { name: messages.tenders.viewDetail })
      .first()
      .click();
    const body = page.locator("body");
    await expect(body).not.toContainText(SEEDED_PUBLISHED_TENDER.addressLine);
    await expect(body).not.toContainText(SEEDED_PUBLISHED_TENDER.exactLatitude);
    await expect(body).not.toContainText(
      SEEDED_PUBLISHED_TENDER.exactLongitude,
    );
    await expect(body).not.toContainText(SEEDED_PUBLISHED_TENDER.conditions);
    await expect(page.getByText(messages.tenders.attachments)).toHaveCount(0);
  });

  test(`@phase-2 the masked discovery API omits exact coordinates (${locale})`, async ({
    page,
  }) => {
    await signInSeededAccount(page, "provider", locale);
    // `page.request` shares the signed-in browser context's cookies; the
    // standalone `request` fixture does not and would be rejected as
    // unauthenticated.
    const response = await page.request.get(
      "/api/tenders/discover?city=Tbilisi",
    );
    expect(response.status()).toBe(200);
    const raw = await response.text();
    expect(raw).not.toContain(SEEDED_PUBLISHED_TENDER.exactLatitude);
    expect(raw).not.toContain(SEEDED_PUBLISHED_TENDER.exactLongitude);
    expect(raw).not.toContain(SEEDED_PUBLISHED_TENDER.addressLine);
  });
}
```

The second test covers the "exact coordinates never appear in … API JSON" half of the exit criterion; the first covers rendered HTML/RSC output.

- [ ] **Step 4: Add the Phase 2 fixture module**

`src/test/e2e/fixtures/tenders.ts` exports only what is new: `fixtureFile(name)` resolving `fixtures/files/<name>` from `import.meta.url`, `SEEDED_PUBLISHED_TENDER` (the title, address line, exact latitude/longitude, and conditions string that `scripts/seed-phase-02.ts` writes, so the masking assertions test the real values rather than hard-coded literals), and `fillScopeStep(page, locale)` filling the Scope & budget step through `messagesFor(locale)`. Sign-in comes from `signInSeededAccount` in `fixtures/accounts.ts` — no second login helper is written.

- [ ] **Step 5: Run the Phase 2 e2e suite**

Run: `pnpm build; pnpm seed:phase-1; pnpm seed:phase-2; pnpm test:e2e --grep @phase-2`
Expected: PASS on both `desktop-chromium` and `mobile-chromium` projects, both locales.

- [ ] **Step 6: Run the full phase gate**

Run: `pnpm verify:phase-2`
Expected: PASS end-to-end (format, lint, boundaries, typecheck, unit, integration, build, Phase 1 e2e, migration, tender integration tests, seed, Phase 2 e2e).

- [ ] **Step 7: Commit**

```powershell
git add src/test/e2e
git commit -m "test: verify tender authoring and masked discovery journeys"
```

---

## Self-review notes

- **Spec coverage:** every Phase 2 roadmap scope bullet maps to a task — authoring/validation/preview/publication/cancellation (Tasks 1, 2, 5, 9, 10), required content fields (Tasks 1–2, 9), attachments/S3 storage (Task 3), geocoding/map/coarsened coordinates (Task 4), search/filter (Task 7, 11), client and masked provider list/detail (Tasks 10, 11).
- **Automated-proof mapping:** publication rejects incomplete/expired drafts (Task 1 Step 6, Task 5 Step 1); uploads reject spoofed MIME types, oversized files, unauthorized downloads, and excess counts (Task 3 Step 9, four cases, plus Task 13's UI-level spoof/oversize checks); response-shape masking (Task 7 Step 1 and Task 13's HTML _and_ JSON assertions); the Playwright draft → upload → pin → publish → masked-discovery journey (Task 13).
- **Exit criteria:** no billing table is written or exists (Task 5 Step 3); published material fields are immutable in place via `NOT_DRAFT` (Task 2 Step 4, proven in Task 5 Step 1); exact coordinates are absent from HTML, RSC payloads, and API JSON (Task 7 masking types plus Task 13's two discovery tests); `pnpm verify:phase-2` exists and runs in CI (Task 12).
- **No unowned scope:** `EXPIRED` status, entitlement/paid access, and bidding are explicitly left to Phase 3 per the Architecture Decisions above; nothing in this plan writes to a billing table.
- **Type consistency:** `TenderActor`, `TenderMutationError`, `TenderDraft`, `TenderRecord`, `ObjectStorage`, and `Geocoder` are defined once (Tasks 1–4) and only ever imported by later tasks, never redefined. `TenderRecord` is the published projection (`status: "PUBLISHED"`); cancellation returns `TenderDraft`.
- **Phase 1 reuse:** the login/message-catalog e2e helpers, `Field`/`ErrorSummary`/`SubmitButton`/`focusErrorSummary`, `renderToStaticMarkup` component testing, the 460px `IdentityShell` frame, and `requireCapability` are reused as-is. No new UI dependency, test environment, or visual system is introduced; the only new runtime dependencies are the two AWS S3 SDK packages.
