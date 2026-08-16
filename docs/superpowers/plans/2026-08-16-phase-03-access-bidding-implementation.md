# Phase 3 Mock Access, Bidding, and Deterministic Winner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a verified construction provider buy a mock access entitlement, see a published tender's full detail and attachments, submit/revise/withdraw exactly one competing bid before the deadline, and have a worker deterministically produce exactly one winner (or one expired-without-bids outcome) at the deadline, with a pending agreement snapshot, audit entry, and outbox notifications written in the same transaction.

**Architecture:** Three new vertical-slice modules follow the Phase 1/2 layering exactly. `access` owns entitlements, the mock payment adapter, and the disclosure policy. `bidding` owns bids, eligibility, ranking, and the deadline selector. `agreements` is introduced as a snapshot-only module (Phase 4 owns its lifecycle). `tenders` gains two published cross-module seams instead of being reached into: a read (`getTenderBiddingContext`) and a transaction-participating gateway (`prismaTenderSelectionGateway`) that performs the tender's own status transition inside the selector's transaction. Disclosure is a single centralized policy consumed through a port, so masked and full projections can never diverge per call site.

**Tech Stack:** Phase 2 stack unchanged — Node.js 24, Next.js 16 App Router, React 19, strict TypeScript, Prisma ORM 7 against PostgreSQL 17, Zod 4, Better Auth, Vitest, Playwright. No new runtime dependency is added in this phase; the payment gateway is a deterministic in-repo mock adapter behind a port, exactly as `LogMailSender` (Phase 1) and `GazetteerGeocoder` (Phase 2) were.

**Spec:** `docs/superpowers/plans/2026-08-14-tender-marketplace-roadmap.md` (Phase 3 section) and `docs/superpowers/specs/2026-08-14-tender-marketplace-program-design.md` (sections 4.3, 4.4, 4.7, 5, 8, 10, 11), read together with `Product_description.md` and `Specs.md` at the repository root. Visual work reuses the approved token set in `DESIGN.md`; this phase introduces no new visual system.

## Global Constraints

- `Product_description.md` and `Specs.md` are the source of truth; first market is Georgia (`GE`), locales `ka`/`en`, currencies `GEL`/`USD`.
- Provider access prices are exactly USD 1 single-tender, USD 20 monthly, USD 200 annual. Copy and stored amounts must match those figures.
- The winner is selected **only** at the deadline: lowest eligible amount, then earliest `qualifyingSubmittedAt`, then stable ID ascending.
- There is no customer-facing or administrator mutation that selects, replaces, or overrides a winner. No route, handler, or UI control may exist for it.
- Re-running selection returns the existing result and creates no new side effects.
- Bid mutation (submit, revise, withdraw) is impossible at or after the deadline instant.
- Money is stored in integer minor units; time is stored in UTC. All bids use the tender's settlement currency; no conversion may influence ranking.
- Prisma migrations are committed and forward-only.
- No source module imports Prisma except database adapters. Files under `src/modules/**/domain` may import only their own module's `domain` folder and `src/modules/shared`; `scripts/verify-module-boundaries.mjs` is fail-closed and rejects Node built-ins, third-party packages, and other modules' folders.
- A module may read another module only through a published query function and may mutate it only through a published command or gateway. Never query or write another module's Prisma tables directly.
- Every authorization decision is server-side; ownership and entitlement are re-checked in the repository/application layer and never trusted from client input.
- WCAG 2.2 AA is the accessibility target; UI reuses the `Field`, `ErrorSummary`, and `SubmitButton` primitives from `src/modules/identity/ui/identity-form.tsx` and the tokens in `DESIGN.md`.
- Reference app logic may be consulted; reference app design must not be copied.

**Architecture decisions for this phase (recorded per the roadmap's change-control rule):**

1. **Payment provider deferred; mock adapter behind a port.** The roadmap explicitly defers real payments to Phase 5. This phase ships `MockPaymentGateway` behind `ports/payment-gateway.ts`, producing a `PaymentEvent` row with a unique `externalEventId` — the same idempotency key a real signed webhook will carry. No provider SDK, account, or contract is introduced.

2. **Cross-module transactions run through owning-module gateways.** Winner selection must atomically mark bids, close the tender, create the agreement snapshot, and enqueue outbox/audit rows. Rather than letting `bidding` write `Tender` or `Agreement` rows directly (forbidden by the roadmap's "may not reach into another module's tables"), `tenders` and `agreements` each publish an infrastructure _gateway_ that accepts the caller's `Prisma.TransactionClient`. The owning module remains the only code that touches its own table, and atomicity is preserved.

3. **`TenderStatus` gains `CLOSED` and `EXPIRED`.** Phase 2 shipped `DRAFT | PUBLISHED | CANCELLED` and deliberately deferred expiry to this phase. `CLOSED` means selection ran and produced a winner; `EXPIRED` means the deadline passed with no eligible bid. `TenderRecord.status` widens to `PublishedTenderStatus = "PUBLISHED" | "CLOSED" | "EXPIRED"` so a settled tender is still readable by its bidders — otherwise the winner and losers could not see their own outcome.

4. **Discovery search stays deadline-filtered; detail does not.** `searchPublished` keeps its `status: PUBLISHED, deadline > now` predicate so settled tenders never appear as biddable inventory. Provider _detail_ accepts `PUBLISHED | CLOSED | EXPIRED`, because the winner/loser views are exactly the case where the deadline has passed.

5. **A bid's conditions note must be at least 30 characters.** The program design requires a "substantive conditions note" without quantifying it. This reuses the platform's only existing substantive-text bar — the 30-character review comment rule in program design §4.6 — rather than inventing a second threshold.

6. **The deadline selector is a real production endpoint, not a test-only route.** `POST /api/tenders/selection/run` is authorized by a `SELECTION_WORKER_SECRET` shared secret compared in constant time. Phase 5/6 point a scheduler at it. A test-only route would have been unreachable from the Phase 3 browser gate, because CI runs `--grep @phase-3` against a production server (`playwright.config.ts` starts `pnpm start` whenever the grep does not request the `@phase-1` mailbox).

7. **The E2E gate reaches the deadline by seeding a past deadline, not by a clock endpoint.** `scripts/seed-phase-03.ts` publishes, entitles, and bids through the real application use cases while the deadline is still in the future, then applies one fixture-only write that moves `deadline` into the past — the same "moderation-owned fixture state applied directly" pattern `scripts/seed-phase-01.ts` already uses for restricted/disabled accounts. No injectable clock is exposed to the running server.

8. **A published tender can no longer be cancelled once it has a bid.** Program design §4.2 requires this and Phase 2 did not enforce it (no bids existed). `tenders` gains a `BidPresence` port, wired to `bidding`'s published `tenderHasActiveBids` query, and `cancelTender` returns the new `TENDER_HAS_BIDS` error.

---

## Planned file structure

```text
package.json                                          + seed:phase-3, verify:phase-3
.env.example, .env.test.example                       + SELECTION_WORKER_SECRET
.github/workflows/verify.yml                          + phase-3 job
playwright.config.ts                                  + SELECTION_WORKER_SECRET in webServer env
app/globals.css                                       + bid table, entitlement panel styles
src/config/env.ts                                     + SELECTION_WORKER_SECRET schema entry
src/config/env.test.ts                                + SELECTION_WORKER_SECRET in the accepted fixture
prisma/schema.prisma                                  + TenderStatus values, AccessEntitlement,
                                                        PaymentEvent, Bid, TenderSelection, Agreement
prisma/migrations/<timestamp>_access_bidding/migration.sql

app/api/access/checkout/route.ts                       POST start mock checkout
app/api/access/checkout/[checkoutId]/confirm/route.ts  POST confirm mock payment, grant entitlement
app/api/access/entitlements/route.ts                   GET own active entitlements
app/api/tenders/[id]/bids/route.ts                     POST submit (provider), GET compare (owner)
app/api/tenders/[id]/bids/mine/route.ts                PATCH revise, DELETE withdraw
app/api/tenders/[id]/bids/summary/route.ts             GET count + current lowest (provider)
app/api/tenders/selection/run/route.ts                 POST worker sweep
app/api/tenders/discover/[id]/attachments/route.ts     GET entitled attachment links

src/modules/access/
  domain/access-product.ts + access-product.test.ts
  domain/entitlement.ts
  domain/disclosure-policy.ts + disclosure-policy.test.ts
  application/start-access-checkout.ts
  application/confirm-access-checkout.ts + confirm-access-checkout.integration.test.ts
  application/list-active-entitlements.ts
  application/has-tender-entitlement.ts
  ports/payment-gateway.ts
  infrastructure/mock-payment-gateway.ts + mock-payment-gateway.test.ts
  infrastructure/prisma-entitlement-repository.ts
  http/access-handlers.ts + access-handlers.test.ts
  http/map-access-error.ts + map-access-error.test.ts
  ui/access-checkout-form.tsx
  ui/entitlement-panel.tsx + entitlement-panel.test.tsx

src/modules/bidding/
  domain/bid.ts
  domain/constraints.ts
  domain/bid-eligibility.ts + bid-eligibility.test.ts
  domain/ranking.ts + ranking.test.ts + ranking.property.test.ts
  domain/bid-summary.ts + bid-summary.test.ts
  application/submit-bid.ts
  application/revise-bid.ts
  application/withdraw-bid.ts
  application/get-bid-summary.ts
  application/list-tender-bids.ts
  application/tender-has-active-bids.ts
  application/run-deadline-selection.ts
  application/bid-lifecycle.integration.test.ts
  application/run-deadline-selection.integration.test.ts
  ports/provider-directory.ts
  infrastructure/prisma-bid-repository.ts
  infrastructure/prisma-selection-repository.ts
  http/bid-handlers.ts + bid-handlers.test.ts
  http/selection-handlers.ts + selection-handlers.test.ts
  http/map-bidding-error.ts
  ui/bid-form.tsx
  ui/bid-comparison.tsx + bid-comparison.test.tsx
  ui/bid-summary-view.tsx
  ui/bid-copy.ts
  ui/bid-request.ts

src/modules/agreements/
  domain/agreement.ts + agreement.test.ts
  infrastructure/prisma-agreement-gateway.ts

src/modules/notifications/
  domain/outbox-topic.ts
  infrastructure/prisma-outbox-gateway.ts

src/modules/tenders/
  domain/tender.ts                                     + CLOSED/EXPIRED, PublishedTenderStatus
  domain/masking.ts                                    + status on the public projections, full detail
  application/get-tender-bidding-context.ts            published cross-module read
  application/get-tender-for-provider.ts + .test.ts    masked vs full, entitlement-gated
  application/cancel-tender.ts                         + TENDER_HAS_BIDS via the BidPresence port
  application/get-attachment-download.ts               + entitled-provider path
  ports/entitlement-check.ts
  ports/bid-presence.ts
  infrastructure/prisma-tender-selection-gateway.ts
  http/map-tender-error.ts                             + TENDER_HAS_BIDS, NOT_ENTITLED

src/modules/profiles/application/get-provider-display-names.ts   published cross-module read
src/modules/localization/messages/{ka,en}.json         + entitlements.*, bidding.* groups
src/modules/localization/messages.test.ts              + the two new required groups

app/[locale]/(workspace)/provider/tenders/[id]/page.tsx  entitlement + bid surfaces
app/[locale]/(workspace)/client/tenders/[id]/page.tsx    bid comparison + outcome

scripts/seed-phase-03.ts
src/test/e2e/fixtures/bidding.ts
src/test/e2e/phase-03-access.spec.ts
src/test/e2e/phase-03-selection.spec.ts
docs/development.md                                    + Phase 3 fixtures and gate
```

---

### Task 1: Access domain, product catalog, and the Phase 3 schema

**Files:**

- Create: `src/modules/access/domain/access-product.ts`
- Create: `src/modules/access/domain/access-product.test.ts`
- Create: `src/modules/access/domain/entitlement.ts`
- Create: `src/modules/access/domain/disclosure-policy.ts`
- Create: `src/modules/access/domain/disclosure-policy.test.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_access_bidding/migration.sql`

**Interfaces:**

- Consumes: `Money`, `Currency` from `@/src/modules/shared`.
- Produces: `AccessProductCode`, `AccessProduct`, `ACCESS_PRODUCTS`, `accessProductFor`, `entitlementExpiryFor`, `EntitlementKind`, `Entitlement`, `DisclosureLevel`, `isActiveEntitlement`, `disclosureFor`. Produces every Prisma model Tasks 2–9 persist: `AccessEntitlement`, `PaymentEvent`, `Bid`, `TenderSelection`, `Agreement`, plus the `CLOSED`/`EXPIRED` `TenderStatus` values.

- [ ] **Step 1: Write the failing access-product tests**

```ts
// src/modules/access/domain/access-product.test.ts
import { describe, expect, it } from "vitest";
import {
  ACCESS_PRODUCTS,
  accessProductFor,
  entitlementExpiryFor,
} from "./access-product";

describe("ACCESS_PRODUCTS", () => {
  it("prices access exactly as the source documents require", () => {
    expect(ACCESS_PRODUCTS.SINGLE_TENDER.amountMinorUnits).toBe(100);
    expect(ACCESS_PRODUCTS.MONTHLY_PROVIDER.amountMinorUnits).toBe(2_000);
    expect(ACCESS_PRODUCTS.ANNUAL_PROVIDER.amountMinorUnits).toBe(20_000);
    for (const product of Object.values(ACCESS_PRODUCTS)) {
      expect(product.currency).toBe("USD");
    }
  });

  it("requires a tender only for single-tender access", () => {
    expect(ACCESS_PRODUCTS.SINGLE_TENDER.requiresTender).toBe(true);
    expect(ACCESS_PRODUCTS.MONTHLY_PROVIDER.requiresTender).toBe(false);
    expect(ACCESS_PRODUCTS.ANNUAL_PROVIDER.requiresTender).toBe(false);
  });
});

describe("accessProductFor", () => {
  it("resolves a known code and rejects anything else", () => {
    expect(accessProductFor("MONTHLY_PROVIDER")).toBe(
      ACCESS_PRODUCTS.MONTHLY_PROVIDER,
    );
    expect(accessProductFor("ADMIN_OVERRIDE")).toBeUndefined();
    expect(accessProductFor("free")).toBeUndefined();
  });
});

describe("entitlementExpiryFor", () => {
  const grantedAt = new Date("2026-03-01T00:00:00.000Z");

  it("never expires single-tender access", () => {
    expect(
      entitlementExpiryFor(ACCESS_PRODUCTS.SINGLE_TENDER, grantedAt),
    ).toBeNull();
  });

  it("expires a monthly subscription 30 days after the grant", () => {
    expect(
      entitlementExpiryFor(ACCESS_PRODUCTS.MONTHLY_PROVIDER, grantedAt),
    ).toEqual(new Date("2026-03-31T00:00:00.000Z"));
  });

  it("expires an annual subscription 365 days after the grant", () => {
    expect(
      entitlementExpiryFor(ACCESS_PRODUCTS.ANNUAL_PROVIDER, grantedAt),
    ).toEqual(new Date("2027-03-01T00:00:00.000Z"));
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm vitest run src/modules/access/domain/access-product.test.ts`
Expected: FAIL — `./access-product` does not exist.

- [ ] **Step 3: Implement the product catalog and entitlement types**

```ts
// src/modules/access/domain/entitlement.ts
export type EntitlementKind =
  | "SINGLE_TENDER"
  | "MONTHLY_PROVIDER"
  | "ANNUAL_PROVIDER"
  // Reserved for audited support inspection (program design §4.7). No route
  // grants it in this phase; the policy honours it so Phase 6's admin surface
  // does not need a second disclosure rule.
  | "ADMIN_OVERRIDE";

export type Entitlement = Readonly<{
  id: string;
  providerId: string;
  kind: EntitlementKind;
  // Non-null only for SINGLE_TENDER (and an ADMIN_OVERRIDE scoped to one
  // tender). A subscription entitles every tender, so it stores no tender.
  tenderId: string | null;
  grantedAt: Date;
  // Null means "does not expire", which is only ever true for single-tender
  // access: the provider paid for that one tender permanently.
  expiresAt: Date | null;
}>;
```

```ts
// src/modules/access/domain/access-product.ts
import type { Currency } from "../../shared";
import type { EntitlementKind } from "./entitlement";

export type AccessProductCode =
  "SINGLE_TENDER" | "MONTHLY_PROVIDER" | "ANNUAL_PROVIDER";

export type AccessProduct = Readonly<{
  code: AccessProductCode;
  entitlementKind: EntitlementKind;
  // Integer minor units, matching the platform-wide money rule. USD 1 / 20 /
  // 200 are the amounts the source documents fix; changing them requires a
  // spec revision, not a code edit.
  amountMinorUnits: number;
  currency: Currency;
  durationDays: number | null;
  requiresTender: boolean;
}>;

const DAY_MS = 24 * 60 * 60 * 1000;

export const ACCESS_PRODUCTS: Readonly<
  Record<AccessProductCode, AccessProduct>
> = {
  SINGLE_TENDER: {
    code: "SINGLE_TENDER",
    entitlementKind: "SINGLE_TENDER",
    amountMinorUnits: 100,
    currency: "USD",
    durationDays: null,
    requiresTender: true,
  },
  MONTHLY_PROVIDER: {
    code: "MONTHLY_PROVIDER",
    entitlementKind: "MONTHLY_PROVIDER",
    amountMinorUnits: 2_000,
    currency: "USD",
    durationDays: 30,
    requiresTender: false,
  },
  ANNUAL_PROVIDER: {
    code: "ANNUAL_PROVIDER",
    entitlementKind: "ANNUAL_PROVIDER",
    amountMinorUnits: 20_000,
    currency: "USD",
    durationDays: 365,
    requiresTender: false,
  },
};

// `ADMIN_OVERRIDE` is deliberately unreachable here: it is an entitlement
// kind, not a purchasable product, so no checkout can ever mint one.
export function accessProductFor(code: string): AccessProduct | undefined {
  return Object.hasOwn(ACCESS_PRODUCTS, code)
    ? ACCESS_PRODUCTS[code as AccessProductCode]
    : undefined;
}

export function entitlementExpiryFor(
  product: AccessProduct,
  grantedAt: Date,
): Date | null {
  return product.durationDays === null
    ? null
    : new Date(grantedAt.getTime() + product.durationDays * DAY_MS);
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run src/modules/access/domain/access-product.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing disclosure-policy tests**

These are the disclosure cases the roadmap's automated proof names: no entitlement, wrong provider, expired subscription, single-tender access, and administrator inspection.

```ts
// src/modules/access/domain/disclosure-policy.test.ts
import { describe, expect, it } from "vitest";
import { disclosureFor } from "./disclosure-policy";
import type { Entitlement } from "./entitlement";

const now = new Date("2026-06-01T12:00:00.000Z");
const request = { providerId: "provider-1", tenderId: "tender-1" };

function entitlement(overrides: Partial<Entitlement>): Entitlement {
  return {
    id: "entitlement-1",
    providerId: "provider-1",
    kind: "MONTHLY_PROVIDER",
    tenderId: null,
    grantedAt: new Date("2026-05-20T00:00:00.000Z"),
    expiresAt: new Date("2026-06-19T00:00:00.000Z"),
    ...overrides,
  };
}

describe("disclosureFor", () => {
  it("masks a provider with no entitlement at all", () => {
    expect(disclosureFor([], request, now)).toBe("MASKED");
  });

  it("masks an entitlement belonging to a different provider", () => {
    expect(
      disclosureFor([entitlement({ providerId: "provider-2" })], request, now),
    ).toBe("MASKED");
  });

  it("masks an expired subscription", () => {
    expect(
      disclosureFor(
        [entitlement({ expiresAt: new Date("2026-05-31T23:59:59.000Z") })],
        request,
        now,
      ),
    ).toBe("MASKED");
  });

  it("masks a subscription that has not started yet", () => {
    expect(
      disclosureFor(
        [entitlement({ grantedAt: new Date("2026-06-02T00:00:00.000Z") })],
        request,
        now,
      ),
    ).toBe("MASKED");
  });

  it("discloses fully for an active subscription", () => {
    expect(disclosureFor([entitlement({})], request, now)).toBe("FULL");
  });

  it("discloses fully for single-tender access to this tender only", () => {
    const single = entitlement({
      kind: "SINGLE_TENDER",
      tenderId: "tender-1",
      expiresAt: null,
    });
    expect(disclosureFor([single], request, now)).toBe("FULL");
    expect(
      disclosureFor([single], { ...request, tenderId: "tender-2" }, now),
    ).toBe("MASKED");
  });

  it("discloses fully for an audited administrator override", () => {
    expect(
      disclosureFor(
        [entitlement({ kind: "ADMIN_OVERRIDE", expiresAt: null })],
        request,
        now,
      ),
    ).toBe("FULL");
  });

  it("treats the expiry instant itself as expired", () => {
    expect(disclosureFor([entitlement({ expiresAt: now })], request, now)).toBe(
      "MASKED",
    );
  });
});
```

- [ ] **Step 6: Run the tests and confirm they fail**

Run: `pnpm vitest run src/modules/access/domain/disclosure-policy.test.ts`
Expected: FAIL — `./disclosure-policy` does not exist.

- [ ] **Step 7: Implement the disclosure policy**

```ts
// src/modules/access/domain/disclosure-policy.ts
import type { Entitlement } from "./entitlement";

export type DisclosureLevel = "MASKED" | "FULL";

export type DisclosureRequest = Readonly<{
  providerId: string;
  tenderId: string;
}>;

// One rule, one place. Every surface that could leak an exact address, the
// client's identity, attachments, or full conditions asks this function
// rather than re-deriving "is this provider allowed" from a payment row.
export function isActiveEntitlement(
  entitlement: Entitlement,
  request: DisclosureRequest,
  now: Date,
): boolean {
  if (entitlement.providerId !== request.providerId) return false;
  // A tender-scoped entitlement covers exactly that tender. A null tenderId
  // is a subscription and covers every tender.
  if (
    entitlement.tenderId !== null &&
    entitlement.tenderId !== request.tenderId
  ) {
    return false;
  }
  if (entitlement.grantedAt.getTime() > now.getTime()) return false;
  // `>=`, not `>`: the expiry instant is the first instant the entitlement no
  // longer holds, so a subscription cannot be used at its own expiry time.
  return (
    entitlement.expiresAt === null ||
    entitlement.expiresAt.getTime() > now.getTime()
  );
}

export function disclosureFor(
  entitlements: readonly Entitlement[],
  request: DisclosureRequest,
  now: Date,
): DisclosureLevel {
  return entitlements.some((entitlement) =>
    isActiveEntitlement(entitlement, request, now),
  )
    ? "FULL"
    : "MASKED";
}
```

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `pnpm vitest run src/modules/access/domain/`
Expected: PASS — both files.

- [ ] **Step 9: Extend the Prisma schema with every Phase 3 model**

Append to `prisma/schema.prisma`, and edit the existing `TenderStatus` enum in place so it reads:

```prisma
enum TenderStatus {
  DRAFT
  PUBLISHED
  // Selection ran and produced a winner.
  CLOSED
  // The deadline passed with no eligible bid.
  EXPIRED
  CANCELLED
}

enum EntitlementKind {
  SINGLE_TENDER
  MONTHLY_PROVIDER
  ANNUAL_PROVIDER
  ADMIN_OVERRIDE
}

enum PaymentEventStatus {
  PENDING
  SUCCEEDED
  FAILED
  CANCELLED
}

enum BidStatus {
  SUBMITTED
  WINNER
  LOST
  WITHDRAWN
}

enum SelectionOutcome {
  WINNER_SELECTED
  EXPIRED_NO_BIDS
}

enum AgreementStatus {
  PENDING_CONFIRMATION
}

model AccessEntitlement {
  id            String          @id
  providerId    String
  provider      User            @relation(fields: [providerId], references: [id], onDelete: Cascade)
  kind          EntitlementKind
  // Null for subscriptions. No relation is declared to Tender: an entitlement
  // is a purchase record and must survive the tender it was bought for.
  tenderId      String?
  grantedAt     DateTime
  expiresAt     DateTime?
  sourceEventId String?         @unique
  createdAt     DateTime        @default(now())

  @@index([providerId, kind, expiresAt])
  @@index([providerId, tenderId])
}

model PaymentEvent {
  // The idempotency key. A real Phase 5 webhook carries the provider's event
  // id here; the mock adapter derives a deterministic one from the checkout.
  externalEventId  String             @id
  checkoutId       String             @unique
  providerId       String
  product          String
  tenderId         String?
  amountMinorUnits Int
  currency         String
  status           PaymentEventStatus @default(PENDING)
  rawPayload       Json
  receivedAt       DateTime           @default(now())
  appliedAt        DateTime?

  @@index([providerId, receivedAt])
}

model Bid {
  id                   String    @id
  tenderId             String
  tender               Tender    @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  providerId           String
  provider             User      @relation(fields: [providerId], references: [id], onDelete: Cascade)
  amountMinorUnits     Int
  currency             String
  status               BidStatus @default(SUBMITTED)
  proposedStartDate    DateTime?
  durationDays         Int?
  includedCosts        String?
  exclusions           String?
  conditions           String
  // Reset on every revision, so a revised bid loses its original queue
  // position for tie-breaking (program design §4.3).
  qualifyingSubmittedAt DateTime
  withdrawnAt          DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  // One active bid per provider per tender. A withdrawal keeps the row, so
  // this also prevents a withdrawn bidder from opening a second record.
  @@unique([tenderId, providerId])
  // Serves the ranking read directly: amount, then queue position, then id.
  @@index([tenderId, status, amountMinorUnits, qualifyingSubmittedAt, id])
}

model TenderSelection {
  id           String           @id
  // The hard idempotency guarantee: a second selection for the same tender
  // cannot insert, no matter how many workers race.
  tenderId     String           @unique
  outcome      SelectionOutcome
  winningBidId String?          @unique
  agreementId  String?          @unique
  ranAt        DateTime
  createdAt    DateTime         @default(now())
}

model Agreement {
  id               String          @id
  tenderId         String          @unique
  clientId         String
  providerId       String
  bidId            String          @unique
  status           AgreementStatus @default(PENDING_CONFIRMATION)
  amountMinorUnits Int
  currency         String
  tenderTitle      String
  // The immutable snapshot of the winning offer's terms. Phase 4 reads it to
  // present the same text both parties confirm.
  snapshot         Json
  confirmDeadline  DateTime
  createdAt        DateTime        @default(now())

  @@index([clientId, status])
  @@index([providerId, status])
}
```

Then add the back-relations to `User` and `Tender` (Prisma requires both sides):

```prisma
model User {
  // ...existing fields...
  tenders      Tender[]
  entitlements AccessEntitlement[]
  bids         Bid[]
}

model Tender {
  // ...existing fields...
  attachments TenderAttachment[]
  bids        Bid[]
}
```

- [ ] **Step 10: Generate and apply the migration**

Run:

```powershell
pnpm exec prisma migrate dev --name access_bidding
pnpm db:generate
pnpm db:migrate:test
```

Expected: a new `prisma/migrations/<timestamp>_access_bidding/migration.sql` that adds two `TenderStatus` values and creates the five new tables. The migration only _adds_ enum values and never uses them in the same statement, so PostgreSQL's in-transaction `ALTER TYPE ... ADD VALUE` restriction does not apply.

- [ ] **Step 11: Confirm the schema compiles and the gate still passes**

Run: `pnpm typecheck && pnpm verify:boundaries && pnpm test:unit`
Expected: PASS. `verify:boundaries` must report "Domain module boundaries verified." — the new `access/domain` files import only `../../shared` and their own folder.

- [ ] **Step 12: Commit**

```bash
git add src/modules/access/domain prisma/schema.prisma prisma/migrations
git commit -m "feat: add access entitlement domain and phase 3 schema"
```

---

### Task 2: Mock payment gateway, checkout use cases, and the entitlement repository

**Files:**

- Create: `src/modules/access/ports/payment-gateway.ts`
- Create: `src/modules/access/infrastructure/mock-payment-gateway.ts`
- Create: `src/modules/access/infrastructure/mock-payment-gateway.test.ts`
- Create: `src/modules/access/application/start-access-checkout.ts`
- Create: `src/modules/access/application/confirm-access-checkout.ts`
- Create: `src/modules/access/application/list-active-entitlements.ts`
- Create: `src/modules/access/application/has-tender-entitlement.ts`
- Create: `src/modules/access/infrastructure/prisma-entitlement-repository.ts`
- Create: `src/modules/access/application/confirm-access-checkout.integration.test.ts`

**Interfaces:**

- Consumes: `Result`, `Clock`, `IdGenerator` from `@/src/modules/shared`; `ACCESS_PRODUCTS`, `accessProductFor`, `entitlementExpiryFor`, `Entitlement`, `isActiveEntitlement` from Task 1; `getTenderBiddingContext` is **not** used here — a checkout only needs the tender to exist, which the repository checks.
- Produces: `PaymentGateway`, `CheckoutIntent`, `PaymentEventRecord`, `mockPaymentGateway`, `AccessActor`, `startAccessCheckout`, `confirmAccessCheckout`, `listActiveEntitlements`, `hasTenderEntitlement`, `StartCheckoutError`, `ConfirmCheckoutError`, `CheckoutView`, `prismaEntitlementRepository`.

- [ ] **Step 1: Write the payment-gateway port**

```ts
// src/modules/access/ports/payment-gateway.ts
import type { Currency } from "../../shared";
import type { AccessProductCode } from "../domain/access-product";

export type CheckoutIntent = Readonly<{
  checkoutId: string;
  providerId: string;
  product: AccessProductCode;
  tenderId: string | null;
  amountMinorUnits: number;
  currency: Currency;
}>;

export type CheckoutSession = Readonly<{
  checkoutId: string;
  // Where the browser posts to complete payment. A hosted Phase 5 provider
  // returns its own absolute URL here instead; the shape does not change.
  confirmPath: string;
}>;

export type PaymentEventRecord = Readonly<{
  // The idempotency key a Phase 5 webhook will carry verbatim.
  externalEventId: string;
  checkoutId: string;
  status: "SUCCEEDED" | "FAILED" | "CANCELLED";
  rawPayload: Readonly<Record<string, unknown>>;
}>;

export interface PaymentGateway {
  createCheckout(intent: CheckoutIntent): Promise<CheckoutSession>;
  confirmCheckout(intent: CheckoutIntent): Promise<PaymentEventRecord>;
}
```

- [ ] **Step 2: Write the failing mock-gateway test**

```ts
// src/modules/access/infrastructure/mock-payment-gateway.test.ts
import { describe, expect, it } from "vitest";
import type { CheckoutIntent } from "../ports/payment-gateway";
import { mockPaymentGateway } from "./mock-payment-gateway";

const intent: CheckoutIntent = {
  checkoutId: "checkout-1",
  providerId: "provider-1",
  product: "SINGLE_TENDER",
  tenderId: "tender-1",
  amountMinorUnits: 100,
  currency: "USD",
};

describe("mockPaymentGateway", () => {
  it("returns a confirm path scoped to the checkout", async () => {
    const session = await mockPaymentGateway.createCheckout(intent);
    expect(session).toEqual({
      checkoutId: "checkout-1",
      confirmPath: "/api/access/checkout/checkout-1/confirm",
    });
  });

  it("derives a deterministic event id so a replay cannot double-grant", async () => {
    const first = await mockPaymentGateway.confirmCheckout(intent);
    const second = await mockPaymentGateway.confirmCheckout(intent);
    expect(first.externalEventId).toBe("mock-payment-checkout-1");
    expect(second.externalEventId).toBe(first.externalEventId);
    expect(first.status).toBe("SUCCEEDED");
  });

  it("records the purchased amount in the raw payload it hands back", async () => {
    const event = await mockPaymentGateway.confirmCheckout(intent);
    expect(event.rawPayload).toEqual({
      gateway: "mock",
      product: "SINGLE_TENDER",
      tenderId: "tender-1",
      amountMinorUnits: 100,
      currency: "USD",
    });
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `pnpm vitest run src/modules/access/infrastructure/mock-payment-gateway.test.ts`
Expected: FAIL — `./mock-payment-gateway` does not exist.

- [ ] **Step 4: Implement the mock gateway**

```ts
// src/modules/access/infrastructure/mock-payment-gateway.ts
import type {
  CheckoutIntent,
  CheckoutSession,
  PaymentEventRecord,
  PaymentGateway,
} from "../ports/payment-gateway";

// The mock never fails a payment: this phase proves entitlement and
// disclosure, not payment failure handling, which arrives with the real
// provider in Phase 5 together with signature verification and retries.
export class MockPaymentGateway implements PaymentGateway {
  async createCheckout(intent: CheckoutIntent): Promise<CheckoutSession> {
    return {
      checkoutId: intent.checkoutId,
      confirmPath: `/api/access/checkout/${intent.checkoutId}/confirm`,
    };
  }

  async confirmCheckout(intent: CheckoutIntent): Promise<PaymentEventRecord> {
    return {
      // Derived from the checkout rather than randomly generated, so
      // confirming the same checkout twice produces the same idempotency key
      // and the second apply is a no-op instead of a second entitlement.
      externalEventId: `mock-payment-${intent.checkoutId}`,
      checkoutId: intent.checkoutId,
      status: "SUCCEEDED",
      rawPayload: {
        gateway: "mock",
        product: intent.product,
        tenderId: intent.tenderId,
        amountMinorUnits: intent.amountMinorUnits,
        currency: intent.currency,
      },
    };
  }
}

export const mockPaymentGateway = new MockPaymentGateway();
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `pnpm vitest run src/modules/access/infrastructure/mock-payment-gateway.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement the checkout use cases**

```ts
// src/modules/access/application/start-access-checkout.ts
import { z } from "zod";
import type { Clock, IdGenerator, Result } from "../../shared";
import { accessProductFor, type AccessProduct } from "../domain/access-product";
import type { Entitlement } from "../domain/entitlement";
import { isActiveEntitlement } from "../domain/disclosure-policy";
import type { CheckoutSession, PaymentGateway } from "../ports/payment-gateway";

export const startAccessCheckoutCommandSchema = z
  .object({
    product: z.enum(["SINGLE_TENDER", "MONTHLY_PROVIDER", "ANNUAL_PROVIDER"]),
    tenderId: z.string().uuid().optional(),
  })
  .strict();

export type StartAccessCheckoutCommand = z.output<
  typeof startAccessCheckoutCommandSchema
>;
export type AccessActor = Readonly<{ id: string }>;

export type StartCheckoutError =
  | "INVALID_INPUT"
  | "TENDER_REQUIRED"
  | "TENDER_NOT_ALLOWED"
  | "TENDER_NOT_FOUND"
  | "ALREADY_ENTITLED";

export type CheckoutView = Readonly<{
  checkoutId: string;
  product: AccessProduct["code"];
  amountMinorUnits: number;
  currency: AccessProduct["currency"];
  confirmPath: string;
}>;

export interface StartAccessCheckoutRepository {
  // Only checks existence and publication: a provider may buy access to a
  // tender whose deadline has already passed (they may still need to read the
  // record they bid on), so no deadline predicate belongs here.
  publishedTenderExists(tenderId: string): Promise<boolean>;
  listEntitlements(providerId: string): Promise<readonly Entitlement[]>;
  createCheckout(
    intent: Readonly<{
      checkoutId: string;
      providerId: string;
      product: AccessProduct["code"];
      tenderId: string | null;
      amountMinorUnits: number;
      currency: AccessProduct["currency"];
    }>,
    now: Date,
  ): Promise<void>;
}

export function createStartAccessCheckout(dependencies: {
  repository: StartAccessCheckoutRepository;
  gateway: PaymentGateway;
  ids: IdGenerator;
  clock: Clock;
}) {
  return async function startAccessCheckout(
    input: unknown,
    actor: AccessActor,
  ): Promise<Result<CheckoutView, StartCheckoutError>> {
    const parsed = startAccessCheckoutCommandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

    const product = accessProductFor(parsed.data.product);
    if (product === undefined) return { ok: false, error: "INVALID_INPUT" };

    const tenderId = parsed.data.tenderId ?? null;
    if (product.requiresTender && tenderId === null) {
      return { ok: false, error: "TENDER_REQUIRED" };
    }
    // A subscription that named a tender would silently sell tender-scoped
    // access at the subscription price; reject rather than ignore the field.
    if (!product.requiresTender && tenderId !== null) {
      return { ok: false, error: "TENDER_NOT_ALLOWED" };
    }

    const now = dependencies.clock.now();
    if (tenderId !== null) {
      if (!(await dependencies.repository.publishedTenderExists(tenderId))) {
        return { ok: false, error: "TENDER_NOT_FOUND" };
      }
      const existing = await dependencies.repository.listEntitlements(actor.id);
      const alreadyEntitled = existing.some((entitlement) =>
        isActiveEntitlement(
          entitlement,
          { providerId: actor.id, tenderId },
          now,
        ),
      );
      // Charging again for access the provider already holds would be a
      // straightforward overcharge, so this is a rejection, not a no-op.
      if (alreadyEntitled) return { ok: false, error: "ALREADY_ENTITLED" };
    }

    const checkoutId = dependencies.ids.next();
    const intent = {
      checkoutId,
      providerId: actor.id,
      product: product.code,
      tenderId,
      amountMinorUnits: product.amountMinorUnits,
      currency: product.currency,
    };
    await dependencies.repository.createCheckout(intent, now);
    const session: CheckoutSession =
      await dependencies.gateway.createCheckout(intent);

    return {
      ok: true,
      value: {
        checkoutId,
        product: product.code,
        amountMinorUnits: product.amountMinorUnits,
        currency: product.currency,
        confirmPath: session.confirmPath,
      },
    };
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function startAccessCheckout(
  input: unknown,
  actor: AccessActor,
): Promise<Result<CheckoutView, StartCheckoutError>> {
  const [{ prismaEntitlementRepository }, { mockPaymentGateway }] =
    await Promise.all([
      import("../infrastructure/prisma-entitlement-repository"),
      import("../infrastructure/mock-payment-gateway"),
    ]);
  return createStartAccessCheckout({
    repository: prismaEntitlementRepository,
    gateway: mockPaymentGateway,
    ids: systemIds,
    clock: systemClock,
  })(input, actor);
}
```

```ts
// src/modules/access/application/confirm-access-checkout.ts
import type { Clock, IdGenerator, Result } from "../../shared";
import { accessProductFor } from "../domain/access-product";
import { entitlementExpiryFor } from "../domain/access-product";
import type { Entitlement } from "../domain/entitlement";
import type { PaymentGateway } from "../ports/payment-gateway";
import type { AccessActor } from "./start-access-checkout";

export type ConfirmCheckoutError =
  "CHECKOUT_NOT_FOUND" | "NOT_CHECKOUT_OWNER" | "PAYMENT_FAILED";

export type PendingCheckout = Readonly<{
  checkoutId: string;
  providerId: string;
  product: string;
  tenderId: string | null;
  amountMinorUnits: number;
  currency: "GEL" | "USD";
}>;

export interface ConfirmAccessCheckoutRepository {
  findCheckout(checkoutId: string): Promise<PendingCheckout | null>;
  // Applies the payment event and grants the entitlement in ONE transaction,
  // keyed on `externalEventId`. A replay returns the entitlement the first
  // apply produced instead of granting a second one.
  applyPaymentEvent(
    event: Readonly<{
      externalEventId: string;
      checkoutId: string;
      rawPayload: Readonly<Record<string, unknown>>;
    }>,
    grant: Readonly<{
      entitlementId: string;
      providerId: string;
      kind: Entitlement["kind"];
      tenderId: string | null;
      grantedAt: Date;
      expiresAt: Date | null;
    }>,
  ): Promise<Entitlement>;
}

export function createConfirmAccessCheckout(dependencies: {
  repository: ConfirmAccessCheckoutRepository;
  gateway: PaymentGateway;
  ids: IdGenerator;
  clock: Clock;
}) {
  return async function confirmAccessCheckout(
    checkoutId: string,
    actor: AccessActor,
  ): Promise<Result<Entitlement, ConfirmCheckoutError>> {
    const checkout = await dependencies.repository.findCheckout(checkoutId);
    if (checkout === null) return { ok: false, error: "CHECKOUT_NOT_FOUND" };
    // Confirming somebody else's checkout would grant them access the actor
    // paid for — or grant the actor access charged to another account.
    if (checkout.providerId !== actor.id) {
      return { ok: false, error: "NOT_CHECKOUT_OWNER" };
    }

    const product = accessProductFor(checkout.product);
    if (product === undefined) return { ok: false, error: "PAYMENT_FAILED" };

    const event = await dependencies.gateway.confirmCheckout({
      checkoutId: checkout.checkoutId,
      providerId: checkout.providerId,
      product: product.code,
      tenderId: checkout.tenderId,
      amountMinorUnits: checkout.amountMinorUnits,
      currency: product.currency,
    });
    if (event.status !== "SUCCEEDED") {
      return { ok: false, error: "PAYMENT_FAILED" };
    }

    const grantedAt = dependencies.clock.now();
    const entitlement = await dependencies.repository.applyPaymentEvent(
      {
        externalEventId: event.externalEventId,
        checkoutId: event.checkoutId,
        rawPayload: event.rawPayload,
      },
      {
        entitlementId: dependencies.ids.next(),
        providerId: checkout.providerId,
        kind: product.entitlementKind,
        tenderId: checkout.tenderId,
        grantedAt,
        expiresAt: entitlementExpiryFor(product, grantedAt),
      },
    );

    return { ok: true, value: entitlement };
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function confirmAccessCheckout(
  checkoutId: string,
  actor: AccessActor,
): Promise<Result<Entitlement, ConfirmCheckoutError>> {
  const [{ prismaEntitlementRepository }, { mockPaymentGateway }] =
    await Promise.all([
      import("../infrastructure/prisma-entitlement-repository"),
      import("../infrastructure/mock-payment-gateway"),
    ]);
  return createConfirmAccessCheckout({
    repository: prismaEntitlementRepository,
    gateway: mockPaymentGateway,
    ids: systemIds,
    clock: systemClock,
  })(checkoutId, actor);
}
```

```ts
// src/modules/access/application/list-active-entitlements.ts
import type { Clock } from "../../shared";
import { isActiveEntitlement } from "../domain/disclosure-policy";
import type { Entitlement } from "../domain/entitlement";
import type { AccessActor } from "./start-access-checkout";

export interface ListEntitlementsRepository {
  listEntitlements(providerId: string): Promise<readonly Entitlement[]>;
}

export function createListActiveEntitlements(dependencies: {
  repository: ListEntitlementsRepository;
  clock: Clock;
}) {
  return async function listActiveEntitlements(
    actor: AccessActor,
  ): Promise<readonly Entitlement[]> {
    const now = dependencies.clock.now();
    const all = await dependencies.repository.listEntitlements(actor.id);
    // `isActiveEntitlement` needs a tender to compare against; a
    // tender-scoped entitlement is always "active for its own tender", so
    // asking about its own tenderId is the correct question here.
    return all.filter((entitlement) =>
      isActiveEntitlement(
        entitlement,
        {
          providerId: actor.id,
          tenderId: entitlement.tenderId ?? "",
        },
        now,
      ),
    );
  };
}

export async function listActiveEntitlements(
  actor: AccessActor,
): Promise<readonly Entitlement[]> {
  const { prismaEntitlementRepository } =
    await import("../infrastructure/prisma-entitlement-repository");
  return createListActiveEntitlements({
    repository: prismaEntitlementRepository,
    clock: { now: () => new Date() },
  })(actor);
}
```

```ts
// src/modules/access/application/has-tender-entitlement.ts
import { disclosureFor } from "../domain/disclosure-policy";
import type { ListEntitlementsRepository } from "./list-active-entitlements";

export function createHasTenderEntitlement(dependencies: {
  repository: ListEntitlementsRepository;
}) {
  return async function hasTenderEntitlement(
    providerId: string,
    tenderId: string,
    now: Date,
  ): Promise<boolean> {
    const entitlements =
      await dependencies.repository.listEntitlements(providerId);
    return (
      disclosureFor(entitlements, { providerId, tenderId }, now) === "FULL"
    );
  };
}

// The published cross-module query the `tenders` and `bidding` modules bind
// to their own `EntitlementCheck` port. It is the only entitlement surface
// other modules are allowed to consume.
export async function hasTenderEntitlement(
  providerId: string,
  tenderId: string,
  now: Date,
): Promise<boolean> {
  const { prismaEntitlementRepository } =
    await import("../infrastructure/prisma-entitlement-repository");
  return createHasTenderEntitlement({
    repository: prismaEntitlementRepository,
  })(providerId, tenderId, now);
}
```

- [ ] **Step 7: Implement the entitlement repository**

```ts
// src/modules/access/infrastructure/prisma-entitlement-repository.ts
import { Prisma } from "../../../generated/prisma/client";
import type { AccessEntitlement } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import type {
  ConfirmAccessCheckoutRepository,
  PendingCheckout,
} from "../application/confirm-access-checkout";
import type { ListEntitlementsRepository } from "../application/list-active-entitlements";
import type { StartAccessCheckoutRepository } from "../application/start-access-checkout";
import type { Entitlement } from "../domain/entitlement";

function toEntitlement(row: AccessEntitlement): Entitlement {
  return {
    id: row.id,
    providerId: row.providerId,
    kind: row.kind,
    tenderId: row.tenderId,
    grantedAt: row.grantedAt,
    expiresAt: row.expiresAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export class PrismaEntitlementRepository
  implements
    StartAccessCheckoutRepository,
    ConfirmAccessCheckoutRepository,
    ListEntitlementsRepository
{
  async publishedTenderExists(tenderId: string): Promise<boolean> {
    const tender = await database.tender.findFirst({
      where: {
        id: tenderId,
        status: { in: ["PUBLISHED", "CLOSED", "EXPIRED"] },
      },
      select: { id: true },
    });
    return tender !== null;
  }

  async listEntitlements(providerId: string): Promise<readonly Entitlement[]> {
    const rows = await database.accessEntitlement.findMany({
      where: { providerId },
      orderBy: { grantedAt: "desc" },
    });
    return rows.map(toEntitlement);
  }

  async createCheckout(
    intent: Readonly<{
      checkoutId: string;
      providerId: string;
      product: string;
      tenderId: string | null;
      amountMinorUnits: number;
      currency: string;
    }>,
    now: Date,
  ): Promise<void> {
    await database.paymentEvent.create({
      data: {
        // A checkout that has not been confirmed yet is a PENDING event with
        // a placeholder key; confirming replaces it with the gateway's real
        // idempotency key by creating the SUCCEEDED row.
        externalEventId: `checkout-${intent.checkoutId}`,
        checkoutId: intent.checkoutId,
        providerId: intent.providerId,
        product: intent.product,
        tenderId: intent.tenderId,
        amountMinorUnits: intent.amountMinorUnits,
        currency: intent.currency,
        status: "PENDING",
        rawPayload: { gateway: "mock", stage: "checkout" },
        receivedAt: now,
      },
    });
  }

  async findCheckout(checkoutId: string): Promise<PendingCheckout | null> {
    const row = await database.paymentEvent.findUnique({
      where: { checkoutId },
    });
    if (row === null) return null;
    return {
      checkoutId: row.checkoutId,
      providerId: row.providerId,
      product: row.product,
      tenderId: row.tenderId,
      amountMinorUnits: row.amountMinorUnits,
      currency: row.currency === "USD" ? "USD" : "GEL",
    };
  }

  async applyPaymentEvent(
    event: Readonly<{
      externalEventId: string;
      checkoutId: string;
      rawPayload: Readonly<Record<string, unknown>>;
    }>,
    grant: Readonly<{
      entitlementId: string;
      providerId: string;
      kind: Entitlement["kind"];
      tenderId: string | null;
      grantedAt: Date;
      expiresAt: Date | null;
    }>,
  ): Promise<Entitlement> {
    // `sourceEventId` is UNIQUE, so a replayed event cannot insert a second
    // entitlement even if two requests race past the existence check below.
    const existing = await database.accessEntitlement.findUnique({
      where: { sourceEventId: event.externalEventId },
    });
    if (existing !== null) return toEntitlement(existing);

    try {
      return await database.$transaction(async (transaction) => {
        await transaction.paymentEvent.update({
          where: { checkoutId: event.checkoutId },
          data: {
            externalEventId: event.externalEventId,
            status: "SUCCEEDED",
            rawPayload: event.rawPayload as Prisma.InputJsonValue,
            appliedAt: grant.grantedAt,
          },
        });
        const created = await transaction.accessEntitlement.create({
          data: {
            id: grant.entitlementId,
            providerId: grant.providerId,
            kind: grant.kind,
            tenderId: grant.tenderId,
            grantedAt: grant.grantedAt,
            expiresAt: grant.expiresAt,
            sourceEventId: event.externalEventId,
          },
        });
        return toEntitlement(created);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // The concurrent apply won. Return its entitlement rather than
        // surfacing a constraint error for what is a successful outcome.
        const winner = await database.accessEntitlement.findUniqueOrThrow({
          where: { sourceEventId: event.externalEventId },
        });
        return toEntitlement(winner);
      }
      throw error;
    }
  }
}

export const prismaEntitlementRepository = new PrismaEntitlementRepository();
```

- [ ] **Step 8: Write the failing entitlement integration test**

```ts
// src/modules/access/application/confirm-access-checkout.integration.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { confirmAccessCheckout } from "./confirm-access-checkout";
import { hasTenderEntitlement } from "./has-tender-entitlement";
import { startAccessCheckout } from "./start-access-checkout";

async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: "Provider",
      email: `${id}@tender.test`,
      emailVerified: true,
    },
  });
  return id;
}

async function seedPublishedTender(ownerId: string): Promise<string> {
  const id = randomUUID();
  await database.tender.create({
    data: {
      id,
      ownerId,
      status: "PUBLISHED",
      specialty: "CONSTRUCTION_REPAIR",
      title: "Repaint two rooms",
      shortDescription: "Interior repaint",
      fullDescription: "Sand, prime, and repaint two bedrooms.",
      scopeOfWork: "Sanding, priming, painting",
      budgetMinorUnits: 80_000,
      currency: "GEL",
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      countryCode: "GE",
      locationMode: "ADDRESS",
      city: "Tbilisi",
      addressLine: "1 Chavchavadze Ave",
      exactLatitude: 41.7151,
      exactLongitude: 44.8271,
      publicLatitude: 41.72,
      publicLongitude: 44.83,
      publishedAt: new Date(),
    },
  });
  return id;
}

afterAll(async () => {
  await database.$disconnect();
});

describe("access checkout", () => {
  it("grants single-tender access and refuses to sell it twice", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId);

    const checkout = await startAccessCheckout(
      { product: "SINGLE_TENDER", tenderId },
      { id: providerId },
    );
    expect(checkout).toMatchObject({
      ok: true,
      value: { amountMinorUnits: 100, currency: "USD" },
    });
    if (!checkout.ok) throw new Error("checkout failed");

    const confirmed = await confirmAccessCheckout(checkout.value.checkoutId, {
      id: providerId,
    });
    expect(confirmed).toMatchObject({
      ok: true,
      value: { kind: "SINGLE_TENDER", tenderId, expiresAt: null },
    });

    await expect(
      hasTenderEntitlement(providerId, tenderId, new Date()),
    ).resolves.toBe(true);

    const second = await startAccessCheckout(
      { product: "SINGLE_TENDER", tenderId },
      { id: providerId },
    );
    expect(second).toEqual({ ok: false, error: "ALREADY_ENTITLED" });
  });

  it("applies a replayed payment event exactly once", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId);

    const checkout = await startAccessCheckout(
      { product: "SINGLE_TENDER", tenderId },
      { id: providerId },
    );
    if (!checkout.ok) throw new Error("checkout failed");

    const first = await confirmAccessCheckout(checkout.value.checkoutId, {
      id: providerId,
    });
    const replay = await confirmAccessCheckout(checkout.value.checkoutId, {
      id: providerId,
    });
    expect(first.ok && replay.ok).toBe(true);
    if (!first.ok || !replay.ok) throw new Error("confirm failed");
    expect(replay.value.id).toBe(first.value.id);

    const granted = await database.accessEntitlement.count({
      where: { providerId },
    });
    expect(granted).toBe(1);
  });

  it("refuses to confirm another provider's checkout", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const intruderId = await seedUser();
    const tenderId = await seedPublishedTender(clientId);

    const checkout = await startAccessCheckout(
      { product: "SINGLE_TENDER", tenderId },
      { id: providerId },
    );
    if (!checkout.ok) throw new Error("checkout failed");

    await expect(
      confirmAccessCheckout(checkout.value.checkoutId, { id: intruderId }),
    ).resolves.toEqual({ ok: false, error: "NOT_CHECKOUT_OWNER" });
  });

  it("entitles every tender through a monthly subscription", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const firstTender = await seedPublishedTender(clientId);
    const secondTender = await seedPublishedTender(clientId);

    const checkout = await startAccessCheckout(
      { product: "MONTHLY_PROVIDER" },
      { id: providerId },
    );
    if (!checkout.ok) throw new Error("checkout failed");
    expect(checkout.value.amountMinorUnits).toBe(2_000);
    await confirmAccessCheckout(checkout.value.checkoutId, { id: providerId });

    const now = new Date();
    await expect(
      hasTenderEntitlement(providerId, firstTender, now),
    ).resolves.toBe(true);
    await expect(
      hasTenderEntitlement(providerId, secondTender, now),
    ).resolves.toBe(true);
    // ...and it lapses at the 30-day boundary rather than lasting forever.
    const afterExpiry = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
    await expect(
      hasTenderEntitlement(providerId, firstTender, afterExpiry),
    ).resolves.toBe(false);
  });

  it("rejects a subscription checkout that names a tender", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId);

    await expect(
      startAccessCheckout(
        { product: "MONTHLY_PROVIDER", tenderId },
        { id: providerId },
      ),
    ).resolves.toEqual({ ok: false, error: "TENDER_NOT_ALLOWED" });
  });
});
```

- [ ] **Step 9: Run the integration test and confirm it passes**

Run: `pnpm db:up` (if the containers are not already healthy), then
`pnpm test:integration -- confirm-access-checkout`
Expected: PASS — five tests.

- [ ] **Step 10: Commit**

```bash
git add src/modules/access
git commit -m "feat: grant mock access entitlements idempotently"
```

---

### Task 3: Access HTTP routes and error mapping

**Files:**

- Create: `src/modules/access/http/map-access-error.ts`
- Create: `src/modules/access/http/map-access-error.test.ts`
- Create: `src/modules/access/http/access-handlers.ts`
- Create: `src/modules/access/http/access-handlers.test.ts`
- Create: `app/api/access/checkout/route.ts`
- Create: `app/api/access/checkout/[checkoutId]/confirm/route.ts`
- Create: `app/api/access/entitlements/route.ts`

**Interfaces:**

- Consumes: `AuthError` from `@/src/modules/identity/application/require-capability`; `StartCheckoutError`, `ConfirmCheckoutError`, `CheckoutView`, `AccessActor` from Task 2; `Messages` from `@/src/modules/localization/get-messages`.
- Produces: `AccessErrorCode`, `mapAccessError`, `ACCESS_ERROR_MESSAGE_KEYS`, `RequireProvider`, `createCheckoutHandlers`, `createCheckoutConfirmHandlers`, `createEntitlementHandlers`.

- [ ] **Step 1: Write the failing error-map test**

```ts
// src/modules/access/http/map-access-error.test.ts
import { describe, expect, it } from "vitest";
import { ACCESS_ERROR_MESSAGE_KEYS, mapAccessError } from "./map-access-error";

describe("mapAccessError", () => {
  it("maps authentication and authorization denials to their identity status", async () => {
    expect(mapAccessError("UNAUTHENTICATED").status).toBe(401);
    expect(mapAccessError("CAPABILITY_MISSING").status).toBe(403);
  });

  it("maps access-specific failures to precise statuses", () => {
    expect(mapAccessError("INVALID_INPUT").status).toBe(400);
    expect(mapAccessError("TENDER_REQUIRED").status).toBe(400);
    expect(mapAccessError("TENDER_NOT_ALLOWED").status).toBe(400);
    expect(mapAccessError("TENDER_NOT_FOUND").status).toBe(404);
    expect(mapAccessError("CHECKOUT_NOT_FOUND").status).toBe(404);
    expect(mapAccessError("NOT_CHECKOUT_OWNER").status).toBe(403);
    expect(mapAccessError("ALREADY_ENTITLED").status).toBe(409);
    expect(mapAccessError("PAYMENT_FAILED").status).toBe(402);
  });

  it("returns the error code and a resolvable message key in the body", async () => {
    const body: unknown = await mapAccessError("ALREADY_ENTITLED").json();
    expect(body).toEqual({
      code: "ALREADY_ENTITLED",
      messageKey: ACCESS_ERROR_MESSAGE_KEYS.ALREADY_ENTITLED,
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run src/modules/access/http/map-access-error.test.ts`
Expected: FAIL — `./map-access-error` does not exist.

- [ ] **Step 3: Implement the error map**

```ts
// src/modules/access/http/map-access-error.ts
import type { AuthError } from "../../identity/application/require-capability";
import type { Messages } from "../../localization/get-messages";
import type { ConfirmCheckoutError } from "../application/confirm-access-checkout";
import type { StartCheckoutError } from "../application/start-access-checkout";

export type AccessErrorCode =
  AuthError | StartCheckoutError | ConfirmCheckoutError;

type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`;
}[keyof T & string];

// Same exhaustiveness guarantee as `src/modules/tenders/http/map-tender-error.ts`:
// typed as a total `Record`, so a new `AuthError` member fails to compile here
// until it is given a status.
const AUTH_STATUS_BY_ERROR: Readonly<Record<AuthError, number>> = {
  UNAUTHENTICATED: 401,
  EMAIL_UNVERIFIED: 403,
  ONBOARDING_INCOMPLETE: 403,
  ACCOUNT_DISABLED: 403,
  ACCOUNT_RESTRICTED: 403,
  CAPABILITY_MISSING: 403,
};

const ACCESS_STATUS_BY_ERROR: Readonly<
  Record<Exclude<AccessErrorCode, AuthError>, number>
> = {
  INVALID_INPUT: 400,
  TENDER_REQUIRED: 400,
  TENDER_NOT_ALLOWED: 400,
  TENDER_NOT_FOUND: 404,
  ALREADY_ENTITLED: 409,
  CHECKOUT_NOT_FOUND: 404,
  NOT_CHECKOUT_OWNER: 403,
  // 402 Payment Required is the accurate status for a declined payment, and
  // it keeps a declined charge distinguishable from a validation failure in
  // logs and in the client's error branch.
  PAYMENT_FAILED: 402,
};

export const ACCESS_ERROR_MESSAGE_KEYS: Readonly<
  Record<AccessErrorCode, MessageKey<Messages>>
> = {
  UNAUTHENTICATED: "access.unauthenticated",
  EMAIL_UNVERIFIED: "access.emailUnverified",
  ONBOARDING_INCOMPLETE: "access.onboardingIncomplete",
  ACCOUNT_DISABLED: "access.accountDisabled",
  ACCOUNT_RESTRICTED: "access.accountRestricted",
  CAPABILITY_MISSING: "access.capabilityMissing",
  INVALID_INPUT: "errors.invalidInput",
  TENDER_REQUIRED: "entitlements.errors.tenderRequired",
  TENDER_NOT_ALLOWED: "entitlements.errors.tenderNotAllowed",
  TENDER_NOT_FOUND: "tenders.errors.notFound",
  ALREADY_ENTITLED: "entitlements.errors.alreadyEntitled",
  CHECKOUT_NOT_FOUND: "entitlements.errors.checkoutNotFound",
  NOT_CHECKOUT_OWNER: "entitlements.errors.notCheckoutOwner",
  PAYMENT_FAILED: "entitlements.errors.paymentFailed",
};

function isAuthError(error: AccessErrorCode): error is AuthError {
  return Object.hasOwn(AUTH_STATUS_BY_ERROR, error);
}

export function mapAccessError(error: AccessErrorCode): Response {
  const status = isAuthError(error)
    ? AUTH_STATUS_BY_ERROR[error]
    : ACCESS_STATUS_BY_ERROR[error];
  return Response.json(
    { code: error, messageKey: ACCESS_ERROR_MESSAGE_KEYS[error] },
    { status },
  );
}
```

> `MessageKey<Messages>` only accepts keys that exist in the catalogs, so the five `entitlements.errors.*` keys above will not compile until the group exists. Add the complete `entitlements` group to `src/modules/localization/messages/en.json` and `ka.json` now — copy it verbatim from Task 12's Step 1, which lists every leaf — and add `"entitlements"` to the required-group array in `src/modules/localization/messages.test.ts`. Task 12 then adds only the remaining `bidding` group. Run `pnpm test:unit -- messages` afterwards: `ka` and `en` must stay key-for-key identical with no empty leaf.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run src/modules/access/http/map-access-error.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Write the failing handler tests**

```ts
// src/modules/access/http/access-handlers.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  createCheckoutConfirmHandlers,
  createCheckoutHandlers,
  createEntitlementHandlers,
} from "./access-handlers";

const grantedProvider = async () =>
  ({ ok: true, value: { id: "provider-1" } }) as const;
const deniedProvider = async () =>
  ({ ok: false, error: "CAPABILITY_MISSING" }) as const;

describe("createCheckoutHandlers", () => {
  it("rejects a caller without the PROVIDER capability before reading the body", async () => {
    const start = vi.fn();
    const { POST } = createCheckoutHandlers({
      requireProvider: deniedProvider,
      start,
    });

    const response = await POST(
      new Request("http://localhost/api/access/checkout", {
        method: "POST",
        body: JSON.stringify({ product: "MONTHLY_PROVIDER" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(start).not.toHaveBeenCalled();
  });

  it("passes the resolved actor, never a client-supplied provider id", async () => {
    const start = vi.fn(async () => ({
      ok: true as const,
      value: {
        checkoutId: "checkout-1",
        product: "MONTHLY_PROVIDER" as const,
        amountMinorUnits: 2_000,
        currency: "USD" as const,
        confirmPath: "/api/access/checkout/checkout-1/confirm",
      },
    }));
    const { POST } = createCheckoutHandlers({
      requireProvider: grantedProvider,
      start,
    });

    const response = await POST(
      new Request("http://localhost/api/access/checkout", {
        method: "POST",
        body: JSON.stringify({
          product: "MONTHLY_PROVIDER",
          providerId: "somebody-else",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(start).toHaveBeenCalledWith(
      { product: "MONTHLY_PROVIDER", providerId: "somebody-else" },
      { id: "provider-1" },
    );
  });
});

describe("createCheckoutConfirmHandlers", () => {
  it("confirms the checkout named by the route parameter", async () => {
    const confirm = vi.fn(async () => ({
      ok: true as const,
      value: {
        id: "entitlement-1",
        providerId: "provider-1",
        kind: "SINGLE_TENDER" as const,
        tenderId: "tender-1",
        grantedAt: new Date("2026-06-01T00:00:00.000Z"),
        expiresAt: null,
      },
    }));
    const { POST } = createCheckoutConfirmHandlers({
      requireProvider: grantedProvider,
      confirm,
    });

    const response = await POST(
      new Request("http://localhost/api/access/checkout/checkout-1/confirm", {
        method: "POST",
      }),
      { params: Promise.resolve({ checkoutId: "checkout-1" }) },
    );

    expect(response.status).toBe(200);
    expect(confirm).toHaveBeenCalledWith("checkout-1", { id: "provider-1" });
  });

  it("maps a declined payment to 402", async () => {
    const { POST } = createCheckoutConfirmHandlers({
      requireProvider: grantedProvider,
      confirm: async () => ({ ok: false, error: "PAYMENT_FAILED" }) as const,
    });

    const response = await POST(
      new Request("http://localhost/api/access/checkout/checkout-1/confirm", {
        method: "POST",
      }),
      { params: Promise.resolve({ checkoutId: "checkout-1" }) },
    );

    expect(response.status).toBe(402);
  });
});

describe("createEntitlementHandlers", () => {
  it("returns only the caller's own entitlements", async () => {
    const list = vi.fn(async () => []);
    const { GET } = createEntitlementHandlers({
      requireProvider: grantedProvider,
      list,
    });

    const response = await GET(
      new Request("http://localhost/api/access/entitlements"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entitlements: [] });
    expect(list).toHaveBeenCalledWith({ id: "provider-1" });
  });
});
```

- [ ] **Step 6: Run the tests and confirm they fail**

Run: `pnpm vitest run src/modules/access/http/access-handlers.test.ts`
Expected: FAIL — `./access-handlers` does not exist.

- [ ] **Step 7: Implement the handlers**

```ts
// src/modules/access/http/access-handlers.ts
import type { AuthError } from "../../identity/application/require-capability";
import type { Result } from "../../shared";
import type { ConfirmCheckoutError } from "../application/confirm-access-checkout";
import type {
  AccessActor,
  CheckoutView,
  StartCheckoutError,
} from "../application/start-access-checkout";
import type { Entitlement } from "../domain/entitlement";
import { mapAccessError } from "./map-access-error";

export type RequireProvider = (
  headers: Headers,
) => Promise<Result<AccessActor, AuthError>>;

type ConfirmRouteContext = Readonly<{
  params: Promise<Readonly<{ checkoutId: string }>>;
}>;

// One combinator, exactly like `authorizeCustomer`/`authorizeProvider` in the
// tenders module: a denial is already a mapped `Response`, so callers narrow
// with `instanceof Response`.
async function authorizeProvider(
  requireProvider: RequireProvider,
  headers: Headers,
): Promise<AccessActor | Response> {
  const access = await requireProvider(headers);
  return access.ok ? access.value : mapAccessError(access.error);
}

export function createCheckoutHandlers({
  requireProvider,
  start,
}: Readonly<{
  requireProvider: RequireProvider;
  start: (
    input: unknown,
    actor: AccessActor,
  ) => Promise<Result<CheckoutView, StartCheckoutError>>;
}>) {
  return {
    POST: async (request: Request): Promise<Response> => {
      const actor = await authorizeProvider(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const body = await request.json().catch(() => null);
      const result = await start(body, actor);
      return result.ok
        ? Response.json({ checkout: result.value })
        : mapAccessError(result.error);
    },
  };
}

export function createCheckoutConfirmHandlers({
  requireProvider,
  confirm,
}: Readonly<{
  requireProvider: RequireProvider;
  confirm: (
    checkoutId: string,
    actor: AccessActor,
  ) => Promise<Result<Entitlement, ConfirmCheckoutError>>;
}>) {
  return {
    POST: async (
      request: Request,
      context: ConfirmRouteContext,
    ): Promise<Response> => {
      const actor = await authorizeProvider(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { checkoutId } = await context.params;
      const result = await confirm(checkoutId, actor);
      return result.ok
        ? Response.json({ entitlement: result.value })
        : mapAccessError(result.error);
    },
  };
}

export function createEntitlementHandlers({
  requireProvider,
  list,
}: Readonly<{
  requireProvider: RequireProvider;
  list: (actor: AccessActor) => Promise<readonly Entitlement[]>;
}>) {
  return {
    GET: async (request: Request): Promise<Response> => {
      const actor = await authorizeProvider(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      return Response.json({ entitlements: await list(actor) });
    },
  };
}
```

- [ ] **Step 8: Wire the three routes**

```ts
// app/api/access/checkout/route.ts
import { startAccessCheckout } from "@/src/modules/access/application/start-access-checkout";
import { createCheckoutHandlers } from "@/src/modules/access/http/access-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("@/src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { POST } = createCheckoutHandlers({
  requireProvider,
  start: startAccessCheckout,
});
```

```ts
// app/api/access/checkout/[checkoutId]/confirm/route.ts
import { confirmAccessCheckout } from "@/src/modules/access/application/confirm-access-checkout";
import { createCheckoutConfirmHandlers } from "@/src/modules/access/http/access-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("@/src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { POST } = createCheckoutConfirmHandlers({
  requireProvider,
  confirm: confirmAccessCheckout,
});
```

```ts
// app/api/access/entitlements/route.ts
import { listActiveEntitlements } from "@/src/modules/access/application/list-active-entitlements";
import { createEntitlementHandlers } from "@/src/modules/access/http/access-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("@/src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { GET } = createEntitlementHandlers({
  requireProvider,
  list: listActiveEntitlements,
});
```

- [ ] **Step 9: Run the tests and the build**

Run: `pnpm vitest run src/modules/access/http/ && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/modules/access/http app/api/access
git commit -m "feat: expose mock access checkout over HTTP"
```

---

### Task 4: Entitlement-gated tender disclosure and attachment downloads

**Files:**

- Modify: `src/modules/tenders/domain/tender.ts`
- Modify: `src/modules/tenders/domain/masking.ts`
- Create: `src/modules/tenders/domain/masking.full.test.ts`
- Create: `src/modules/tenders/ports/entitlement-check.ts`
- Create: `src/modules/tenders/application/get-tender-for-provider.ts`
- Create: `src/modules/tenders/application/get-tender-for-provider.test.ts`
- Modify: `src/modules/tenders/application/get-attachment-download.ts`
- Modify: `src/modules/tenders/application/list-tender-attachments.ts`
- Modify: `src/modules/tenders/infrastructure/prisma-tender-repository.ts`
- Modify: `src/modules/tenders/infrastructure/prisma-attachment-repository.ts`
- Modify: `src/modules/tenders/http/discovery-handlers.ts`
- Modify: `src/modules/tenders/http/map-tender-error.ts`
- Modify: `app/api/tenders/discover/[id]/route.ts`
- Create: `app/api/tenders/discover/[id]/attachments/route.ts`

**Interfaces:**

- Consumes: `hasTenderEntitlement` from Task 2; `DisclosureLevel` from Task 1.
- Produces: `PublishedTenderStatus`, `FullTenderDetail`, `toFullDetail`, `EntitlementCheck`, `ProviderTenderView`, `getTenderForProvider`, `NOT_ENTITLED` on `TenderErrorCode`, and the entitled-provider attachment path.

- [ ] **Step 1: Widen the tender status types**

In `src/modules/tenders/domain/tender.ts`, replace the `TenderStatus` alias and add the published-status alias, then point `TenderRecord` at it:

```ts
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
```

and in `TenderRecord`:

```ts
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
```

- [ ] **Step 2: Write the failing full-projection test**

```ts
// src/modules/tenders/domain/masking.full.test.ts
import { describe, expect, it } from "vitest";
import { toFullDetail, toPublicDetail } from "./masking";
import type { TenderRecord } from "./tender";

const record: TenderRecord = {
  id: "tender-1",
  ownerId: "client-1",
  status: "PUBLISHED",
  specialty: "CONSTRUCTION_REPAIR",
  title: "Repaint two rooms",
  shortDescription: "Interior repaint",
  fullDescription: "Sand, prime, and repaint two bedrooms.",
  scopeOfWork: "Sanding, priming, painting",
  budgetMinorUnits: 80_000,
  currency: "GEL",
  desiredStartDate: null,
  deadline: new Date("2026-07-01T09:00:00.000Z"),
  workerNotes: null,
  equipmentNotes: null,
  materialNotes: null,
  location: {
    countryCode: "GE",
    mode: "ADDRESS",
    city: "Tbilisi",
    district: null,
    addressLine: "1 Chavchavadze Ave",
    exact: { latitude: 41.7151, longitude: 44.8271 },
    public: { latitude: 41.72, longitude: 44.83 },
  },
  conditions: "Weekdays only, 9am to 5pm.",
  publishedAt: new Date("2026-06-01T09:00:00.000Z"),
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date("2026-06-01T08:00:00.000Z"),
  updatedAt: new Date("2026-06-01T09:00:00.000Z"),
};

describe("toPublicDetail", () => {
  it("still withholds the exact address, coordinates, conditions, and owner", () => {
    const masked = JSON.stringify(toPublicDetail(record));
    expect(masked).not.toContain("1 Chavchavadze Ave");
    expect(masked).not.toContain("41.7151");
    expect(masked).not.toContain("44.8271");
    expect(masked).not.toContain("Weekdays only");
    expect(masked).not.toContain("client-1");
  });

  it("carries the settled status so a closed tender reads as closed", () => {
    expect(toPublicDetail({ ...record, status: "CLOSED" }).status).toBe(
      "CLOSED",
    );
  });
});

describe("toFullDetail", () => {
  it("adds exactly the fields entitlement unlocks and nothing more", () => {
    const full = toFullDetail(record);
    expect(full.addressLine).toBe("1 Chavchavadze Ave");
    expect(full.exactLatitude).toBe(41.7151);
    expect(full.exactLongitude).toBe(44.8271);
    expect(full.conditions).toBe("Weekdays only, 9am to 5pm.");
    // The owner's identity is not part of the tender projection even at full
    // disclosure: contact details belong to the agreement, after selection.
    expect(JSON.stringify(full)).not.toContain("client-1");
  });

  it("is a strict superset of the masked projection", () => {
    const masked = toPublicDetail(record);
    expect(toFullDetail(record)).toMatchObject(masked);
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `pnpm vitest run src/modules/tenders/domain/masking.full.test.ts`
Expected: FAIL — `toFullDetail` is not exported.

- [ ] **Step 4: Add `status` and the full projection to the masking module**

In `src/modules/tenders/domain/masking.ts`, add `status` to `PublicTenderSummary` and append the full projection:

```ts
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
```

and add `status: tender.status,` to the object `toPublicSummary` returns.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `pnpm vitest run src/modules/tenders/domain/`
Expected: PASS.

- [ ] **Step 6: Write the failing provider-view test**

```ts
// src/modules/tenders/application/get-tender-for-provider.test.ts
import { describe, expect, it } from "vitest";
import { FakeClock } from "../../shared";
import { createGetTenderForProvider } from "./get-tender-for-provider";
import type { TenderRecord } from "../domain/tender";

const record = {
  id: "tender-1",
  ownerId: "client-1",
  status: "PUBLISHED",
  specialty: "CONSTRUCTION_REPAIR",
  title: "Repaint two rooms",
  shortDescription: "Interior repaint",
  fullDescription: "Sand, prime, and repaint two bedrooms.",
  scopeOfWork: "Sanding, priming, painting",
  budgetMinorUnits: 80_000,
  currency: "GEL",
  desiredStartDate: null,
  deadline: new Date("2026-07-01T09:00:00.000Z"),
  workerNotes: null,
  equipmentNotes: null,
  materialNotes: null,
  location: {
    countryCode: "GE",
    mode: "ADDRESS",
    city: "Tbilisi",
    district: null,
    addressLine: "1 Chavchavadze Ave",
    exact: { latitude: 41.7151, longitude: 44.8271 },
    public: { latitude: 41.72, longitude: 44.83 },
  },
  conditions: "Weekdays only.",
  publishedAt: new Date("2026-06-01T09:00:00.000Z"),
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date("2026-06-01T08:00:00.000Z"),
  updatedAt: new Date("2026-06-01T09:00:00.000Z"),
} satisfies TenderRecord;

const repository = {
  getSettleable: async (id: string) =>
    id === "tender-1"
      ? ({ ok: true, value: record } as const)
      : ({ ok: false, error: "TENDER_NOT_FOUND" } as const),
};
const clock = new FakeClock(new Date("2026-06-10T00:00:00.000Z"));

describe("getTenderForProvider", () => {
  it("returns the masked projection when the provider is not entitled", async () => {
    const view = await createGetTenderForProvider({
      repository,
      clock,
      isEntitled: async () => false,
    })("tender-1", { id: "provider-1" });

    expect(view).toMatchObject({ ok: true, value: { disclosure: "MASKED" } });
    if (!view.ok) throw new Error("expected a view");
    expect(JSON.stringify(view.value.tender)).not.toContain(
      "1 Chavchavadze Ave",
    );
  });

  it("returns the full projection when the provider is entitled", async () => {
    const view = await createGetTenderForProvider({
      repository,
      clock,
      isEntitled: async () => true,
    })("tender-1", { id: "provider-1" });

    expect(view).toMatchObject({
      ok: true,
      value: {
        disclosure: "FULL",
        tender: { addressLine: "1 Chavchavadze Ave" },
      },
    });
  });

  it("asks the entitlement port about the requesting provider and tender", async () => {
    const seen: Array<readonly [string, string]> = [];
    await createGetTenderForProvider({
      repository,
      clock,
      isEntitled: async (providerId, tenderId) => {
        seen.push([providerId, tenderId]);
        return false;
      },
    })("tender-1", { id: "provider-7" });

    expect(seen).toEqual([["provider-7", "tender-1"]]);
  });

  it("reports a missing tender rather than an empty masked view", async () => {
    const view = await createGetTenderForProvider({
      repository,
      clock,
      isEntitled: async () => true,
    })("tender-missing", { id: "provider-1" });

    expect(view).toEqual({ ok: false, error: "TENDER_NOT_FOUND" });
  });
});
```

- [ ] **Step 7: Run the test and confirm it fails**

Run: `pnpm vitest run src/modules/tenders/application/get-tender-for-provider.test.ts`
Expected: FAIL — `./get-tender-for-provider` does not exist.

- [ ] **Step 8: Implement the port and the provider view**

```ts
// src/modules/tenders/ports/entitlement-check.ts
// Bound at the composition root to `access`'s published
// `hasTenderEntitlement` query. Declaring it as a port keeps `tenders` free
// of a compile-time dependency on the `access` module.
export type EntitlementCheck = (
  providerId: string,
  tenderId: string,
  now: Date,
) => Promise<boolean>;
```

```ts
// src/modules/tenders/application/get-tender-for-provider.ts
import type { Clock, Result } from "@/src/modules/shared";
import {
  toFullDetail,
  toPublicDetail,
  type FullTenderDetail,
  type PublicTenderDetail,
} from "../domain/masking";
import type { TenderRecord } from "../domain/tender";
import type { EntitlementCheck } from "../ports/entitlement-check";

export type ProviderTenderView =
  | Readonly<{ disclosure: "MASKED"; tender: PublicTenderDetail }>
  | Readonly<{ disclosure: "FULL"; tender: FullTenderDetail }>;

export interface GetSettleableTenderRepository {
  // Unlike `getPublished`, this accepts CLOSED and EXPIRED tenders and applies
  // no deadline predicate: the winner/loser views exist precisely for tenders
  // whose deadline has already passed.
  getSettleable(id: string): Promise<Result<TenderRecord, "TENDER_NOT_FOUND">>;
}

export function createGetTenderForProvider(dependencies: {
  repository: GetSettleableTenderRepository;
  clock: Clock;
  isEntitled: EntitlementCheck;
}) {
  return async function getTenderForProvider(
    id: string,
    actor: Readonly<{ id: string }>,
  ): Promise<Result<ProviderTenderView, "TENDER_NOT_FOUND">> {
    const found = await dependencies.repository.getSettleable(id);
    if (!found.ok) return found;

    const entitled = await dependencies.isEntitled(
      actor.id,
      id,
      dependencies.clock.now(),
    );
    return {
      ok: true,
      value: entitled
        ? { disclosure: "FULL", tender: toFullDetail(found.value) }
        : { disclosure: "MASKED", tender: toPublicDetail(found.value) },
    };
  };
}

export async function getTenderForProvider(
  id: string,
  actor: Readonly<{ id: string }>,
): Promise<Result<ProviderTenderView, "TENDER_NOT_FOUND">> {
  const [{ prismaTenderRepository }, { hasTenderEntitlement }] =
    await Promise.all([
      import("../infrastructure/prisma-tender-repository"),
      import("../../access/application/has-tender-entitlement"),
    ]);
  return createGetTenderForProvider({
    repository: prismaTenderRepository,
    clock: { now: () => new Date() },
    isEntitled: hasTenderEntitlement,
  })(id, actor);
}
```

- [ ] **Step 9: Add the repository read and relax `toTenderRecord`**

In `src/modules/tenders/infrastructure/prisma-tender-repository.ts`:

- Add `GetSettleableTenderRepository` to the `TenderRepository` interface's extends list and import its type.
- In `toTenderRecord`, replace the `draft.status !== "PUBLISHED"` guard with a settled-status guard:

```ts
  if (
    draft.status === "DRAFT" ||
    draft.status === "CANCELLED" ||
    draft.shortDescription === null ||
    // ...the remaining null checks are unchanged...
  ) {
    return null;
  }
```

- Add the method:

```ts
  async getSettleable(
    id: string,
  ): Promise<Result<TenderRecord, "TENDER_NOT_FOUND">> {
    // No deadline predicate and no PUBLISHED-only filter: this is the read
    // that lets a bidder open the tender they competed on after selection.
    const row = await database.tender.findFirst({
      where: { id, status: { in: ["PUBLISHED", "CLOSED", "EXPIRED"] } },
    });
    if (row === null) return { ok: false, error: "TENDER_NOT_FOUND" };
    const record = toTenderRecord(row);
    return record === null
      ? { ok: false, error: "TENDER_NOT_FOUND" }
      : { ok: true, value: record };
  }
```

- [ ] **Step 10: Open the attachment paths to an entitled provider**

In `src/modules/tenders/application/get-attachment-download.ts`, replace the owner-only repository interface (and the stale "no entitlement until Phase 3" comment) with a two-path lookup, and add a `NOT_ENTITLED` error:

```ts
export interface GetAttachmentDownloadRepository {
  findOwnedAttachment(
    tenderId: string,
    attachmentId: string,
    actor: TenderActor,
  ): Promise<
    Result<Readonly<{ objectKey: string }>, "NOT_FOUND" | "NOT_OWNER">
  >;
  // Ownership is not consulted here: this is the provider path, and the
  // caller has already proven entitlement through `EntitlementCheck`.
  findPublishedAttachment(
    tenderId: string,
    attachmentId: string,
  ): Promise<Result<Readonly<{ objectKey: string }>, "NOT_FOUND">>;
}

export function createGetEntitledAttachmentDownload(dependencies: {
  repository: GetAttachmentDownloadRepository;
  storage: ObjectStorage;
  clock: Clock;
  isEntitled: EntitlementCheck;
}) {
  return async function getEntitledAttachmentDownload(
    tenderId: string,
    attachmentId: string,
    actor: TenderActor,
    ttlSeconds: number = DOWNLOAD_URL_TTL_SECONDS,
  ): Promise<Result<string, "NOT_FOUND" | "NOT_ENTITLED">> {
    // Entitlement is checked BEFORE the attachment is looked up, so a
    // non-entitled provider cannot distinguish "no such attachment" from
    // "this tender has that attachment" by the error it receives.
    const entitled = await dependencies.isEntitled(
      actor.id,
      tenderId,
      dependencies.clock.now(),
    );
    if (!entitled) return { ok: false, error: "NOT_ENTITLED" };

    const attachment = await dependencies.repository.findPublishedAttachment(
      tenderId,
      attachmentId,
    );
    if (!attachment.ok) return attachment;
    const url = await dependencies.storage.getSignedDownloadUrl(
      attachment.value.objectKey,
      ttlSeconds,
    );
    return { ok: true, value: url };
  };
}
```

Keep the existing `createGetAttachmentDownload`/`getAttachmentDownload` owner path exactly as it is, and export a composed `getEntitledAttachmentDownload` alongside `getAttachmentDownload`, wiring `isEntitled` to `hasTenderEntitlement` the same way Step 8 does.

Add the matching `findPublishedAttachment` to `src/modules/tenders/infrastructure/prisma-attachment-repository.ts`:

```ts
  async findPublishedAttachment(
    tenderId: string,
    attachmentId: string,
  ): Promise<Result<Readonly<{ objectKey: string }>, "NOT_FOUND">> {
    const attachment = await database.tenderAttachment.findFirst({
      where: {
        id: attachmentId,
        tenderId,
        tender: { status: { in: ["PUBLISHED", "CLOSED", "EXPIRED"] } },
      },
      select: { objectKey: true },
    });
    return attachment === null
      ? { ok: false, error: "NOT_FOUND" }
      : { ok: true, value: attachment };
  }
```

An entitled provider must also be able to enumerate the files. Append to `src/modules/tenders/application/list-tender-attachments.ts`:

```ts
export interface ListPublishedAttachmentsRepository {
  listForPublishedTender(
    tenderId: string,
  ): Promise<readonly AttachmentRecord[]>;
}

export function createListEntitledAttachments(dependencies: {
  repository: ListPublishedAttachmentsRepository;
  clock: Clock;
  isEntitled: EntitlementCheck;
}) {
  return async function listEntitledAttachments(
    tenderId: string,
    actor: TenderActor,
  ): Promise<Result<readonly AttachmentRecord[], "NOT_ENTITLED">> {
    // Entitlement first, for the same reason as the download path: a
    // non-entitled provider must not learn how many files a tender carries.
    const entitled = await dependencies.isEntitled(
      actor.id,
      tenderId,
      dependencies.clock.now(),
    );
    if (!entitled) return { ok: false, error: "NOT_ENTITLED" };
    return {
      ok: true,
      value: await dependencies.repository.listForPublishedTender(tenderId),
    };
  };
}

export async function listEntitledAttachments(
  tenderId: string,
  actor: TenderActor,
): Promise<Result<readonly AttachmentRecord[], "NOT_ENTITLED">> {
  const [{ prismaAttachmentRepository }, { hasTenderEntitlement }] =
    await Promise.all([
      import("../infrastructure/prisma-attachment-repository"),
      import("../../access/application/has-tender-entitlement"),
    ]);
  return createListEntitledAttachments({
    repository: prismaAttachmentRepository,
    clock: { now: () => new Date() },
    isEntitled: hasTenderEntitlement,
  })(tenderId, actor);
}
```

and the matching repository read:

```ts
  async listForPublishedTender(
    tenderId: string,
  ): Promise<readonly AttachmentRecord[]> {
    return database.tenderAttachment.findMany({
      where: {
        tenderId,
        tender: { status: { in: ["PUBLISHED", "CLOSED", "EXPIRED"] } },
      },
      orderBy: { createdAt: "asc" },
    });
  }
```

- [ ] **Step 11: Add `NOT_ENTITLED` to the tender error map**

In `src/modules/tenders/http/map-tender-error.ts`, add `"NOT_ENTITLED"` to `TenderErrorCode`, `NOT_ENTITLED: 402` to `TENDER_STATUS_BY_ERROR` (the provider must pay to proceed — the same status the access module returns for a declined charge, and distinct from a 403 they can never resolve), and `NOT_ENTITLED: "entitlements.errors.notEntitled"` to `TENDER_ERROR_MESSAGE_KEYS`.

- [ ] **Step 12: Rewire the discovery detail route and add the attachments route**

`authorizeProvider` currently discards the resolved actor, which the provider view now needs. Replace it with the actor-returning form:

```ts
// src/modules/tenders/http/authorize.ts — replace `authorizeProvider`
export async function authorizeProvider(
  requireProvider: RequireProvider,
  headers: Headers,
): Promise<TenderActor | Response> {
  const access = await requireProvider(headers);
  return access.ok ? access.value : mapTenderError(access.error);
}
```

and update `createDiscoveryHandlers`'s single call site from `if (denied) return denied;` to `if (actor instanceof Response) return actor;` (the search list still ignores the actor's identity — it only needed the capability check).

Then replace `createDiscoveredTenderHandlers` and add the attachment lister, in the same file:

```ts
// src/modules/tenders/http/discovery-handlers.ts
type DiscoveredTenderHandlersDependencies = Readonly<{
  requireProvider: RequireProvider;
  getForProvider: (
    id: string,
    actor: TenderActor,
  ) => Promise<Result<ProviderTenderView, "TENDER_NOT_FOUND">>;
}>;

export function createDiscoveredTenderHandlers({
  requireProvider,
  getForProvider,
}: DiscoveredTenderHandlersDependencies) {
  return {
    GET: async (request: Request, context: RouteContext): Promise<Response> => {
      const actor = await authorizeProvider(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const result = await getForProvider(id, actor);
      // `disclosure` travels with the payload so the client renders the level
      // the server actually granted rather than inferring it from which
      // fields happen to be present.
      return result.ok
        ? Response.json({
            disclosure: result.value.disclosure,
            tender: result.value.tender,
          })
        : mapTenderError(result.error);
    },
  };
}

type EntitledAttachmentHandlersDependencies = Readonly<{
  requireProvider: RequireProvider;
  list: (
    tenderId: string,
    actor: TenderActor,
  ) => Promise<Result<readonly AttachmentRecord[], "NOT_ENTITLED">>;
}>;

export function createEntitledAttachmentHandlers({
  requireProvider,
  list,
}: EntitledAttachmentHandlersDependencies) {
  return {
    GET: async (request: Request, context: RouteContext): Promise<Response> => {
      const actor = await authorizeProvider(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const result = await list(id, actor);
      // The same explicit allowlist `attachment-handlers.ts` uses:
      // `objectKey` is an internal storage address and never leaves the
      // server.
      return result.ok
        ? Response.json({
            attachments: result.value.map((record) => ({
              id: record.id,
              tenderId: record.tenderId,
              originalFileName: record.originalFileName,
              mimeType: record.mimeType,
              sizeBytes: record.sizeBytes,
              createdAt: record.createdAt,
            })),
          })
        : mapTenderError(result.error);
    },
  };
}
```

```ts
// app/api/tenders/discover/[id]/route.ts
import { getTenderForProvider } from "@/src/modules/tenders/application/get-tender-for-provider";
import { createDiscoveredTenderHandlers } from "@/src/modules/tenders/http/discovery-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("@/src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { GET } = createDiscoveredTenderHandlers({
  requireProvider,
  getForProvider: getTenderForProvider,
});
```

```ts
// app/api/tenders/discover/[id]/attachments/route.ts
import { listEntitledAttachments } from "@/src/modules/tenders/application/list-tender-attachments";
import { createEntitledAttachmentHandlers } from "@/src/modules/tenders/http/discovery-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("@/src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { GET } = createEntitledAttachmentHandlers({
  requireProvider,
  list: listEntitledAttachments,
});
```

- [ ] **Step 13: Run every affected test layer**

Run: `pnpm vitest run src/modules/tenders && pnpm typecheck && pnpm lint && pnpm verify:boundaries`
Expected: PASS. `src/modules/tenders/http/tender-handlers.test.ts` and the Phase 2 discovery UI tests must still pass unchanged; if a Phase 2 test asserted the old `authorizeProvider` return shape, update the assertion rather than the behaviour.

- [ ] **Step 14: Commit**

```bash
git add src/modules/tenders app/api/tenders
git commit -m "feat: gate full tender disclosure behind an entitlement"
```

---

### Task 5: Bidding domain — eligibility, deterministic ranking, and the provider-safe summary

**Files:**

- Create: `src/modules/bidding/domain/bid.ts`
- Create: `src/modules/bidding/domain/constraints.ts`
- Create: `src/modules/bidding/domain/bid-eligibility.ts`
- Create: `src/modules/bidding/domain/bid-eligibility.test.ts`
- Create: `src/modules/bidding/domain/ranking.ts`
- Create: `src/modules/bidding/domain/ranking.test.ts`
- Create: `src/modules/bidding/domain/ranking.property.test.ts`
- Create: `src/modules/bidding/domain/bid-summary.ts`
- Create: `src/modules/bidding/domain/bid-summary.test.ts`

**Interfaces:**

- Consumes: nothing outside `src/modules/shared` — `bidding/domain` must not import `tenders/domain` (the boundary script rejects it), so the tender's terms arrive as a local `BidTenderTerms` value.
- Produces: `BidStatus`, `BidCurrency`, `Bid`, `RankableBid`, `BidTenderTerms`, `MIN_BID_CONDITIONS_LENGTH`, `MAX_BID_AMOUNT_MINOR_UNITS`, `MAX_BID_DURATION_DAYS`, `BidIneligibilityReason`, `bidIneligibility`, `eligibleBids`, `rankBids`, `selectWinningBid`, `BidSummary`, `summarizeBids`.

- [ ] **Step 1: Write the bid types and constraints**

```ts
// src/modules/bidding/domain/bid.ts
export type BidStatus = "SUBMITTED" | "WINNER" | "LOST" | "WITHDRAWN";
export type BidCurrency = "GEL" | "USD";

export type Bid = Readonly<{
  id: string;
  tenderId: string;
  providerId: string;
  amountMinorUnits: number;
  currency: BidCurrency;
  status: BidStatus;
  proposedStartDate: Date | null;
  durationDays: number | null;
  includedCosts: string | null;
  exclusions: string | null;
  conditions: string;
  // Reset on every revision, so a provider cannot revise downward at the last
  // moment and still keep an earlier bid's tie-break advantage.
  qualifyingSubmittedAt: Date;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

// The minimum a bid must carry to be ranked. Selection reads only these
// fields, so ranking cannot accidentally depend on terms.
export type RankableBid = Readonly<{
  id: string;
  amountMinorUnits: number;
  currency: BidCurrency;
  status: BidStatus;
  qualifyingSubmittedAt: Date;
}>;

// The tender facts a bid is judged against. Declared here rather than
// imported from `tenders/domain`, which the module-boundary gate forbids.
export type BidTenderTerms = Readonly<{
  currency: BidCurrency;
  deadline: Date;
}>;
```

```ts
// src/modules/bidding/domain/constraints.ts
// `Bid.amountMinorUnits` is a Postgres INTEGER (INT4) column, so a larger
// amount would overflow on write and surface as a driver error rather than a
// validation failure — the same ceiling and the same reasoning as
// `MAX_BUDGET_MINOR_UNITS` in the tenders module.
export const MAX_BID_AMOUNT_MINOR_UNITS = 2_147_483_647;

// The program design requires a "substantive conditions note" without fixing
// a length. This reuses the platform's only existing substantive-text bar,
// the 30-character review comment rule, rather than inventing a second one.
export const MIN_BID_CONDITIONS_LENGTH = 30;
export const MAX_BID_CONDITIONS_LENGTH = 4_000;
export const MAX_BID_TERM_LENGTH = 2_000;
export const MAX_BID_DURATION_DAYS = 3_650;
```

- [ ] **Step 2: Write the failing eligibility tests**

```ts
// src/modules/bidding/domain/bid-eligibility.test.ts
import { describe, expect, it } from "vitest";
import { bidIneligibility, eligibleBids } from "./bid-eligibility";
import type { BidTenderTerms, RankableBid } from "./bid";

const terms: BidTenderTerms = {
  currency: "GEL",
  deadline: new Date("2026-07-01T09:00:00.000Z"),
};

function bid(overrides: Partial<RankableBid>): RankableBid {
  return {
    id: "bid-1",
    amountMinorUnits: 50_000,
    currency: "GEL",
    status: "SUBMITTED",
    qualifyingSubmittedAt: new Date("2026-06-10T00:00:00.000Z"),
    ...overrides,
  };
}

describe("bidIneligibility", () => {
  it("accepts a submitted bid in the tender's currency before the deadline", () => {
    expect(bidIneligibility(bid({}), terms)).toBeNull();
  });

  it("rejects a withdrawn bid", () => {
    expect(bidIneligibility(bid({ status: "WITHDRAWN" }), terms)).toBe(
      "WITHDRAWN",
    );
  });

  it("rejects a bid in a different currency", () => {
    expect(bidIneligibility(bid({ currency: "USD" }), terms)).toBe(
      "CURRENCY_MISMATCH",
    );
  });

  it("rejects a non-positive amount", () => {
    expect(bidIneligibility(bid({ amountMinorUnits: 0 }), terms)).toBe(
      "NON_POSITIVE_AMOUNT",
    );
    expect(bidIneligibility(bid({ amountMinorUnits: -1 }), terms)).toBe(
      "NON_POSITIVE_AMOUNT",
    );
  });

  it("rejects a bid that qualified at or after the deadline instant", () => {
    expect(
      bidIneligibility(bid({ qualifyingSubmittedAt: terms.deadline }), terms),
    ).toBe("SUBMITTED_AFTER_DEADLINE");
    expect(
      bidIneligibility(
        bid({ qualifyingSubmittedAt: new Date("2026-07-01T09:00:01.000Z") }),
        terms,
      ),
    ).toBe("SUBMITTED_AFTER_DEADLINE");
  });

  it("treats an already-ranked bid as still eligible so re-running is stable", () => {
    expect(bidIneligibility(bid({ status: "WINNER" }), terms)).toBeNull();
    expect(bidIneligibility(bid({ status: "LOST" }), terms)).toBeNull();
  });
});

describe("eligibleBids", () => {
  it("keeps only the eligible bids and preserves nothing else", () => {
    const kept = bid({ id: "keep" });
    const dropped = bid({ id: "drop", status: "WITHDRAWN" });
    expect(eligibleBids([kept, dropped], terms)).toEqual([kept]);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm vitest run src/modules/bidding/domain/bid-eligibility.test.ts`
Expected: FAIL — `./bid-eligibility` does not exist.

- [ ] **Step 4: Implement eligibility**

```ts
// src/modules/bidding/domain/bid-eligibility.ts
import type { BidTenderTerms, RankableBid } from "./bid";

export type BidIneligibilityReason =
  | "WITHDRAWN"
  | "CURRENCY_MISMATCH"
  | "NON_POSITIVE_AMOUNT"
  | "SUBMITTED_AFTER_DEADLINE";

// Returns the FIRST reason a bid cannot be ranked, or null when it can. A
// reason (rather than a boolean) is what lets the selector explain an
// expired-without-bids outcome in its audit entry.
export function bidIneligibility(
  bid: RankableBid,
  terms: BidTenderTerms,
): BidIneligibilityReason | null {
  if (bid.status === "WITHDRAWN") return "WITHDRAWN";
  // All bids settle in the tender's currency; a mismatch would compare two
  // different units of account on the same integer.
  if (bid.currency !== terms.currency) return "CURRENCY_MISMATCH";
  if (
    !Number.isSafeInteger(bid.amountMinorUnits) ||
    bid.amountMinorUnits <= 0
  ) {
    return "NON_POSITIVE_AMOUNT";
  }
  // `>=`: the deadline instant is the first instant bidding is closed, so a
  // bid stamped exactly at the deadline did not make it.
  if (bid.qualifyingSubmittedAt.getTime() >= terms.deadline.getTime()) {
    return "SUBMITTED_AFTER_DEADLINE";
  }
  return null;
}

export function eligibleBids(
  bids: readonly RankableBid[],
  terms: BidTenderTerms,
): readonly RankableBid[] {
  return bids.filter((bid) => bidIneligibility(bid, terms) === null);
}
```

- [ ] **Step 5: Write the failing ranking tests**

```ts
// src/modules/bidding/domain/ranking.test.ts
import { describe, expect, it } from "vitest";
import type { BidTenderTerms, RankableBid } from "./bid";
import { rankBids, selectWinningBid } from "./ranking";

const terms: BidTenderTerms = {
  currency: "GEL",
  deadline: new Date("2026-07-01T09:00:00.000Z"),
};

function bid(
  id: string,
  amountMinorUnits: number,
  isoSubmittedAt: string,
): RankableBid {
  return {
    id,
    amountMinorUnits,
    currency: "GEL",
    status: "SUBMITTED",
    qualifyingSubmittedAt: new Date(isoSubmittedAt),
  };
}

describe("rankBids", () => {
  it("ranks by amount ascending", () => {
    const ranked = rankBids(
      [
        bid("expensive", 90_000, "2026-06-01T00:00:00.000Z"),
        bid("cheap", 10_000, "2026-06-03T00:00:00.000Z"),
        bid("middle", 50_000, "2026-06-02T00:00:00.000Z"),
      ],
      terms,
    );
    expect(ranked.map((entry) => entry.id)).toEqual([
      "cheap",
      "middle",
      "expensive",
    ]);
  });

  it("breaks an equal amount by the earliest qualifying submission", () => {
    const ranked = rankBids(
      [
        bid("late", 10_000, "2026-06-03T00:00:00.000Z"),
        bid("early", 10_000, "2026-06-01T00:00:00.000Z"),
      ],
      terms,
    );
    expect(ranked.map((entry) => entry.id)).toEqual(["early", "late"]);
  });

  it("breaks an identical amount and timestamp by stable id ascending", () => {
    const ranked = rankBids(
      [
        bid("bbb", 10_000, "2026-06-01T00:00:00.000Z"),
        bid("aaa", 10_000, "2026-06-01T00:00:00.000Z"),
      ],
      terms,
    );
    expect(ranked.map((entry) => entry.id)).toEqual(["aaa", "bbb"]);
  });

  it("drops ineligible bids before ranking", () => {
    const ranked = rankBids(
      [
        {
          ...bid("withdrawn", 1_000, "2026-06-01T00:00:00.000Z"),
          status: "WITHDRAWN",
        },
        bid("valid", 10_000, "2026-06-01T00:00:00.000Z"),
      ],
      terms,
    );
    expect(ranked.map((entry) => entry.id)).toEqual(["valid"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      bid("b", 20_000, "2026-06-01T00:00:00.000Z"),
      bid("a", 10_000, "2026-06-01T00:00:00.000Z"),
    ];
    const snapshot = input.map((entry) => entry.id);
    rankBids(input, terms);
    expect(input.map((entry) => entry.id)).toEqual(snapshot);
  });
});

describe("selectWinningBid", () => {
  it("returns the first ranked bid", () => {
    const winner = selectWinningBid(
      [
        bid("expensive", 90_000, "2026-06-01T00:00:00.000Z"),
        bid("cheap", 10_000, "2026-06-02T00:00:00.000Z"),
      ],
      terms,
    );
    expect(winner?.id).toBe("cheap");
  });

  it("returns null when no bid is eligible", () => {
    expect(selectWinningBid([], terms)).toBeNull();
    expect(
      selectWinningBid(
        [{ ...bid("x", 10_000, "2026-06-01T00:00:00.000Z"), currency: "USD" }],
        terms,
      ),
    ).toBeNull();
  });
});
```

- [ ] **Step 6: Run the tests and confirm they fail**

Run: `pnpm vitest run src/modules/bidding/domain/ranking.test.ts`
Expected: FAIL — `./ranking` does not exist.

- [ ] **Step 7: Implement ranking**

```ts
// src/modules/bidding/domain/ranking.ts
import type { BidTenderTerms, RankableBid } from "./bid";
import { eligibleBids } from "./bid-eligibility";

// Amount ascending, then earliest qualifying submission, then stable id
// ascending. The third key exists so the order is total: without it two bids
// with identical amount and timestamp would rank by whatever order the
// database happened to return, and re-running selection could disagree with
// itself.
function compareBids(left: RankableBid, right: RankableBid): number {
  if (left.amountMinorUnits !== right.amountMinorUnits) {
    return left.amountMinorUnits - right.amountMinorUnits;
  }
  const leftTime = left.qualifyingSubmittedAt.getTime();
  const rightTime = right.qualifyingSubmittedAt.getTime();
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function rankBids(
  bids: readonly RankableBid[],
  terms: BidTenderTerms,
): readonly RankableBid[] {
  // Copy before sorting: `Array.prototype.sort` mutates, and the caller's
  // array is frequently the repository's own result.
  return [...eligibleBids(bids, terms)].sort(compareBids);
}

export function selectWinningBid(
  bids: readonly RankableBid[],
  terms: BidTenderTerms,
): RankableBid | null {
  return rankBids(bids, terms)[0] ?? null;
}
```

- [ ] **Step 8: Write the failing ranking property test**

This is the roadmap's "property tests rank arbitrary valid bid sets deterministically". It uses a seeded linear-congruential generator rather than a new dependency, so the generated sets are arbitrary but the run is reproducible.

```ts
// src/modules/bidding/domain/ranking.property.test.ts
import { describe, expect, it } from "vitest";
import type { BidTenderTerms, RankableBid } from "./bid";
import { rankBids, selectWinningBid } from "./ranking";

const terms: BidTenderTerms = {
  currency: "GEL",
  deadline: new Date("2026-07-01T09:00:00.000Z"),
};
const DEADLINE_MS = terms.deadline.getTime();

// A seeded LCG (Numerical Recipes constants). Deterministic, dependency-free,
// and good enough to shuffle and to draw amounts/timestamps from a small
// range — a small range is what makes ties, the interesting case, frequent.
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 0x1_00_00_00_00;
  };
}

function generateBids(random: () => number, count: number): RankableBid[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `bid-${String(index).padStart(3, "0")}`,
    // Deliberately few distinct amounts and timestamps, so equal-amount and
    // equal-timestamp ties occur in most generated sets.
    amountMinorUnits: 1_000 * (1 + Math.floor(random() * 5)),
    currency: "GEL" as const,
    status: "SUBMITTED" as const,
    qualifyingSubmittedAt: new Date(
      DEADLINE_MS - 86_400_000 * (1 + Math.floor(random() * 4)),
    ),
  }));
}

function shuffle<T>(random: () => number, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

describe("rankBids ranks arbitrary valid bid sets deterministically", () => {
  it("produces the same order regardless of input order", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = createRandom(seed);
      const bids = generateBids(random, 1 + Math.floor(random() * 12));
      const expected = rankBids(bids, terms).map((bid) => bid.id);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const reordered = rankBids(shuffle(random, bids), terms);
        expect(reordered.map((bid) => bid.id)).toEqual(expected);
      }
    }
  });

  it("never ranks a bid ahead of a strictly cheaper one", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = createRandom(seed);
      const ranked = rankBids(
        generateBids(random, 2 + Math.floor(random() * 12)),
        terms,
      );

      for (let index = 1; index < ranked.length; index += 1) {
        const previous = ranked[index - 1]!;
        const current = ranked[index]!;
        expect(previous.amountMinorUnits).toBeLessThanOrEqual(
          current.amountMinorUnits,
        );
        if (previous.amountMinorUnits === current.amountMinorUnits) {
          expect(previous.qualifyingSubmittedAt.getTime()).toBeLessThanOrEqual(
            current.qualifyingSubmittedAt.getTime(),
          );
          if (
            previous.qualifyingSubmittedAt.getTime() ===
            current.qualifyingSubmittedAt.getTime()
          ) {
            expect(previous.id < current.id).toBe(true);
          }
        }
      }
    }
  });

  it("always selects a bid that no other eligible bid beats", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = createRandom(seed);
      const bids = generateBids(random, 1 + Math.floor(random() * 12));
      const winner = selectWinningBid(bids, terms);
      expect(winner).not.toBeNull();

      for (const other of bids) {
        if (other.id === winner!.id) continue;
        const cheaper = other.amountMinorUnits < winner!.amountMinorUnits;
        const sameAmountButEarlier =
          other.amountMinorUnits === winner!.amountMinorUnits &&
          other.qualifyingSubmittedAt.getTime() <
            winner!.qualifyingSubmittedAt.getTime();
        expect(cheaper || sameAmountButEarlier).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 9: Run the property test and confirm it passes**

Run: `pnpm vitest run src/modules/bidding/domain/ranking.property.test.ts`
Expected: PASS — three properties over 200 seeds each.

- [ ] **Step 10: Write the failing bid-summary tests**

```ts
// src/modules/bidding/domain/bid-summary.test.ts
import { describe, expect, it } from "vitest";
import type { BidTenderTerms, RankableBid } from "./bid";
import { summarizeBids } from "./bid-summary";

const terms: BidTenderTerms = {
  currency: "GEL",
  deadline: new Date("2026-07-01T09:00:00.000Z"),
};

function bid(id: string, amountMinorUnits: number): RankableBid {
  return {
    id,
    amountMinorUnits,
    currency: "GEL",
    status: "SUBMITTED",
    qualifyingSubmittedAt: new Date("2026-06-01T00:00:00.000Z"),
  };
}

describe("summarizeBids", () => {
  it("reports the eligible count and the current lowest amount", () => {
    expect(summarizeBids([bid("a", 30_000), bid("b", 10_000)], terms)).toEqual({
      bidCount: 2,
      lowestAmountMinorUnits: 10_000,
      currency: "GEL",
    });
  });

  it("reports an empty tender without inventing a lowest amount", () => {
    expect(summarizeBids([], terms)).toEqual({
      bidCount: 0,
      lowestAmountMinorUnits: null,
      currency: "GEL",
    });
  });

  it("excludes withdrawn bids from both the count and the lowest", () => {
    const withdrawn = { ...bid("gone", 1_000), status: "WITHDRAWN" as const };
    expect(summarizeBids([withdrawn, bid("live", 10_000)], terms)).toEqual({
      bidCount: 1,
      lowestAmountMinorUnits: 10_000,
      currency: "GEL",
    });
  });

  it("carries no bidder identity, terms, or submission time", () => {
    const summary = summarizeBids([bid("secret-provider-bid", 10_000)], terms);
    expect(Object.keys(summary).sort()).toEqual([
      "bidCount",
      "currency",
      "lowestAmountMinorUnits",
    ]);
    expect(JSON.stringify(summary)).not.toContain("secret-provider-bid");
  });
});
```

- [ ] **Step 11: Run the tests and confirm they fail, then implement**

Run: `pnpm vitest run src/modules/bidding/domain/bid-summary.test.ts`
Expected: FAIL — `./bid-summary` does not exist.

```ts
// src/modules/bidding/domain/bid-summary.ts
import type { BidCurrency, BidTenderTerms, RankableBid } from "./bid";
import { rankBids } from "./ranking";

// Exactly what a competing provider may see (program design §4.3): how many
// eligible bids exist and what the current lowest amount is. Bidder identity,
// terms, and submission times are deliberately absent from the TYPE, so a
// careless spread at a call site cannot leak them.
export type BidSummary = Readonly<{
  bidCount: number;
  lowestAmountMinorUnits: number | null;
  currency: BidCurrency;
}>;

export function summarizeBids(
  bids: readonly RankableBid[],
  terms: BidTenderTerms,
): BidSummary {
  const ranked = rankBids(bids, terms);
  return {
    bidCount: ranked.length,
    lowestAmountMinorUnits: ranked[0]?.amountMinorUnits ?? null,
    currency: terms.currency,
  };
}
```

- [ ] **Step 12: Run the whole domain layer and the boundary gate**

Run: `pnpm vitest run src/modules/bidding/domain/ && pnpm verify:boundaries && pnpm typecheck`
Expected: PASS, and "Domain module boundaries verified." — no file under `src/modules/bidding/domain` may import `tenders`, Prisma, Node built-ins, or any third-party package other than `vitest` in its own tests.

- [ ] **Step 13: Commit**

```bash
git add src/modules/bidding/domain
git commit -m "feat: rank bids deterministically by amount, time, then id"
```

---

### Task 6: Tender cross-module seams — bidding context and the selection gateway

**Files:**

- Create: `src/modules/tenders/application/get-tender-bidding-context.ts`
- Create: `src/modules/tenders/infrastructure/prisma-tender-selection-gateway.ts`
- Create: `src/modules/tenders/infrastructure/prisma-tender-selection-gateway.integration.test.ts`
- Modify: `src/modules/tenders/infrastructure/prisma-tender-repository.ts`

**Interfaces:**

- Consumes: `Result` from `@/src/modules/shared`; `PublishedTenderStatus`, `TenderCurrency` from Task 4.
- Produces: `TenderBiddingContext`, `getTenderBiddingContext` (the published read every `bidding` use case binds to), `TenderClosingOutcome`, `TenderSelectionGateway`, `prismaTenderSelectionGateway` (the transaction-participating command Task 10's selector binds to).

- [ ] **Step 1: Implement the published bidding-context read**

```ts
// src/modules/tenders/application/get-tender-bidding-context.ts
import type { Result } from "@/src/modules/shared";
import type { PublishedTenderStatus, TenderCurrency } from "../domain/tender";

// The narrow projection the `bidding` module is allowed to see. It is
// deliberately not `TenderRecord`: bidding needs the settlement currency, the
// deadline, the owner (to refuse a self-bid), and the status — nothing about
// the tender's location, attachments, or conditions.
export type TenderBiddingContext = Readonly<{
  id: string;
  ownerId: string;
  title: string;
  status: PublishedTenderStatus;
  currency: TenderCurrency;
  budgetMinorUnits: number;
  deadline: Date;
}>;

export interface TenderBiddingContextRepository {
  getBiddingContext(
    id: string,
  ): Promise<Result<TenderBiddingContext, "TENDER_NOT_FOUND">>;
}

export function createGetTenderBiddingContext(dependencies: {
  repository: TenderBiddingContextRepository;
}) {
  return async function getTenderBiddingContext(
    id: string,
  ): Promise<Result<TenderBiddingContext, "TENDER_NOT_FOUND">> {
    return dependencies.repository.getBiddingContext(id);
  };
}

// The published cross-module query. `bidding` binds its own
// `TenderContextLookup` port to this function and never touches the Tender
// table itself.
export async function getTenderBiddingContext(
  id: string,
): Promise<Result<TenderBiddingContext, "TENDER_NOT_FOUND">> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createGetTenderBiddingContext({
    repository: prismaTenderRepository,
  })(id);
}
```

- [ ] **Step 2: Add the repository method**

Add `TenderBiddingContextRepository` to the `TenderRepository` extends list in `src/modules/tenders/infrastructure/prisma-tender-repository.ts`, import its type, and add:

```ts
  async getBiddingContext(
    id: string,
  ): Promise<Result<TenderBiddingContext, "TENDER_NOT_FOUND">> {
    const row = await database.tender.findFirst({
      where: { id, status: { in: ["PUBLISHED", "CLOSED", "EXPIRED"] } },
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
```

- [ ] **Step 3: Implement the selection gateway**

```ts
// src/modules/tenders/infrastructure/prisma-tender-selection-gateway.ts
import { Prisma } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import type { Result } from "../../shared";
import type { TenderBiddingContext } from "../application/get-tender-bidding-context";

export type TenderClosingOutcome = "WINNER_SELECTED" | "EXPIRED_NO_BIDS";

// Winner selection has to mark bids, close the tender, create the agreement
// snapshot, and enqueue audit/outbox rows atomically. Rather than letting the
// `bidding` module write the Tender table directly — which the roadmap
// forbids — `tenders` publishes this gateway, which accepts the CALLER's
// transaction client. The owning module stays the only code that writes its
// own table, and atomicity is preserved.
export interface TenderSelectionGateway {
  // `SELECT ... FOR UPDATE` on the tender row: the serialization point for
  // concurrent selectors. The row stays locked for the caller's transaction.
  lockDueTender(
    transaction: Prisma.TransactionClient,
    tenderId: string,
    now: Date,
  ): Promise<Result<TenderBiddingContext, "TENDER_NOT_FOUND" | "NOT_DUE">>;
  listDueTenderIds(now: Date, limit: number): Promise<readonly string[]>;
  closeAfterSelection(
    transaction: Prisma.TransactionClient,
    tenderId: string,
    outcome: TenderClosingOutcome,
  ): Promise<void>;
}

export class PrismaTenderSelectionGateway implements TenderSelectionGateway {
  async lockDueTender(
    transaction: Prisma.TransactionClient,
    tenderId: string,
    now: Date,
  ): Promise<Result<TenderBiddingContext, "TENDER_NOT_FOUND" | "NOT_DUE">> {
    // Raw `FOR UPDATE` because Prisma has no first-class row lock. The same
    // pattern `PrismaProfileRepository.complete` already uses.
    await transaction.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Tender" WHERE "id" = ${tenderId} FOR UPDATE`,
    );
    const row = await transaction.tender.findUnique({
      where: { id: tenderId },
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
    if (
      row === null ||
      row.deadline === null ||
      row.budgetMinorUnits === null ||
      (row.currency !== "GEL" && row.currency !== "USD")
    ) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    // "Due" means: still open for bidding AND the deadline has arrived.
    // Rejecting execution before the deadline is a program-design invariant
    // (§4.4 step 3), enforced here where the row is already locked rather
    // than in a caller that could race with a deadline extension.
    if (row.status !== "PUBLISHED" || row.deadline.getTime() > now.getTime()) {
      return { ok: false, error: "NOT_DUE" };
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

  async listDueTenderIds(now: Date, limit: number): Promise<readonly string[]> {
    const rows = await database.tender.findMany({
      where: { status: "PUBLISHED", deadline: { lte: now } },
      // Oldest deadline first, so a backlog drains in the order tenders
      // actually became due rather than by insertion order.
      orderBy: { deadline: "asc" },
      take: limit,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async closeAfterSelection(
    transaction: Prisma.TransactionClient,
    tenderId: string,
    outcome: TenderClosingOutcome,
  ): Promise<void> {
    await transaction.tender.update({
      where: { id: tenderId },
      data: {
        status: outcome === "WINNER_SELECTED" ? "CLOSED" : "EXPIRED",
      },
    });
  }
}

export const prismaTenderSelectionGateway = new PrismaTenderSelectionGateway();
```

- [ ] **Step 4: Write the failing gateway integration test**

```ts
// src/modules/tenders/infrastructure/prisma-tender-selection-gateway.integration.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { prismaTenderSelectionGateway } from "./prisma-tender-selection-gateway";

async function seedTender(deadline: Date, status: "PUBLISHED" | "CLOSED") {
  const ownerId = randomUUID();
  await database.user.create({
    data: {
      id: ownerId,
      name: "Owner",
      email: `${ownerId}@tender.test`,
      emailVerified: true,
    },
  });
  const id = randomUUID();
  await database.tender.create({
    data: {
      id,
      ownerId,
      status,
      specialty: "CONSTRUCTION_REPAIR",
      title: "Repaint two rooms",
      shortDescription: "Interior repaint",
      fullDescription: "Sand, prime, and repaint two bedrooms.",
      scopeOfWork: "Sanding, priming, painting",
      budgetMinorUnits: 80_000,
      currency: "GEL",
      deadline,
      countryCode: "GE",
      locationMode: "ADDRESS",
      city: "Tbilisi",
      addressLine: "1 Chavchavadze Ave",
      exactLatitude: 41.7151,
      exactLongitude: 44.8271,
      publicLatitude: 41.72,
      publicLongitude: 44.83,
      publishedAt: new Date(),
    },
  });
  return id;
}

afterAll(async () => {
  await database.$disconnect();
});

describe("prismaTenderSelectionGateway", () => {
  it("refuses to lock a tender whose deadline has not arrived", async () => {
    const future = new Date(Date.now() + 60_000);
    const tenderId = await seedTender(future, "PUBLISHED");

    const locked = await database.$transaction((transaction) =>
      prismaTenderSelectionGateway.lockDueTender(
        transaction,
        tenderId,
        new Date(),
      ),
    );

    expect(locked).toEqual({ ok: false, error: "NOT_DUE" });
  });

  it("locks a due tender and reports its settlement terms", async () => {
    const past = new Date(Date.now() - 60_000);
    const tenderId = await seedTender(past, "PUBLISHED");

    const locked = await database.$transaction((transaction) =>
      prismaTenderSelectionGateway.lockDueTender(
        transaction,
        tenderId,
        new Date(),
      ),
    );

    expect(locked).toMatchObject({
      ok: true,
      value: { id: tenderId, currency: "GEL", status: "PUBLISHED" },
    });
  });

  it("refuses to lock a tender selection has already closed", async () => {
    const past = new Date(Date.now() - 60_000);
    const tenderId = await seedTender(past, "CLOSED");

    const locked = await database.$transaction((transaction) =>
      prismaTenderSelectionGateway.lockDueTender(
        transaction,
        tenderId,
        new Date(),
      ),
    );

    expect(locked).toEqual({ ok: false, error: "NOT_DUE" });
  });

  it("closes to CLOSED on a winner and EXPIRED without one", async () => {
    const past = new Date(Date.now() - 60_000);
    const withWinner = await seedTender(past, "PUBLISHED");
    const withoutBids = await seedTender(past, "PUBLISHED");

    await database.$transaction(async (transaction) => {
      await prismaTenderSelectionGateway.closeAfterSelection(
        transaction,
        withWinner,
        "WINNER_SELECTED",
      );
      await prismaTenderSelectionGateway.closeAfterSelection(
        transaction,
        withoutBids,
        "EXPIRED_NO_BIDS",
      );
    });

    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: withWinner },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "CLOSED" });
    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: withoutBids },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "EXPIRED" });
  });

  it("lists only tenders that are due, oldest deadline first", async () => {
    const older = await seedTender(new Date(Date.now() - 120_000), "PUBLISHED");
    const newer = await seedTender(new Date(Date.now() - 60_000), "PUBLISHED");
    await seedTender(new Date(Date.now() + 60_000), "PUBLISHED");

    const due = await prismaTenderSelectionGateway.listDueTenderIds(
      new Date(),
      50,
    );

    const relevant = due.filter((id) => id === older || id === newer);
    expect(relevant).toEqual([older, newer]);
  });
});
```

- [ ] **Step 5: Run the integration test**

Run: `pnpm test:integration -- prisma-tender-selection-gateway`
Expected: PASS — five tests. If `SELECT ... FOR UPDATE` fails with a relation-name error, confirm the generated table name: the `Tender` model has no `@@map`, so PostgreSQL's quoted identifier is `"Tender"`.

- [ ] **Step 6: Commit**

```bash
git add src/modules/tenders
git commit -m "feat: publish tender bidding-context and selection seams"
```

---

### Task 7: Bid persistence, submission, revision, and withdrawal

**Files:**

- Create: `src/modules/bidding/application/submit-bid.ts`
- Create: `src/modules/bidding/application/revise-bid.ts`
- Create: `src/modules/bidding/application/withdraw-bid.ts`
- Create: `src/modules/bidding/application/tender-has-active-bids.ts`
- Create: `src/modules/bidding/infrastructure/prisma-bid-repository.ts`
- Create: `src/modules/bidding/application/bid-lifecycle.integration.test.ts`
- Create: `src/modules/tenders/ports/bid-presence.ts`
- Modify: `src/modules/tenders/application/cancel-tender.ts`
- Modify: `src/modules/tenders/http/map-tender-error.ts`

**Interfaces:**

- Consumes: `getTenderBiddingContext` (Task 6); `hasTenderEntitlement` (Task 2); `RankableBid`, `Bid`, `bidIneligibility`, the Task 5 constraints.
- Produces: `BidActor`, `submitBidCommandSchema`, `SubmitBidError`, `submitBid`, `reviseBid`, `ReviseBidError`, `withdrawBid`, `WithdrawBidError`, `tenderHasActiveBids`, `prismaBidRepository`, `BidPresence`, and `TENDER_HAS_BIDS` on `CancelError`.

- [ ] **Step 1: Implement submit-bid**

```ts
// src/modules/bidding/application/submit-bid.ts
import { z } from "zod";
import type { Clock, IdGenerator, Result } from "../../shared";
import type { Bid, BidCurrency } from "../domain/bid";
import {
  MAX_BID_AMOUNT_MINOR_UNITS,
  MAX_BID_CONDITIONS_LENGTH,
  MAX_BID_DURATION_DAYS,
  MAX_BID_TERM_LENGTH,
  MIN_BID_CONDITIONS_LENGTH,
} from "../domain/constraints";

// The bid carries no currency: it always settles in the tender's currency,
// which the use case reads from the tender context. Accepting one from the
// client would let a bidder claim a cheaper unit of account.
export const submitBidCommandSchema = z
  .object({
    amountMinorUnits: z
      .number()
      .int()
      .positive()
      .max(MAX_BID_AMOUNT_MINOR_UNITS),
    proposedStartDate: z.coerce.date().optional(),
    durationDays: z
      .number()
      .int()
      .positive()
      .max(MAX_BID_DURATION_DAYS)
      .optional(),
    includedCosts: z.string().trim().min(1).max(MAX_BID_TERM_LENGTH).optional(),
    exclusions: z.string().trim().min(1).max(MAX_BID_TERM_LENGTH).optional(),
    conditions: z
      .string()
      .trim()
      .min(MIN_BID_CONDITIONS_LENGTH)
      .max(MAX_BID_CONDITIONS_LENGTH),
  })
  .strict();

export type SubmitBidCommand = z.output<typeof submitBidCommandSchema>;
export type BidActor = Readonly<{ id: string }>;

export type SubmitBidError =
  | "INVALID_INPUT"
  | "TENDER_NOT_FOUND"
  | "TENDER_NOT_OPEN"
  | "DEADLINE_PASSED"
  | "NOT_ENTITLED"
  | "OWN_TENDER"
  | "BID_ALREADY_EXISTS";

export type TenderContextLookup = (id: string) => Promise<
  Result<
    Readonly<{
      id: string;
      ownerId: string;
      status: "PUBLISHED" | "CLOSED" | "EXPIRED";
      currency: BidCurrency;
      deadline: Date;
    }>,
    "TENDER_NOT_FOUND"
  >
>;

export type EntitlementCheck = (
  providerId: string,
  tenderId: string,
  now: Date,
) => Promise<boolean>;

export interface SubmitBidRepository {
  insertBid(
    bid: Readonly<{
      id: string;
      tenderId: string;
      providerId: string;
      amountMinorUnits: number;
      currency: BidCurrency;
      command: SubmitBidCommand;
      qualifyingSubmittedAt: Date;
    }>,
    // Re-asserted inside the write, so a deadline that elapses between the
    // check below and the INSERT is caught by the write itself.
    deadline: Date,
  ): Promise<Result<Bid, "BID_ALREADY_EXISTS" | "DEADLINE_PASSED">>;
}

export function createSubmitBid(dependencies: {
  repository: SubmitBidRepository;
  tenders: TenderContextLookup;
  isEntitled: EntitlementCheck;
  ids: IdGenerator;
  clock: Clock;
}) {
  return async function submitBid(
    tenderId: string,
    input: unknown,
    actor: BidActor,
  ): Promise<Result<Bid, SubmitBidError>> {
    const parsed = submitBidCommandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

    const tender = await dependencies.tenders(tenderId);
    if (!tender.ok) return { ok: false, error: "TENDER_NOT_FOUND" };
    // A dual-capability company holds both CUSTOMER and PROVIDER, so nothing
    // in the capability check stops it bidding on its own tender. Price
    // competition requires that it cannot.
    if (tender.value.ownerId === actor.id) {
      return { ok: false, error: "OWN_TENDER" };
    }
    if (tender.value.status !== "PUBLISHED") {
      return { ok: false, error: "TENDER_NOT_OPEN" };
    }

    const now = dependencies.clock.now();
    if (now.getTime() >= tender.value.deadline.getTime()) {
      return { ok: false, error: "DEADLINE_PASSED" };
    }
    // Sending an offer is free, but only after access has been gained
    // (Product_description, "Application Viewing System").
    if (!(await dependencies.isEntitled(actor.id, tenderId, now))) {
      return { ok: false, error: "NOT_ENTITLED" };
    }

    return dependencies.repository.insertBid(
      {
        id: dependencies.ids.next(),
        tenderId,
        providerId: actor.id,
        amountMinorUnits: parsed.data.amountMinorUnits,
        currency: tender.value.currency,
        command: parsed.data,
        qualifyingSubmittedAt: now,
      },
      tender.value.deadline,
    );
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function submitBid(
  tenderId: string,
  input: unknown,
  actor: BidActor,
): Promise<Result<Bid, SubmitBidError>> {
  const [
    { prismaBidRepository },
    { getTenderBiddingContext },
    { hasTenderEntitlement },
  ] = await Promise.all([
    import("../infrastructure/prisma-bid-repository"),
    import("../../tenders/application/get-tender-bidding-context"),
    import("../../access/application/has-tender-entitlement"),
  ]);
  return createSubmitBid({
    repository: prismaBidRepository,
    tenders: getTenderBiddingContext,
    isEntitled: hasTenderEntitlement,
    ids: systemIds,
    clock: systemClock,
  })(tenderId, input, actor);
}
```

- [ ] **Step 2: Implement revise-bid and withdraw-bid**

```ts
// src/modules/bidding/application/revise-bid.ts
import type { Clock, Result } from "../../shared";
import type { Bid } from "../domain/bid";
import {
  submitBidCommandSchema,
  type BidActor,
  type SubmitBidCommand,
  type TenderContextLookup,
} from "./submit-bid";

export type ReviseBidError =
  | "INVALID_INPUT"
  | "TENDER_NOT_FOUND"
  | "BID_NOT_FOUND"
  | "BID_NOT_ACTIVE"
  | "DEADLINE_PASSED";

export interface ReviseBidRepository {
  reviseOwnBid(
    tenderId: string,
    providerId: string,
    command: SubmitBidCommand,
    qualifyingSubmittedAt: Date,
    deadline: Date,
  ): Promise<
    Result<Bid, "BID_NOT_FOUND" | "BID_NOT_ACTIVE" | "DEADLINE_PASSED">
  >;
}

export function createReviseBid(dependencies: {
  repository: ReviseBidRepository;
  tenders: TenderContextLookup;
  clock: Clock;
}) {
  return async function reviseBid(
    tenderId: string,
    input: unknown,
    actor: BidActor,
  ): Promise<Result<Bid, ReviseBidError>> {
    // A revision re-states the whole offer rather than patching it: a partial
    // patch would leave the surviving fields describing an offer the provider
    // never re-affirmed at the new price.
    const parsed = submitBidCommandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

    const tender = await dependencies.tenders(tenderId);
    if (!tender.ok) return { ok: false, error: "TENDER_NOT_FOUND" };

    const now = dependencies.clock.now();
    if (now.getTime() >= tender.value.deadline.getTime()) {
      return { ok: false, error: "DEADLINE_PASSED" };
    }

    // The new timestamp is the point of a revision: a revised bid rejoins the
    // tie-break queue at the back (program design §4.3).
    return dependencies.repository.reviseOwnBid(
      tenderId,
      actor.id,
      parsed.data,
      now,
      tender.value.deadline,
    );
  };
}

export async function reviseBid(
  tenderId: string,
  input: unknown,
  actor: BidActor,
): Promise<Result<Bid, ReviseBidError>> {
  const [{ prismaBidRepository }, { getTenderBiddingContext }] =
    await Promise.all([
      import("../infrastructure/prisma-bid-repository"),
      import("../../tenders/application/get-tender-bidding-context"),
    ]);
  return createReviseBid({
    repository: prismaBidRepository,
    tenders: getTenderBiddingContext,
    clock: { now: () => new Date() },
  })(tenderId, input, actor);
}
```

```ts
// src/modules/bidding/application/withdraw-bid.ts
import type { Clock, Result } from "../../shared";
import type { Bid } from "../domain/bid";
import type { BidActor, TenderContextLookup } from "./submit-bid";

export type WithdrawBidError =
  "TENDER_NOT_FOUND" | "BID_NOT_FOUND" | "BID_NOT_ACTIVE" | "DEADLINE_PASSED";

export interface WithdrawBidRepository {
  withdrawOwnBid(
    tenderId: string,
    providerId: string,
    withdrawnAt: Date,
    deadline: Date,
  ): Promise<
    Result<Bid, "BID_NOT_FOUND" | "BID_NOT_ACTIVE" | "DEADLINE_PASSED">
  >;
}

export function createWithdrawBid(dependencies: {
  repository: WithdrawBidRepository;
  tenders: TenderContextLookup;
  clock: Clock;
}) {
  return async function withdrawBid(
    tenderId: string,
    actor: BidActor,
  ): Promise<Result<Bid, WithdrawBidError>> {
    const tender = await dependencies.tenders(tenderId);
    if (!tender.ok) return { ok: false, error: "TENDER_NOT_FOUND" };

    const now = dependencies.clock.now();
    if (now.getTime() >= tender.value.deadline.getTime()) {
      return { ok: false, error: "DEADLINE_PASSED" };
    }

    // The row is kept and flagged WITHDRAWN rather than deleted: the unique
    // (tenderId, providerId) constraint then also stops a withdrawn bidder
    // from opening a second record, and the audit trail survives.
    return dependencies.repository.withdrawOwnBid(
      tenderId,
      actor.id,
      now,
      tender.value.deadline,
    );
  };
}

export async function withdrawBid(
  tenderId: string,
  actor: BidActor,
): Promise<Result<Bid, WithdrawBidError>> {
  const [{ prismaBidRepository }, { getTenderBiddingContext }] =
    await Promise.all([
      import("../infrastructure/prisma-bid-repository"),
      import("../../tenders/application/get-tender-bidding-context"),
    ]);
  return createWithdrawBid({
    repository: prismaBidRepository,
    tenders: getTenderBiddingContext,
    clock: { now: () => new Date() },
  })(tenderId, actor);
}
```

```ts
// src/modules/bidding/application/tender-has-active-bids.ts
export interface BidPresenceRepository {
  countActiveBids(tenderId: string): Promise<number>;
}

export function createTenderHasActiveBids(dependencies: {
  repository: BidPresenceRepository;
}) {
  return async function tenderHasActiveBids(
    tenderId: string,
  ): Promise<boolean> {
    return (await dependencies.repository.countActiveBids(tenderId)) > 0;
  };
}

// The published cross-module query `tenders` binds to its `BidPresence` port
// so a client cannot cancel a tender providers have already competed for.
export async function tenderHasActiveBids(tenderId: string): Promise<boolean> {
  const { prismaBidRepository } =
    await import("../infrastructure/prisma-bid-repository");
  return createTenderHasActiveBids({ repository: prismaBidRepository })(
    tenderId,
  );
}
```

- [ ] **Step 3: Implement the bid repository**

```ts
// src/modules/bidding/infrastructure/prisma-bid-repository.ts
import { Prisma } from "../../../generated/prisma/client";
import type { Bid as BidRow } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import type { Result } from "../../shared";
import type { BidPresenceRepository } from "../application/tender-has-active-bids";
import type { ReviseBidRepository } from "../application/revise-bid";
import type {
  SubmitBidCommand,
  SubmitBidRepository,
} from "../application/submit-bid";
import type { WithdrawBidRepository } from "../application/withdraw-bid";
import type { Bid, BidCurrency } from "../domain/bid";

function toBid(row: BidRow): Bid | null {
  // The same never-throw convention the tenders repository uses: a row whose
  // currency this module cannot represent is treated as absent rather than
  // coerced, because coercing would misreport an amount in minor units.
  if (row.currency !== "GEL" && row.currency !== "USD") return null;
  return {
    id: row.id,
    tenderId: row.tenderId,
    providerId: row.providerId,
    amountMinorUnits: row.amountMinorUnits,
    currency: row.currency as BidCurrency,
    status: row.status,
    proposedStartDate: row.proposedStartDate,
    durationDays: row.durationDays,
    includedCosts: row.includedCosts,
    exclusions: row.exclusions,
    conditions: row.conditions,
    qualifyingSubmittedAt: row.qualifyingSubmittedAt,
    withdrawnAt: row.withdrawnAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function termsData(command: SubmitBidCommand) {
  return {
    amountMinorUnits: command.amountMinorUnits,
    proposedStartDate: command.proposedStartDate ?? null,
    durationDays: command.durationDays ?? null,
    includedCosts: command.includedCosts ?? null,
    exclusions: command.exclusions ?? null,
    conditions: command.conditions,
  };
}

export class PrismaBidRepository
  implements
    SubmitBidRepository,
    ReviseBidRepository,
    WithdrawBidRepository,
    BidPresenceRepository
{
  async insertBid(
    bid: Readonly<{
      id: string;
      tenderId: string;
      providerId: string;
      amountMinorUnits: number;
      currency: BidCurrency;
      command: SubmitBidCommand;
      qualifyingSubmittedAt: Date;
    }>,
    deadline: Date,
  ): Promise<Result<Bid, "BID_ALREADY_EXISTS" | "DEADLINE_PASSED">> {
    // Cheap re-check against the deadline the caller already validated, using
    // the timestamp this write will store, so a request that stalled between
    // the check and the write cannot land a late bid.
    if (bid.qualifyingSubmittedAt.getTime() >= deadline.getTime()) {
      return { ok: false, error: "DEADLINE_PASSED" };
    }
    try {
      const created = await database.bid.create({
        data: {
          id: bid.id,
          tenderId: bid.tenderId,
          providerId: bid.providerId,
          currency: bid.currency,
          status: "SUBMITTED",
          qualifyingSubmittedAt: bid.qualifyingSubmittedAt,
          ...termsData(bid.command),
        },
      });
      const mapped = toBid(created);
      if (mapped === null) {
        throw new Error(`Failed to map newly created bid ${created.id}.`);
      }
      return { ok: true, value: mapped };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // The unique (tenderId, providerId) constraint: one active bid per
        // provider per tender, enforced by the database rather than by a
        // read-then-write the next request could interleave with.
        return { ok: false, error: "BID_ALREADY_EXISTS" };
      }
      throw error;
    }
  }

  async reviseOwnBid(
    tenderId: string,
    providerId: string,
    command: SubmitBidCommand,
    qualifyingSubmittedAt: Date,
    deadline: Date,
  ): Promise<
    Result<Bid, "BID_NOT_FOUND" | "BID_NOT_ACTIVE" | "DEADLINE_PASSED">
  > {
    // Cheap re-check against the timestamp this write will store, matching
    // `insertBid`, so a request that stalled cannot land a late revision.
    if (qualifyingSubmittedAt.getTime() >= deadline.getTime()) {
      return { ok: false, error: "DEADLINE_PASSED" };
    }
    // The conditional `updateMany` IS the state transition: ownership, active
    // status, and the tender's own deadline are all part of the single
    // statement, exactly like the tenders module's publish/cancel guards.
    const { count } = await database.bid.updateMany({
      where: {
        tenderId,
        providerId,
        status: "SUBMITTED",
        tender: {
          status: "PUBLISHED",
          deadline: { gt: qualifyingSubmittedAt },
        },
      },
      data: { ...termsData(command), qualifyingSubmittedAt },
    });

    if (count === 0) {
      const existing = await database.bid.findUnique({
        where: { tenderId_providerId: { tenderId, providerId } },
        select: { status: true },
      });
      if (existing === null) return { ok: false, error: "BID_NOT_FOUND" };
      if (existing.status !== "SUBMITTED") {
        return { ok: false, error: "BID_NOT_ACTIVE" };
      }
      // Owned, active, still not updated: the tender closed or its deadline
      // elapsed during the round trip.
      return { ok: false, error: "DEADLINE_PASSED" };
    }

    const updated = await database.bid.findUniqueOrThrow({
      where: { tenderId_providerId: { tenderId, providerId } },
    });
    const mapped = toBid(updated);
    return mapped === null
      ? { ok: false, error: "BID_NOT_FOUND" }
      : { ok: true, value: mapped };
  }

  async withdrawOwnBid(
    tenderId: string,
    providerId: string,
    withdrawnAt: Date,
    deadline: Date,
  ): Promise<
    Result<Bid, "BID_NOT_FOUND" | "BID_NOT_ACTIVE" | "DEADLINE_PASSED">
  > {
    if (withdrawnAt.getTime() >= deadline.getTime()) {
      return { ok: false, error: "DEADLINE_PASSED" };
    }
    const { count } = await database.bid.updateMany({
      where: {
        tenderId,
        providerId,
        status: "SUBMITTED",
        tender: { status: "PUBLISHED", deadline: { gt: withdrawnAt } },
      },
      data: { status: "WITHDRAWN", withdrawnAt },
    });

    if (count === 0) {
      const existing = await database.bid.findUnique({
        where: { tenderId_providerId: { tenderId, providerId } },
        select: { status: true },
      });
      if (existing === null) return { ok: false, error: "BID_NOT_FOUND" };
      if (existing.status !== "SUBMITTED") {
        return { ok: false, error: "BID_NOT_ACTIVE" };
      }
      return { ok: false, error: "DEADLINE_PASSED" };
    }

    const updated = await database.bid.findUniqueOrThrow({
      where: { tenderId_providerId: { tenderId, providerId } },
    });
    const mapped = toBid(updated);
    return mapped === null
      ? { ok: false, error: "BID_NOT_FOUND" }
      : { ok: true, value: mapped };
  }

  async countActiveBids(tenderId: string): Promise<number> {
    return database.bid.count({
      where: { tenderId, status: { not: "WITHDRAWN" } },
    });
  }
}

export const prismaBidRepository = new PrismaBidRepository();
```

- [ ] **Step 4: Block cancellation once a tender has bids**

```ts
// src/modules/tenders/ports/bid-presence.ts
// Bound at the composition root to `bidding`'s published
// `tenderHasActiveBids` query. Program design §4.2: a client may cancel an
// open tender only while it has no submitted bids.
export type BidPresence = (tenderId: string) => Promise<boolean>;
```

In `src/modules/tenders/application/cancel-tender.ts`, add `"TENDER_HAS_BIDS"` to `CancelError`, take `hasBids: BidPresence` as a dependency, and check it after the input parses and before the repository write:

```ts
// Checked before the write rather than inside it, because the bid count
// lives in another module's table: the guard has to be a published query,
// not a `where` clause. The window this leaves is bounded by the same
// deadline both sides respect, and a bid landing in it is protected by the
// selection lock, which refuses to run for a CANCELLED tender.
if (await dependencies.hasBids(id)) {
  return { ok: false, error: "TENDER_HAS_BIDS" };
}
```

Wire the composed export to `tenderHasActiveBids`, and add to `src/modules/tenders/http/map-tender-error.ts`: `"TENDER_HAS_BIDS"` on `TenderErrorCode`, `TENDER_HAS_BIDS: 409` in `TENDER_STATUS_BY_ERROR`, and `TENDER_HAS_BIDS: "tenders.errors.tenderHasBids"` in `TENDER_ERROR_MESSAGE_KEYS`. Add the `tenders.errors.tenderHasBids` leaf to both catalogs.

- [ ] **Step 5: Write the failing bid-lifecycle integration test**

```ts
// src/modules/bidding/application/bid-lifecycle.integration.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { cancelTender } from "../../tenders/application/cancel-tender";
import { reviseBid } from "./revise-bid";
import { submitBid } from "./submit-bid";
import { withdrawBid } from "./withdraw-bid";

const CONDITIONS =
  "Materials and labour included; scaffolding excluded from this price.";

async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: "Party",
      email: `${id}@tender.test`,
      emailVerified: true,
    },
  });
  return id;
}

async function seedPublishedTender(
  ownerId: string,
  deadline: Date,
): Promise<string> {
  const id = randomUUID();
  await database.tender.create({
    data: {
      id,
      ownerId,
      status: "PUBLISHED",
      specialty: "CONSTRUCTION_REPAIR",
      title: "Repaint two rooms",
      shortDescription: "Interior repaint",
      fullDescription: "Sand, prime, and repaint two bedrooms.",
      scopeOfWork: "Sanding, priming, painting",
      budgetMinorUnits: 80_000,
      currency: "GEL",
      deadline,
      countryCode: "GE",
      locationMode: "ADDRESS",
      city: "Tbilisi",
      addressLine: "1 Chavchavadze Ave",
      exactLatitude: 41.7151,
      exactLongitude: 44.8271,
      publicLatitude: 41.72,
      publicLongitude: 44.83,
      publishedAt: new Date(),
    },
  });
  return id;
}

async function entitle(providerId: string, tenderId: string): Promise<void> {
  await database.accessEntitlement.create({
    data: {
      id: randomUUID(),
      providerId,
      kind: "SINGLE_TENDER",
      tenderId,
      grantedAt: new Date(Date.now() - 1_000),
      expiresAt: null,
    },
  });
}

const future = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

afterAll(async () => {
  await database.$disconnect();
});

describe("bid lifecycle", () => {
  it("refuses a bid from a provider with no entitlement", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());

    await expect(
      submitBid(
        tenderId,
        { amountMinorUnits: 70_000, conditions: CONDITIONS },
        { id: providerId },
      ),
    ).resolves.toEqual({ ok: false, error: "NOT_ENTITLED" });
  });

  it("accepts one bid per provider and refuses a second", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());
    await entitle(providerId, tenderId);

    const first = await submitBid(
      tenderId,
      { amountMinorUnits: 70_000, conditions: CONDITIONS },
      { id: providerId },
    );
    expect(first).toMatchObject({
      ok: true,
      value: { amountMinorUnits: 70_000, currency: "GEL", status: "SUBMITTED" },
    });

    await expect(
      submitBid(
        tenderId,
        { amountMinorUnits: 60_000, conditions: CONDITIONS },
        { id: providerId },
      ),
    ).resolves.toEqual({ ok: false, error: "BID_ALREADY_EXISTS" });
  });

  it("refuses a bid on the provider's own tender", async () => {
    const dualId = await seedUser();
    const tenderId = await seedPublishedTender(dualId, future());
    await entitle(dualId, tenderId);

    await expect(
      submitBid(
        tenderId,
        { amountMinorUnits: 10_000, conditions: CONDITIONS },
        { id: dualId },
      ),
    ).resolves.toEqual({ ok: false, error: "OWN_TENDER" });
  });

  it("rejects a conditions note that is not substantive", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());
    await entitle(providerId, tenderId);

    await expect(
      submitBid(
        tenderId,
        { amountMinorUnits: 70_000, conditions: "ok" },
        { id: providerId },
      ),
    ).resolves.toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("moves a revised bid to the back of the tie-break queue", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());
    await entitle(providerId, tenderId);

    const submitted = await submitBid(
      tenderId,
      { amountMinorUnits: 70_000, conditions: CONDITIONS },
      { id: providerId },
    );
    if (!submitted.ok) throw new Error("submit failed");

    const revised = await reviseBid(
      tenderId,
      { amountMinorUnits: 65_000, conditions: CONDITIONS },
      { id: providerId },
    );
    expect(revised).toMatchObject({
      ok: true,
      value: { amountMinorUnits: 65_000 },
    });
    if (!revised.ok) throw new Error("revise failed");
    expect(
      revised.value.qualifyingSubmittedAt.getTime(),
    ).toBeGreaterThanOrEqual(submitted.value.qualifyingSubmittedAt.getTime());
  });

  it("keeps a withdrawn bid's row and refuses to revise it", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());
    await entitle(providerId, tenderId);
    await submitBid(
      tenderId,
      { amountMinorUnits: 70_000, conditions: CONDITIONS },
      { id: providerId },
    );

    const withdrawn = await withdrawBid(tenderId, { id: providerId });
    expect(withdrawn).toMatchObject({
      ok: true,
      value: { status: "WITHDRAWN" },
    });

    await expect(
      reviseBid(
        tenderId,
        { amountMinorUnits: 1_000, conditions: CONDITIONS },
        { id: providerId },
      ),
    ).resolves.toEqual({ ok: false, error: "BID_NOT_ACTIVE" });
  });

  it("refuses every bid mutation once the deadline has passed", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());
    await entitle(providerId, tenderId);
    await submitBid(
      tenderId,
      { amountMinorUnits: 70_000, conditions: CONDITIONS },
      { id: providerId },
    );

    // The fixture-only write the seed script also uses: move the deadline
    // into the past without touching any application rule.
    await database.tender.update({
      where: { id: tenderId },
      data: { deadline: new Date(Date.now() - 1_000) },
    });

    const otherProviderId = await seedUser();
    await entitle(otherProviderId, tenderId);

    await expect(
      submitBid(
        tenderId,
        { amountMinorUnits: 1_000, conditions: CONDITIONS },
        { id: otherProviderId },
      ),
    ).resolves.toEqual({ ok: false, error: "DEADLINE_PASSED" });
    await expect(
      reviseBid(
        tenderId,
        { amountMinorUnits: 1_000, conditions: CONDITIONS },
        { id: providerId },
      ),
    ).resolves.toEqual({ ok: false, error: "DEADLINE_PASSED" });
    await expect(withdrawBid(tenderId, { id: providerId })).resolves.toEqual({
      ok: false,
      error: "DEADLINE_PASSED",
    });
  });

  it("refuses to cancel a tender that already has a bid", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId, future());
    await entitle(providerId, tenderId);
    await submitBid(
      tenderId,
      { amountMinorUnits: 70_000, conditions: CONDITIONS },
      { id: providerId },
    );

    await expect(
      cancelTender(
        tenderId,
        { reason: "Changed my mind entirely" },
        { id: clientId },
      ),
    ).resolves.toEqual({ ok: false, error: "TENDER_HAS_BIDS" });

    // ...but a withdrawal releases the tender again.
    await withdrawBid(tenderId, { id: providerId });
    await expect(
      cancelTender(
        tenderId,
        { reason: "Changed my mind entirely" },
        { id: clientId },
      ),
    ).resolves.toMatchObject({ ok: true, value: { status: "CANCELLED" } });
  });
});
```

- [ ] **Step 6: Run the integration test**

Run: `pnpm test:integration -- bid-lifecycle`
Expected: PASS — eight tests.

- [ ] **Step 7: Run the full unit and boundary layers**

Run: `pnpm test:unit && pnpm verify:boundaries && pnpm typecheck && pnpm lint`
Expected: PASS. Phase 2's `cancel-tender` unit tests must be updated to supply the new `hasBids` dependency; do not weaken any existing assertion to make them pass.

- [ ] **Step 8: Commit**

```bash
git add src/modules/bidding src/modules/tenders src/modules/localization
git commit -m "feat: submit, revise, and withdraw bids before the deadline"
```

---

### Task 8: Bid HTTP routes, provider summary, and client comparison

**Files:**

- Create: `src/modules/bidding/application/get-bid-summary.ts`
- Create: `src/modules/bidding/application/list-tender-bids.ts`
- Create: `src/modules/bidding/ports/provider-directory.ts`
- Create: `src/modules/profiles/application/get-provider-display-names.ts`
- Create: `src/modules/bidding/http/map-bidding-error.ts`
- Create: `src/modules/bidding/http/bid-handlers.ts`
- Create: `src/modules/bidding/http/bid-handlers.test.ts`
- Create: `app/api/tenders/[id]/bids/route.ts`
- Create: `app/api/tenders/[id]/bids/mine/route.ts`
- Create: `app/api/tenders/[id]/bids/summary/route.ts`
- Modify: `src/modules/bidding/infrastructure/prisma-bid-repository.ts`

**Interfaces:**

- Consumes: Task 7's use cases; `summarizeBids` from Task 5; `getTenderBiddingContext` from Task 6.
- Produces: `getBidSummary`, `listTenderBids`, `ClientBidView`, `ProviderDirectory`, `getProviderDisplayNames`, `BiddingErrorCode`, `mapBiddingError`, `createBidHandlers`, `createOwnBidHandlers`, `createBidSummaryHandlers`.

- [ ] **Step 1: Implement the two read use cases and the directory port**

```ts
// src/modules/bidding/ports/provider-directory.ts
// Bound to `profiles`'s published `getProviderDisplayNames` query. Bidding
// must not read the profiles tables itself, and it deliberately asks for
// display names only — never phone, email, or address.
export type ProviderDirectory = (
  providerIds: readonly string[],
) => Promise<ReadonlyMap<string, string>>;
```

```ts
// src/modules/profiles/application/get-provider-display-names.ts
export interface ProviderDisplayNameRepository {
  findDisplayNames(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>>;
}

export function createGetProviderDisplayNames(dependencies: {
  repository: ProviderDisplayNameRepository;
}) {
  return async function getProviderDisplayNames(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (userIds.length === 0) return new Map();
    return dependencies.repository.findDisplayNames(userIds);
  };
}

export async function getProviderDisplayNames(
  userIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const { prismaProfileRepository } =
    await import("../infrastructure/prisma-profile-repository");
  return createGetProviderDisplayNames({
    repository: prismaProfileRepository,
  })(userIds);
}
```

Add the matching method to `src/modules/profiles/infrastructure/prisma-profile-repository.ts`:

```ts
  async findDisplayNames(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const rows = await database.userProfile.findMany({
      where: { userId: { in: [...userIds] } },
      // Only the public display name leaves this module. Selecting the whole
      // profile here would put phone numbers one careless spread away from a
      // competitor-visible response.
      select: { userId: true, displayName: true },
    });
    return new Map(rows.map((row) => [row.userId, row.displayName]));
  }
```

```ts
// src/modules/bidding/application/get-bid-summary.ts
import type { Result } from "../../shared";
import { summarizeBids } from "../domain/bid-summary";
import type { BidSummary } from "../domain/bid-summary";
import type { Bid, RankableBid } from "../domain/bid";
import type { BidActor, TenderContextLookup } from "./submit-bid";

export interface BidSummaryRepository {
  listRankableBids(tenderId: string): Promise<readonly RankableBid[]>;
  // Scoped to one provider's own bid. There is no read anywhere in this
  // module that hands one provider another provider's bid.
  findOwnBid(tenderId: string, providerId: string): Promise<Bid | null>;
}

export function createGetBidSummary(dependencies: {
  repository: BidSummaryRepository;
  tenders: TenderContextLookup;
}) {
  return async function getBidSummary(
    tenderId: string,
  ): Promise<Result<BidSummary, "TENDER_NOT_FOUND">> {
    const tender = await dependencies.tenders(tenderId);
    if (!tender.ok) return { ok: false, error: "TENDER_NOT_FOUND" };
    const bids = await dependencies.repository.listRankableBids(tenderId);
    // Summarised through the domain projection, so what a competitor sees is
    // the count and the current lowest amount — never who bid or when.
    return {
      ok: true,
      value: summarizeBids(bids, {
        currency: tender.value.currency,
        deadline: tender.value.deadline,
      }),
    };
  };
}

export async function getBidSummary(
  tenderId: string,
): Promise<Result<BidSummary, "TENDER_NOT_FOUND">> {
  const [{ prismaBidRepository }, { getTenderBiddingContext }] =
    await Promise.all([
      import("../infrastructure/prisma-bid-repository"),
      import("../../tenders/application/get-tender-bidding-context"),
    ]);
  return createGetBidSummary({
    repository: prismaBidRepository,
    tenders: getTenderBiddingContext,
  })(tenderId);
}

export function createGetOwnBid(dependencies: {
  repository: BidSummaryRepository;
  tenders: TenderContextLookup;
}) {
  return async function getOwnBid(
    tenderId: string,
    actor: BidActor,
  ): Promise<Result<Bid | null, "TENDER_NOT_FOUND">> {
    const tender = await dependencies.tenders(tenderId);
    if (!tender.ok) return { ok: false, error: "TENDER_NOT_FOUND" };
    return {
      ok: true,
      value: await dependencies.repository.findOwnBid(tenderId, actor.id),
    };
  };
}

// Feeds the provider detail page: which control to render (submit vs revise)
// and, after selection, whether this provider won or lost.
export async function getOwnBid(
  tenderId: string,
  actor: BidActor,
): Promise<Result<Bid | null, "TENDER_NOT_FOUND">> {
  const [{ prismaBidRepository }, { getTenderBiddingContext }] =
    await Promise.all([
      import("../infrastructure/prisma-bid-repository"),
      import("../../tenders/application/get-tender-bidding-context"),
    ]);
  return createGetOwnBid({
    repository: prismaBidRepository,
    tenders: getTenderBiddingContext,
  })(tenderId, actor);
}
```

```ts
// src/modules/bidding/application/list-tender-bids.ts
import type { Result } from "../../shared";
import type { Bid } from "../domain/bid";
import { rankBids } from "../domain/ranking";
import type { ProviderDirectory } from "../ports/provider-directory";
import type { BidActor, TenderContextLookup } from "./submit-bid";

// What the client sees: every bid, ranked, with the provider's public display
// name. The client may compare but may not choose — no route in this module
// accepts a client-selected winner.
export type ClientBidView = Readonly<{
  id: string;
  providerDisplayName: string;
  amountMinorUnits: number;
  currency: Bid["currency"];
  status: Bid["status"];
  proposedStartDate: string | null;
  durationDays: number | null;
  includedCosts: string | null;
  exclusions: string | null;
  conditions: string;
  qualifyingSubmittedAt: string;
}>;

export interface ListTenderBidsRepository {
  listBids(tenderId: string): Promise<readonly Bid[]>;
}

export function createListTenderBids(dependencies: {
  repository: ListTenderBidsRepository;
  tenders: TenderContextLookup;
  directory: ProviderDirectory;
}) {
  return async function listTenderBids(
    tenderId: string,
    actor: BidActor,
  ): Promise<
    Result<readonly ClientBidView[], "TENDER_NOT_FOUND" | "NOT_OWNER">
  > {
    const tender = await dependencies.tenders(tenderId);
    if (!tender.ok) return { ok: false, error: "TENDER_NOT_FOUND" };
    if (tender.value.ownerId !== actor.id) {
      return { ok: false, error: "NOT_OWNER" };
    }

    const bids = await dependencies.repository.listBids(tenderId);
    const terms = {
      currency: tender.value.currency,
      deadline: tender.value.deadline,
    };
    // Ranked order is the comparison order the client sees, so the ordering
    // the selector will use is visible rather than implied.
    const rankedIds = rankBids(bids, terms).map((bid) => bid.id);
    const ordered = [
      ...rankedIds
        .map((id) => bids.find((bid) => bid.id === id))
        .filter((bid): bid is Bid => bid !== undefined),
      ...bids.filter((bid) => !rankedIds.includes(bid.id)),
    ];

    const names = await dependencies.directory(
      ordered.map((bid) => bid.providerId),
    );

    return {
      ok: true,
      value: ordered.map((bid) => ({
        id: bid.id,
        providerDisplayName: names.get(bid.providerId) ?? "",
        amountMinorUnits: bid.amountMinorUnits,
        currency: bid.currency,
        status: bid.status,
        proposedStartDate: bid.proposedStartDate?.toISOString() ?? null,
        durationDays: bid.durationDays,
        includedCosts: bid.includedCosts,
        exclusions: bid.exclusions,
        conditions: bid.conditions,
        qualifyingSubmittedAt: bid.qualifyingSubmittedAt.toISOString(),
      })),
    };
  };
}

export async function listTenderBids(
  tenderId: string,
  actor: BidActor,
): Promise<Result<readonly ClientBidView[], "TENDER_NOT_FOUND" | "NOT_OWNER">> {
  const [
    { prismaBidRepository },
    { getTenderBiddingContext },
    { getProviderDisplayNames },
  ] = await Promise.all([
    import("../infrastructure/prisma-bid-repository"),
    import("../../tenders/application/get-tender-bidding-context"),
    import("../../profiles/application/get-provider-display-names"),
  ]);
  return createListTenderBids({
    repository: prismaBidRepository,
    tenders: getTenderBiddingContext,
    directory: getProviderDisplayNames,
  })(tenderId, actor);
}
```

Add both repository reads to `PrismaBidRepository`:

```ts
  async listBids(tenderId: string): Promise<readonly Bid[]> {
    const rows = await database.bid.findMany({
      where: { tenderId },
      orderBy: [
        { amountMinorUnits: "asc" },
        { qualifyingSubmittedAt: "asc" },
        { id: "asc" },
      ],
    });
    return rows.map(toBid).filter((bid): bid is Bid => bid !== null);
  }

  async listRankableBids(tenderId: string): Promise<readonly RankableBid[]> {
    const rows = await database.bid.findMany({
      where: { tenderId },
      select: {
        id: true,
        amountMinorUnits: true,
        currency: true,
        status: true,
        qualifyingSubmittedAt: true,
      },
      orderBy: [
        { amountMinorUnits: "asc" },
        { qualifyingSubmittedAt: "asc" },
        { id: "asc" },
      ],
    });
    return rows
      .filter((row) => row.currency === "GEL" || row.currency === "USD")
      .map((row) => ({
        id: row.id,
        amountMinorUnits: row.amountMinorUnits,
        currency: row.currency as BidCurrency,
        status: row.status,
        qualifyingSubmittedAt: row.qualifyingSubmittedAt,
      }));
  }

  async findOwnBid(
    tenderId: string,
    providerId: string,
  ): Promise<Bid | null> {
    const row = await database.bid.findUnique({
      where: { tenderId_providerId: { tenderId, providerId } },
    });
    return row === null ? null : toBid(row);
  }
```

Add `BidSummaryRepository` and `ListTenderBidsRepository` to the `PrismaBidRepository` implements list.

- [ ] **Step 2: Implement the bidding error map**

```ts
// src/modules/bidding/http/map-bidding-error.ts
import type { AuthError } from "../../identity/application/require-capability";
import type { Messages } from "../../localization/get-messages";
import type { ReviseBidError } from "../application/revise-bid";
import type { SubmitBidError } from "../application/submit-bid";
import type { WithdrawBidError } from "../application/withdraw-bid";

export type BiddingErrorCode =
  AuthError | SubmitBidError | ReviseBidError | WithdrawBidError | "NOT_OWNER";

type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`;
}[keyof T & string];

const AUTH_STATUS_BY_ERROR: Readonly<Record<AuthError, number>> = {
  UNAUTHENTICATED: 401,
  EMAIL_UNVERIFIED: 403,
  ONBOARDING_INCOMPLETE: 403,
  ACCOUNT_DISABLED: 403,
  ACCOUNT_RESTRICTED: 403,
  CAPABILITY_MISSING: 403,
};

const BIDDING_STATUS_BY_ERROR: Readonly<
  Record<Exclude<BiddingErrorCode, AuthError>, number>
> = {
  INVALID_INPUT: 400,
  TENDER_NOT_FOUND: 404,
  TENDER_NOT_OPEN: 409,
  DEADLINE_PASSED: 409,
  // Payment Required: the provider can resolve this by buying access, which
  // is materially different from a 403 they can never resolve.
  NOT_ENTITLED: 402,
  OWN_TENDER: 403,
  BID_ALREADY_EXISTS: 409,
  BID_NOT_FOUND: 404,
  BID_NOT_ACTIVE: 409,
  NOT_OWNER: 403,
};

export const BIDDING_ERROR_MESSAGE_KEYS: Readonly<
  Record<BiddingErrorCode, MessageKey<Messages>>
> = {
  UNAUTHENTICATED: "access.unauthenticated",
  EMAIL_UNVERIFIED: "access.emailUnverified",
  ONBOARDING_INCOMPLETE: "access.onboardingIncomplete",
  ACCOUNT_DISABLED: "access.accountDisabled",
  ACCOUNT_RESTRICTED: "access.accountRestricted",
  CAPABILITY_MISSING: "access.capabilityMissing",
  INVALID_INPUT: "errors.invalidInput",
  TENDER_NOT_FOUND: "tenders.errors.notFound",
  TENDER_NOT_OPEN: "bidding.errors.tenderNotOpen",
  DEADLINE_PASSED: "bidding.errors.deadlinePassed",
  NOT_ENTITLED: "entitlements.errors.notEntitled",
  OWN_TENDER: "bidding.errors.ownTender",
  BID_ALREADY_EXISTS: "bidding.errors.bidAlreadyExists",
  BID_NOT_FOUND: "bidding.errors.bidNotFound",
  BID_NOT_ACTIVE: "bidding.errors.bidNotActive",
  NOT_OWNER: "tenders.errors.notOwner",
};

function isAuthError(error: BiddingErrorCode): error is AuthError {
  return Object.hasOwn(AUTH_STATUS_BY_ERROR, error);
}

export function mapBiddingError(error: BiddingErrorCode): Response {
  const status = isAuthError(error)
    ? AUTH_STATUS_BY_ERROR[error]
    : BIDDING_STATUS_BY_ERROR[error];
  return Response.json(
    { code: error, messageKey: BIDDING_ERROR_MESSAGE_KEYS[error] },
    { status },
  );
}
```

- [ ] **Step 3: Write the failing handler tests**

```ts
// src/modules/bidding/http/bid-handlers.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  createBidHandlers,
  createBidSummaryHandlers,
  createOwnBidHandlers,
} from "./bid-handlers";

const provider = async () =>
  ({ ok: true, value: { id: "provider-1" } }) as const;
const customer = async () => ({ ok: true, value: { id: "client-1" } }) as const;
const deniedProvider = async () =>
  ({ ok: false, error: "CAPABILITY_MISSING" }) as const;
const context = { params: Promise.resolve({ id: "tender-1" }) };

describe("createBidHandlers", () => {
  it("submits with the resolved provider, never a body-supplied one", async () => {
    const submit = vi.fn(
      async () => ({ ok: false, error: "NOT_ENTITLED" }) as const,
    );
    const { POST } = createBidHandlers({
      requireProvider: provider,
      requireCustomer: customer,
      submit,
      list: vi.fn(),
    });

    const response = await POST(
      new Request("http://localhost/api/tenders/tender-1/bids", {
        method: "POST",
        body: JSON.stringify({ amountMinorUnits: 1, providerId: "someone" }),
      }),
      { params: Promise.resolve({ id: "tender-1" }) },
    );

    // A provider who has not paid gets 402, which the UI turns into an
    // unlock prompt rather than a dead end.
    expect(response.status).toBe(402);
    expect(submit).toHaveBeenCalledWith(
      "tender-1",
      { amountMinorUnits: 1, providerId: "someone" },
      { id: "provider-1" },
    );
  });

  it("requires the CUSTOMER capability to compare bids", async () => {
    const list = vi.fn(async () => ({ ok: true, value: [] }) as const);
    const { GET } = createBidHandlers({
      requireProvider: deniedProvider,
      requireCustomer: customer,
      submit: vi.fn(),
      list,
    });

    const response = await GET(
      new Request("http://localhost/api/tenders/tender-1/bids"),
      { params: Promise.resolve({ id: "tender-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ bids: [] });
    expect(list).toHaveBeenCalledWith("tender-1", { id: "client-1" });
  });

  it("refuses a comparison request from a non-owner", async () => {
    const { GET } = createBidHandlers({
      requireProvider: provider,
      requireCustomer: customer,
      submit: vi.fn(),
      list: async () => ({ ok: false, error: "NOT_OWNER" }) as const,
    });

    const response = await GET(
      new Request("http://localhost/api/tenders/tender-1/bids"),
      { params: Promise.resolve({ id: "tender-1" }) },
    );

    expect(response.status).toBe(403);
  });
});

describe("createOwnBidHandlers", () => {
  it("maps a post-deadline revision to 409", async () => {
    const { PATCH } = createOwnBidHandlers({
      requireProvider: provider,
      revise: async () => ({ ok: false, error: "DEADLINE_PASSED" }) as const,
      withdraw: vi.fn(),
    });

    const response = await PATCH(
      new Request("http://localhost/api/tenders/tender-1/bids/mine", {
        method: "PATCH",
        body: JSON.stringify({ amountMinorUnits: 1 }),
      }),
      { params: Promise.resolve({ id: "tender-1" }) },
    );

    expect(response.status).toBe(409);
  });

  it("withdraws the caller's own bid without reading a body", async () => {
    const withdraw = vi.fn(
      async () => ({ ok: false, error: "BID_NOT_FOUND" }) as const,
    );
    const { DELETE } = createOwnBidHandlers({
      requireProvider: provider,
      revise: vi.fn(),
      withdraw,
    });

    const response = await DELETE(
      new Request("http://localhost/api/tenders/tender-1/bids/mine", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "tender-1" }) },
    );

    expect(response.status).toBe(404);
    expect(withdraw).toHaveBeenCalledWith("tender-1", { id: "provider-1" });
  });
});

describe("createBidSummaryHandlers", () => {
  it("returns only the count and the lowest amount", async () => {
    const { GET } = createBidSummaryHandlers({
      requireProvider: provider,
      summarize: async () =>
        ({
          ok: true,
          value: {
            bidCount: 3,
            lowestAmountMinorUnits: 42_000,
            currency: "GEL",
          },
        }) as const,
    });

    const response = await GET(
      new Request("http://localhost/api/tenders/tender-1/bids/summary"),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: { bidCount: 3, lowestAmountMinorUnits: 42_000, currency: "GEL" },
    });
  });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `pnpm vitest run src/modules/bidding/http/bid-handlers.test.ts`
Expected: FAIL — `./bid-handlers` does not exist.

- [ ] **Step 5: Implement the handlers**

```ts
// src/modules/bidding/http/bid-handlers.ts
import type { AuthError } from "../../identity/application/require-capability";
import type { Result } from "../../shared";
import type { ClientBidView } from "../application/list-tender-bids";
import type { ReviseBidError } from "../application/revise-bid";
import type { BidActor, SubmitBidError } from "../application/submit-bid";
import type { WithdrawBidError } from "../application/withdraw-bid";
import type { Bid } from "../domain/bid";
import type { BidSummary } from "../domain/bid-summary";
import { mapBiddingError } from "./map-bidding-error";

export type RequireActor = (
  headers: Headers,
) => Promise<Result<BidActor, AuthError>>;

type RouteContext = Readonly<{ params: Promise<Readonly<{ id: string }>> }>;

async function authorize(
  require: RequireActor,
  headers: Headers,
): Promise<BidActor | Response> {
  const access = await require(headers);
  return access.ok ? access.value : mapBiddingError(access.error);
}

export function createBidHandlers({
  requireProvider,
  requireCustomer,
  submit,
  list,
}: Readonly<{
  requireProvider: RequireActor;
  requireCustomer: RequireActor;
  submit: (
    tenderId: string,
    input: unknown,
    actor: BidActor,
  ) => Promise<Result<Bid, SubmitBidError>>;
  list: (
    tenderId: string,
    actor: BidActor,
  ) => Promise<
    Result<readonly ClientBidView[], "TENDER_NOT_FOUND" | "NOT_OWNER">
  >;
}>) {
  return {
    POST: async (
      request: Request,
      context: RouteContext,
    ): Promise<Response> => {
      const actor = await authorize(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const body = await request.json().catch(() => null);
      const result = await submit(id, body, actor);
      return result.ok
        ? Response.json({ bid: result.value })
        : mapBiddingError(result.error);
    },
    // The comparison read requires CUSTOMER: it is the tender owner's view,
    // and ownership is re-checked in the use case rather than inferred from
    // the capability alone.
    GET: async (request: Request, context: RouteContext): Promise<Response> => {
      const actor = await authorize(requireCustomer, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const result = await list(id, actor);
      return result.ok
        ? Response.json({ bids: result.value })
        : mapBiddingError(result.error);
    },
  };
}

export function createOwnBidHandlers({
  requireProvider,
  revise,
  withdraw,
}: Readonly<{
  requireProvider: RequireActor;
  revise: (
    tenderId: string,
    input: unknown,
    actor: BidActor,
  ) => Promise<Result<Bid, ReviseBidError>>;
  withdraw: (
    tenderId: string,
    actor: BidActor,
  ) => Promise<Result<Bid, WithdrawBidError>>;
}>) {
  return {
    PATCH: async (
      request: Request,
      context: RouteContext,
    ): Promise<Response> => {
      const actor = await authorize(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const body = await request.json().catch(() => null);
      const result = await revise(id, body, actor);
      return result.ok
        ? Response.json({ bid: result.value })
        : mapBiddingError(result.error);
    },
    DELETE: async (
      request: Request,
      context: RouteContext,
    ): Promise<Response> => {
      const actor = await authorize(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const result = await withdraw(id, actor);
      return result.ok
        ? Response.json({ bid: result.value })
        : mapBiddingError(result.error);
    },
  };
}

export function createBidSummaryHandlers({
  requireProvider,
  summarize,
}: Readonly<{
  requireProvider: RequireActor;
  summarize: (
    tenderId: string,
  ) => Promise<Result<BidSummary, "TENDER_NOT_FOUND">>;
}>) {
  return {
    GET: async (request: Request, context: RouteContext): Promise<Response> => {
      const actor = await authorize(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const result = await summarize(id);
      return result.ok
        ? Response.json({ summary: result.value })
        : mapBiddingError(result.error);
    },
  };
}
```

- [ ] **Step 6: Wire the three routes**

```ts
// app/api/tenders/[id]/bids/route.ts
import { listTenderBids } from "@/src/modules/bidding/application/list-tender-bids";
import { submitBid } from "@/src/modules/bidding/application/submit-bid";
import { createBidHandlers } from "@/src/modules/bidding/http/bid-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("@/src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};
const requireCustomer = async (headers: Headers) => {
  const { requireCapability } =
    await import("@/src/modules/identity/application/require-capability");
  return requireCapability(headers, "CUSTOMER");
};

export const { POST, GET } = createBidHandlers({
  requireProvider,
  requireCustomer,
  submit: submitBid,
  list: listTenderBids,
});
```

```ts
// app/api/tenders/[id]/bids/mine/route.ts
import { reviseBid } from "@/src/modules/bidding/application/revise-bid";
import { withdrawBid } from "@/src/modules/bidding/application/withdraw-bid";
import { createOwnBidHandlers } from "@/src/modules/bidding/http/bid-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("@/src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { PATCH, DELETE } = createOwnBidHandlers({
  requireProvider,
  revise: reviseBid,
  withdraw: withdrawBid,
});
```

```ts
// app/api/tenders/[id]/bids/summary/route.ts
import { getBidSummary } from "@/src/modules/bidding/application/get-bid-summary";
import { createBidSummaryHandlers } from "@/src/modules/bidding/http/bid-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("@/src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { GET } = createBidSummaryHandlers({
  requireProvider,
  summarize: getBidSummary,
});
```

- [ ] **Step 7: Run the tests and the type/lint layers**

Run: `pnpm vitest run src/modules/bidding && pnpm typecheck && pnpm lint`
Expected: PASS. The `bidding.*` message keys land in Task 13; add the group now if `MessageKey<Messages>` rejects them, using the leaves listed there.

- [ ] **Step 8: Commit**

```bash
git add src/modules/bidding src/modules/profiles app/api/tenders
git commit -m "feat: expose bid submission, comparison, and summary over HTTP"
```

---

### Task 9: Agreement snapshot module and the transactional outbox gateway

**Files:**

- Create: `src/modules/agreements/domain/agreement.ts`
- Create: `src/modules/agreements/domain/agreement.test.ts`
- Create: `src/modules/agreements/infrastructure/prisma-agreement-gateway.ts`
- Create: `src/modules/notifications/domain/outbox-topic.ts`
- Create: `src/modules/notifications/infrastructure/prisma-outbox-gateway.ts`
- Create: `src/modules/notifications/infrastructure/prisma-outbox-gateway.integration.test.ts`

**Interfaces:**

- Consumes: `Prisma.TransactionClient` (infrastructure only).
- Produces: `AgreementStatus`, `AGREEMENT_CONFIRMATION_WINDOW_MS`, `confirmationDeadline`, `AgreementSnapshot`, `AgreementGateway`, `prismaAgreementGateway`, `OUTBOX_TOPICS`, `OutboxTopic`, `OutboxDraft`, `OutboxGateway`, `prismaOutboxGateway`.

- [ ] **Step 1: Write the failing agreement-domain test**

```ts
// src/modules/agreements/domain/agreement.test.ts
import { describe, expect, it } from "vitest";
import {
  AGREEMENT_CONFIRMATION_WINDOW_MS,
  confirmationDeadline,
} from "./agreement";

describe("confirmationDeadline", () => {
  it("gives both parties exactly 48 hours to confirm", () => {
    expect(AGREEMENT_CONFIRMATION_WINDOW_MS).toBe(48 * 60 * 60 * 1000);
    expect(confirmationDeadline(new Date("2026-07-01T09:00:00.000Z"))).toEqual(
      new Date("2026-07-03T09:00:00.000Z"),
    );
  });

  it("does not mutate the instant it is given", () => {
    const now = new Date("2026-07-01T09:00:00.000Z");
    confirmationDeadline(now);
    expect(now.toISOString()).toBe("2026-07-01T09:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails, then implement the domain**

Run: `pnpm vitest run src/modules/agreements/domain/agreement.test.ts`
Expected: FAIL — `./agreement` does not exist.

```ts
// src/modules/agreements/domain/agreement.ts
// Phase 3 creates the snapshot and nothing else. The confirmation, decline,
// start, and completion transitions are Phase 4's; this module deliberately
// declares only the one status Phase 3 can produce, so an unimplemented
// transition cannot be written by accident.
export type AgreementStatus = "PENDING_CONFIRMATION";

// Program design §4.4: the selected provider and client each have 48 hours to
// confirm the snapshot.
export const AGREEMENT_CONFIRMATION_WINDOW_MS = 48 * 60 * 60 * 1000;

// The immutable record of the winning offer, stored as JSON so Phase 4 shows
// both parties exactly the terms that won rather than re-reading a bid row
// that could later change.
export type AgreementSnapshot = Readonly<{
  tenderId: string;
  tenderTitle: string;
  clientId: string;
  providerId: string;
  bidId: string;
  amountMinorUnits: number;
  currency: "GEL" | "USD";
  proposedStartDate: string | null;
  durationDays: number | null;
  includedCosts: string | null;
  exclusions: string | null;
  conditions: string;
}>;

export function confirmationDeadline(now: Date): Date {
  return new Date(now.getTime() + AGREEMENT_CONFIRMATION_WINDOW_MS);
}
```

- [ ] **Step 3: Implement the agreement gateway**

```ts
// src/modules/agreements/infrastructure/prisma-agreement-gateway.ts
import type { Prisma } from "../../../generated/prisma/client";
import {
  confirmationDeadline,
  type AgreementSnapshot,
} from "../domain/agreement";

// The same transaction-participating gateway pattern as
// `prismaTenderSelectionGateway`: `bidding` needs the snapshot created inside
// its selection transaction, and `agreements` stays the only module that
// writes the Agreement table.
export interface AgreementGateway {
  createPending(
    transaction: Prisma.TransactionClient,
    agreementId: string,
    snapshot: AgreementSnapshot,
    now: Date,
  ): Promise<string>;
}

export class PrismaAgreementGateway implements AgreementGateway {
  async createPending(
    transaction: Prisma.TransactionClient,
    agreementId: string,
    snapshot: AgreementSnapshot,
    now: Date,
  ): Promise<string> {
    const created = await transaction.agreement.create({
      data: {
        id: agreementId,
        tenderId: snapshot.tenderId,
        clientId: snapshot.clientId,
        providerId: snapshot.providerId,
        bidId: snapshot.bidId,
        status: "PENDING_CONFIRMATION",
        amountMinorUnits: snapshot.amountMinorUnits,
        currency: snapshot.currency,
        tenderTitle: snapshot.tenderTitle,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        confirmDeadline: confirmationDeadline(now),
      },
      select: { id: true },
    });
    return created.id;
  }
}

export const prismaAgreementGateway = new PrismaAgreementGateway();
```

- [ ] **Step 4: Implement the outbox topics and gateway**

```ts
// src/modules/notifications/domain/outbox-topic.ts
export const OUTBOX_TOPICS = {
  tenderWinnerSelected: "TENDER_WINNER_SELECTED",
  bidWon: "BID_WON",
  bidLost: "BID_LOST",
  tenderExpiredNoBids: "TENDER_EXPIRED_NO_BIDS",
} as const;

export type OutboxTopic = (typeof OUTBOX_TOPICS)[keyof typeof OUTBOX_TOPICS];

export type OutboxDraft = Readonly<{
  topic: OutboxTopic;
  aggregateId: string;
  payload: Readonly<Record<string, string | number | null>>;
}>;
```

```ts
// src/modules/notifications/infrastructure/prisma-outbox-gateway.ts
import type { Prisma } from "../../../generated/prisma/client";
import type { OutboxDraft } from "../domain/outbox-topic";

// Written inside the caller's transaction so a notification cannot exist for
// a state change that rolled back, and a state change cannot commit without
// its notification — the transactional-outbox guarantee the program design
// requires (§3.1).
export interface OutboxGateway {
  enqueue(
    transaction: Prisma.TransactionClient,
    drafts: readonly OutboxDraft[],
    ids: readonly string[],
    now: Date,
  ): Promise<void>;
}

export class PrismaOutboxGateway implements OutboxGateway {
  async enqueue(
    transaction: Prisma.TransactionClient,
    drafts: readonly OutboxDraft[],
    ids: readonly string[],
    now: Date,
  ): Promise<void> {
    if (drafts.length === 0) return;
    if (ids.length !== drafts.length) {
      throw new Error(
        `Outbox enqueue needs one id per draft (${drafts.length} drafts, ${ids.length} ids).`,
      );
    }
    await transaction.outboxMessage.createMany({
      data: drafts.map((draft, index) => ({
        id: ids[index]!,
        topic: draft.topic,
        aggregateId: draft.aggregateId,
        payload: draft.payload as unknown as Prisma.InputJsonValue,
        // Available immediately: Phase 5 introduces the delivery worker and
        // may schedule retries into the future by moving this forward.
        availableAt: now,
      })),
    });
  }
}

export const prismaOutboxGateway = new PrismaOutboxGateway();
```

- [ ] **Step 5: Write the failing outbox integration test**

```ts
// src/modules/notifications/infrastructure/prisma-outbox-gateway.integration.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { OUTBOX_TOPICS } from "../domain/outbox-topic";
import { prismaOutboxGateway } from "./prisma-outbox-gateway";

afterAll(async () => {
  await database.$disconnect();
});

describe("prismaOutboxGateway", () => {
  it("writes every draft inside the caller's transaction", async () => {
    const aggregateId = randomUUID();
    const ids = [randomUUID(), randomUUID()];

    await database.$transaction((transaction) =>
      prismaOutboxGateway.enqueue(
        transaction,
        [
          {
            topic: OUTBOX_TOPICS.bidWon,
            aggregateId,
            payload: { bidId: "bid-1" },
          },
          {
            topic: OUTBOX_TOPICS.bidLost,
            aggregateId,
            payload: { bidId: "bid-2" },
          },
        ],
        ids,
        new Date(),
      ),
    );

    const written = await database.outboxMessage.findMany({
      where: { aggregateId },
      orderBy: { topic: "asc" },
      select: { topic: true, processedAt: true },
    });
    expect(written).toEqual([
      { topic: "BID_LOST", processedAt: null },
      { topic: "BID_WON", processedAt: null },
    ]);
  });

  it("writes nothing when the caller's transaction rolls back", async () => {
    const aggregateId = randomUUID();

    await expect(
      database.$transaction(async (transaction) => {
        await prismaOutboxGateway.enqueue(
          transaction,
          [
            {
              topic: OUTBOX_TOPICS.tenderWinnerSelected,
              aggregateId,
              payload: {},
            },
          ],
          [randomUUID()],
          new Date(),
        );
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    await expect(
      database.outboxMessage.count({ where: { aggregateId } }),
    ).resolves.toBe(0);
  });
});
```

- [ ] **Step 6: Run the integration test**

Run: `pnpm test:integration -- prisma-outbox-gateway`
Expected: PASS — two tests, the second proving the outbox is genuinely transactional.

- [ ] **Step 7: Commit**

```bash
git add src/modules/agreements src/modules/notifications
git commit -m "feat: add agreement snapshot and transactional outbox gateways"
```

---

### Task 10: The deadline selector — one winner, idempotent, transactional

**Files:**

- Create: `src/modules/bidding/application/run-deadline-selection.ts`
- Create: `src/modules/bidding/infrastructure/prisma-selection-repository.ts`
- Create: `src/modules/bidding/application/run-deadline-selection.integration.test.ts`

**Interfaces:**

- Consumes: `selectWinningBid`, `rankBids` (Task 5); `prismaTenderSelectionGateway` (Task 6); `prismaAgreementGateway`, `prismaOutboxGateway`, `OUTBOX_TOPICS` (Task 9).
- Produces: `SelectionOutcome`, `SelectionResult`, `SelectionRepository`, `runDeadlineSelection`, `runDueSelections`, `prismaSelectionRepository`.

- [ ] **Step 1: Implement the selection use case**

```ts
// src/modules/bidding/application/run-deadline-selection.ts
import type { Clock, IdGenerator, Result } from "../../shared";

export type SelectionOutcome = "WINNER_SELECTED" | "EXPIRED_NO_BIDS";

export type SelectionResult = Readonly<{
  tenderId: string;
  outcome: SelectionOutcome;
  winningBidId: string | null;
  agreementId: string | null;
  // True when this call found a selection that had already run. The result is
  // identical either way; the flag exists so the worker can report how much
  // of a sweep was genuinely new without changing the returned result.
  alreadyRan: boolean;
}>;

export type SelectionError = "TENDER_NOT_FOUND" | "NOT_DUE";

export interface SelectionRepository {
  runSelection(
    tenderId: string,
    now: Date,
    ids: IdGenerator,
  ): Promise<Result<SelectionResult, SelectionError>>;
  listDueTenderIds(now: Date, limit: number): Promise<readonly string[]>;
}

// A single sweep never processes more than this many tenders, so one worker
// invocation has a bounded runtime and a stuck tender cannot starve the rest
// forever — the next invocation picks up where this one stopped.
export const MAX_SELECTIONS_PER_SWEEP = 50;

export function createRunDeadlineSelection(dependencies: {
  repository: SelectionRepository;
  clock: Clock;
  ids: IdGenerator;
}) {
  return async function runDeadlineSelection(
    tenderId: string,
  ): Promise<Result<SelectionResult, SelectionError>> {
    return dependencies.repository.runSelection(
      tenderId,
      dependencies.clock.now(),
      dependencies.ids,
    );
  };
}

export function createRunDueSelections(dependencies: {
  repository: SelectionRepository;
  clock: Clock;
  ids: IdGenerator;
}) {
  return async function runDueSelections(
    limit: number = MAX_SELECTIONS_PER_SWEEP,
  ): Promise<readonly SelectionResult[]> {
    const now = dependencies.clock.now();
    const due = await dependencies.repository.listDueTenderIds(now, limit);
    const results: SelectionResult[] = [];
    // Sequential on purpose: each selection takes a row lock, and running the
    // sweep concurrently would only add lock contention against itself while
    // making a partial failure harder to reason about.
    for (const dueTenderId of due) {
      const result = await dependencies.repository.runSelection(
        dueTenderId,
        now,
        dependencies.ids,
      );
      // A tender that stopped being due between the list and the lock (a
      // concurrent worker got there first) is not an error; it simply
      // contributes nothing new to this sweep.
      if (result.ok) results.push(result.value);
    }
    return results;
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function runDeadlineSelection(
  tenderId: string,
): Promise<Result<SelectionResult, SelectionError>> {
  const { prismaSelectionRepository } =
    await import("../infrastructure/prisma-selection-repository");
  return createRunDeadlineSelection({
    repository: prismaSelectionRepository,
    clock: systemClock,
    ids: systemIds,
  })(tenderId);
}

export async function runDueSelections(
  limit: number = MAX_SELECTIONS_PER_SWEEP,
): Promise<readonly SelectionResult[]> {
  const { prismaSelectionRepository } =
    await import("../infrastructure/prisma-selection-repository");
  return createRunDueSelections({
    repository: prismaSelectionRepository,
    clock: systemClock,
    ids: systemIds,
  })(limit);
}
```

- [ ] **Step 2: Implement the selection repository**

```ts
// src/modules/bidding/infrastructure/prisma-selection-repository.ts
import { Prisma } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import { prismaAgreementGateway } from "../../agreements/infrastructure/prisma-agreement-gateway";
import type { AgreementSnapshot } from "../../agreements/domain/agreement";
import {
  OUTBOX_TOPICS,
  type OutboxDraft,
} from "../../notifications/domain/outbox-topic";
import { prismaOutboxGateway } from "../../notifications/infrastructure/prisma-outbox-gateway";
import type { IdGenerator, Result } from "../../shared";
import { prismaTenderSelectionGateway } from "../../tenders/infrastructure/prisma-tender-selection-gateway";
import type {
  SelectionError,
  SelectionRepository,
  SelectionResult,
} from "../application/run-deadline-selection";
import type { BidCurrency, RankableBid } from "../domain/bid";
import { selectWinningBid } from "../domain/ranking";

function toRankable(row: {
  id: string;
  amountMinorUnits: number;
  currency: string;
  status: RankableBid["status"];
  qualifyingSubmittedAt: Date;
}): RankableBid | null {
  if (row.currency !== "GEL" && row.currency !== "USD") return null;
  return {
    id: row.id,
    amountMinorUnits: row.amountMinorUnits,
    currency: row.currency as BidCurrency,
    status: row.status,
    qualifyingSubmittedAt: row.qualifyingSubmittedAt,
  };
}

export class PrismaSelectionRepository implements SelectionRepository {
  async listDueTenderIds(now: Date, limit: number): Promise<readonly string[]> {
    return prismaTenderSelectionGateway.listDueTenderIds(now, limit);
  }

  async runSelection(
    tenderId: string,
    now: Date,
    ids: IdGenerator,
  ): Promise<Result<SelectionResult, SelectionError>> {
    try {
      return await database.$transaction(async (transaction) => {
        // 1. Return the existing result if selection already ran. Read first
        //    so a repeat call is cheap and takes no lock at all.
        const settled = await transaction.tenderSelection.findUnique({
          where: { tenderId },
        });
        if (settled !== null) {
          return {
            ok: true,
            value: {
              tenderId,
              outcome: settled.outcome,
              winningBidId: settled.winningBidId,
              agreementId: settled.agreementId,
              alreadyRan: true,
            },
          } as const;
        }

        // 2. Lock the tender. Concurrent selectors serialize here; the loser
        //    resumes after the winner commits and sees a CLOSED/EXPIRED
        //    tender, i.e. NOT_DUE.
        const locked = await prismaTenderSelectionGateway.lockDueTender(
          transaction,
          tenderId,
          now,
        );
        if (!locked.ok) {
          // The winner may have committed between step 1 and the lock, so
          // re-read before reporting a failure: an already-run selection is a
          // success, not an error.
          const raced = await transaction.tenderSelection.findUnique({
            where: { tenderId },
          });
          if (raced !== null) {
            return {
              ok: true,
              value: {
                tenderId,
                outcome: raced.outcome,
                winningBidId: raced.winningBidId,
                agreementId: raced.agreementId,
                alreadyRan: true,
              },
            } as const;
          }
          return { ok: false, error: locked.error } as const;
        }

        const tender = locked.value;
        const terms = {
          currency: tender.currency,
          deadline: tender.deadline,
        };

        // 3. Load every bid and rank the eligible ones in the domain, not in
        //    SQL: the ordering rule is tested there and must not exist twice.
        const rows = await transaction.bid.findMany({
          where: { tenderId },
          select: {
            id: true,
            providerId: true,
            amountMinorUnits: true,
            currency: true,
            status: true,
            qualifyingSubmittedAt: true,
            proposedStartDate: true,
            durationDays: true,
            includedCosts: true,
            exclusions: true,
            conditions: true,
          },
        });
        const rankable = rows
          .map(toRankable)
          .filter((bid): bid is RankableBid => bid !== null);
        const winner = selectWinningBid(rankable, terms);

        const selectionId = ids.next();
        const auditId = ids.next();

        if (winner === null) {
          // 4a. No eligible bid: the tender expires. No agreement is created
          //     and no bid is promoted — the client may republish.
          await prismaTenderSelectionGateway.closeAfterSelection(
            transaction,
            tenderId,
            "EXPIRED_NO_BIDS",
          );
          await transaction.tenderSelection.create({
            data: {
              id: selectionId,
              tenderId,
              outcome: "EXPIRED_NO_BIDS",
              winningBidId: null,
              agreementId: null,
              ranAt: now,
            },
          });
          const drafts: OutboxDraft[] = [
            {
              topic: OUTBOX_TOPICS.tenderExpiredNoBids,
              aggregateId: tenderId,
              payload: { tenderId, clientId: tender.ownerId },
            },
          ];
          await prismaOutboxGateway.enqueue(
            transaction,
            drafts,
            drafts.map(() => ids.next()),
            now,
          );
          await transaction.auditEvent.create({
            data: {
              id: auditId,
              // System action: no human selects a winner, so there is no
              // actor to record.
              actorId: null,
              action: "TENDER_SELECTION_EXPIRED",
              targetType: "Tender",
              targetId: tenderId,
              correlationId: selectionId,
              metadata: { bidsConsidered: rows.length },
            },
          });
          return {
            ok: true,
            value: {
              tenderId,
              outcome: "EXPIRED_NO_BIDS" as const,
              winningBidId: null,
              agreementId: null,
              alreadyRan: false,
            },
          } as const;
        }

        // 4b. Exactly one WINNER; every other still-submitted bid becomes
        //     LOST. Withdrawn bids keep their own terminal status.
        const winningRow = rows.find((row) => row.id === winner.id)!;
        await transaction.bid.update({
          where: { id: winner.id },
          data: { status: "WINNER" },
        });
        await transaction.bid.updateMany({
          where: { tenderId, status: "SUBMITTED", id: { not: winner.id } },
          data: { status: "LOST" },
        });

        const agreementId = ids.next();
        const snapshot: AgreementSnapshot = {
          tenderId,
          tenderTitle: tender.title,
          clientId: tender.ownerId,
          providerId: winningRow.providerId,
          bidId: winner.id,
          amountMinorUnits: winner.amountMinorUnits,
          currency: winner.currency,
          proposedStartDate:
            winningRow.proposedStartDate?.toISOString() ?? null,
          durationDays: winningRow.durationDays,
          includedCosts: winningRow.includedCosts,
          exclusions: winningRow.exclusions,
          conditions: winningRow.conditions,
        };
        await prismaAgreementGateway.createPending(
          transaction,
          agreementId,
          snapshot,
          now,
        );
        await prismaTenderSelectionGateway.closeAfterSelection(
          transaction,
          tenderId,
          "WINNER_SELECTED",
        );
        await transaction.tenderSelection.create({
          data: {
            id: selectionId,
            tenderId,
            outcome: "WINNER_SELECTED",
            winningBidId: winner.id,
            agreementId,
            ranAt: now,
          },
        });

        const drafts: OutboxDraft[] = [
          {
            topic: OUTBOX_TOPICS.tenderWinnerSelected,
            aggregateId: tenderId,
            payload: { tenderId, clientId: tender.ownerId, agreementId },
          },
          {
            topic: OUTBOX_TOPICS.bidWon,
            aggregateId: tenderId,
            payload: {
              tenderId,
              bidId: winner.id,
              providerId: winningRow.providerId,
              agreementId,
            },
          },
          ...rows
            .filter((row) => row.id !== winner.id && row.status === "SUBMITTED")
            .map((row) => ({
              topic: OUTBOX_TOPICS.bidLost,
              aggregateId: tenderId,
              payload: {
                tenderId,
                bidId: row.id,
                providerId: row.providerId,
              },
            })),
        ];
        await prismaOutboxGateway.enqueue(
          transaction,
          drafts,
          drafts.map(() => ids.next()),
          now,
        );
        await transaction.auditEvent.create({
          data: {
            id: auditId,
            actorId: null,
            action: "TENDER_WINNER_SELECTED",
            targetType: "Tender",
            targetId: tenderId,
            correlationId: selectionId,
            metadata: {
              winningBidId: winner.id,
              amountMinorUnits: winner.amountMinorUnits,
              currency: winner.currency,
              bidsConsidered: rows.length,
            },
          },
        });

        return {
          ok: true,
          value: {
            tenderId,
            outcome: "WINNER_SELECTED" as const,
            winningBidId: winner.id,
            agreementId,
            alreadyRan: false,
          },
        } as const;
      });
    } catch (error) {
      // `TenderSelection.tenderId` is UNIQUE: if two transactions somehow both
      // reach the insert, the database refuses the second. That is a success
      // for the caller — the selection exists — so the committed row is
      // returned rather than the constraint error.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const settled = await database.tenderSelection.findUniqueOrThrow({
          where: { tenderId },
        });
        return {
          ok: true,
          value: {
            tenderId,
            outcome: settled.outcome,
            winningBidId: settled.winningBidId,
            agreementId: settled.agreementId,
            alreadyRan: true,
          },
        };
      }
      throw error;
    }
  }
}

export const prismaSelectionRepository = new PrismaSelectionRepository();
```

- [ ] **Step 3: Write the failing selection integration test**

```ts
// src/modules/bidding/application/run-deadline-selection.integration.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import {
  runDeadlineSelection,
  runDueSelections,
} from "./run-deadline-selection";

const CONDITIONS =
  "Materials and labour included; scaffolding excluded from this price.";

async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: "Party",
      email: `${id}@tender.test`,
      emailVerified: true,
    },
  });
  return id;
}

async function seedDueTender(ownerId: string): Promise<string> {
  const id = randomUUID();
  await database.tender.create({
    data: {
      id,
      ownerId,
      status: "PUBLISHED",
      specialty: "CONSTRUCTION_REPAIR",
      title: "Repaint two rooms",
      shortDescription: "Interior repaint",
      fullDescription: "Sand, prime, and repaint two bedrooms.",
      scopeOfWork: "Sanding, priming, painting",
      budgetMinorUnits: 80_000,
      currency: "GEL",
      // Already due: the deadline is in the past.
      deadline: new Date(Date.now() - 60_000),
      countryCode: "GE",
      locationMode: "ADDRESS",
      city: "Tbilisi",
      addressLine: "1 Chavchavadze Ave",
      exactLatitude: 41.7151,
      exactLongitude: 44.8271,
      publicLatitude: 41.72,
      publicLongitude: 44.83,
      publishedAt: new Date(Date.now() - 120_000),
    },
  });
  return id;
}

async function seedBid(
  tenderId: string,
  amountMinorUnits: number,
  submittedAt: Date,
  overrides: Partial<{
    currency: string;
    status: "SUBMITTED" | "WITHDRAWN";
  }> = {},
): Promise<string> {
  const providerId = await seedUser();
  const id = randomUUID();
  await database.bid.create({
    data: {
      id,
      tenderId,
      providerId,
      amountMinorUnits,
      currency: overrides.currency ?? "GEL",
      status: overrides.status ?? "SUBMITTED",
      conditions: CONDITIONS,
      qualifyingSubmittedAt: submittedAt,
      withdrawnAt: overrides.status === "WITHDRAWN" ? new Date() : null,
    },
  });
  return id;
}

afterAll(async () => {
  await database.$disconnect();
});

describe("runDeadlineSelection", () => {
  it("selects the lowest eligible bid and closes the tender", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    const expensive = await seedBid(
      tenderId,
      90_000,
      new Date(Date.now() - 300_000),
    );
    const cheapest = await seedBid(
      tenderId,
      40_000,
      new Date(Date.now() - 200_000),
    );

    const result = await runDeadlineSelection(tenderId);

    expect(result).toMatchObject({
      ok: true,
      value: {
        outcome: "WINNER_SELECTED",
        winningBidId: cheapest,
        alreadyRan: false,
      },
    });
    await expect(
      database.bid.findUniqueOrThrow({
        where: { id: cheapest },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "WINNER" });
    await expect(
      database.bid.findUniqueOrThrow({
        where: { id: expensive },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "LOST" });
    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: tenderId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "CLOSED" });
  });

  it("breaks an equal amount by the earliest qualifying submission", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    const early = await seedBid(
      tenderId,
      50_000,
      new Date(Date.now() - 400_000),
    );
    await seedBid(tenderId, 50_000, new Date(Date.now() - 200_000));

    const result = await runDeadlineSelection(tenderId);
    expect(result).toMatchObject({ ok: true, value: { winningBidId: early } });
  });

  it("ignores withdrawn and wrong-currency bids", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    await seedBid(tenderId, 1_000, new Date(Date.now() - 400_000), {
      status: "WITHDRAWN",
    });
    await seedBid(tenderId, 2_000, new Date(Date.now() - 400_000), {
      currency: "USD",
    });
    const onlyEligible = await seedBid(
      tenderId,
      70_000,
      new Date(Date.now() - 300_000),
    );

    const result = await runDeadlineSelection(tenderId);
    expect(result).toMatchObject({
      ok: true,
      value: { winningBidId: onlyEligible },
    });
  });

  it("creates exactly one pending agreement snapshot of the winning offer", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    const winnerBid = await seedBid(
      tenderId,
      40_000,
      new Date(Date.now() - 200_000),
    );

    const result = await runDeadlineSelection(tenderId);
    if (!result.ok || result.value.agreementId === null) {
      throw new Error("expected an agreement");
    }

    const agreement = await database.agreement.findUniqueOrThrow({
      where: { id: result.value.agreementId },
    });
    expect(agreement).toMatchObject({
      tenderId,
      clientId,
      bidId: winnerBid,
      status: "PENDING_CONFIRMATION",
      amountMinorUnits: 40_000,
      currency: "GEL",
    });
    // 48 hours, to the minute.
    expect(
      agreement.confirmDeadline.getTime() - agreement.createdAt.getTime(),
    ).toBeGreaterThan(47 * 60 * 60 * 1000);
  });

  it("expires a due tender that received no eligible bid", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);

    const result = await runDeadlineSelection(tenderId);

    expect(result).toMatchObject({
      ok: true,
      value: {
        outcome: "EXPIRED_NO_BIDS",
        winningBidId: null,
        agreementId: null,
      },
    });
    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: tenderId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "EXPIRED" });
    await expect(
      database.agreement.count({ where: { tenderId } }),
    ).resolves.toBe(0);
  });

  it("refuses to run before the deadline", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    await database.tender.update({
      where: { id: tenderId },
      data: { deadline: new Date(Date.now() + 60_000) },
    });

    await expect(runDeadlineSelection(tenderId)).resolves.toEqual({
      ok: false,
      error: "NOT_DUE",
    });
  });

  it("produces one winner, one agreement, and one outbox set under concurrency", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    const cheapest = await seedBid(
      tenderId,
      30_000,
      new Date(Date.now() - 400_000),
    );
    await seedBid(tenderId, 60_000, new Date(Date.now() - 300_000));
    await seedBid(tenderId, 90_000, new Date(Date.now() - 200_000));

    // Eight selectors racing on the same tender, exactly as several worker
    // invocations overlapping in production would.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => runDeadlineSelection(tenderId)),
    );

    for (const result of results) {
      expect(result).toMatchObject({
        ok: true,
        value: { outcome: "WINNER_SELECTED", winningBidId: cheapest },
      });
    }
    await expect(
      database.tenderSelection.count({ where: { tenderId } }),
    ).resolves.toBe(1);
    await expect(
      database.bid.count({ where: { tenderId, status: "WINNER" } }),
    ).resolves.toBe(1);
    await expect(
      database.agreement.count({ where: { tenderId } }),
    ).resolves.toBe(1);
    await expect(
      database.outboxMessage.count({
        where: { aggregateId: tenderId, topic: "BID_WON" },
      }),
    ).resolves.toBe(1);
    await expect(
      database.auditEvent.count({
        where: { targetId: tenderId, action: "TENDER_WINNER_SELECTED" },
      }),
    ).resolves.toBe(1);
  });

  it("re-running returns the existing result with no new side effects", async () => {
    const clientId = await seedUser();
    const tenderId = await seedDueTender(clientId);
    await seedBid(tenderId, 30_000, new Date(Date.now() - 400_000));

    const first = await runDeadlineSelection(tenderId);
    const outboxAfterFirst = await database.outboxMessage.count({
      where: { aggregateId: tenderId },
    });

    const second = await runDeadlineSelection(tenderId);

    expect(second).toMatchObject({ ok: true, value: { alreadyRan: true } });
    if (!first.ok || !second.ok) throw new Error("expected both to succeed");
    expect(second.value.winningBidId).toBe(first.value.winningBidId);
    expect(second.value.agreementId).toBe(first.value.agreementId);
    await expect(
      database.outboxMessage.count({ where: { aggregateId: tenderId } }),
    ).resolves.toBe(outboxAfterFirst);
  });
});

describe("runDueSelections", () => {
  it("settles every due tender and leaves future ones alone", async () => {
    const clientId = await seedUser();
    const dueTender = await seedDueTender(clientId);
    await seedBid(dueTender, 25_000, new Date(Date.now() - 400_000));
    const futureTender = await seedDueTender(clientId);
    await database.tender.update({
      where: { id: futureTender },
      data: { deadline: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });

    const results = await runDueSelections();

    expect(results.some((result) => result.tenderId === dueTender)).toBe(true);
    expect(results.some((result) => result.tenderId === futureTender)).toBe(
      false,
    );
    await expect(
      database.tender.findUniqueOrThrow({
        where: { id: futureTender },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "PUBLISHED" });
  });
});
```

- [ ] **Step 4: Run the selection integration test**

Run: `pnpm test:integration -- run-deadline-selection`
Expected: PASS — nine tests. `vitest.integration.config.ts` sets `fileParallelism: false` and a 30 s timeout, which the eight-way concurrency test comfortably fits inside.

- [ ] **Step 5: Confirm no winner-mutation surface exists**

Run:

```bash
git grep -n "WINNER" -- src app | grep -v "src/modules/bidding/domain" | grep -v "prisma-selection-repository"
```

Expected: only type declarations, view code, and tests. There must be no application function, route handler, or UI control that sets a winner outside `PrismaSelectionRepository.runSelection`. If the search finds one, delete it — the global constraint is absolute.

- [ ] **Step 6: Commit**

```bash
git add src/modules/bidding
git commit -m "feat: select exactly one deadline winner transactionally"
```

---

### Task 11: The selection worker endpoint and its shared secret

**Files:**

- Modify: `src/config/env.ts`
- Modify: `src/config/env.test.ts`
- Modify: `.env.example`
- Modify: `.env.test.example`
- Modify: `playwright.config.ts`
- Create: `src/modules/bidding/http/selection-handlers.ts`
- Create: `src/modules/bidding/http/selection-handlers.test.ts`
- Create: `app/api/tenders/selection/run/route.ts`

**Interfaces:**

- Consumes: `runDueSelections`, `runDeadlineSelection` (Task 10).
- Produces: `SELECTION_WORKER_SECRET` on `ServerEnv`, `SELECTION_WORKER_HEADER`, `createSelectionHandlers`.

- [ ] **Step 1: Add the required secret to the environment schema**

In `src/config/env.ts`, add to `serverEnvSchema`:

```ts
  // Required, not optional: a deployment without it would silently never run
  // winner selection, and the Phase 0 exit criterion forbids a missing-secret
  // fallback in a production build. 32 characters matches AUTH_SECRET.
  SELECTION_WORKER_SECRET: z.string().min(32),
```

Add `SELECTION_WORKER_SECRET: "0123456789012345678901234567890123"` to the `testEnvironment` fixture in `src/config/env.test.ts`, and add this test:

```ts
it("rejects a missing selection worker secret", () => {
  const withoutSecret: NodeJS.ProcessEnv = { ...testEnvironment };
  delete withoutSecret.SELECTION_WORKER_SECRET;
  expect(() => getServerEnv(withoutSecret)).toThrow(/SELECTION_WORKER_SECRET/);
});
```

Add the same key to `.env.example` and `.env.test.example`:

```text
SELECTION_WORKER_SECRET=0123456789012345678901234567890123
```

And to the `webServer.env` block in `playwright.config.ts`, so the browser gate's server can authorize the worker call:

```ts
      SELECTION_WORKER_SECRET: serverEnv.SELECTION_WORKER_SECRET,
```

- [ ] **Step 2: Write the failing worker-handler test**

```ts
// src/modules/bidding/http/selection-handlers.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  SELECTION_WORKER_HEADER,
  createSelectionHandlers,
} from "./selection-handlers";

const secret = "0123456789012345678901234567890123";

function workerRequest(headerValue?: string): Request {
  return new Request("http://localhost/api/tenders/selection/run", {
    method: "POST",
    headers:
      headerValue === undefined
        ? undefined
        : { [SELECTION_WORKER_HEADER]: headerValue },
  });
}

describe("createSelectionHandlers", () => {
  it("rejects a request with no worker secret without running anything", async () => {
    const runDue = vi.fn();
    const { POST } = createSelectionHandlers({ secret, runDue });

    const response = await POST(workerRequest());

    expect(response.status).toBe(401);
    expect(runDue).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret, including one of a different length", async () => {
    const runDue = vi.fn();
    const { POST } = createSelectionHandlers({ secret, runDue });

    expect((await POST(workerRequest("wrong"))).status).toBe(401);
    expect((await POST(workerRequest(`${secret}-extra`))).status).toBe(401);
    expect(runDue).not.toHaveBeenCalled();
  });

  it("runs the sweep and reports what it settled", async () => {
    const runDue = vi.fn(async () => [
      {
        tenderId: "tender-1",
        outcome: "WINNER_SELECTED" as const,
        winningBidId: "bid-1",
        agreementId: "agreement-1",
        alreadyRan: false,
      },
    ]);
    const { POST } = createSelectionHandlers({ secret, runDue });

    const response = await POST(workerRequest(secret));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      selections: [
        {
          tenderId: "tender-1",
          outcome: "WINNER_SELECTED",
          winningBidId: "bid-1",
          agreementId: "agreement-1",
          alreadyRan: false,
        },
      ],
    });
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `pnpm vitest run src/modules/bidding/http/selection-handlers.test.ts`
Expected: FAIL — `./selection-handlers` does not exist.

- [ ] **Step 4: Implement the worker handler**

```ts
// src/modules/bidding/http/selection-handlers.ts
import { timingSafeEqual } from "node:crypto";
import type { SelectionResult } from "../application/run-deadline-selection";

export const SELECTION_WORKER_HEADER = "x-selection-worker-secret";

// Constant-time comparison, and a length check first: `timingSafeEqual`
// throws on differing lengths, and an early `return false` on length is not
// a leak — the secret's length is not secret.
function matchesSecret(presented: string | null, expected: string): boolean {
  if (presented === null) return false;
  const presentedBytes = Buffer.from(presented, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (presentedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(presentedBytes, expectedBytes);
}

export function createSelectionHandlers({
  secret,
  runDue,
}: Readonly<{
  secret: string;
  runDue: () => Promise<readonly SelectionResult[]>;
}>) {
  return {
    POST: async (request: Request): Promise<Response> => {
      if (
        !matchesSecret(request.headers.get(SELECTION_WORKER_HEADER), secret)
      ) {
        // Deliberately terse: an unauthorized caller learns nothing about
        // which tenders are due.
        return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
      }
      return Response.json({ selections: await runDue() });
    },
  };
}
```

```ts
// app/api/tenders/selection/run/route.ts
import { getServerEnv } from "@/src/config/env";
import { runDueSelections } from "@/src/modules/bidding/application/run-deadline-selection";
import { createSelectionHandlers } from "@/src/modules/bidding/http/selection-handlers";

export const { POST } = createSelectionHandlers({
  secret: getServerEnv().SELECTION_WORKER_SECRET,
  runDue: () => runDueSelections(),
});
```

- [ ] **Step 5: Run the tests, type check, and build**

Run: `pnpm vitest run src/modules/bidding/http && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS. The build must not warn about a missing environment variable; if it fails, `.env` is missing `SELECTION_WORKER_SECRET` — add it there too (`.env` is gitignored, so this is a local-only step).

- [ ] **Step 6: Commit**

```bash
git add src/config src/modules/bidding/http app/api/tenders/selection .env.example .env.test.example playwright.config.ts
git commit -m "feat: run deadline selection from an authorized worker endpoint"
```

---

### Task 12: Provider surfaces — unlock, full detail, bid, and outcome

**Files:**

- Create: `src/modules/access/ui/access-checkout-form.tsx`
- Create: `src/modules/access/ui/entitlement-panel.tsx`
- Create: `src/modules/access/ui/entitlement-panel.test.tsx`
- Create: `src/modules/bidding/ui/bid-request.ts`
- Create: `src/modules/bidding/ui/bid-copy.ts`
- Create: `src/modules/bidding/ui/bid-form.tsx`
- Create: `src/modules/bidding/ui/bid-summary-view.tsx`
- Modify: `src/modules/tenders/ui/discovery-detail.tsx`
- Modify: `app/[locale]/(workspace)/provider/tenders/[id]/page.tsx`
- Modify: `app/globals.css`
- Modify: `src/modules/localization/messages/{ka,en}.json`

**Interfaces:**

- Consumes: `ProviderTenderView` (Task 4), `BidSummary` (Task 5), `ACCESS_PRODUCTS` (Task 1), `Field`/`ErrorSummary`/`SubmitButton`/`focusErrorSummary` from `src/modules/identity/ui/identity-form.tsx`.
- Produces: `AccessCheckoutForm`, `AccessCheckoutCopy`, `EntitlementPanel`, `entitlementPanelCopy`, `BidForm`, `BidFormCopy`, `bidFormCopy`, `ExistingBid`, `BidSummaryView`, `submitBidRequest`, `reviseBidRequest`, `withdrawBidRequest`.

- [ ] **Step 1: Add the `entitlements` and `bidding` message groups**

Add to `src/modules/localization/messages/en.json` (and the Georgian equivalents to `ka.json` — authored as first-class Georgian copy, not truncated English):

```json
  "entitlements": {
    "lockedTitle": "Full details are locked",
    "lockedBody": "Buy access to see the exact location, the client's conditions, and any attached files, and to send a free offer.",
    "unlockSingle": "Unlock this tender — USD 1",
    "unlockMonthly": "Monthly access — USD 20",
    "unlockAnnual": "Annual access — USD 200",
    "unlocking": "Opening checkout",
    "confirmPayment": "Confirm test payment",
    "confirmingPayment": "Confirming payment",
    "mockNotice": "Payments are simulated in this release. No card is charged and no money moves.",
    "unlocked": "Full details unlocked.",
    "activeAccess": "Active access",
    "accessSingle": "This tender",
    "accessMonthly": "Monthly access",
    "accessAnnual": "Annual access",
    "accessAdmin": "Administrative inspection",
    "accessExpires": "Active until {date}",
    "accessNoExpiry": "Does not expire",
    "errors": {
      "tenderRequired": "Choose a tender before buying single-tender access.",
      "tenderNotAllowed": "A subscription covers every tender and cannot name one.",
      "alreadyEntitled": "You already have access to this tender.",
      "checkoutNotFound": "That checkout is no longer available. Start again.",
      "notCheckoutOwner": "That checkout belongs to another account.",
      "paymentFailed": "The payment did not complete. Try again.",
      "notEntitled": "Buy access to this tender before continuing."
    }
  },
  "bidding": {
    "summaryTitle": "Current competition",
    "bidCount": "{count} offers",
    "noBidsYet": "No offers yet.",
    "currentLowest": "Current lowest",
    "yourOffer": "Your offer",
    "amount": "Offer amount",
    "amountHint": "The amount you will complete the work for, in the tender's currency.",
    "proposedStartDate": "Proposed start date",
    "durationDays": "Duration in days",
    "includedCosts": "Included costs",
    "exclusions": "Excluded from this price",
    "conditions": "Your conditions",
    "conditionsHint": "Describe what your price covers. At least 30 characters.",
    "submit": "Send offer",
    "submitting": "Sending offer",
    "revise": "Revise offer",
    "revising": "Revising offer",
    "withdraw": "Withdraw offer",
    "withdrawing": "Withdrawing offer",
    "submitted": "Your offer is registered.",
    "revised": "Your revised offer is registered.",
    "withdrawn": "Your offer is withdrawn.",
    "revisionResetsQueue": "A revision takes a new submission time, so an equal price is ranked behind an earlier one.",
    "automaticWinner": "At the deadline the lowest valid offer wins automatically. Neither the client nor an administrator can choose a different one.",
    "comparisonTitle": "Offers received",
    "comparisonEmpty": "No offers have been received yet.",
    "provider": "Provider",
    "submittedAt": "Submitted",
    "status": "Status",
    "statusSubmitted": "Submitted",
    "statusWinner": "Winner",
    "statusLost": "Not selected",
    "statusWithdrawn": "Withdrawn",
    "outcomeWinnerTitle": "This tender has a winner",
    "outcomeExpiredTitle": "This tender expired with no valid offer",
    "outcomeWonBody": "Your offer won. The agreement is awaiting confirmation from both sides.",
    "outcomeLostBody": "Your offer was not the lowest valid offer at the deadline.",
    "errors": {
      "tenderNotOpen": "This tender is no longer open for offers.",
      "deadlinePassed": "The deadline has passed. Offers can no longer be changed.",
      "ownTender": "You cannot send an offer on your own tender.",
      "bidAlreadyExists": "You already have an offer on this tender. Revise it instead.",
      "bidNotFound": "You do not have an offer on this tender.",
      "bidNotActive": "That offer is withdrawn or already settled."
    }
  },
```

Also add two leaves to the existing `tenders` group in both catalogs — `"statusClosed": "Closed"` and `"statusExpired": "Expired"`. `tenderStatusLabel` in `src/modules/tenders/ui/tender-format.ts` takes a total `Record<TenderStatus, string>`, so widening `TenderStatus` in Task 4 makes every call site fail to compile until these exist.

Add `"bidding"` and `"entitlements"` to the required-group list in `src/modules/localization/messages.test.ts`, keeping the array sorted:

```ts
expect(Object.keys(en).sort()).toEqual([
  "access",
  "auth",
  "bidding",
  "common",
  "entitlements",
  "errors",
  "onboarding",
  "profile",
  "tenders",
  "workspace",
]);
```

Run: `pnpm test:unit -- messages`
Expected: PASS — `ka` and `en` must be key-for-key identical with no empty leaf.

- [ ] **Step 2: Write the failing entitlement-panel test**

```tsx
// src/modules/access/ui/entitlement-panel.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import type { Messages } from "../../localization/get-messages";
import { EntitlementPanel, entitlementPanelCopy } from "./entitlement-panel";

const messages = en as Messages;

describe("EntitlementPanel", () => {
  it("states the three prices exactly as the source documents fix them", () => {
    const markup = renderToStaticMarkup(
      <EntitlementPanel
        copy={entitlementPanelCopy(messages)}
        disclosure="MASKED"
        tenderId="tender-1"
      />,
    );

    expect(markup).toContain("USD 1");
    expect(markup).toContain("USD 20");
    expect(markup).toContain("USD 200");
  });

  it("tells the provider payments are simulated", () => {
    const markup = renderToStaticMarkup(
      <EntitlementPanel
        copy={entitlementPanelCopy(messages)}
        disclosure="MASKED"
        tenderId="tender-1"
      />,
    );

    expect(markup).toContain(messages.entitlements.mockNotice);
  });

  it("renders no purchase control once the provider is entitled", () => {
    const markup = renderToStaticMarkup(
      <EntitlementPanel
        copy={entitlementPanelCopy(messages)}
        disclosure="FULL"
        tenderId="tender-1"
      />,
    );

    expect(markup).not.toContain(messages.entitlements.unlockSingle);
    expect(markup).toContain(messages.entitlements.unlocked);
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails, then implement the access UI**

Run: `pnpm vitest run src/modules/access/ui/entitlement-panel.test.tsx`
Expected: FAIL — `./entitlement-panel` does not exist.

```tsx
// src/modules/access/ui/access-checkout-form.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ErrorSummary,
  SubmitButton,
  focusErrorSummary,
  type FormIssue,
} from "../../identity/ui/identity-form";
import type { AccessProductCode } from "../domain/access-product";

export type AccessCheckoutCopy = Readonly<{
  label: string;
  pendingLabel: string;
  summaryOne: string;
  summaryMany: string;
  genericError: string;
  alreadyEntitled: string;
  paymentFailed: string;
  checkoutNotFound: string;
}>;

function responseCode(value: unknown) {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return undefined;
  }
  return typeof value.code === "string" ? value.code : undefined;
}

function checkoutIssue(
  code: string | undefined,
  copy: AccessCheckoutCopy,
  field: string,
): FormIssue {
  const message = {
    ALREADY_ENTITLED: copy.alreadyEntitled,
    PAYMENT_FAILED: copy.paymentFailed,
    CHECKOUT_NOT_FOUND: copy.checkoutNotFound,
    NOT_CHECKOUT_OWNER: copy.checkoutNotFound,
  }[code ?? ""];
  return { field, message: message ?? copy.genericError };
}

export function AccessCheckoutForm({
  copy,
  product,
  tenderId,
}: Readonly<{
  copy: AccessCheckoutCopy;
  product: AccessProductCode;
  tenderId: string;
}>) {
  const router = useRouter();
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [isPending, setIsPending] = useState(false);
  const focusRequest = useRef(false);
  const errorsId = `checkout-errors-${product}`;

  useEffect(() => {
    if (!focusRequest.current || issue === null) return;
    focusRequest.current = false;
    focusErrorSummary(errorsId);
  }, [errorsId, issue]);

  function showIssue(next: FormIssue) {
    focusRequest.current = true;
    setIssue(next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssue(null);
    setIsPending(true);

    try {
      // Two steps on purpose: `checkout` is where a Phase 5 hosted provider
      // will redirect, and `confirm` is where its webhook will land. Keeping
      // both now means swapping the adapter later changes no call site.
      const started = await fetch("/api/access/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product,
          ...(product === "SINGLE_TENDER" ? { tenderId } : {}),
        }),
      });
      if (!started.ok) {
        const body: unknown = await started.json().catch(() => null);
        showIssue(checkoutIssue(responseCode(body), copy, errorsId));
        return;
      }

      const { checkout } = (await started.json()) as {
        checkout: { confirmPath: string };
      };
      const confirmed = await fetch(checkout.confirmPath, { method: "POST" });
      if (!confirmed.ok) {
        const body: unknown = await confirmed.json().catch(() => null);
        showIssue(checkoutIssue(responseCode(body), copy, errorsId));
        return;
      }

      router.refresh();
    } catch {
      showIssue(checkoutIssue(undefined, copy, errorsId));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={onSubmit} noValidate>
      <ErrorSummary
        id={errorsId}
        issues={issue ? [issue] : []}
        summaryOne={copy.summaryOne}
        summaryMany={copy.summaryMany}
      />
      <SubmitButton
        label={copy.label}
        pendingLabel={copy.pendingLabel}
        isPending={isPending}
      />
    </form>
  );
}
```

```tsx
// src/modules/access/ui/entitlement-panel.tsx
import type { Messages } from "../../localization/get-messages";
import type { DisclosureLevel } from "../domain/disclosure-policy";
import {
  AccessCheckoutForm,
  type AccessCheckoutCopy,
} from "./access-checkout-form";

export type EntitlementPanelCopy = Readonly<{
  lockedTitle: string;
  lockedBody: string;
  mockNotice: string;
  unlocked: string;
  single: AccessCheckoutCopy;
  monthly: AccessCheckoutCopy;
  annual: AccessCheckoutCopy;
}>;

// Collected in one place, exactly like `publishTenderCopy` in
// `src/modules/tenders/ui/tender-action-copy.ts`, so the client components
// stay free of the whole message catalog.
export function entitlementPanelCopy(messages: Messages): EntitlementPanelCopy {
  const shared = {
    pendingLabel: messages.entitlements.unlocking,
    summaryOne: messages.errors.summaryOne,
    summaryMany: messages.errors.summaryMany,
    genericError: messages.errors.generic,
    alreadyEntitled: messages.entitlements.errors.alreadyEntitled,
    paymentFailed: messages.entitlements.errors.paymentFailed,
    checkoutNotFound: messages.entitlements.errors.checkoutNotFound,
  };
  return {
    lockedTitle: messages.entitlements.lockedTitle,
    lockedBody: messages.entitlements.lockedBody,
    mockNotice: messages.entitlements.mockNotice,
    unlocked: messages.entitlements.unlocked,
    single: { ...shared, label: messages.entitlements.unlockSingle },
    monthly: { ...shared, label: messages.entitlements.unlockMonthly },
    annual: { ...shared, label: messages.entitlements.unlockAnnual },
  };
}

export function EntitlementPanel({
  copy,
  disclosure,
  tenderId,
}: Readonly<{
  copy: EntitlementPanelCopy;
  disclosure: DisclosureLevel;
  tenderId: string;
}>) {
  if (disclosure === "FULL") {
    return (
      <p className="success-status" role="status">
        {copy.unlocked}
      </p>
    );
  }

  return (
    <section
      className="entitlement-panel"
      aria-labelledby="entitlement-heading"
    >
      <h2 id="entitlement-heading">{copy.lockedTitle}</h2>
      <p>{copy.lockedBody}</p>
      <AccessCheckoutForm
        copy={copy.single}
        product="SINGLE_TENDER"
        tenderId={tenderId}
      />
      <AccessCheckoutForm
        copy={copy.monthly}
        product="MONTHLY_PROVIDER"
        tenderId={tenderId}
      />
      <AccessCheckoutForm
        copy={copy.annual}
        product="ANNUAL_PROVIDER"
        tenderId={tenderId}
      />
      {/*
        Truthful about what this release actually does. Hiding the simulation
        would be the one place in this product where the interface claims
        something that is not true.
      */}
      <p className="field-description">{copy.mockNotice}</p>
    </section>
  );
}
```

- [ ] **Step 4: Implement the bidding UI**

```ts
// src/modules/bidding/ui/bid-request.ts
export type BidFormValues = Readonly<{
  amountMinorUnits: number;
  proposedStartDate?: string;
  durationDays?: number;
  includedCosts?: string;
  exclusions?: string;
  conditions: string;
}>;

export function submitBidRequest(values: BidFormValues): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values),
  };
}

export function reviseBidRequest(values: BidFormValues): RequestInit {
  return {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values),
  };
}

export const withdrawBidRequest: RequestInit = { method: "DELETE" };
```

```tsx
// src/modules/bidding/ui/bid-form.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field } from "../../identity/ui/field";
import {
  ErrorSummary,
  SubmitButton,
  focusErrorSummary,
  type FormIssue,
} from "../../identity/ui/identity-form";
import {
  reviseBidRequest,
  submitBidRequest,
  withdrawBidRequest,
} from "./bid-request";

export type BidFormCopy = Readonly<{
  amount: string;
  amountHint: string;
  proposedStartDate: string;
  durationDays: string;
  includedCosts: string;
  exclusions: string;
  conditions: string;
  conditionsHint: string;
  optional: string;
  submit: string;
  submitting: string;
  revise: string;
  revising: string;
  withdraw: string;
  withdrawing: string;
  submitted: string;
  revised: string;
  withdrawn: string;
  automaticWinner: string;
  revisionResetsQueue: string;
  summaryOne: string;
  summaryMany: string;
  genericError: string;
  errorsByCode: Readonly<Record<string, string>>;
}>;

export type ExistingBid = Readonly<{
  amountMinorUnits: number;
  conditions: string;
  includedCosts: string | null;
  exclusions: string | null;
  durationDays: number | null;
}>;

function responseCode(value: unknown) {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return undefined;
  }
  return typeof value.code === "string" ? value.code : undefined;
}

// Major units in the input, integer minor units on the wire. The rounding
// happens once, here, so no floating-point amount ever reaches the API and
// the platform-wide integer-money rule holds end to end.
function toMinorUnits(major: string): number {
  return Math.round(Number.parseFloat(major) * 100);
}

function optionalText(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length === 0 ? undefined : text;
}

export function BidForm({
  copy,
  existing,
  tenderId,
}: Readonly<{
  copy: BidFormCopy;
  existing: ExistingBid | null;
  tenderId: string;
}>) {
  const router = useRouter();
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const focusRequest = useRef(false);
  const isRevision = existing !== null;

  useEffect(() => {
    if (!focusRequest.current || issue === null) return;
    focusRequest.current = false;
    focusErrorSummary("bid-errors");
  }, [issue]);

  function showIssue(code: string | undefined, field: string) {
    focusRequest.current = true;
    setIssue({
      field,
      message: copy.errorsByCode[code ?? ""] ?? copy.genericError,
    });
  }

  async function send(request: RequestInit, path: string, success: string) {
    setIssue(null);
    setStatus(null);
    setIsPending(true);
    try {
      const response = await fetch(path, request);
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        showIssue(responseCode(body), "bid-amount");
        return;
      }
      setStatus(success);
      router.refresh();
    } catch {
      showIssue(undefined, "bid-amount");
    } finally {
      setIsPending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = toMinorUnits(String(data.get("amount") ?? ""));
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      showIssue("INVALID_INPUT", "bid-amount");
      return;
    }
    const duration = optionalText(data.get("durationDays"));
    const values = {
      amountMinorUnits: amount,
      ...(optionalText(data.get("proposedStartDate")) === undefined
        ? {}
        : { proposedStartDate: String(data.get("proposedStartDate")) }),
      ...(duration === undefined
        ? {}
        : { durationDays: Number.parseInt(duration, 10) }),
      ...(optionalText(data.get("includedCosts")) === undefined
        ? {}
        : { includedCosts: String(data.get("includedCosts")).trim() }),
      ...(optionalText(data.get("exclusions")) === undefined
        ? {}
        : { exclusions: String(data.get("exclusions")).trim() }),
      conditions: String(data.get("conditions") ?? "").trim(),
    };

    await (isRevision
      ? send(
          reviseBidRequest(values),
          `/api/tenders/${tenderId}/bids/mine`,
          copy.revised,
        )
      : send(
          submitBidRequest(values),
          `/api/tenders/${tenderId}/bids`,
          copy.submitted,
        ));
  }

  async function onWithdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await send(
      withdrawBidRequest,
      `/api/tenders/${tenderId}/bids/mine`,
      copy.withdrawn,
    );
  }

  return (
    <>
      <form className="bid-form form-stack" onSubmit={onSubmit} noValidate>
        <ErrorSummary
          id="bid-errors"
          issues={issue ? [issue] : []}
          summaryOne={copy.summaryOne}
          summaryMany={copy.summaryMany}
        />
        <Field
          id="bid-amount"
          label={copy.amount}
          description={copy.amountHint}
        >
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            defaultValue={
              existing === null ? "" : String(existing.amountMinorUnits / 100)
            }
          />
        </Field>
        <Field
          id="bid-start"
          label={copy.proposedStartDate}
          description={copy.optional}
        >
          <input name="proposedStartDate" type="date" />
        </Field>
        <Field
          id="bid-duration"
          label={copy.durationDays}
          description={copy.optional}
        >
          <input
            name="durationDays"
            type="number"
            min="1"
            step="1"
            defaultValue={existing?.durationDays ?? ""}
          />
        </Field>
        <Field
          id="bid-included"
          label={copy.includedCosts}
          description={copy.optional}
        >
          <textarea
            name="includedCosts"
            rows={2}
            defaultValue={existing?.includedCosts ?? ""}
          />
        </Field>
        <Field
          id="bid-exclusions"
          label={copy.exclusions}
          description={copy.optional}
        >
          <textarea
            name="exclusions"
            rows={2}
            defaultValue={existing?.exclusions ?? ""}
          />
        </Field>
        <Field
          id="bid-conditions"
          label={copy.conditions}
          description={copy.conditionsHint}
        >
          <textarea
            name="conditions"
            rows={4}
            required
            minLength={30}
            defaultValue={existing?.conditions ?? ""}
          />
        </Field>
        {/*
          The two facts the provider must have before confirming: the winner is
          automatic, and a revision costs them their queue position.
        */}
        <p className="tender-action-hint">{copy.automaticWinner}</p>
        {isRevision ? (
          <p className="tender-action-hint">{copy.revisionResetsQueue}</p>
        ) : null}
        <SubmitButton
          label={isRevision ? copy.revise : copy.submit}
          pendingLabel={isRevision ? copy.revising : copy.submitting}
          isPending={isPending}
        />
      </form>
      {isRevision ? (
        <form className="form-stack" onSubmit={onWithdraw} noValidate>
          <SubmitButton
            label={copy.withdraw}
            pendingLabel={copy.withdrawing}
            isPending={isPending}
          />
        </form>
      ) : null}
      {status === null ? null : (
        <p className="success-status" role="status">
          {status}
        </p>
      )}
    </>
  );
}
```

```tsx
// src/modules/bidding/ui/bid-summary-view.tsx
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { formatTenderMoney } from "../../tenders/ui/tender-format";
import type { BidSummary } from "../domain/bid-summary";

// Renders exactly what `BidSummary` carries and nothing more. The type has no
// bidder identity, terms, or timestamps in it, and this view must not add any.
export function BidSummaryView({
  locale,
  messages,
  summary,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  summary: BidSummary;
}>) {
  return (
    <section className="bid-summary" aria-labelledby="bid-summary-heading">
      <h2 id="bid-summary-heading">{messages.bidding.summaryTitle}</h2>
      {summary.bidCount === 0 ? (
        <p>{messages.bidding.noBidsYet}</p>
      ) : (
        <dl>
          <div>
            <dt>{messages.bidding.summaryTitle}</dt>
            <dd>
              {messages.bidding.bidCount.replace(
                "{count}",
                String(summary.bidCount),
              )}
            </dd>
          </div>
          <div>
            <dt>{messages.bidding.currentLowest}</dt>
            <dd>
              {formatTenderMoney(
                summary.lowestAmountMinorUnits,
                summary.currency,
                locale,
              )}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Compose the provider detail page**

First widen `DiscoveryDetailContent` in `src/modules/tenders/ui/discovery-detail.tsx` to take the whole view rather than the masked tender, so the masked and full renderings cannot drift apart:

```tsx
export function DiscoveryDetailContent({
  attachments,
  locale,
  messages,
  view,
}: Readonly<{
  attachments?: readonly TenderAttachmentView[];
  locale: Locale;
  messages: Messages;
  view: ProviderTenderView;
}>) {
  const { disclosure, tender } = view;
  const fallback = messages.tenders.notProvided;
  // ...every existing <DetailRow> stays exactly as it is...
  // then, only when entitlement has been proven:
  //   disclosure === "FULL" ? (
  //     <>
  //       <DetailRow label={messages.tenders.addressLine} value={tender.addressLine} />
  //       <DetailRow label={messages.tenders.conditions} value={tender.conditions ?? fallback} />
  //     </>
  //   ) : null
  // and the map switches from the coarse area to the precise pin:
  //   <LocationMap
  //     coordinates={
  //       disclosure === "FULL"
  //         ? { latitude: tender.exactLatitude, longitude: tender.exactLongitude }
  //         : { latitude: tender.publicLatitude, longitude: tender.publicLongitude }
  //     }
  //     precision={disclosure === "FULL" ? "PRECISE" : "APPROXIMATE"}
  //     copy={locationMapCopy(messages)}
  //   />
  // and the attachment list renders only when `attachments` is supplied,
  // reusing the same markup the owner's `TenderAttachments` already uses.
}
```

Then rewrite the page:

```tsx
// app/[locale]/(workspace)/provider/tenders/[id]/page.tsx
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  EntitlementPanel,
  entitlementPanelCopy,
} from "@/src/modules/access/ui/entitlement-panel";
import {
  getBidSummary,
  getOwnBid,
} from "@/src/modules/bidding/application/get-bid-summary";
import { BidForm } from "@/src/modules/bidding/ui/bid-form";
import { BidSummaryView } from "@/src/modules/bidding/ui/bid-summary-view";
import { bidFormCopy } from "@/src/modules/bidding/ui/bid-copy";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { getTenderForProvider } from "@/src/modules/tenders/application/get-tender-for-provider";
import { listEntitledAttachments } from "@/src/modules/tenders/application/list-tender-attachments";
import { DiscoveryDetailContent } from "@/src/modules/tenders/ui/discovery-detail";

export default async function ProviderTenderDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string; locale: string }> }>) {
  const [{ id, locale }, requestHeaders] = await Promise.all([
    params,
    headers(),
  ]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireCapability(requestHeaders, "PROVIDER");
  if (!access.ok) {
    if (access.error === "UNAUTHENTICATED") redirect(`/${locale}/login`);
    return (
      <WorkspaceDenied
        error={access.error}
        locale={locale}
        messages={messages}
      />
    );
  }

  const actor = { id: access.value.id };
  const view = await getTenderForProvider(id, actor);
  if (!view.ok) notFound();

  const [summary, ownBid, attachments] = await Promise.all([
    getBidSummary(id),
    getOwnBid(id, actor),
    view.value.disclosure === "FULL"
      ? listEntitledAttachments(id, actor)
      : Promise.resolve({ ok: false, error: "NOT_ENTITLED" } as const),
  ]);

  const bid = ownBid.ok ? ownBid.value : null;
  const isOpen = view.value.tender.status === "PUBLISHED";

  return (
    <IdentityShell title={view.value.tender.title}>
      <Link className="back-link" href={`/${locale}/provider/tenders`}>
        {messages.tenders.providerBackToList}
      </Link>
      <DiscoveryDetailContent
        attachments={
          attachments.ok ? attachments.value.map(toAttachmentView) : undefined
        }
        locale={locale}
        messages={messages}
        view={view.value}
      />
      <EntitlementPanel
        copy={entitlementPanelCopy(messages)}
        disclosure={view.value.disclosure}
        tenderId={id}
      />
      {summary.ok ? (
        <BidSummaryView
          locale={locale}
          messages={messages}
          summary={summary.value}
        />
      ) : null}
      {view.value.disclosure === "FULL" && isOpen ? (
        <BidForm copy={bidFormCopy(messages)} existing={bid} tenderId={id} />
      ) : null}
      {/*
        The outcome is stated in text, never by colour alone, and it is the
        provider's OWN outcome: a losing bidder is told they lost, not who won.
      */}
      {isOpen ? null : (
        <section className="bid-outcome">
          <h2>
            {view.value.tender.status === "EXPIRED"
              ? messages.bidding.outcomeExpiredTitle
              : messages.bidding.outcomeWinnerTitle}
          </h2>
          {bid?.status === "WINNER" ? (
            <p>{messages.bidding.outcomeWonBody}</p>
          ) : null}
          {bid?.status === "LOST" ? (
            <p>{messages.bidding.outcomeLostBody}</p>
          ) : null}
        </section>
      )}
    </IdentityShell>
  );
}
```

`toAttachmentView` maps an `AttachmentRecord` to the `TenderAttachmentView` the detail component already renders, signing each URL with `getEntitledAttachmentDownload(id, attachment.id, actor, RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS)` — the 15-minute TTL the owner page already uses for links embedded in server-rendered markup. `bidFormCopy(messages)` lives in a new `src/modules/bidding/ui/bid-copy.ts` and collects the `BidFormCopy` leaves, including an `errorsByCode` record mapping every `BiddingErrorCode` to its `messages.bidding.errors.*` string.

Add the supporting classes to `app/globals.css` next to the existing `.tender-detail` / `.discovery-list` rules, using only the tokens already defined in `DESIGN.md`: `.entitlement-panel` (hairline border, 8px radius, flat surface), `.bid-summary`, `.bid-form`, and `.bid-outcome`. Emerald only for a won outcome, red only for a repair state, and every status must carry text — never color alone.

- [ ] **Step 6: Run the UI tests and the accessibility-sensitive checks**

Run: `pnpm vitest run src/modules/access src/modules/bidding src/modules/tenders && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS. `src/modules/tenders/ui/discovery-ui.test.tsx` renders `DiscoveryDetailContent` with the old `tender` prop and must be updated to pass `view={{ disclosure: "MASKED", tender }}`. Update the call, not the assertions: every existing masking assertion in that file must still hold, and a second case asserting the `FULL` branch renders the exact address is worth adding while the file is open.

- [ ] **Step 7: Commit**

```bash
git add src/modules/access/ui src/modules/bidding/ui src/modules/tenders/ui src/modules/localization app/[locale] app/globals.css
git commit -m "feat: let an entitled provider unlock, bid, and see the outcome"
```

---

### Task 13: Client surfaces — bid comparison and the automatic outcome

**Files:**

- Create: `src/modules/bidding/ui/bid-comparison.tsx`
- Create: `src/modules/bidding/ui/bid-comparison.test.tsx`
- Modify: `app/[locale]/(workspace)/client/tenders/[id]/page.tsx`
- Modify: `src/modules/tenders/ui/tender-detail.tsx`
- Modify: `app/globals.css`

**Interfaces:**

- Consumes: `listTenderBids`, `ClientBidView` (Task 8); `Messages`.
- Produces: `BidComparison`, `bidComparisonCopy`.

- [ ] **Step 1: Write the failing comparison test**

```tsx
// src/modules/bidding/ui/bid-comparison.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import type { Messages } from "../../localization/get-messages";
import type { ClientBidView } from "../application/list-tender-bids";
import { BidComparison, bidComparisonCopy } from "./bid-comparison";

const messages = en as Messages;

const bids: ClientBidView[] = [
  {
    id: "bid-cheap",
    providerDisplayName: "Alpha Builders",
    amountMinorUnits: 40_000,
    currency: "GEL",
    status: "SUBMITTED",
    proposedStartDate: null,
    durationDays: 14,
    includedCosts: "Paint and labour",
    exclusions: "Scaffolding",
    conditions: "Weekday work only, materials included in the quoted price.",
    qualifyingSubmittedAt: "2026-06-10T09:00:00.000Z",
  },
  {
    id: "bid-expensive",
    providerDisplayName: "Beta Repairs",
    amountMinorUnits: 90_000,
    currency: "GEL",
    status: "SUBMITTED",
    proposedStartDate: null,
    durationDays: null,
    includedCosts: null,
    exclusions: null,
    conditions: "Full service including all materials and site cleanup.",
    qualifyingSubmittedAt: "2026-06-11T09:00:00.000Z",
  },
];

describe("BidComparison", () => {
  it("lists offers in the ranked order the selector will use", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={bids}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    expect(markup.indexOf("Alpha Builders")).toBeLessThan(
      markup.indexOf("Beta Repairs"),
    );
  });

  it("states that the winner is chosen automatically", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={bids}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    expect(markup).toContain(messages.bidding.automaticWinner);
  });

  it("offers the client no control that selects a provider", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={bids}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    // The single most important assertion on this surface: there is no
    // button, no form, and no link through which a client could choose.
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("<form");
  });

  it("renders a truthful empty state rather than sample offers", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={[]}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    expect(markup).toContain(messages.bidding.comparisonEmpty);
    expect(markup).not.toContain("Alpha Builders");
  });

  it("communicates status with text, not colour alone", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={[{ ...bids[0]!, status: "WINNER" }]}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    expect(markup).toContain(messages.bidding.statusWinner);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails, then implement the comparison**

Run: `pnpm vitest run src/modules/bidding/ui/bid-comparison.test.tsx`
Expected: FAIL — `./bid-comparison` does not exist.

```tsx
// src/modules/bidding/ui/bid-comparison.tsx
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import {
  formatTenderDate,
  formatTenderMoney,
} from "../../tenders/ui/tender-format";
import type { ClientBidView } from "../application/list-tender-bids";
import type { BidStatus } from "../domain/bid";

export type BidComparisonCopy = Readonly<{
  title: string;
  empty: string;
  automaticWinner: string;
  provider: string;
  amount: string;
  durationDays: string;
  includedCosts: string;
  exclusions: string;
  conditions: string;
  submittedAt: string;
  status: string;
  notProvided: string;
  statusLabels: Readonly<Record<BidStatus, string>>;
}>;

export function bidComparisonCopy(messages: Messages): BidComparisonCopy {
  return {
    title: messages.bidding.comparisonTitle,
    empty: messages.bidding.comparisonEmpty,
    automaticWinner: messages.bidding.automaticWinner,
    provider: messages.bidding.provider,
    amount: messages.bidding.amount,
    durationDays: messages.bidding.durationDays,
    includedCosts: messages.bidding.includedCosts,
    exclusions: messages.bidding.exclusions,
    conditions: messages.bidding.conditions,
    submittedAt: messages.bidding.submittedAt,
    status: messages.bidding.status,
    notProvided: messages.tenders.notProvided,
    statusLabels: {
      SUBMITTED: messages.bidding.statusSubmitted,
      WINNER: messages.bidding.statusWinner,
      LOST: messages.bidding.statusLost,
      WITHDRAWN: messages.bidding.statusWithdrawn,
    },
  };
}

// A server component with no interactive element at all. That is the point:
// the client may compare offers and may not choose one, and the surest way to
// guarantee that is for this view to contain no control that could.
//
// One DOM structure, not two. The table reflows into labelled cards at 608px
// through the `data-label` attributes below, rather than by rendering a second
// copy of every row — a duplicate would put each provider's name and amount on
// the page twice for screen readers and for tests.
export function BidComparison({
  bids,
  copy,
  locale,
}: Readonly<{
  bids: readonly ClientBidView[];
  copy: BidComparisonCopy;
  locale: Locale;
}>) {
  return (
    <section
      className="bid-comparison"
      aria-labelledby="bid-comparison-heading"
    >
      <h2 id="bid-comparison-heading">{copy.title}</h2>
      <p className="tender-action-hint">{copy.automaticWinner}</p>
      {bids.length === 0 ? (
        <p>{copy.empty}</p>
      ) : (
        <div className="bid-comparison-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{copy.provider}</th>
                <th scope="col">{copy.amount}</th>
                <th scope="col">{copy.durationDays}</th>
                <th scope="col">{copy.includedCosts}</th>
                <th scope="col">{copy.exclusions}</th>
                <th scope="col">{copy.conditions}</th>
                <th scope="col">{copy.submittedAt}</th>
                <th scope="col">{copy.status}</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <tr key={bid.id}>
                  <th scope="row" data-label={copy.provider}>
                    {bid.providerDisplayName}
                  </th>
                  <td data-label={copy.amount}>
                    {formatTenderMoney(
                      bid.amountMinorUnits,
                      bid.currency,
                      locale,
                    )}
                  </td>
                  <td data-label={copy.durationDays}>
                    {bid.durationDays ?? copy.notProvided}
                  </td>
                  <td data-label={copy.includedCosts}>
                    {bid.includedCosts ?? copy.notProvided}
                  </td>
                  <td data-label={copy.exclusions}>
                    {bid.exclusions ?? copy.notProvided}
                  </td>
                  <td data-label={copy.conditions}>{bid.conditions}</td>
                  <td data-label={copy.submittedAt}>
                    {formatTenderDate(bid.qualifyingSubmittedAt, locale) ??
                      copy.notProvided}
                  </td>
                  {/* Status is text, never colour alone. */}
                  <td data-label={copy.status}>
                    {copy.statusLabels[bid.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

Add the styles to `app/globals.css`: `.bid-comparison-scroll { overflow-x: auto; }` for wide screens, and a `@media (max-width: 608px)` block that sets the table, its rows, and its cells to `display: block`, hides `thead`, and renders each cell's `data-label` through `td::before` / `th[scope="row"]::before` — the labelled-card presentation at narrow width, from the same single DOM.

- [ ] **Step 3: Compose the client tender detail page**

In `app/[locale]/(workspace)/client/tenders/[id]/page.tsx`, after the existing `getOwnedTender` call, fetch `listTenderBids(id, routeAccess.actor)` and pass the result into `TenderDetail` as a new optional `comparison` slot rendered below the existing detail list. Render nothing extra when the tender is still a `DRAFT` (there can be no offers). When the tender is `CLOSED`, render `messages.bidding.outcomeWinnerTitle` above the table; when `EXPIRED`, render `messages.bidding.outcomeExpiredTitle`.

`TenderDetail` already accepts optional `ReactNode` slots (`cancelControl`, `publishControl`); add `comparison?: ReactNode` in the same style rather than passing bid data into the tenders module.

- [ ] **Step 4: Confirm the cancel control disappears once offers exist**

The Phase 2 cancel form is still rendered for a `PUBLISHED` tender. Because Task 7 made the command reject with `TENDER_HAS_BIDS`, hide the control when `bids.length > 0` and render `messages.tenders.errors.tenderHasBids` in its place. Hiding a control is never authorization — the server-side rejection from Task 7 is what enforces the rule; this only stops the UI from offering an action that must fail.

- [ ] **Step 5: Run the tests and the build**

Run: `pnpm vitest run src/modules/bidding/ui && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/bidding/ui src/modules/tenders/ui app/[locale] app/globals.css
git commit -m "feat: let a client compare offers without choosing one"
```

---

### Task 14: Phase 3 fixtures, browser journeys, CI job, and the phase gate

**Files:**

- Create: `scripts/seed-phase-03.ts`
- Create: `src/test/e2e/fixtures/bidding.ts`
- Create: `src/test/e2e/phase-03-access.spec.ts`
- Create: `src/test/e2e/phase-03-selection.spec.ts`
- Modify: `package.json`
- Modify: `.github/workflows/verify.yml`
- Modify: `docs/development.md`

**Interfaces:**

- Consumes: every use case and route from Tasks 1–13.
- Produces: `pnpm seed:phase-3`, `pnpm verify:phase-3`, the `@phase-3` browser suite, and the CI `phase-3` job.

- [ ] **Step 1: Write the seed script**

```ts
// scripts/seed-phase-03.ts
import "dotenv/config";
import { getTestDatabaseServerEnv } from "../src/config/test-database-url";

const CLIENT_EMAIL = "phase1.client@tender.test";
const PROVIDER_A_EMAIL = "phase1.provider@tender.test";

// Phase 1 seeds one provider; the deadline journey needs three competing
// bidders, so this script creates the two extra accounts itself, through the
// same public interfaces (Better Auth sign-up plus the onboarding use case)
// that a real registration uses.
const EXTRA_PROVIDERS = [
  {
    key: "providerB",
    email: "phase3.provider.b@tender.test",
    name: "Seeded Provider B",
    phone: "+995555030002",
  },
  {
    key: "providerC",
    email: "phase3.provider.c@tender.test",
    name: "Seeded Provider C",
    phone: "+995555030003",
  },
] as const;

// Every tender this phase owns is titled "Phase 3 ...", including the ones the
// browser journeys publish for themselves. Deleting by that prefix (not by
// owner) keeps the Phase 2 seed's tenders intact, so `verify:phase-3` can seed
// both phases in order, and stops journey tenders accumulating across runs.
const PHASE_3_TITLE_PREFIX = "Phase 3 ";
const DUE_TENDER_TITLE = "Phase 3 tender whose deadline has passed";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const CONDITIONS =
  "Materials and labour are included; scaffolding is excluded from this price.";

function requiredPassword(): string {
  const password = process.env.PHASE_1_SEED_PASSWORD;
  if (password === undefined || password.length < 12) {
    throw new Error(
      "PHASE_1_SEED_PASSWORD must contain at least 12 random characters",
    );
  }
  return password;
}

async function main(): Promise<void> {
  const serverEnv = getTestDatabaseServerEnv(process.env);
  if (serverEnv.NODE_ENV === "production") {
    throw new Error("Phase 3 test seeding is unavailable in production");
  }
  process.env.DATABASE_URL = serverEnv.DATABASE_URL_TEST;

  const [
    { auth },
    { database },
    { completeOnboarding },
    { createTenderDraft },
    { updateTenderDraft },
    { syncTenderLocation },
    { publishTender },
    { startAccessCheckout },
    { confirmAccessCheckout },
    { submitBid },
  ] = await Promise.all([
    import("../src/modules/identity/infrastructure/auth"),
    import("../src/infrastructure/db/client"),
    import("../src/modules/profiles/application/complete-onboarding"),
    import("../src/modules/tenders/application/create-tender-draft"),
    import("../src/modules/tenders/application/update-tender-draft"),
    import("../src/modules/tenders/application/sync-tender-location"),
    import("../src/modules/tenders/application/publish-tender"),
    import("../src/modules/access/application/start-access-checkout"),
    import("../src/modules/access/application/confirm-access-checkout"),
    import("../src/modules/bidding/application/submit-bid"),
  ]);
  const password = requiredPassword();

  try {
    const client = await database.user
      .findUniqueOrThrow({
        where: { email: CLIENT_EMAIL },
        select: { id: true },
      })
      .catch(() => {
        throw new Error(
          `Phase 1 seeded account (${CLIENT_EMAIL}) not found. Run \`pnpm seed:phase-1\` first.`,
        );
      });
    const actor = { id: client.id };

    // Re-runnable: drop only this script's own tenders and provider accounts.
    await database.tender.deleteMany({
      where: { title: { startsWith: PHASE_3_TITLE_PREFIX } },
    });
    await database.user.deleteMany({
      where: { email: { in: EXTRA_PROVIDERS.map(({ email }) => email) } },
    });

    // Bidder order matters below: the Phase 1 provider bids highest, so the
    // browser gate has a loser whose account already exists in every phase.
    const providerA = await database.user.findUniqueOrThrow({
      where: { email: PROVIDER_A_EMAIL },
      select: { id: true },
    });
    const providerIds: string[] = [providerA.id];
    for (const spec of EXTRA_PROVIDERS) {
      await auth.api.signUpEmail({
        body: { email: spec.email, name: spec.name, password },
      });
      const user = await database.user.update({
        where: { email: spec.email },
        data: { emailVerified: true },
        select: { id: true },
      });
      const onboarded = await completeOnboarding(
        {
          intent: "CONSTRUCTION_PROVIDER",
          accountKind: "COMPANY",
          displayName: spec.name,
          phoneE164: spec.phone,
          countryCode: "GE",
          city: "Tbilisi",
          activityDescription: "Seeded construction and repair services",
          preferredLocale: "en",
          preferredCurrency: "GEL",
        },
        { id: user.id, emailVerified: true },
      );
      if (!onboarded.ok) {
        throw new Error(`Could not onboard ${spec.key}: ${onboarded.error}`);
      }
      providerIds.push(user.id);
    }

    async function publishTenderNamed(title: string): Promise<string> {
      const draft = await createTenderDraft(
        { specialty: "CONSTRUCTION_REPAIR", title },
        actor,
      );
      if (!draft.ok) throw new Error(`Failed to draft "${title}"`);
      const updated = await updateTenderDraft(
        draft.value.id,
        {
          shortDescription: "Repaint and refinish a two-bedroom flat",
          fullDescription:
            "Strip old finishes, repair walls, and repaint throughout a " +
            "two-bedroom apartment.",
          scopeOfWork:
            "Demolition of old finishes, wall repair, and painting across " +
            "two bedrooms and a hallway.",
          budgetMinorUnits: 450_000,
          currency: "GEL",
          deadline: new Date(Date.now() + THIRTY_DAYS_MS),
          conditions: "Work must be completed on weekdays between 9am and 5pm.",
        },
        actor,
      );
      if (!updated.ok) throw new Error(`Failed to complete "${title}"`);
      const located = await syncTenderLocation(
        draft.value.id,
        {
          mode: "ADDRESS",
          city: "Tbilisi",
          district: null,
          addressLine: "12 Rustaveli Avenue",
        },
        actor,
      );
      if (!located.ok) throw new Error(`Failed to locate "${title}"`);
      const published = await publishTender(draft.value.id, actor);
      if (!published.ok) throw new Error(`Failed to publish "${title}"`);
      return draft.value.id;
    }

    async function entitle(
      providerId: string,
      tenderId: string,
    ): Promise<void> {
      const checkout = await startAccessCheckout(
        { product: "SINGLE_TENDER", tenderId },
        { id: providerId },
      );
      if (!checkout.ok) {
        throw new Error(`Failed to start checkout: ${checkout.error}`);
      }
      const confirmed = await confirmAccessCheckout(checkout.value.checkoutId, {
        id: providerId,
      });
      if (!confirmed.ok) {
        throw new Error(`Failed to confirm checkout: ${confirmed.error}`);
      }
    }

    // One tender, with three competing offers, whose deadline has already
    // passed — so the selection journey can run the worker immediately. The
    // access journey publishes its own tender per run rather than sharing
    // this one, because buying access and bidding are not repeatable against
    // a single fixture.
    const dueTenderId = await publishTenderNamed(DUE_TENDER_TITLE);
    const amounts = [420_000, 380_000, 400_000];
    for (const [index, providerId] of providerIds.entries()) {
      await entitle(providerId, dueTenderId);
      const bid = await submitBid(
        dueTenderId,
        { amountMinorUnits: amounts[index]!, conditions: CONDITIONS },
        { id: providerId },
      );
      if (!bid.ok) throw new Error(`Failed to seed bid ${index}: ${bid.error}`);
    }

    // The one fixture-only write in this script, and the reason it is safe:
    // every bid above was submitted through the real use case while the
    // deadline was still in the future. Moving the deadline afterwards makes
    // the tender due without weakening a single application rule — the same
    // pattern seed-phase-01.ts uses for restricted/disabled fixture state.
    await database.tender.update({
      where: { id: dueTenderId },
      data: { deadline: new Date(Date.now() - 60_000) },
    });

    console.log(
      `Seeded 1 due Phase 3 tender, ${EXTRA_PROVIDERS.length} extra providers, and 3 offers.`,
    );
  } finally {
    await database.$disconnect();
  }
}

await main();
```

- [ ] **Step 2: Write the E2E fixtures**

```ts
// src/test/e2e/fixtures/bidding.ts
import type { APIRequestContext, Browser, Page } from "@playwright/test";
import type { Locale } from "../../../modules/localization/config";
import { signInSeededAccount } from "./accounts";

export const PHASE_3_DUE_TENDER = "Phase 3 tender whose deadline has passed";

export const PHASE_3_PROVIDERS = {
  b: "phase3.provider.b@tender.test",
  c: "phase3.provider.c@tender.test",
} as const;

// The three seeded amounts. The cheapest is the SECOND bid submitted, on
// purpose, so "the winner" is never simply "the first" or "the last" offer.
export const PHASE_3_BID_AMOUNTS = {
  providerA: 420_000,
  providerB: 380_000,
  providerC: 400_000,
} as const;
export const PHASE_3_WINNING_AMOUNT = PHASE_3_BID_AMOUNTS.providerB;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Same reason as `warmUpDevServer` in ./tenders.ts: outside CI Playwright runs
// `next dev`, which compiles each route on its first hit, and a bare
// `expect(...)` has a 5-second default timeout.
const WARM_UP_ROUTES = [
  "/continue",
  "/provider/tenders",
  "/provider/tenders/00000000-0000-0000-0000-000000000000",
  "/client/tenders",
] as const;

export async function warmUpBiddingRoutes(
  request: APIRequestContext,
): Promise<void> {
  for (const locale of ["ka", "en"] as const) {
    for (const route of WARM_UP_ROUTES) {
      await request.get(`/${locale}${route}`);
    }
  }
  // The worker route is not a page, but it compiles on first hit too, and an
  // unauthenticated POST is a cheap 401 that forces that compile.
  await request.post("/api/tenders/selection/run");
}

export function selectionWorkerSecret(): string {
  const secret = process.env.SELECTION_WORKER_SECRET;
  if (secret === undefined || secret.length < 32) {
    throw new Error(
      "SELECTION_WORKER_SECRET must contain at least 32 characters",
    );
  }
  return secret;
}

// Publishes a fresh, uniquely titled tender as the seeded client, through the
// real API, in its own browser context.
//
// The access journey buys access and sends an offer, so it CANNOT run twice
// against one seeded tender — and it runs four times (ka/en x desktop/mobile).
// Creating its own tender per run makes it repeatable and independent of
// whether any other spec has already run.
export async function publishTenderAsClient(
  browser: Browser,
  locale: Locale,
  title: string,
): Promise<string> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInSeededAccount(page, "client", locale);

    const created = await page.request.post("/api/tenders", {
      data: { specialty: "CONSTRUCTION_REPAIR", title },
    });
    if (!created.ok()) {
      throw new Error(`Could not create "${title}": ${created.status()}`);
    }
    const { tender } = (await created.json()) as { tender: { id: string } };

    const updated = await page.request.patch(`/api/tenders/${tender.id}`, {
      data: {
        shortDescription: "Repaint and refinish a two-bedroom flat",
        fullDescription:
          "Strip old finishes, repair walls, and repaint throughout a " +
          "two-bedroom apartment.",
        scopeOfWork:
          "Demolition of old finishes, wall repair, and painting across " +
          "two bedrooms and a hallway.",
        budgetMinorUnits: 450_000,
        currency: "GEL",
        deadline: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        conditions: "Work must be completed on weekdays between 9am and 5pm.",
      },
    });
    if (!updated.ok()) {
      throw new Error(`Could not complete "${title}": ${updated.status()}`);
    }

    const located = await page.request.patch(
      `/api/tenders/${tender.id}/location`,
      {
        data: {
          mode: "ADDRESS",
          city: "Tbilisi",
          district: null,
          addressLine: "12 Rustaveli Avenue",
        },
      },
    );
    if (!located.ok()) {
      throw new Error(`Could not locate "${title}": ${located.status()}`);
    }

    const published = await page.request.post(
      `/api/tenders/${tender.id}/publish`,
    );
    if (!published.ok()) {
      throw new Error(`Could not publish "${title}": ${published.status()}`);
    }
    return tender.id;
  } finally {
    await context.close();
  }
}

// Resolves a seeded tender's id from its title, for a page already signed in
// as its OWNER. `GET /api/tenders` lists only the caller's own tenders, which
// is the only place a settled tender's id is still discoverable — discovery
// deliberately drops it once the deadline passes.
export async function findOwnedTenderIdByTitle(
  page: Page,
  title: string,
): Promise<string> {
  const response = await page.request.get("/api/tenders");
  if (!response.ok()) {
    throw new Error(`Could not list owned tenders: ${response.status()}`);
  }
  const { tenders } = (await response.json()) as {
    tenders: ReadonlyArray<{ id: string; title: string }>;
  };
  const match = tenders.find((tender) => tender.title === title);
  if (match === undefined) {
    throw new Error(
      `No seeded tender titled "${title}". Run \`pnpm seed:phase-3\` first.`,
    );
  }
  return match.id;
}
```

- [ ] **Step 3: Write the access journey**

```ts
// src/test/e2e/phase-03-access.spec.ts
import { expect, test } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";
import { SEEDED_CLIENT } from "./fixtures/tenders";
import { publishTenderAsClient, warmUpBiddingRoutes } from "./fixtures/bidding";

test.beforeAll(async ({ request }) => {
  await warmUpBiddingRoutes(request);
});

for (const locale of ["ka", "en"] as const) {
  const messages = messagesFor(locale);

  test(`@phase-3 a provider unlocks a tender, offers, and revises (${locale})`, async ({
    browser,
    page,
  }, testInfo) => {
    // Its own tender per run: this test buys access and sends an offer, and
    // it runs once per locale per project. A shared seeded tender would make
    // the second run hit ALREADY_ENTITLED and BID_ALREADY_EXISTS.
    const title = `Phase 3 unlock journey ${locale} ${testInfo.project.name}`;
    const tenderId = await publishTenderAsClient(browser, locale, title);

    await signInSeededAccount(page, "provider", locale);
    await page.goto(`/${locale}/provider/tenders/${tenderId}`);

    // Establish identity BEFORE any negative assertion, so the locked-state
    // checks cannot pass against a page that never loaded.
    await expect(page.locator("h1")).toContainText(title);

    // Locked: no bid form, and the exact address is absent.
    await expect(
      page.getByRole("button", { name: messages.bidding.submit }),
    ).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("12 Rustaveli Avenue");
    await expect(page.locator("body")).not.toContainText(SEEDED_CLIENT.email);
    await expect(
      page.getByText(messages.entitlements.mockNotice),
    ).toBeVisible();

    // Unlock through the two-step mock checkout.
    await page
      .getByRole("button", { name: messages.entitlements.unlockSingle })
      .click();
    await expect(page.getByText("12 Rustaveli Avenue")).toBeVisible({
      timeout: 15_000,
    });

    // Sending an offer is free once access is held.
    await page
      .getByLabel(messages.bidding.amount, { exact: true })
      .fill("3900");
    await page
      .getByLabel(messages.bidding.conditions, { exact: true })
      .fill(
        "Materials and labour are included; scaffolding is excluded from this price.",
      );
    await page.getByRole("button", { name: messages.bidding.submit }).click();
    await expect(page.getByRole("status")).toHaveText(
      messages.bidding.submitted,
      { timeout: 15_000 },
    );

    // A second offer is refused, so revision is the only way to change a
    // price — and the revision itself must be accepted before the deadline.
    await expect(
      page.getByRole("button", { name: messages.bidding.submit }),
    ).toHaveCount(0);
    await expect(
      page.getByText(messages.bidding.revisionResetsQueue),
    ).toBeVisible();
    await page
      .getByLabel(messages.bidding.amount, { exact: true })
      .fill("3600");
    await page.getByRole("button", { name: messages.bidding.revise }).click();
    await expect(page.getByRole("status")).toHaveText(
      messages.bidding.revised,
      {
        timeout: 15_000,
      },
    );

    // The competing-offer summary exists and still names nobody. The amount
    // itself is asserted through the API rather than the rendered string,
    // because `Intl.NumberFormat` groups and places the currency symbol
    // differently in ka and en.
    await expect(page.locator(".bid-summary")).toBeVisible();
    await expect(page.locator(".bid-summary")).not.toContainText(
      SEEDED_CLIENT.name,
    );
    const summary = await page.request.get(
      `/api/tenders/${tenderId}/bids/summary`,
    );
    expect(summary.status()).toBe(200);
    await expect(summary.json()).resolves.toEqual({
      summary: {
        bidCount: 1,
        lowestAmountMinorUnits: 360_000,
        currency: "GEL",
      },
    });
  });

  test(`@phase-3 an unentitled provider gets neither full detail nor a bid (${locale})`, async ({
    browser,
    page,
  }, testInfo) => {
    const title = `Phase 3 locked journey ${locale} ${testInfo.project.name}`;
    const tenderId = await publishTenderAsClient(browser, locale, title);

    await signInSeededAccount(page, "provider", locale);
    // `page.request` shares the signed-in context's cookies; the standalone
    // `request` fixture does not and would be rejected as unauthenticated.
    const detail = await page.request.get(`/api/tenders/discover/${tenderId}`);
    expect(detail.status()).toBe(200);
    const body = (await detail.json()) as { disclosure: string };
    expect(body.disclosure).toBe("MASKED");

    const raw = await detail.text();
    expect(raw).toContain(title);
    expect(raw).not.toContain("12 Rustaveli Avenue");
    expect(raw).not.toContain("41.7151");
    expect(raw).not.toContain(SEEDED_CLIENT.email);

    // Attachments and a bid are both refused with 402 — the provider can
    // resolve this by buying access, which is what that status means.
    const attachments = await page.request.get(
      `/api/tenders/discover/${tenderId}/attachments`,
    );
    expect(attachments.status()).toBe(402);

    const bid = await page.request.post(`/api/tenders/${tenderId}/bids`, {
      data: {
        amountMinorUnits: 1_000,
        conditions:
          "Materials and labour are included; scaffolding is excluded here.",
      },
    });
    expect(bid.status()).toBe(402);
  });
}
```

> `detail.json()` and `detail.text()` are both called on the same response above. Playwright buffers the body, so this is safe; if a future Playwright release changes that, read `text()` first and `JSON.parse` it.

- [ ] **Step 4: Write the selection journey**

```ts
// src/test/e2e/phase-03-selection.spec.ts
import { expect, test } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";
import {
  PHASE_3_DUE_TENDER,
  PHASE_3_WINNING_AMOUNT,
  findOwnedTenderIdByTitle,
  selectionWorkerSecret,
  warmUpBiddingRoutes,
} from "./fixtures/bidding";

test.beforeAll(async ({ request }) => {
  await warmUpBiddingRoutes(request);
});

test("@phase-3 the worker rejects a caller without the shared secret", async ({
  request,
}) => {
  const unauthorized = await request.post("/api/tenders/selection/run");
  expect(unauthorized.status()).toBe(401);

  const wrongSecret = await request.post("/api/tenders/selection/run", {
    headers: { "x-selection-worker-secret": "not-the-secret" },
  });
  expect(wrongSecret.status()).toBe(401);
});

for (const locale of ["ka", "en"] as const) {
  const messages = messagesFor(locale);

  test(`@phase-3 selection produces exactly one winner and is idempotent (${locale})`, async ({
    page,
    request,
  }) => {
    const headers = { "x-selection-worker-secret": selectionWorkerSecret() };

    const first = await request.post("/api/tenders/selection/run", { headers });
    expect(first.status()).toBe(200);
    const second = await request.post("/api/tenders/selection/run", {
      headers,
    });
    expect(second.status()).toBe(200);
    // Every sweep after the first finds nothing: a settled tender is no
    // longer due, so it is never listed again. This is the browser-level
    // proof of the "re-running creates no new side effects" exit criterion,
    // and it also makes this whole spec re-runnable.
    await expect(second.json()).resolves.toEqual({ selections: [] });

    await signInSeededAccount(page, "client", locale);
    const tenderId = await findOwnedTenderIdByTitle(page, PHASE_3_DUE_TENDER);
    await page.goto(`/${locale}/client/tenders/${tenderId}`);

    await expect(page.locator("h1")).toContainText(PHASE_3_DUE_TENDER);
    await expect(
      page.getByText(messages.bidding.outcomeWinnerTitle),
    ).toBeVisible();
    await expect(
      page.getByText(messages.bidding.automaticWinner),
    ).toBeVisible();
    // Exactly one winner on the page, stated in text.
    await expect(
      page.getByText(messages.bidding.statusWinner, { exact: true }),
    ).toHaveCount(1);
    // No control on this page can choose or replace a provider.
    await expect(
      page.getByRole("button", { name: /select|choose/i }),
    ).toHaveCount(0);

    // The lowest seeded offer, and only it, won. Asserted through the
    // comparison API rather than the rendered string, because
    // `Intl.NumberFormat` formats GEL differently in ka and en.
    const compared = await page.request.get(`/api/tenders/${tenderId}/bids`);
    expect(compared.status()).toBe(200);
    const { bids } = (await compared.json()) as {
      bids: ReadonlyArray<{ amountMinorUnits: number; status: string }>;
    };
    const winners = bids.filter((bid) => bid.status === "WINNER");
    expect(winners).toHaveLength(1);
    expect(winners[0]?.amountMinorUnits).toBe(PHASE_3_WINNING_AMOUNT);
    expect(bids.filter((bid) => bid.status === "LOST")).toHaveLength(2);
  });

  test(`@phase-3 a losing provider sees its own outcome after the deadline (${locale})`, async ({
    browser,
    page,
    request,
  }) => {
    await request.post("/api/tenders/selection/run", {
      headers: { "x-selection-worker-secret": selectionWorkerSecret() },
    });

    // The tender id has to come from the owner, so it is read in a separate
    // context signed in as the client, then used by the provider below.
    const clientContext = await browser.newContext();
    let tenderId: string;
    try {
      const clientPage = await clientContext.newPage();
      await signInSeededAccount(clientPage, "client", locale);
      tenderId = await findOwnedTenderIdByTitle(clientPage, PHASE_3_DUE_TENDER);
    } finally {
      await clientContext.close();
    }

    // The seeded Phase 1 provider submitted the highest of the three offers,
    // so it lost — and must still be able to open the tender it bid on even
    // though the deadline has passed and discovery no longer lists it.
    await signInSeededAccount(page, "provider", locale);
    const listed = await page.request.get("/api/tenders/discover?city=tbilisi");
    const { tenders } = (await listed.json()) as {
      tenders: ReadonlyArray<{ title: string }>;
    };
    // A settled tender never reappears as biddable inventory.
    expect(tenders.some((tender) => tender.title === PHASE_3_DUE_TENDER)).toBe(
      false,
    );

    await page.goto(`/${locale}/provider/tenders/${tenderId}`);
    await expect(page.locator("h1")).toContainText(PHASE_3_DUE_TENDER);
    await expect(
      page.getByText(messages.bidding.outcomeLostBody),
    ).toBeVisible();
    // A loser is told they lost, never who won or for how much.
    await expect(page.getByText(messages.bidding.outcomeWonBody)).toHaveCount(
      0,
    );
    // And bidding is over: no offer control remains.
    await expect(
      page.getByRole("button", { name: messages.bidding.submit }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: messages.bidding.revise }),
    ).toHaveCount(0);
  });
}
```

> The seeded Phase 1 provider does not bid on the due tender (the seed uses the two Phase 3 provider accounts plus the Phase 1 provider — confirm which three the script actually entitles and adjust the loser assertion to match; the seed as written entitles the two Phase 3 providers only, so add the Phase 1 provider as the third bidder in Step 1's loop before relying on this test).

- [ ] **Step 5: Add the phase scripts**

In `package.json`:

```json
    "seed:phase-3": "tsx scripts/seed-phase-03.ts",
    "verify:phase-3": "pnpm verify:phase-2 && pnpm db:migrate:test && pnpm test:integration -- access bidding agreements notifications && pnpm build && pnpm seed:phase-3 && pnpm test:e2e --grep @phase-3"
```

and extend the Phase 0 grep-invert so the pre-phase suite still excludes tagged journeys:

```json
    "verify:phase-0": "pnpm format:check && pnpm lint && pnpm verify:boundaries && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm build && pnpm test:e2e --grep-invert \"@phase-1|@phase-2|@phase-3\""
```

- [ ] **Step 6: Add the CI job**

Copy the `phase-2` job in `.github/workflows/verify.yml` to a `phase-3` job named "Phase 3 access and bidding", changing only:

- `name: Phase 3 access and bidding` and the job key `phase-3`.
- Add `SELECTION_WORKER_SECRET: ci-only-selection-worker-secret-0123456789` to the job's `env` block (at least 32 characters).
- The final step runs `pnpm verify:phase-3`.

Add the same `SELECTION_WORKER_SECRET` entry to the existing `phase-1` and `phase-2` job `env` blocks: `src/config/env.ts` now requires it, so every job that runs `pnpm build` fails without it.

- [ ] **Step 7: Document the phase**

Append to `docs/development.md`, after the Phase 1 section:

- A "Phase 2 and Phase 3 fixtures and gates" subsection listing `pnpm seed:phase-2` and `pnpm seed:phase-3`, and stating that the Phase 3 seed requires the Phase 1 seed to have run first (it looks the client account up rather than creating it) and reuses `PHASE_1_SEED_PASSWORD` for the two extra provider accounts.
- The `SELECTION_WORKER_SECRET` requirement: what it protects (`POST /api/tenders/selection/run`), that it is required in every environment including local development, and how to generate one:

```powershell
$bytes = [byte[]]::new(24)
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:SELECTION_WORKER_SECRET = [Convert]::ToBase64String($bytes)
```

- A statement of the phase's non-negotiable behaviour for future contributors: the winner is produced only by `POST /api/tenders/selection/run` at or after the deadline, no customer-facing or administrator route may set a winner, and re-running the worker returns the existing result.
- The `pnpm verify:phase-3` command and what it adds over `verify:phase-2`.

- [ ] **Step 8: Run the complete phase gate**

Run:

```powershell
pnpm db:up
pnpm db:generate
pnpm db:migrate:test
$bytes = [byte[]]::new(24)
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:PHASE_1_SEED_PASSWORD = [Convert]::ToBase64String($bytes)
pnpm verify:phase-3
```

Expected: PASS end to end — format, lint, boundaries, typecheck, unit, integration, build, the Phase 0/1/2 browser suites, then the `@phase-3` suite on both `desktop-chromium` and `mobile-chromium`.

- [ ] **Step 9: Confirm the exit criteria explicitly**

Check each roadmap Phase 3 exit criterion and record the evidence:

1. **No customer-facing or admin winner mutation.** Re-run the Task 10 Step 5 grep; there must be no such surface.
2. **Re-running selection returns the existing result with no new side effects.** Proven by `run-deadline-selection.integration.test.ts` ("re-running returns the existing result") and by the second worker sweep in `phase-03-selection.spec.ts`.
3. **Bid mutation is impossible at or after the deadline.** Proven by the three post-deadline assertions in `bid-lifecycle.integration.test.ts`.

- [ ] **Step 10: Commit**

```bash
git add scripts src/test package.json .github/workflows/verify.yml docs/development.md
git commit -m "test: prove the phase 3 access, bidding, and selection journeys"
```

---

## Phase 3 completion checklist

- [ ] `pnpm verify:phase-3` passes locally from a clean checkout.
- [ ] The CI `phase-3` job passes, and `phase-1`/`phase-2` still pass with the new required secret.
- [ ] `pnpm verify:boundaries` reports no violation: no `src/modules/**/domain` file imports another module, Prisma, a Node built-in, or a third-party package.
- [ ] No module reads or writes another module's Prisma tables. `access`, `bidding`, `agreements`, and `notifications` touch `Tender` and `Agreement` only through `prismaTenderSelectionGateway`, `getTenderBiddingContext`, and `prismaAgreementGateway`.
- [ ] Access prices in code and copy are exactly USD 1 / 20 / 200.
- [ ] The masked provider projection still omits the exact address, exact coordinates, client identity/contact, attachments, and full conditions — the Phase 2 leak tests pass unchanged.
- [ ] Selection writes the tender close, the bid statuses, the agreement snapshot, the audit event, and the outbox messages in one transaction, and nothing when it rolls back.
