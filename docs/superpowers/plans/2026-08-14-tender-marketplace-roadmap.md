# Tender Marketplace Delivery Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each phase plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the source-of-truth product as a sequence of working, independently testable releases, proving construction/repair before expanding the marketplace.

**Architecture:** A Next.js vertical-slice modular monolith owns explicit identity, tender, access, bidding, agreement, review, billing, trust, and administration modules. PostgreSQL transactions enforce commercial invariants; external services are adapters. Each phase may ship without future modules and must leave the main branch releasable.

**Tech Stack:** Node.js 24 LTS, Next.js 16 App Router, React 19, strict TypeScript, pnpm, PostgreSQL 17, Prisma ORM 7 GA, Better Auth, Zod, Tailwind CSS 4, accessible headless primitives, Vitest, Playwright, and S3-compatible storage.

## Global Constraints

- `Product_description.md` and `Specs.md` are the source of truth.
- First market: Georgia; locales: `ka` and `en`; currencies: `GEL` and `USD`.
- First vertical: construction and repair.
- Client tender posting is free.
- Provider access prices: single USD 1, monthly USD 20, annual USD 200.
- Winner is selected only at deadline: lowest eligible amount, then earliest qualifying submission, then stable ID.
- Client cannot manually select or replace the winner.
- No dispute adjudication, arbitration, escrow, or user-to-user payment custody.
- Reference app logic may be consulted; reference app design must not be copied.
- WCAG 2.2 AA is the accessibility target.
- Money is stored in integer minor units; time is stored in UTC.
- Prisma migrations are committed and forward-only.
- Local development/testing uses Docker Compose with separate PostgreSQL 17 databases `tender_dev` and `tender_test`; Prisma ORM is not the database host.
- No managed database account is required until a staging environment is created.
- Every phase adds domain, PostgreSQL integration, route-contract, Playwright, and accessibility coverage appropriate to its scope.

---

## Program gates

```text
Phase 0 Foundation
  -> Phase 1 Identity
    -> Phase 2 Tenders
      -> Phase 3 Access/Bidding
        -> Phase 4 Agreements/Reviews = Functional MVP
          -> Phase 5 Real Billing = Commercial Pilot
            -> Phase 6 Trust/Admin = Public Launch
              -> Phases 7-9 Vertical Expansion
                -> Phase 10 International/Growth
```

No phase starts until the previous phase's CI command, demo journey, migration rehearsal, and documented exit checklist pass.

## Phase 0 — Engineering foundation

**Outcome:** A deployable empty product with architecture boundaries and reliable feedback loops.

**Scope**

- Scaffold Next.js, strict TypeScript, linting, formatting, environment validation, and package pinning.
- Configure Docker Compose with persistent `tender_dev` and disposable `tender_test` PostgreSQL 17 services, Prisma ORM 7, initial migration, test database isolation, and seed/reset commands.
- Establish vertical-module folder rules and shared ports for clock, IDs, transactions, and audit context.
- Configure Vitest unit/integration projects and Playwright desktop/mobile projects.
- Add locale-aware root routes, error boundaries, health/readiness endpoints, and CI.
- Run and approve the visual-direction workshop before authenticated UI implementation begins.

**Automated proof**

- Unit sentinel imports domain code without Next.js.
- Integration sentinel applies migrations and round-trips a health record through PostgreSQL.
- A guard refuses integration cleanup unless `DATABASE_URL_TEST` resolves to a database whose name ends `_test`.
- Playwright opens `/ka` and `/en`, checks landmark/focus behavior, and verifies the health contract.
- CI provisions PostgreSQL and runs typecheck, lint, unit, integration, build, and E2E.

**Exit criteria**

- Fresh-clone setup is reproducible from documented commands.
- No source module imports Prisma except database adapters.
- Production build contains no missing-environment fallback for required secrets.
- Phase command: `pnpm verify:phase-0`.

**Execution plan:** `2026-08-14-phase-00-foundation-implementation.md`.

## Phase 1 — Identity, capabilities, and bilingual workspaces

**Outcome:** A client and construction provider can establish trusted sessions and reach role-appropriate workspaces.

**Scope**

- Better Auth with Prisma, secure cookie sessions, email/password, email verification, password reset, logout, and session revocation.
- Separate account capabilities from provider specialty; admin cannot be self-assigned.
- Client and construction-provider registration paths with shared identity fields.
- Georgian/English message catalogs, locale persistence, localized validation, and GEL/USD preferences.
- Profile editing, account restriction checks, client workspace shell, and provider workspace shell.
- Development email adapter that records messages without external delivery.

**Automated proof**

- Domain tests deny restricted accounts and forbid self-granting admin.
- Integration tests enforce unique normalized email/phone and capability constraints.
- Route tests cover unauthenticated, unverified, wrong-capability, and restricted cases.
- Playwright registers one client and one provider in both locales, verifies email through a test-only inbox, signs in/out, and checks dashboard authorization.

**Exit criteria**

- No client-supplied user ID or capability is trusted.
- Georgian and English paths have identical capabilities.
- Keyboard-only registration and sign-in pass.
- Phase command: `pnpm verify:phase-1`.

**Execution plan:** `2026-08-14-phase-01-identity-implementation.md`.

## Phase 2 — Tender authoring and masked discovery

**Outcome:** A client publishes a valid free construction tender, while providers discover only permitted summary data.

**Scope**

- Construction tender draft schema, step-based authoring, validation, preview, publication, and permitted cancellation.
- Required content: title, short/full description, category/specialty, scope, budget/currency, desired dates/deadline, worker/equipment/material notes, location, and conditions.
- Private upload metadata and S3-compatible storage adapter for PDF/JPEG/PNG/WebP.
- Geocoding/reverse-geocoding ports, map pin synchronization, and coarsened public coordinates.
- Search/filter by specialty, city/district, budget, publication date, deadline, and nearby area.
- Client tender list/detail and provider masked list/detail.

**Automated proof**

- Publication rejects incomplete or expired-deadline drafts.
- Upload tests reject spoofed MIME types, oversized files, unauthorized downloads, and excess counts.
- Response-shape tests prove exact address, client identity/contact, attachments, and full conditions are absent before entitlement.
- Playwright creates a draft, uploads fixtures, selects a map location, publishes, and discovers the masked tender from another account.

**Exit criteria**

- Free publication creates no billing record.
- Published material fields/deadline cannot be edited in place.
- Exact coordinates never appear in public HTML, RSC payloads, or API JSON.
- Phase command: `pnpm verify:phase-2`.

## Phase 3 — Mock access, bidding, and deterministic winner

**Outcome:** Providers unlock tenders, compete transparently, and the system produces exactly one deadline winner.

**Scope**

- Access entitlement model and centralized disclosure policy.
- Mock checkout/payment-event adapter for single, monthly, and annual access.
- Full tender disclosure and authorized signed downloads after entitlement.
- Bid submit, revise, withdraw, current-lowest summary, client comparison, and eligibility validation.
- Deadline selector with locks, idempotency, deterministic ties, expired-without-bids path, and transactional outbox.
- Pending-agreement snapshot creation.

**Automated proof**

- Property tests rank arbitrary valid bid sets deterministically.
- Integration tests run concurrent selectors and assert one winner/agreement/outbox set.
- Disclosure tests exercise no entitlement, wrong provider, expired subscription, single-tender access, and administrator inspection.
- Playwright uses three providers, revises bids, advances the test clock, runs selection, and checks winner/loser/client views.

**Exit criteria**

- There is no customer-facing or admin mutation for choosing/replacing a winner.
- Re-running selection returns the existing result without new side effects.
- Bid mutation is impossible at or after the deadline.
- Phase command: `pnpm verify:phase-3`.

## Phase 4 — Agreements, work completion, and reviews

**Outcome:** The selected parties can record an engagement through verified completion and publish authentic reviews.

**Scope**

- Agreement snapshot display, 48-hour two-party confirmation, decline/expiry, start acknowledgement, and two-party completion.
- Cancellation reason records without adjudication or platform fault decisions.
- Review eligibility, four rating dimensions, derived average, substantive-comment rule, publication, public profile aggregates, and admin redaction.
- Lifecycle notifications through the outbox and in-app inbox.

**Automated proof**

- State-machine tests cover every permitted/forbidden transition and deadline boundary.
- Concurrency tests confirm completion exactly once when both parties act simultaneously.
- Review tests reject outsiders, incomplete agreements, duplicates, self-reviews, weak comments, and out-of-range scores.
- Playwright completes the winning agreement and publishes reciprocal reviews in both locales.

**Exit criteria**

- Functional MVP journey passes from registration to review.
- No route or UI claims the platform resolves disputes.
- Review aggregate derives only from published, non-redacted reviews.
- Phase command: `pnpm verify:mvp`.

## Phase 5 — Real billing, subscriptions, and delivery notifications

**Outcome:** A commercial pilot can collect paid-access revenue safely.

**Scope**

- Select a Georgian-compatible provider through a separate provider evaluation and legal/commercial review.
- Hosted checkout adapter, signed webhook ingestion, raw event retention, idempotent payment application, failure/cancellation paths, and reconciliation report.
- Single, monthly, and annual product mapping; entitlement start/expiry; payment history and receipts.
- Production email delivery and optional SMS for verification/deadline events.
- Backup, restore, secret rotation, and webhook replay runbooks.

**Automated proof**

- Provider contract suite runs unchanged against mock and sandbox adapters.
- Replayed/out-of-order webhooks cannot double-grant or shorten an entitlement.
- Subscription boundary tests use a fake clock.
- Sandbox Playwright journey reaches hosted checkout and returns to an unlocked tender.

**Exit criteria**

- Provider sandbox, webhook signature validation, reconciliation, backup restore, and failure alert all pass.
- Pricing copy exactly matches USD 1/20/200 or an explicitly approved source-document amendment.
- Phase command: `pnpm verify:commercial-pilot`.

## Phase 6 — Verification, trust, administration, and reporting

**Outcome:** The platform can be operated publicly with explainable moderation and financial visibility.

**Scope**

- Phone verification and optional private identity-document workflow.
- Verification badge rules and transparent search effects.
- White-list eligibility/review and black-list violation/restriction lifecycle.
- Admin users, tenders, bids, agreements, payments, subscriptions, reviews, trust lists, suspicious activity, statistics, revenue, and financial exports.
- Append-only audit search/export and least-privilege admin actions.
- Homepage registration/login/listings/statistics/trust-list/advertising slots using real platform data only.

**Automated proof**

- Permission matrix tests every administrator command and confirms winner immutability.
- Identity documents never appear in general admin/user responses or logs.
- Five qualifying completions create white-list eligibility, not silent publication.
- Client eligibility additionally requires provider-recorded on-time payment confirmation and no active cancellation/violation disqualifier.
- Three recorded violations create a dated 365-day restriction with prior notice.
- Financial report totals reconcile to immutable payment events.

**Exit criteria**

- Public-launch security, accessibility, moderation, recovery, and privacy checklists pass.
- Admin cannot access a private identity document without an audited purpose.
- Phase command: `pnpm verify:public-launch`.

## Phase 7 — Transport

**Outcome:** Carriers complete the proven loop using transport-specific requirements.

- Add pickup/drop-off, cargo type, weight, volume, vehicle needs, route, distance, and access conditions.
- Add route-provider adapter and cached distance quote; preserve exact endpoints behind entitlement.
- Reuse entitlement, bidding, deadline selection, agreement, review, billing, and audit contracts.
- Exit proof: a carrier completes a route-based tender in both locales; route-provider failure produces a recoverable manual-distance state.

## Phase 8 — Equipment and daily labor

**Outcome:** Equipment owners and workers use specialized schemas without branching the shared commercial workflow.

- Equipment: type, pricing unit, duration, operator/fuel terms, availability, location, and conditions.
- Daily labor: worker count, work type, hours, compensation basis, experience, start date, and location.
- Exit proof: one E2E journey per specialty plus schema/property tests proving irrelevant fields cannot leak between verticals.

## Phase 9 — Materials procurement

**Outcome:** Clients issue a bill-of-materials request and compare supplier line-item offers.

- Structured request/items, units, quantity, grade/class, acceptable substitutions, delivery location/deadline, and attachments.
- Supplier catalog and CSV/XLSX import are separate optional tasks after manual item entry works.
- Supplier offers contain line prices, availability, delivery cost/date, conditions, and comparable total.
- Winner policy remains lowest eligible total at deadline unless the source documents are explicitly amended.
- Exit proof: a multi-line request receives comparable offers and creates an agreement snapshot with immutable line items.

## Phase 10 — International and growth surfaces

**Outcome:** A second country can be configured without hard-coded Georgian assumptions.

- Country configuration for locale, currencies, phone/address rules, timezone, map provider, and payment adapter.
- Add new locales only with complete catalog and human review.
- Ads, featured company profiles, premium supplier packages, and priority application display must be visibly labeled.
- Paid promotion can affect discovery placement but never bid eligibility, comparison ordering, or winner selection.
- Exit proof: second-country configuration passes the core journey and ranking-invariance tests.

## Cross-phase change control

- A source-document conflict is recorded as an architecture decision before implementation.
- Database changes include migration, rollback/forward-fix notes, and data-compatibility test.
- A phase may extend an earlier interface but may not reach into another module's tables directly.
- Any change to price, winner selection, disclosure, review eligibility, trust restrictions, or no-disputes policy requires user approval and a spec revision.
- Each phase receives a file-level TDD execution plan immediately before implementation. Phase 0 and Phase 1 plans are included now; later plans are intentionally written after their dependency interfaces exist.
