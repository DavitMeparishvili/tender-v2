# Tender Marketplace Program Design

**Date:** 2026-08-14  
**Status:** Approved architecture; program specification  
**Authority:** `Product_description.md` and `Specs.md` are authoritative. This document resolves their implementation boundaries using the user's confirmed decisions. The reference application is logic evidence only.

## 1. Confirmed decisions

- The first production vertical is construction and repair.
- The initial market is Georgia, with Georgian and English interfaces and GEL/USD money display.
- Winner selection happens only at the tender deadline.
- The lowest eligible price wins. Equal prices are resolved by the earliest qualifying submission time.
- A client cannot manually select another provider and cannot close bidding early to favor a current bidder.
- The core workflow uses a mock payment adapter first. Real payments arrive in a later phase.
- The architecture is a Next.js vertical-slice modular monolith with clean extraction seams.
- The old application is not a visual reference.

## 2. Scope and success

The first complete marketplace release proves this journey:

1. A client registers and verifies their email.
2. The client creates and publishes a construction/repair tender for free.
3. A suitable provider discovers a masked tender summary.
4. The provider gains an access entitlement through the mock payment adapter.
5. The provider views full details and submits a valid offer.
6. At the deadline, the system deterministically selects the lowest valid offer.
7. Client and provider confirm an agreement and progress the work.
8. Both confirm completion.
9. Each party can publish one substantive, job-bound review of the other.
10. An administrator can inspect the audit trail but cannot change the winner.

The release is successful when this journey passes in Georgian and English, at desktop and mobile viewport sizes, against PostgreSQL in CI.

## 3. Architecture

### 3.1 Runtime shape

- One Next.js 16 application serves pages, route handlers, and scheduled worker endpoints.
- PostgreSQL is the authoritative datastore; Prisma migrations are committed and forward-only.
- Business rules live in plain TypeScript domain/application modules, not React components or route handlers.
- Route handlers authenticate, validate input, call one application use case, and map its result to HTTP.
- UI components consume view models and never infer permissions from hidden controls.
- A transactional outbox records notifications and background work in the same transaction as the state change.
- Time, IDs, payments, file storage, email, SMS, geocoding, routing, and exchange rates are ports with production and test adapters.

### 3.2 Database topology and ownership

- PostgreSQL 17 is the database engine. Prisma ORM 7 is the ESM TypeScript query, schema, and migration layer using `@prisma/adapter-pg`; it is not a hosted database.
- Local development uses Docker Compose service `postgres-dev`, database `tender_dev`, technical login `tender_local`, and a persistent named volume.
- Automated local tests use a separate Docker Compose service `postgres-test`, database `tender_test`, technical login `tender_test`, port 5433, and disposable storage.
- `DATABASE_URL` points to development or the deployed runtime database. `DATABASE_URL_TEST` exists only in development/CI and must name a database ending `_test`.
- Unit tests never connect to PostgreSQL. Integration and Playwright tests use `tender_test`. CI provisions a fresh PostgreSQL 17 service for each run.
- Local technical logins are created automatically by Docker Compose; no cloud database account is required for Phases 0–4.
- Application clients, providers, and administrators are rows in application tables. They never receive PostgreSQL credentials and never connect directly to the database.
- Production uses managed PostgreSQL selected before staging. `tender_app` is the restricted runtime login; `tender_migrator` is used only by deployment automation for DDL migrations. An optional `tender_reporting` login is read-only.
- Prisma Postgres may be selected as the managed PostgreSQL host, but the architecture remains provider-neutral. Local `prisma dev`/PGlite is not the default because single-connection queuing would not exercise the marketplace's concurrent bid and winner-selection behavior like standard PostgreSQL.

### 3.3 Module boundaries

| Module | Owns | Does not own |
|---|---|---|
| `identity` | users, sessions, capabilities, verification | provider specialties or tenders |
| `profiles` | client/provider public data and specialties | authentication credentials |
| `tenders` | tender content, requirements, deadline, publication | offers or winner selection |
| `access` | entitlements and disclosure policy | payment-provider implementation |
| `bidding` | offers, revisions, eligibility, ranking, winner selection | work execution |
| `agreements` | confirmation and work lifecycle | tender ranking |
| `reviews` | eligibility, ratings, moderation state | disputes or compensation |
| `billing` | checkout intent, payment events, subscriptions | disclosure rules |
| `maps` | normalized places, coordinates, routes | tender visibility policy |
| `notifications` | templates, preferences, outbox delivery | domain state transitions |
| `trust` | verification badges, list eligibility, restrictions | arbitration |
| `admin` | read models, moderation commands, reports, audit search | winner selection |

Modules may read another module only through a published query interface and may mutate it only through an application command.

## 4. Domain model

### 4.1 Identity and capabilities

An account can hold multiple capabilities because a construction company may both publish work and provide services:

- `CUSTOMER`
- `PROVIDER`
- `ADMIN`

Provider specialty is separate from capability. Phase 1 supports `CONSTRUCTION_REPAIR`; future phases add `TRANSPORT`, `EQUIPMENT`, `DAILY_LABOR`, and `MATERIAL_SUPPLIER`.

Administrative capability is never self-selectable. Disabled or restricted accounts keep their historical records but cannot start new commercial actions.

### 4.2 Tender lifecycle

`DRAFT -> OPEN -> CLOSED | EXPIRED | CANCELLED`

- A draft is visible only to its client and administrators.
- Publishing validates required category-specific data and establishes an immutable deadline.
- An open tender accepts eligible bids until the deadline instant.
- `CLOSED` means selection ran, whether or not a winner existed.
- `EXPIRED` means the deadline passed with no eligible bids.
- A client may cancel an open tender only while it has no submitted bids. After the first bid, only an administrator may cancel it for a documented platform-rule or safety reason; the action is audited.
- Published tender requirements and deadline cannot be silently changed. A material change requires cancelling and republishing a new tender linked to the original.

### 4.3 Bid lifecycle and visibility

`SUBMITTED -> WINNER | LOST | WITHDRAWN`

- One active bid per provider per tender.
- A bid contains price, currency, proposed start date, duration, included costs, exclusions, and a substantive conditions note.
- All bids use the tender's settlement currency. GEL and USD display conversion is informational only and cannot affect ranking.
- A provider may revise or withdraw a bid before the deadline. A revision receives a new `qualifyingSubmittedAt` for tie-breaking.
- Providers can see the current lowest amount and bid count, but not bidder identity, exact terms, or submission timestamp.
- The client can compare every submitted bid and provider trust summary but cannot select one.
- Price is the sole rank after eligibility validation. Terms are disclosed for agreement confirmation, not used for secret ranking.

### 4.4 Winner selection

Selection is a single serializable/idempotent use case:

1. Lock the tender by ID.
2. Return the existing result if selection already ran.
3. Reject execution before the deadline.
4. Load non-withdrawn eligible bids ordered by amount ascending, then `qualifyingSubmittedAt` ascending, then stable ID ascending.
5. Mark the first bid `WINNER` and the rest `LOST`.
6. Close the tender.
7. Create one `PENDING_CONFIRMATION` agreement snapshot.
8. Write audit and notification outbox entries.

If no bid is eligible, mark the tender `EXPIRED`. The worker can be retried without changing the result.

The selected provider and client each have 48 hours to confirm the agreement snapshot. If either declines or the window expires, the agreement is cancelled and the tender remains closed. The client may republish; the system does not silently cascade to a different bidder.

### 4.5 Agreement lifecycle

`PENDING_CONFIRMATION -> AGREED -> IN_PROGRESS -> COMPLETED | CANCELLED`

- The agreement stores immutable snapshots of the winning offer, parties, tender summary, price, currency, start date, duration, and conditions.
- Both parties must confirm the same snapshot before it becomes `AGREED`.
- Either party may mark work started; the other receives a notification and the agreement becomes `IN_PROGRESS` once both acknowledge start.
- Completion requires separate client and provider confirmations.
- `COMPLETED` is reached only when both confirmations exist.
- Cancellation captures actor, reason code, explanatory text, and timestamp. The platform records the event but does not decide legal or financial fault.

### 4.6 Reviews

- A review is eligible only for a `COMPLETED` agreement and only from one party to the other.
- One review per reviewer, reviewed party, and agreement.
- Scores: overall star display derived from quality, deadline, communication, and agreed-price adherence, each 1–5.
- Comment is required, normalized, and at least 30 characters.
- Reviews are immutable after publication except administrator redaction for policy/privacy violations. Redaction preserves the record and audit entry.
- Reviews are not a dispute channel and cannot request compensation or adjudication.

### 4.7 Access entitlements

Tender disclosure checks an entitlement, not a payment status:

- `SINGLE_TENDER`, scoped to provider and tender.
- `MONTHLY_PROVIDER`, scoped to provider and a time range.
- `ANNUAL_PROVIDER`, scoped to provider and a time range.
- `ADMIN_OVERRIDE`, audited and reserved for support inspection.

Before entitlement, a provider sees category, short description, budget, country, city/district, approximate map area, publication date, deadline, bid count, and current lowest amount. Exact address, client identity/contact, full description, attachments, and detailed conditions remain hidden.

The mock adapter creates a successful test payment event and then grants the same entitlement a real verified webhook will grant later.

## 5. Files and uploads

- Accepted phase-2 tender files: PDF, JPEG, PNG, and WebP.
- Object storage is private by default. The database stores metadata, owner, purpose, size, hash, MIME type, scan status, and object key.
- Download uses a short-lived signed URL after authorization.
- Client and administrator access is immediate after clean upload; provider access requires entitlement.
- File type is verified from content, not filename alone.
- Initial limits: 20 MB per file, 10 files per tender, 100 MB total per tender.
- Virus scanning is an adapter. Test and local adapters deterministically mark fixtures clean; production launch with real uploads requires a real scanner.

## 6. Localization, money, and time

- Routes use a locale prefix: `/ka/...` and `/en/...`.
- Georgian is the default for Georgia; language choice persists in an HTTP-only preference cookie and account preference.
- Message keys, not translated prose, are stored for system notifications and validation errors.
- Tender records store settlement currency (`GEL` or `USD`) and integer minor units; floating-point money is prohibited.
- Display conversion is clearly labeled as estimated and includes rate timestamp/source. Phase 1 can use a deterministic configured rate adapter; no converted value is used for contracts or winner selection.
- Datetimes are stored in UTC and rendered in the user's timezone. Tender deadlines display the absolute time and timezone.

## 7. Maps and privacy

- Store normalized address text, country, region, city, district, latitude, and longitude.
- Client tender creation supports address-to-pin and pin-to-address synchronization.
- Before entitlement, map output is deliberately coarsened and exact address text is absent from API responses.
- Geocoding and routing are provider ports with request caching, rate limiting, and provider attribution.
- Transport routing is deferred to the transport phase; construction tenders need location selection and nearby discovery only.

## 8. Administration, audit, and trust

- Every sensitive mutation writes an append-only audit event: actor, action, target, before/after summary, request correlation ID, timestamp, and reason where required.
- Administrators may manage accounts, content visibility, identity decisions, payments, subscriptions, trust lists, and reports.
- Administrators cannot create or replace a tender winner.
- White-list eligibility for providers is computed after at least five completed, on-time agreements, then published only after an administrative policy review.
- White-list eligibility for clients requires at least five completed agreements, provider confirmation that the recorded agreed amount was paid on time, no unjustified platform-recorded cancellation, and no active violation; publication still requires administrative policy review.
- Black-list restriction requires three recorded platform-rule violations. The user sees the cited events, effective date, duration, and restrictions in advance. Initial restriction duration is 365 days.
- Only platform-observable violations are recorded. The admin does not rule on off-platform financial or legal disputes.

## 9. UI/UX contract

The product is an operational workspace, not a visual clone of the old application.

- All public and authenticated interfaces target WCAG 2.2 AA.
- A separate visual-direction workshop must approve the new design system before authenticated screens are built.
- Navigation follows user tasks: discover, publish, bid, agree, perform, review—not database entities.
- Status is always communicated with text plus icon/shape; color alone is insufficient.
- Critical deadlines, disclosure boundaries, automatic-winner rules, and irreversible actions appear before confirmation.
- Dense comparison data uses responsive tables on wide screens and labeled comparison cards on narrow screens.
- Every route defines loading, empty, error, unauthorized, restricted, and success states.
- Georgian copy is authored as first-class content rather than generated by truncating English layouts.
- Public marketing claims use only evidence supplied by the user. No fabricated statistics, testimonials, or partner logos.

## 10. Security and reliability

- Server-side authorization on every read and mutation; hiding a control is never authorization.
- Secure, HTTP-only, same-site session cookies; CSRF protection on state-changing browser requests.
- Password hashing and session management are delegated to the chosen maintained auth library.
- Input schemas reject unknown fields at external boundaries.
- Rate limits cover authentication, verification, upload, search, bid mutation, and checkout/webhook endpoints.
- Payment webhooks require signature verification, idempotency keys, and raw event retention.
- Scheduled selection uses database locking and unique constraints to guarantee one result.
- Production database backups and restore drills are required before real-payment launch.
- Logs never include passwords, tokens, identity documents, exact private addresses, or unredacted payment payload secrets.

## 11. Testing contract

Every phase must include:

- Domain tests for state transitions, permissions, deadlines, ranking, money, and disclosure rules.
- PostgreSQL integration tests for Prisma constraints, transactions, concurrent calls, and migrations.
- Route contract tests for authentication, validation, status codes, and redacted response shapes.
- Playwright journeys in Georgian and English, desktop Chromium, and a mobile viewport; release gates add Firefox and WebKit smoke coverage.
- Accessibility checks plus keyboard-only verification for the phase's main journey.
- A seeded demo scenario and reset command that use the same public application interfaces as production.
- A phase-specific CI command that can pass without unfinished future modules.

## 12. Delivery phases

| Phase | Deliverable | Independent proof |
|---|---|---|
| 0 | Engineering foundation | Health, DB migration, unit/integration/E2E harness, CI |
| 1 | Identity, capabilities, profiles, bilingual shell | Client and construction provider register, verify, sign in, and reach correct workspace |
| 2 | Tender authoring, files, maps, and discovery | Client publishes free tender; provider sees only masked discovery data |
| 3 | Mock access, bidding, and deadline selection | Provider unlocks, bids, revises; concurrent worker runs create exactly one winner |
| 4 | Agreements, completion, and reviews | Winning parties complete the recorded lifecycle and publish eligible reviews |
| 5 | Real payments, subscriptions, and notifications | Verified provider webhook grants entitlement exactly once; expiry works |
| 6 | Verification, trust, administration, audit, and reporting | Admin manages policy-bound operations but cannot alter winner |
| 7 | Transport vertical | Route-based transport tender completes the shared marketplace loop |
| 8 | Equipment and day-labor verticals | Each specialized request schema completes the shared loop |
| 9 | Materials procurement | BOQ request and supplier line-item offers complete a procurement loop |
| 10 | Internationalization and growth surfaces | New country configuration, local formats, ads, featured listings, and priority display work without weakening ranking transparency |

Phases 0–4 form the functional MVP. Phase 5 is required for a commercial paid-access launch. Phase 6 is required before an open public launch. Phases 7–10 expand the proven system.

## 13. Explicit anti-goals

- No microservices during the MVP.
- No native mobile application.
- No escrow or user-to-user money transfer.
- No dispute-resolution or arbitration module.
- No client-chosen winner or hidden scoring formula.
- No chat feature until disclosure and moderation requirements are separately specified.
- No real-time infrastructure when polling or revalidation satisfies the workflow.
- No copying of the reference application's layout, components, palette, or visual identity.

## 14. Sources for pinned technology decisions

- [Next.js 16 release](https://nextjs.org/blog/next-16)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [Prisma with Next.js](https://docs.prisma.io/docs/guides/frameworks/nextjs)
- [Prisma ORM 7 versus Prisma Next early access](https://www.prisma.io/docs/next/quickstart/postgresql)
- [Prisma ORM overview and PostgreSQL adapter](https://www.prisma.io/docs/orm)
- [Prisma Postgres managed service](https://www.prisma.io/docs/postgres)
- [Prisma Postgres local development limitations](https://docs.prisma.io/docs/postgres/database/local-development)
- [Official PostgreSQL Docker image](https://hub.docker.com/_/postgres)
- [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [Playwright test runner](https://playwright.dev/docs/intro)
- [Vitest testing guide](https://vitest.dev/guide/learn/testing-in-practice)
