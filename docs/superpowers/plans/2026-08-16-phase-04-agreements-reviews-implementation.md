# Phase 4 Agreements, Completion, and Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase 3 winning-offer snapshot into a two-party work lifecycle, deliver its events to an in-app inbox, and let each party publish one authentic review after verified completion.

**Architecture:** Keep lifecycle decisions in pure TypeScript state machines, then persist each accepted transition under a PostgreSQL row lock with its audit event, outbox messages, and inbox items in one transaction. The `agreements` module owns work state, `reviews` owns eligibility and moderation state, `notifications` owns delivery records, and `profiles` exposes only its existing public projection; modules communicate through application interfaces rather than reading one another's tables.

**Tech Stack:** Node.js 24 LTS, Next.js 16 App Router, React 19, strict TypeScript, pnpm, PostgreSQL 17, Prisma ORM 7, Better Auth, Zod 4, Tailwind CSS 4, Vitest 4, and Playwright 1.62.

## Global Constraints

- `Product_description.md` and `Specs.md` are the source of truth; the approved program design resolves their implementation boundaries.
- First market: Georgia; locales: `ka` and `en`; currencies: `GEL` and `USD`.
- The Phase 3 winner, winning offer, parties, price, currency, dates, duration, and conditions remain immutable snapshots.
- Both selected parties have exactly 48 hours to confirm; confirmation is accepted only while `now < confirmDeadline`, and expiry applies at `now >= confirmDeadline`.
- A decline or confirmation expiry cancels the agreement and never selects the next bidder; the tender remains closed and may be republished as a new tender.
- Agreement lifecycle is `PENDING_CONFIRMATION -> AGREED -> IN_PROGRESS -> COMPLETED | CANCELLED`.
- Both parties must confirm the same snapshot before `AGREED`, acknowledge start before `IN_PROGRESS`, and confirm completion before `COMPLETED`.
- Cancellation records actor, neutral reason code, normalized explanation, and timestamp; the platform does not determine legal or financial fault.
- A review is eligible only after `COMPLETED`, only from one agreement party to the other, and only once per reviewer and agreement.
- Review dimensions are quality, deadline adherence, communication, and agreed-price adherence; every dimension is an integer from 1 through 5 and the overall value is derived, never independently entered.
- A review comment is normalized, contains at least 30 Unicode characters, at least five words, and at least three distinct case-folded words.
- Published reviews are immutable. Administrator redaction preserves the stored record and audit history, removes it from public output and aggregates, and cannot edit its scores or text.
- Review and cancellation copy must not invite compensation requests, blame findings, arbitration, or dispute adjudication.
- Lifecycle notifications are written to both the transactional outbox and the recipient's in-app inbox in the same transaction as the state change.
- Message keys and structured variables, not translated prose, are persisted for notifications.
- Server-side authorization applies to every read and mutation; controls hidden in React are not authorization.
- Money stays in integer minor units and time stays in UTC.
- WCAG 2.2 AA is the accessibility target; statuses use text in addition to color, irreversible actions state their effect before confirmation, and the core flow is keyboard-operable.
- Prisma migrations are committed and forward-only. No module may reach into another module's tables except through a published query or command interface.
- Work directly in the primary checkout. Do not create or use a Git worktree.

---

## File map

### Agreement lifecycle

- Modify `src/modules/agreements/domain/agreement.ts` — complete lifecycle types, action input, pure transition function, and 48-hour boundary.
- Modify `src/modules/agreements/domain/agreement.test.ts` — exhaustive state/party/deadline transition matrix.
- Create `src/modules/agreements/application/manage-agreement.ts` — participant commands and repository contract.
- Create `src/modules/agreements/application/get-agreement.ts` — party-scoped detail/list/tender query contract and public view model.
- Create `src/modules/agreements/application/expire-agreements.ts` — bounded confirmation-expiry sweep.
- Replace `src/modules/agreements/infrastructure/prisma-agreement-gateway.ts` — preserve Phase 3 snapshot creation and implement locked lifecycle reads/writes.
- Create `src/modules/agreements/application/agreement-lifecycle.integration.test.ts` — PostgreSQL transitions, rollback, idempotency, and concurrency.
- Create `src/modules/agreements/http/agreement-handlers.ts` and `src/modules/agreements/http/map-agreement-error.ts` — route contracts.
- Create `src/modules/agreements/http/expiry-handlers.ts` — authenticated worker endpoint.
- Create `src/modules/agreements/http/agreement-handlers.test.ts` and `src/modules/agreements/http/expiry-handlers.test.ts` — HTTP contracts.
- Create `app/api/agreements/route.ts`, `app/api/agreements/[id]/route.ts`, and `app/api/agreements/expiry/run/route.ts` — thin route adapters.
- Create `src/modules/agreements/ui/agreement-list.tsx`, `agreement-detail.tsx`, `agreement-action-form.tsx`, and `agreement-ui.test.tsx` — bilingual lifecycle UI.
- Create `app/[locale]/(workspace)/client/agreements/page.tsx`, `provider/agreements/page.tsx`, and `agreements/[id]/page.tsx` — participant pages.
- Modify both tender detail pages under `app/[locale]/(workspace)/**/tenders/[id]/page.tsx` — link a selected party to the agreement. Preserve any changes already present in those files when implementation begins.

### Notifications and authorization

- Modify `src/modules/notifications/domain/outbox-topic.ts` — recipient-aware lifecycle and review topics.
- Replace `src/modules/notifications/infrastructure/prisma-outbox-gateway.ts` with a notification publisher that atomically writes outbox and inbox rows.
- Create `src/modules/notifications/application/list-inbox.ts` and `mark-inbox-item-read.ts` — recipient-scoped inbox operations.
- Create `src/modules/notifications/infrastructure/prisma-inbox-repository.ts` and its integration test.
- Create `src/modules/notifications/http/inbox-handlers.ts`, its route-contract test, `app/api/notifications/route.ts`, and `app/api/notifications/[id]/route.ts`.
- Create `src/modules/notifications/ui/inbox-list.tsx`, its render test, and `app/[locale]/(workspace)/notifications/page.tsx`.
- Modify `src/modules/bidding/infrastructure/prisma-selection-repository.ts` and its integration test — route Phase 3 winner/loss messages through the recipient-aware publisher so the initial agreement notification appears in the inbox.
- Modify `src/modules/identity/application/require-capability.ts` and its tests — authorize `ADMIN` and add an any-commercial-capability guard for shared agreement/inbox routes.
- Create `src/modules/shared/http/worker-secret.ts` and its test; modify Phase 3 selection handlers to use it.
- Modify `src/config/env.ts`, `src/config/env.test.ts`, `.env.example`, and `.env.test.example` — require `AGREEMENT_WORKER_SECRET` with at least 32 characters.

### Reviews and public profiles

- Create `src/modules/reviews/domain/review.ts` and `review.test.ts` — validation, normalization, overall derivation, and public aggregation.
- Create `src/modules/reviews/application/publish-review.ts`, `redact-review.ts`, `get-profile-reviews.ts`, and `list-reviews-for-moderation.ts`.
- Create `src/modules/reviews/infrastructure/prisma-review-repository.ts` and `review-lifecycle.integration.test.ts` — transactional eligibility, uniqueness, redaction, and aggregate queries.
- Create `src/modules/reviews/http/review-handlers.ts`, `map-review-error.ts`, and route-contract tests.
- Create `app/api/agreements/[id]/reviews/route.ts`, `app/api/profiles/[id]/reviews/route.ts`, `app/api/admin/reviews/route.ts`, and `app/api/admin/reviews/[id]/route.ts`.
- Modify `src/modules/profiles/application/get-provider-display-names.ts` and `src/modules/profiles/infrastructure/prisma-profile-repository.ts` — generalize the safe display-name lookup and add a public profile projection without phone/contact fields.
- Create `src/modules/profiles/application/get-public-profile.ts` and `app/[locale]/profiles/[id]/page.tsx`.
- Create `src/modules/reviews/ui/review-form.tsx`, `review-list.tsx`, `review-summary.tsx`, `review-moderation-list.tsx`, and render tests.
- Create `app/[locale]/(workspace)/admin/reviews/page.tsx` — the Phase 4-only moderation surface; the broader admin shell remains Phase 6.

### Database, copy, acceptance, and operations

- Modify `prisma/schema.prisma` and create `prisma/migrations/20260816150000_phase4_agreements_reviews/migration.sql` — lifecycle columns, review records, inbox records, constraints, and indexes.
- Modify `src/modules/localization/messages/en.json`, `ka.json`, and `messages.test.ts` — first-class agreement, review, notification, and moderation copy.
- Modify `src/modules/identity/ui/workspace-view.tsx` and its test — link client/provider workspaces to agreements and the inbox.
- Modify `app/globals.css` — responsive lifecycle, rating, inbox, and moderation states consistent with the existing focused-column design.
- Create `scripts/seed-phase-04.ts` and `src/test/e2e/fixtures/agreements.ts` — deterministic selected parties, admin, and agreement lookup helpers.
- Create `src/test/e2e/phase-04-agreement.spec.ts`, `phase-04-reviews.spec.ts`, and `phase-04-accessibility.spec.ts`.
- Modify `src/test/e2e/fixtures/accounts.ts`, `package.json`, `.github/workflows/verify.yml`, and `docs/development.md` — Phase 4 fixtures and the functional-MVP gate.

---

### Task 1: Define the agreement and review domain contracts

**Files:**

- Modify: `src/modules/agreements/domain/agreement.ts`
- Modify: `src/modules/agreements/domain/agreement.test.ts`
- Create: `src/modules/reviews/domain/review.ts`
- Create: `src/modules/reviews/domain/review.test.ts`

**Interfaces:**

- Produces: `AgreementRecord`, `AgreementAction`, `AgreementTransition`, `transitionAgreement(record, action, now)`.
- Produces: `ReviewScores`, `normalizeReviewComment(comment)`, `validateReviewDraft(input)`, `deriveOverallRating(scores)`, and `aggregatePublishedReviews(reviews)`.
- Consumes: the existing `AgreementSnapshot` and `AGREEMENT_CONFIRMATION_WINDOW_MS` without changing their serialized Phase 3 shape.

- [ ] **Step 1: Write the failing agreement transition matrix**

Add table-driven tests that assert the complete boundary, including idempotent repeated actions:

```ts
const pending = agreementRecord({
  status: "PENDING_CONFIRMATION",
  confirmDeadline: new Date("2026-08-18T10:00:00.000Z"),
});

it("becomes agreed only after both parties confirm before the deadline", () => {
  const first = transitionAgreement(
    pending,
    { type: "CONFIRM", actorId: pending.clientId },
    new Date("2026-08-18T09:59:59.999Z"),
  );
  expect(first).toMatchObject({
    ok: true,
    value: { record: { status: "PENDING_CONFIRMATION" } },
  });
  if (!first.ok) throw new Error("expected first confirmation");
  expect(
    transitionAgreement(
      first.value.record,
      { type: "CONFIRM", actorId: pending.providerId },
      new Date("2026-08-18T09:59:59.999Z"),
    ),
  ).toMatchObject({
    ok: true,
    value: { record: { status: "AGREED" }, event: "AGREEMENT_AGREED" },
  });
});

it("expires at the exact confirmation deadline", () => {
  expect(
    transitionAgreement(
      pending,
      { type: "EXPIRE", actorId: null },
      pending.confirmDeadline,
    ),
  ).toMatchObject({
    ok: true,
    value: {
      record: {
        status: "CANCELLED",
        cancellationReasonCode: "CONFIRMATION_EXPIRED",
      },
      event: "AGREEMENT_EXPIRED",
    },
  });
  expect(
    transitionAgreement(
      pending,
      { type: "CONFIRM", actorId: pending.clientId },
      pending.confirmDeadline,
    ),
  ).toEqual({ ok: false, error: "CONFIRMATION_EXPIRED" });
});
```

Cover all of these cases explicitly: outsider actor; wrong starting state; client/provider double-confirm; decline before the deadline; expiry before and at the deadline; first and second start acknowledgement; first and second completion confirmation; cancellation from `AGREED` and `IN_PROGRESS`; and every action against terminal `COMPLETED`/`CANCELLED`.

- [ ] **Step 2: Run the agreement domain test to verify it fails**

Run: `pnpm test:unit -- src/modules/agreements/domain/agreement.test.ts`

Expected: FAIL because the complete status/action types and `transitionAgreement` do not exist.

- [ ] **Step 3: Implement the pure agreement state machine**

Use these exact public types; keep persistence and notifications out of the domain:

```ts
export type AgreementStatus =
  "PENDING_CONFIRMATION" | "AGREED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type CancellationReasonCode =
  | "PARTY_DECLINED"
  | "SCHEDULE_CHANGED"
  | "SCOPE_CANNOT_PROCEED"
  | "OTHER"
  | "CONFIRMATION_EXPIRED";

export type AgreementRecord = Readonly<{
  id: string;
  clientId: string;
  providerId: string;
  status: AgreementStatus;
  confirmDeadline: Date;
  clientConfirmedAt: Date | null;
  providerConfirmedAt: Date | null;
  clientStartedAt: Date | null;
  providerStartedAt: Date | null;
  clientCompletedAt: Date | null;
  providerCompletedAt: Date | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  cancellationReasonCode: CancellationReasonCode | null;
  cancellationExplanation: string | null;
}>;

export type AgreementAction =
  | Readonly<{ type: "CONFIRM"; actorId: string }>
  | Readonly<{
      type: "DECLINE";
      actorId: string;
      explanation: string;
    }>
  | Readonly<{ type: "ACKNOWLEDGE_START"; actorId: string }>
  | Readonly<{ type: "CONFIRM_COMPLETION"; actorId: string }>
  | Readonly<{
      type: "CANCEL";
      actorId: string;
      reasonCode: Exclude<
        CancellationReasonCode,
        "PARTY_DECLINED" | "CONFIRMATION_EXPIRED"
      >;
      explanation: string;
    }>
  | Readonly<{ type: "EXPIRE"; actorId: null }>;

export type AgreementTransitionError =
  | "NOT_PARTICIPANT"
  | "INVALID_STATE"
  | "CONFIRMATION_EXPIRED"
  | "NOT_DUE"
  | "INVALID_EXPLANATION";

export type AgreementTransition = Readonly<{
  record: AgreementRecord;
  changed: boolean;
  event:
    | "PARTY_CONFIRMED"
    | "AGREEMENT_AGREED"
    | "AGREEMENT_DECLINED"
    | "AGREEMENT_EXPIRED"
    | "PARTY_ACKNOWLEDGED_START"
    | "WORK_STARTED"
    | "PARTY_CONFIRMED_COMPLETION"
    | "AGREEMENT_COMPLETED"
    | "AGREEMENT_CANCELLED";
}>;
```

Normalize cancellation explanations with `trim().replace(/\s+/gu, " ")` and require 10–1,000 Unicode characters. Return `changed: false` only when the same participant repeats an already recorded action while the agreement remains in the compatible state; a retry must not manufacture a second event.

- [ ] **Step 4: Write failing review policy tests**

```ts
it("normalizes a substantive review and derives, rather than accepts, overall", () => {
  expect(
    validateReviewDraft({
      quality: 5,
      deadline: 4,
      communication: 3,
      agreedPrice: 4,
      comment:
        "  Careful work, clear updates, and the agreed price was kept.  ",
    }),
  ).toEqual({
    ok: true,
    value: {
      scores: { quality: 5, deadline: 4, communication: 3, agreedPrice: 4 },
      overall: 4,
      comment: "Careful work, clear updates, and the agreed price was kept.",
    },
  });
});

it.each([
  [0, "SCORE_OUT_OF_RANGE"],
  [6, "SCORE_OUT_OF_RANGE"],
  [4.5, "SCORE_OUT_OF_RANGE"],
])("rejects invalid quality score %s", (quality, error) => {
  expect(validateReviewDraft(validDraft({ quality }))).toEqual({
    ok: false,
    error,
  });
});

it("rejects a long repeated-word comment as non-substantive", () => {
  expect(
    validateReviewDraft(
      validDraft({ comment: "good good good good good good good good" }),
    ),
  ).toEqual({ ok: false, error: "COMMENT_NOT_SUBSTANTIVE" });
});
```

Also assert aggregate math excludes redacted reviews and returns `null` averages for zero reviews.

- [ ] **Step 5: Run the review domain test to verify it fails**

Run: `pnpm test:unit -- src/modules/reviews/domain/review.test.ts`

Expected: FAIL because the reviews domain does not exist.

- [ ] **Step 6: Implement review validation and aggregation**

```ts
export type ReviewScores = Readonly<{
  quality: number;
  deadline: number;
  communication: number;
  agreedPrice: number;
}>;

export function deriveOverallRating(scores: ReviewScores): number {
  return (
    (scores.quality +
      scores.deadline +
      scores.communication +
      scores.agreedPrice) /
    4
  );
}

export function normalizeReviewComment(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function isSubstantive(comment: string): boolean {
  const characters = Array.from(comment);
  const words = comment.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return (
    characters.length >= 30 && words.length >= 5 && new Set(words).size >= 3
  );
}
```

Validate the input as an exact object, require four integer scores in `[1, 5]`, and return the normalized comment plus the derived overall. Define aggregate output as `{ reviewCount, overall, quality, deadline, communication, agreedPrice }`, with each average rounded to two decimal places and `null` when `reviewCount` is zero.

- [ ] **Step 7: Run both domain suites**

Run: `pnpm test:unit -- src/modules/agreements/domain/agreement.test.ts src/modules/reviews/domain/review.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/agreements/domain src/modules/reviews/domain
git commit -m "feat: define agreement and review policies"
```

---

### Task 2: Persist lifecycle, inbox, and immutable reviews

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260816150000_phase4_agreements_reviews/migration.sql`
- Modify: `src/generated/prisma/**` through `pnpm db:generate`

**Interfaces:**

- Produces: expanded `Agreement`, new `InboxNotification`, new `Review`, `ReviewStatus`, and `AgreementCancellationReasonCode` Prisma types.
- Consumes: current `Agreement.id`, `tenderId`, `clientId`, `providerId`, `bidId`, snapshot, amount, currency, title, confirmation deadline, and created time without destructive rewriting.

- [ ] **Step 1: Add a migration compatibility test before changing the schema**

In `src/modules/agreements/application/agreement-lifecycle.integration.test.ts`, seed a Phase 3-shaped pending agreement and assert every new nullable lifecycle field is `null` and its status remains `PENDING_CONFIRMATION`. This proves the forward migration preserves existing snapshots.

- [ ] **Step 2: Extend the Prisma schema**

Use these models and relations; add `agreementsAsClient`, `agreementsAsProvider`, `inboxNotifications`, `reviewsWritten`, and `reviewsReceived` relation fields to `User` with matching relation names:

```prisma
enum AgreementStatus {
  PENDING_CONFIRMATION
  AGREED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum AgreementCancellationReasonCode {
  PARTY_DECLINED
  SCHEDULE_CHANGED
  SCOPE_CANNOT_PROCEED
  OTHER
  CONFIRMATION_EXPIRED
}

enum ReviewStatus {
  PUBLISHED
  REDACTED
}

model Agreement {
  id                      String                           @id
  tenderId                String                           @unique
  clientId                String
  client                  User                             @relation("AgreementClient", fields: [clientId], references: [id], onDelete: Restrict)
  providerId              String
  provider                User                             @relation("AgreementProvider", fields: [providerId], references: [id], onDelete: Restrict)
  bidId                   String                           @unique
  status                  AgreementStatus                  @default(PENDING_CONFIRMATION)
  amountMinorUnits        Int
  currency                String
  tenderTitle             String
  snapshot                Json
  confirmDeadline         DateTime
  clientConfirmedAt       DateTime?
  providerConfirmedAt     DateTime?
  clientStartedAt         DateTime?
  providerStartedAt       DateTime?
  clientCompletedAt       DateTime?
  providerCompletedAt     DateTime?
  cancelledAt             DateTime?
  cancelledById           String?
  cancellationReasonCode  AgreementCancellationReasonCode?
  cancellationExplanation String?
  completedAt             DateTime?
  createdAt               DateTime                         @default(now())
  updatedAt               DateTime                         @updatedAt
  reviews                 Review[]

  @@index([clientId, status, updatedAt])
  @@index([providerId, status, updatedAt])
  @@index([status, confirmDeadline])
}

model InboxNotification {
  id            String   @id
  recipientId   String
  recipient     User     @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  topic         String
  aggregateType String
  aggregateId   String
  messageKey    String
  variables     Json
  readAt        DateTime?
  createdAt     DateTime @default(now())

  @@index([recipientId, createdAt(sort: Desc)])
  @@index([recipientId, readAt, createdAt(sort: Desc)])
}

model Review {
  id             String       @id
  agreementId    String
  agreement      Agreement    @relation(fields: [agreementId], references: [id], onDelete: Restrict)
  reviewerId     String
  reviewer       User         @relation("ReviewAuthor", fields: [reviewerId], references: [id], onDelete: Restrict)
  reviewedId     String
  reviewed       User         @relation("ReviewSubject", fields: [reviewedId], references: [id], onDelete: Restrict)
  quality        Int
  deadline       Int
  communication  Int
  agreedPrice    Int
  comment        String
  status         ReviewStatus @default(PUBLISHED)
  redactedAt     DateTime?
  redactedById   String?
  redactionReason String?
  createdAt      DateTime     @default(now())

  @@unique([agreementId, reviewerId])
  @@index([reviewedId, status, createdAt(sort: Desc)])
  @@index([status, createdAt(sort: Desc)])
}
```

Do not add a stored `overall` column; it is derived from the four dimensions. Add SQL `CHECK` constraints for every review score (`BETWEEN 1 AND 5`), for `reviewerId <> reviewedId`, and for agreement cancellation coherence: `CANCELLED` requires `cancelledAt` and a reason code, while non-cancelled rows must not have cancellation fields.

- [ ] **Step 3: Generate and inspect the forward migration**

Run:

```powershell
pnpm db:up
pnpm exec prisma migrate dev --name phase4_agreements_reviews
pnpm db:generate
```

Expected: the generated SQL alters `Agreement` in place and creates `InboxNotification` and `Review`; it does not drop or recreate existing commercial tables.

- [ ] **Step 4: Add explicit SQL constraints if Prisma did not emit them**

Append named constraints to the migration:

```sql
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_quality_range" CHECK ("quality" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_deadline_range" CHECK ("deadline" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_communication_range" CHECK ("communication" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_agreedPrice_range" CHECK ("agreedPrice" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_distinct_parties" CHECK ("reviewerId" <> "reviewedId");

ALTER TABLE "Agreement"
  ADD CONSTRAINT "Agreement_cancellation_coherent" CHECK (
    ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "cancellationReasonCode" IS NOT NULL)
    OR
    ("status" <> 'CANCELLED' AND "cancelledAt" IS NULL AND "cancelledById" IS NULL AND "cancellationReasonCode" IS NULL AND "cancellationExplanation" IS NULL)
  );
```

- [ ] **Step 5: Rebuild the disposable test database and run compatibility proof**

Run:

```powershell
docker compose stop postgres-test
docker compose rm --force postgres-test
docker compose up -d --wait postgres-test
pnpm db:migrate:test
pnpm test:integration -- agreements
```

Expected: PASS and the pre-existing pending snapshot remains readable.

- [ ] **Step 6: Commit**

```bash
git add prisma src/generated/prisma src/modules/agreements/application/agreement-lifecycle.integration.test.ts
git commit -m "feat: persist phase 4 lifecycle and reviews"
```

---

### Task 3: Publish recipient-aware outbox and inbox notifications atomically

**Files:**

- Modify: `src/modules/notifications/domain/outbox-topic.ts`
- Replace: `src/modules/notifications/infrastructure/prisma-outbox-gateway.ts`
- Create: `src/modules/notifications/infrastructure/prisma-notification-publisher.integration.test.ts`
- Modify: `src/modules/bidding/infrastructure/prisma-selection-repository.ts`
- Modify: `src/modules/bidding/application/run-deadline-selection.integration.test.ts`

**Interfaces:**

- Produces: `NotificationDraft` and `NotificationPublisher.publish(transaction, drafts, ids, now)`.
- Consumes: Phase 3's transaction client and ID generator; each draft gets exactly one outbox ID and one inbox ID.
- Preserves: `prismaOutboxGateway` as a temporary compatibility export only until all Phase 3 call sites change in this task, then removes it.

- [ ] **Step 1: Write the transactional publisher test**

```ts
const draft: NotificationDraft = {
  recipientId,
  topic: OUTBOX_TOPICS.agreementAgreed,
  aggregateType: "Agreement",
  aggregateId: agreementId,
  messageKey: "notifications.agreementAgreed",
  variables: { agreementId, tenderTitle: "Kitchen renovation" },
};

await database.$transaction((transaction) =>
  prismaNotificationPublisher.publish(
    transaction,
    [draft],
    [{ outboxId: randomUUID(), inboxId: randomUUID() }],
    now,
  ),
);

await expect(
  database.outboxMessage.count({ where: { aggregateId: agreementId } }),
).resolves.toBe(1);
await expect(
  database.inboxNotification.count({ where: { recipientId } }),
).resolves.toBe(1);
```

Add a rollback test that throws after `publish` and expects zero rows in both tables, plus a mismatched-ID-count test.

- [ ] **Step 2: Run the publisher test to verify it fails**

Run: `pnpm test:integration -- prisma-notification-publisher`

Expected: FAIL because the recipient-aware publisher does not exist.

- [ ] **Step 3: Define topics and the publisher contract**

```ts
export const OUTBOX_TOPICS = {
  tenderWinnerSelected: "TENDER_WINNER_SELECTED",
  bidWon: "BID_WON",
  bidLost: "BID_LOST",
  tenderExpiredNoBids: "TENDER_EXPIRED_NO_BIDS",
  agreementPartyConfirmed: "AGREEMENT_PARTY_CONFIRMED",
  agreementAgreed: "AGREEMENT_AGREED",
  agreementDeclined: "AGREEMENT_DECLINED",
  agreementExpired: "AGREEMENT_EXPIRED",
  workStartAcknowledged: "WORK_START_ACKNOWLEDGED",
  workStarted: "WORK_STARTED",
  completionConfirmed: "COMPLETION_CONFIRMED",
  agreementCompleted: "AGREEMENT_COMPLETED",
  agreementCancelled: "AGREEMENT_CANCELLED",
  reviewPublished: "REVIEW_PUBLISHED",
  reviewRedacted: "REVIEW_REDACTED",
} as const;

export type NotificationDraft = Readonly<{
  recipientId: string;
  topic: (typeof OUTBOX_TOPICS)[keyof typeof OUTBOX_TOPICS];
  aggregateType: "Tender" | "Agreement" | "Review";
  aggregateId: string;
  messageKey: `notifications.${string}`;
  variables: Readonly<Record<string, string | number | null>>;
}>;
```

Implement `publish` with `transaction.outboxMessage.createMany` and `transaction.inboxNotification.createMany`. Persist the same topic, aggregate ID, and structured variables in both records; include `recipientId`, `aggregateType`, and `messageKey` in the outbox payload so Phase 5 can deliver localized email without rereading business tables.

- [ ] **Step 4: Route selection messages through the publisher**

Change every selection draft to name exactly one recipient:

```ts
{
  recipientId: tender.ownerId,
  topic: OUTBOX_TOPICS.tenderWinnerSelected,
  aggregateType: "Tender",
  aggregateId: tenderId,
  messageKey: "notifications.tenderWinnerSelected",
  variables: { tenderId, agreementId, tenderTitle: tender.title },
}
```

Use the winning provider for `bidWon`, each losing provider for `bidLost`, and the client for `tenderExpiredNoBids`. Extend the selection integration test to assert one client inbox item, one winner item, and one item per loser, and assert a repeated selection creates no additional inbox row.

- [ ] **Step 5: Run notification and selection integration suites**

Run: `pnpm test:integration -- notifications run-deadline-selection`

Expected: PASS, including rollback and Phase 3 idempotency.

- [ ] **Step 6: Commit**

```bash
git add src/modules/notifications src/modules/bidding
git commit -m "feat: deliver transaction events to the in-app inbox"
```

---

### Task 4: Implement locked and idempotent agreement lifecycle use cases

**Files:**

- Create: `src/modules/agreements/application/manage-agreement.ts`
- Create: `src/modules/agreements/application/get-agreement.ts`
- Create: `src/modules/agreements/application/expire-agreements.ts`
- Replace: `src/modules/agreements/infrastructure/prisma-agreement-gateway.ts`
- Complete: `src/modules/agreements/application/agreement-lifecycle.integration.test.ts`

**Interfaces:**

- Produces: `manageAgreement(id, action, actor)`, `getAgreement(id, actor)`, `getAgreementForTender(tenderId, actor)`, `listAgreements(actor, role)`, and `expireDueAgreements(limit?)`.
- Produces: `AgreementView` with `partyRole`, immutable `snapshot`, lifecycle timestamps, cancellation record, `canConfirm`, `canDecline`, `canAcknowledgeStart`, `canConfirmCompletion`, `canCancel`, and `canReview`.
- Consumes: `transitionAgreement`, `NotificationPublisher`, `Clock`, and `IdGenerator`.

- [ ] **Step 1: Write the PostgreSQL lifecycle tests**

Seed client/provider/outsider plus a pending agreement and prove:

```ts
await expect(
  manageAgreement(agreementId, { type: "CONFIRM" }, { id: outsiderId }),
).resolves.toEqual({ ok: false, error: "NOT_PARTICIPANT" });

await manageAgreement(agreementId, { type: "CONFIRM" }, { id: clientId });
await manageAgreement(agreementId, { type: "CONFIRM" }, { id: providerId });
await expect(statusOf(agreementId)).resolves.toBe("AGREED");

await Promise.all([
  manageAgreement(agreementId, { type: "ACKNOWLEDGE_START" }, { id: clientId }),
  manageAgreement(
    agreementId,
    { type: "ACKNOWLEDGE_START" },
    { id: providerId },
  ),
]);
await expect(statusOf(agreementId)).resolves.toBe("IN_PROGRESS");

await Promise.all([
  manageAgreement(
    agreementId,
    { type: "CONFIRM_COMPLETION" },
    { id: clientId },
  ),
  manageAgreement(
    agreementId,
    { type: "CONFIRM_COMPLETION" },
    { id: providerId },
  ),
]);
await expect(statusOf(agreementId)).resolves.toBe("COMPLETED");
await expect(
  database.auditEvent.count({
    where: { targetId: agreementId, action: "AGREEMENT_COMPLETED" },
  }),
).resolves.toBe(1);
```

Also prove each accepted transition creates one audit row and one notification for the other party, terminal transition notifications go to both parties, a repeated same-party command adds no rows, cancellation persists neutral reason details, and a forced notification failure rolls back the agreement update.

- [ ] **Step 2: Run the lifecycle integration test to verify it fails**

Run: `pnpm test:integration -- agreement-lifecycle`

Expected: FAIL because lifecycle application interfaces do not exist.

- [ ] **Step 3: Define the application contracts**

```ts
export type AgreementActor = Readonly<{ id: string }>;
export type ManageAgreementCommand =
  | Readonly<{ type: "CONFIRM" }>
  | Readonly<{ type: "DECLINE"; explanation: string }>
  | Readonly<{ type: "ACKNOWLEDGE_START" }>
  | Readonly<{ type: "CONFIRM_COMPLETION" }>
  | Readonly<{
      type: "CANCEL";
      reasonCode: "SCHEDULE_CHANGED" | "SCOPE_CANNOT_PROCEED" | "OTHER";
      explanation: string;
    }>;

export type ManageAgreementError =
  | "AGREEMENT_NOT_FOUND"
  | "NOT_PARTICIPANT"
  | "INVALID_STATE"
  | "CONFIRMATION_EXPIRED"
  | "INVALID_EXPLANATION";

export interface AgreementRepository {
  manage(
    id: string,
    action: AgreementAction,
    now: Date,
    ids: IdGenerator,
  ): Promise<Result<AgreementView, ManageAgreementError>>;
  get(
    id: string,
    actorId: string,
  ): Promise<Result<AgreementView, "AGREEMENT_NOT_FOUND" | "NOT_PARTICIPANT">>;
  getForTender(
    tenderId: string,
    actorId: string,
  ): Promise<Result<AgreementView, "AGREEMENT_NOT_FOUND" | "NOT_PARTICIPANT">>;
  list(
    actorId: string,
    role: "CLIENT" | "PROVIDER",
  ): Promise<readonly AgreementSummary[]>;
  listDueConfirmationIds(now: Date, limit: number): Promise<readonly string[]>;
}
```

The application function supplies `actor.id` to the domain action and never accepts a client/provider ID from request JSON.

- [ ] **Step 4: Implement the Prisma gateway with one lock and one transaction per action**

Keep `createPending(...)` unchanged for Phase 3 callers. For `manage(...)`:

1. Start `database.$transaction`.
2. Lock the agreement with `SELECT "id" FROM "Agreement" WHERE "id" = ${id} FOR UPDATE`.
3. Load the row; return `AGREEMENT_NOT_FOUND` without side effects when absent.
4. Convert it to `AgreementRecord`, call `transitionAgreement`, and return mapped errors unchanged.
5. If `changed` is false, return the current view with no update, audit, outbox, or inbox write.
6. Update only the lifecycle fields returned by the transition and set `completedAt` on the transition to `COMPLETED`.
7. Insert one append-only audit row. Use action names `AGREEMENT_PARTY_CONFIRMED`, `AGREEMENT_AGREED`, `AGREEMENT_DECLINED`, `AGREEMENT_EXPIRED`, `AGREEMENT_START_ACKNOWLEDGED`, `AGREEMENT_IN_PROGRESS`, `AGREEMENT_COMPLETION_CONFIRMED`, `AGREEMENT_COMPLETED`, and `AGREEMENT_CANCELLED`.
8. Publish the notification drafts in the same transaction. A party-only event notifies the other party; a status-changing event notifies both. Expiry notifies both and has `actorId: null` in audit.
9. Return a view derived from the updated row and immutable snapshot.

Use an interactive transaction with `isolationLevel: Prisma.TransactionIsolationLevel.Serializable`; retry Prisma `P2034` transaction conflicts up to three times, then rethrow.

- [ ] **Step 5: Implement bounded expiry**

```ts
export const MAX_AGREEMENT_EXPIRIES_PER_SWEEP = 50;

export function createExpireDueAgreements(dependencies: {
  repository: AgreementRepository;
  clock: Clock;
  ids: IdGenerator;
}) {
  return async function expireDueAgreements(
    limit = MAX_AGREEMENT_EXPIRIES_PER_SWEEP,
  ): Promise<readonly AgreementView[]> {
    const now = dependencies.clock.now();
    const ids = await dependencies.repository.listDueConfirmationIds(
      now,
      limit,
    );
    const expired: AgreementView[] = [];
    for (const id of ids) {
      const result = await dependencies.repository.manage(
        id,
        { type: "EXPIRE", actorId: null },
        now,
        dependencies.ids,
      );
      if (result.ok) expired.push(result.value);
    }
    return expired;
  };
}
```

The due query is `status = PENDING_CONFIRMATION AND confirmDeadline <= now`, ordered by `confirmDeadline, id`. Concurrent sweeps remain safe because `manage` locks and the state machine makes a second expiry idempotent/invalid without new side effects.

- [ ] **Step 6: Run lifecycle and Phase 3 selection suites**

Run: `pnpm test:integration -- agreement-lifecycle run-deadline-selection`

Expected: PASS, including simultaneous completion exactly once and unchanged snapshot creation.

- [ ] **Step 7: Commit**

```bash
git add src/modules/agreements
git commit -m "feat: record the two-party agreement lifecycle"
```

---

### Task 5: Expose authenticated agreement, inbox, and expiry contracts

**Files:**

- Modify: `src/modules/identity/application/require-capability.ts`
- Modify: `src/modules/identity/application/require-capability.test.ts`
- Create: `src/modules/shared/http/worker-secret.ts`
- Create: `src/modules/shared/http/worker-secret.test.ts`
- Modify: `src/modules/bidding/http/selection-handlers.ts`
- Modify: `src/modules/bidding/http/selection-handlers.test.ts`
- Modify: `src/config/env.ts`
- Modify: `src/config/env.test.ts`
- Modify: `.env.example`
- Modify: `.env.test.example`
- Create: `src/modules/agreements/http/agreement-handlers.ts`
- Create: `src/modules/agreements/http/map-agreement-error.ts`
- Create: `src/modules/agreements/http/agreement-handlers.test.ts`
- Create: `src/modules/agreements/http/expiry-handlers.ts`
- Create: `src/modules/agreements/http/expiry-handlers.test.ts`
- Create: `app/api/agreements/route.ts`
- Create: `app/api/agreements/[id]/route.ts`
- Create: `app/api/agreements/expiry/run/route.ts`
- Create: `src/modules/notifications/application/list-inbox.ts`
- Create: `src/modules/notifications/application/mark-inbox-item-read.ts`
- Create: `src/modules/notifications/infrastructure/prisma-inbox-repository.ts`
- Create: `src/modules/notifications/infrastructure/prisma-inbox-repository.integration.test.ts`
- Create: `src/modules/notifications/http/inbox-handlers.ts`
- Create: `src/modules/notifications/http/inbox-handlers.test.ts`
- Create: `app/api/notifications/route.ts`
- Create: `app/api/notifications/[id]/route.ts`

**Interfaces:**

- Produces: `requireAnyCommercialCapability(headers)` and admin-capable `requireCapability(headers, capability)`.
- Produces: `GET /api/agreements?role=CLIENT|PROVIDER`, `GET/PATCH /api/agreements/:id`, and `POST /api/agreements/expiry/run`.
- Produces: `GET /api/notifications` and `PATCH /api/notifications/:id`.
- Consumes: the current session only; no actor ID is accepted from query or body.

- [ ] **Step 1: Generalize authorization with failing tests**

Assert `requireCapability(headers, "ADMIN")` accepts only an active admin, and `requireAnyCommercialCapability` accepts an active `CUSTOMER`, `PROVIDER`, or dual-capability user but rejects an admin-only account. Keep verification, onboarding, disabled, and restriction checks unchanged.

Change the signature from `CommercialCapability` to `Capability` and remove the hard-coded customer/provider rejection:

```ts
export async function requireAnyCommercialCapability(
  headers: Headers,
): Promise<Result<CurrentUser, AuthError>> {
  const user = await resolveCurrentUser(headers);
  if (user === null) return { ok: false, error: "UNAUTHENTICATED" };
  const available = (["CUSTOMER", "PROVIDER"] as const).find((capability) =>
    user.capabilities.includes(capability),
  );
  if (available === undefined)
    return { ok: false, error: "CAPABILITY_MISSING" };
  const access = canUseCapability(user, available, systemClock.now());
  return access.ok ? { ok: true, value: user } : access;
}
```

- [ ] **Step 2: Extract constant-time worker-secret comparison**

Move the byte-length check and `timingSafeEqual` logic from selection handlers into:

```ts
export function matchesWorkerSecret(
  presented: string | null,
  expected: string,
): boolean;
```

Keep `x-selection-worker-secret` unchanged. Add `AGREEMENT_WORKER_SECRET: z.string().min(32)` and use `x-agreement-worker-secret` for expiry. Update both environment templates with a 32-character local-only value.

- [ ] **Step 3: Write route-contract tests before handlers**

For agreement routes, cover 401 unauthenticated, 403 access denial, 404 absent, 403 outsider, 409 invalid state/deadline, 422 exact-object validation, and 200 success. Use this discriminated request body:

```ts
const agreementCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CONFIRM") }).strict(),
  z.object({ action: z.literal("DECLINE"), explanation: z.string() }).strict(),
  z.object({ action: z.literal("ACKNOWLEDGE_START") }).strict(),
  z.object({ action: z.literal("CONFIRM_COMPLETION") }).strict(),
  z
    .object({
      action: z.literal("CANCEL"),
      reasonCode: z.enum(["SCHEDULE_CHANGED", "SCOPE_CANNOT_PROCEED", "OTHER"]),
      explanation: z.string(),
    })
    .strict(),
]);
```

The expiry handler returns 401 for missing/wrong secret and `{ expirations: [...] }` for a valid call.

- [ ] **Step 4: Implement thin agreement routes**

`GET /api/agreements` validates `role` and calls `listAgreements`. `GET /api/agreements/:id` calls `getAgreement`. `PATCH /api/agreements/:id` validates the discriminated body, maps it to `ManageAgreementCommand`, and calls `manageAgreement`. All three authenticate with `requireAnyCommercialCapability`; the use case still proves participant ownership.

Use this error map:

```ts
const agreementErrors = {
  AGREEMENT_NOT_FOUND: [404, "agreements.errors.notFound"],
  NOT_PARTICIPANT: [403, "agreements.errors.notParticipant"],
  INVALID_STATE: [409, "agreements.errors.invalidState"],
  CONFIRMATION_EXPIRED: [409, "agreements.errors.confirmationExpired"],
  INVALID_EXPLANATION: [422, "agreements.errors.invalidExplanation"],
} as const;
```

- [ ] **Step 5: Implement recipient-scoped inbox operations**

```ts
export type InboxItem = Readonly<{
  id: string;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  messageKey: string;
  variables: Readonly<Record<string, string | number | null>>;
  readAt: Date | null;
  createdAt: Date;
}>;

export interface InboxRepository {
  list(recipientId: string, limit: number): Promise<readonly InboxItem[]>;
  markRead(
    id: string,
    recipientId: string,
    now: Date,
  ): Promise<Result<InboxItem, "NOTIFICATION_NOT_FOUND">>;
}
```

List at most 50 newest items. `PATCH /api/notifications/:id` accepts only `{ "read": true }`; the Prisma update must include both notification ID and authenticated recipient ID so one user cannot acknowledge another's message. Repeating the patch preserves the original `readAt`.

- [ ] **Step 6: Run focused tests**

Run:

```powershell
pnpm test:unit -- src/modules/identity/application/require-capability.test.ts src/modules/shared/http/worker-secret.test.ts src/modules/agreements/http src/modules/notifications/http
pnpm test:integration -- prisma-inbox-repository
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .env.example .env.test.example app/api/agreements app/api/notifications src/config src/modules/identity src/modules/shared/http src/modules/agreements/http src/modules/notifications
git commit -m "feat: expose agreements and lifecycle notifications"
```

---

### Task 6: Build participant agreement and inbox pages

**Files:**

- Create: `src/modules/agreements/ui/agreement-list.tsx`
- Create: `src/modules/agreements/ui/agreement-detail.tsx`
- Create: `src/modules/agreements/ui/agreement-action-form.tsx`
- Create: `src/modules/agreements/ui/agreement-ui.test.tsx`
- Create: `src/modules/notifications/ui/inbox-list.tsx`
- Create: `src/modules/notifications/ui/inbox-list.test.tsx`
- Create: `app/[locale]/(workspace)/client/agreements/page.tsx`
- Create: `app/[locale]/(workspace)/provider/agreements/page.tsx`
- Create: `app/[locale]/(workspace)/agreements/[id]/page.tsx`
- Create: `app/[locale]/(workspace)/notifications/page.tsx`
- Modify: `src/modules/identity/ui/workspace-view.tsx`
- Modify: `src/modules/identity/ui/render-contract.test.tsx`
- Modify: `app/[locale]/(workspace)/client/tenders/[id]/page.tsx`
- Modify: `app/[locale]/(workspace)/provider/tenders/[id]/page.tsx`

**Interfaces:**

- Consumes: server-side `AgreementSummary[]`, `AgreementView`, `InboxItem[]`, current user, locale, and message catalog.
- Produces: accessible forms that submit only action-specific fields to `PATCH /api/agreements/:id` and then `router.refresh()`.
- Preserves: existing tender disclosure and bid-outcome behavior; only a winning participant sees an agreement link.

- [ ] **Step 1: Write render-contract tests**

Assert the participant detail renders the immutable tender title, amount/currency, winning conditions, confirmation deadline, both party checkpoints, and status text. For every status, assert exactly the allowed controls:

```ts
expect(
  renderAgreement(pendingClient).getByRole("button", { name: copy.confirm }),
).toBeTruthy();
expect(
  renderAgreement(pendingClient).getByRole("button", { name: copy.decline }),
).toBeTruthy();
expect(
  renderAgreement(agreedClient).getByRole("button", {
    name: copy.acknowledgeStart,
  }),
).toBeTruthy();
expect(
  renderAgreement(inProgressClient).getByRole("button", {
    name: copy.confirmCompletion,
  }),
).toBeTruthy();
expect(renderAgreement(completedClient).queryByRole("button")).toBeNull();
```

Assert decline/cancel forms state: the platform records the reason, does not determine fault, and does not resolve payment/legal disputes. Assert statuses are present as visible text rather than color-only markers.

- [ ] **Step 2: Run UI tests to verify they fail**

Run: `pnpm test:unit -- src/modules/agreements/ui src/modules/notifications/ui`

Expected: FAIL because the UI files do not exist.

- [ ] **Step 3: Implement agreement list and detail components**

Lists group records into `Needs action`, `Current work`, and `Completed or cancelled`, with an empty state and links to `/${locale}/agreements/${id}`. The detail uses a semantic `<dl>` for the immutable snapshot and an ordered lifecycle list with `aria-current="step"` on the current checkpoint.

The client action request is exact and generic:

```ts
const response = await fetch(`/api/agreements/${agreementId}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(command),
});
if (!response.ok) {
  const body = (await response.json()) as { code: string };
  setError(copy.errors[body.code] ?? copy.errors.generic);
  return;
}
router.refresh();
```

Disable the submitting control, announce success/error through `role="status"`/`role="alert"`, and put irreversible decline/cancel consequences before the submit button.

- [ ] **Step 4: Implement server-authorized pages**

Each list page requires its matching capability and calls `listAgreements` with the authenticated user ID. The shared detail page uses `requireAnyCommercialCapability` and `getAgreement`, then renders the role already derived by the server. Redirect only unauthenticated users to login; use `WorkspaceDenied` for account-state denial and `notFound()` for absent/outsider details so the page does not disclose agreement existence.

On the client and provider tender detail pages, obtain the current agreement by tender through a new `getAgreementForTender(tenderId, actor)` query. Render a link only when it returns success. Do not infer the agreement ID from bids or accept it from client data.

- [ ] **Step 5: Implement the inbox page**

Render localized `messageKey` values with their variables, `<time dateTime={createdAt.toISOString()}>`, unread text, a mark-read button, and a safe destination selected only from `aggregateType`:

```ts
const href =
  item.aggregateType === "Agreement"
    ? `/${locale}/agreements/${item.aggregateId}`
    : item.aggregateType === "Review"
      ? `/${locale}/profiles/${userId}`
      : null;
```

Never treat a stored variable as a URL. Unknown topics render `messages.notifications.generic` and remain readable.

- [ ] **Step 6: Add workspace links and run UI tests**

Add Agreements and Inbox links to both commercial workspace action groups, without showing an admin link to ordinary users.

Run: `pnpm test:unit -- src/modules/agreements/ui src/modules/notifications/ui src/modules/identity/ui/render-contract.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/[locale]/\(workspace\) src/modules/agreements/ui src/modules/notifications/ui src/modules/identity/ui
git commit -m "feat: add agreement and inbox workspaces"
```

---

### Task 7: Publish one authentic review per completed agreement

**Files:**

- Create: `src/modules/reviews/application/publish-review.ts`
- Create: `src/modules/reviews/application/get-profile-reviews.ts`
- Create: `src/modules/reviews/infrastructure/prisma-review-repository.ts`
- Create: `src/modules/reviews/infrastructure/review-lifecycle.integration.test.ts`
- Create: `src/modules/reviews/http/review-handlers.ts`
- Create: `src/modules/reviews/http/map-review-error.ts`
- Create: `src/modules/reviews/http/review-handlers.test.ts`
- Create: `app/api/agreements/[id]/reviews/route.ts`
- Create: `app/api/profiles/[id]/reviews/route.ts`

**Interfaces:**

- Produces: `publishReview(agreementId, input, actor)`, `getProfileReviews(userId)`, `ReviewView`, and `ProfileReviewView`.
- Consumes: completed agreement state through `PrismaAgreementGateway.lockForReview(transaction, agreementId)`; the `reviews` module never reads or writes the `Agreement` table directly.

- [ ] **Step 1: Write eligibility and uniqueness integration tests**

Cover incomplete agreement, outsider, self-review attempt, invalid/weak input, first publication, duplicate publication, reciprocal publication, and a database-level concurrent duplicate race:

```ts
const results = await Promise.all([
  publishReview(agreementId, validReview, { id: clientId }),
  publishReview(agreementId, validReview, { id: clientId }),
]);
expect(results.filter((result) => result.ok)).toHaveLength(1);
expect(results.filter((result) => !result.ok)).toHaveLength(1);
await expect(
  database.review.count({ where: { agreementId, reviewerId: clientId } }),
).resolves.toBe(1);
```

Assert the reviewed party is always derived as the other participant, each publication writes audit/outbox/inbox in the same transaction, and a forced publisher error rolls back the review.

- [ ] **Step 2: Run the review integration test to verify it fails**

Run: `pnpm test:integration -- review-lifecycle`

Expected: FAIL because the review repository does not exist.

- [ ] **Step 3: Define publication contracts**

```ts
export type PublishReviewError =
  | "AGREEMENT_NOT_FOUND"
  | "NOT_PARTICIPANT"
  | "AGREEMENT_NOT_COMPLETED"
  | "REVIEW_ALREADY_EXISTS"
  | "INVALID_REVIEW";

export interface ReviewRepository {
  publish(
    agreementId: string,
    reviewerId: string,
    draft: ValidatedReviewDraft,
    ids: IdGenerator,
    now: Date,
  ): Promise<Result<ReviewView, Exclude<PublishReviewError, "INVALID_REVIEW">>>;
  getForProfile(reviewedId: string): Promise<ProfileReviewView>;
}
```

Add this published read to `src/modules/agreements/infrastructure/prisma-agreement-gateway.ts` beside `createPending`; the reviews infrastructure supplies the transaction but agreement ownership stays in the agreements module:

```ts
export type CompletedAgreementForReview = Readonly<{
  id: string;
  clientId: string;
  providerId: string;
  tenderTitle: string;
  status: AgreementStatus;
}>;

lockForReview(
  transaction: Prisma.TransactionClient,
  agreementId: string,
): Promise<CompletedAgreementForReview | null>;
```

Implement it with `SELECT ... FOR UPDATE` followed by a selected Agreement read inside the same transaction. `publishReview` validates in the domain before opening a transaction, calls this agreement-owned gateway, checks `COMPLETED`, derives `reviewedId`, inserts the review, writes `REVIEW_PUBLISHED` audit, and notifies the reviewed party. Map Prisma `P2002` on `(agreementId, reviewerId)` to `REVIEW_ALREADY_EXISTS`.

- [ ] **Step 4: Implement public review reads and aggregates**

Select only `status = PUBLISHED`, newest first. Return reviewer public display name through a published profiles lookup, not a direct `UserProfile` query. Public rows contain agreement tender title, four dimensions, derived overall, normalized comment, reviewer display name, and publication time; they do not expose agreement IDs, tender IDs, email, phone, exact address, or cancellation details.

Compute the aggregate from the same published rows used for the list. A redacted row must be absent from both outputs, preventing list/aggregate disagreement.

- [ ] **Step 5: Implement route handlers**

`POST /api/agreements/:id/reviews` requires any commercial capability and accepts an exact body:

```json
{
  "quality": 5,
  "deadline": 4,
  "communication": 5,
  "agreedPrice": 4,
  "comment": "Careful work, clear updates, and the agreed price was kept."
}
```

Map absent to 404, outsider to 403, incomplete/duplicate to 409, and invalid input to 422. `GET /api/profiles/:id/reviews` is public and returns `{ aggregate, reviews }`; absent profile handling belongs to the profile page in Task 8.

- [ ] **Step 6: Run review tests**

Run:

```powershell
pnpm test:integration -- review-lifecycle
pnpm test:unit -- src/modules/reviews/http
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/agreements/[id]/reviews app/api/profiles/[id]/reviews src/modules/reviews
git commit -m "feat: publish verified job-bound reviews"
```

---

### Task 8: Add public aggregates and immutable admin redaction

**Files:**

- Modify: `src/modules/profiles/application/get-provider-display-names.ts`
- Modify: `src/modules/profiles/infrastructure/prisma-profile-repository.ts`
- Create: `src/modules/profiles/application/get-public-profile.ts`
- Create: `src/modules/reviews/application/redact-review.ts`
- Create: `src/modules/reviews/application/list-reviews-for-moderation.ts`
- Extend: `src/modules/reviews/infrastructure/prisma-review-repository.ts`
- Extend: `src/modules/reviews/infrastructure/review-lifecycle.integration.test.ts`
- Extend: `src/modules/reviews/http/review-handlers.ts`
- Extend: `src/modules/reviews/http/review-handlers.test.ts`
- Create: `app/api/admin/reviews/route.ts`
- Create: `app/api/admin/reviews/[id]/route.ts`
- Create: `src/modules/reviews/ui/review-form.tsx`
- Create: `src/modules/reviews/ui/review-list.tsx`
- Create: `src/modules/reviews/ui/review-summary.tsx`
- Create: `src/modules/reviews/ui/review-moderation-list.tsx`
- Create: `src/modules/reviews/ui/review-ui.test.tsx`
- Create: `app/[locale]/profiles/[id]/page.tsx`
- Create: `app/[locale]/(workspace)/admin/reviews/page.tsx`
- Modify: `src/modules/agreements/ui/agreement-detail.tsx`

**Interfaces:**

- Produces: `PublicProfileView`, `redactReview(reviewId, reason, admin)`, and `listReviewsForModeration(admin)`.
- Consumes: admin authorization from Task 5 and review/public-profile projections only.
- Preserves: review rows and original text/scores after redaction; public consumers cannot retrieve them.

- [ ] **Step 1: Write public-projection and moderation tests**

Assert public profiles include only `userId`, display name, account kind, city, activity description, provider specialties, and review output. Explicitly assert serialized output omits `phoneE164`, email, disabled/restricted fields, and internal IDs.

For redaction, assert:

```ts
await redactReview(
  reviewId,
  { reason: "Contains a private telephone number." },
  admin,
);
const stored = await database.review.findUniqueOrThrow({
  where: { id: reviewId },
});
expect(stored).toMatchObject({
  status: "REDACTED",
  comment: originalComment,
  redactedById: admin.id,
  redactionReason: "Contains a private telephone number.",
});
expect((await getProfileReviews(reviewedId)).aggregate.reviewCount).toBe(0);
expect((await getProfileReviews(reviewedId)).reviews).toEqual([]);
```

Also prove ordinary users receive 403, reason length outside 10–500 Unicode characters receives 422, a repeat redaction is idempotent with no second audit/outbox/inbox row, and redaction cannot change any score or comment.

- [ ] **Step 2: Generalize the safe profile lookup**

Rename `ProviderDisplayNameRepository`/`getProviderDisplayNames` to `PublicDisplayNameRepository`/`getPublicDisplayNames`, update bidding callers, and add:

```ts
export type PublicProfileView = Readonly<{
  userId: string;
  displayName: string;
  accountKind: "PERSON" | "COMPANY";
  city: string;
  activityDescription: string;
  providerSpecialties: readonly "CONSTRUCTION_REPAIR"[];
}>;
```

Select only those columns. Do not reuse `SafeProfileView`, which intentionally contains private phone and preference fields for the owner.

- [ ] **Step 3: Implement redaction transaction and admin routes**

`redactReview` requires `ADMIN`, locks the review, changes only status/redaction metadata, writes `REVIEW_REDACTED` audit, and notifies the author with a policy-neutral message. `GET /api/admin/reviews` returns the moderation projection. `PATCH /api/admin/reviews/:id` accepts only:

```json
{ "action": "REDACT", "reason": "Contains a private telephone number." }
```

The broader account/payment/trust administration remains out of scope until Phase 6.

- [ ] **Step 4: Build review and profile UI**

The completed agreement detail shows `ReviewForm` only when `canReview` is true, otherwise shows the already-published review or a clear ineligible state. Use four native `<select>` fields labeled 1–5, no separate overall input, a live derived-average preview, a required comment textarea, remaining character guidance, and an irreversible-publication notice.

The public profile page combines `getPublicProfile` and `getProfileReviews`, renders the aggregate with its count, renders all four dimension averages, and lists published reviews. With zero reviews it displays `No completed-job reviews yet` rather than `0 stars`.

The admin page requires `ADMIN`, lists publication time/author/subject/text/scores, and provides a reason form. It labels redaction as removal from public views and aggregates, not deletion.

- [ ] **Step 5: Run focused UI, profile, review, and authorization tests**

Run:

```powershell
pnpm test:unit -- src/modules/reviews/ui src/modules/identity/application/require-capability.test.ts
pnpm test:integration -- profiles review-lifecycle
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin app/[locale]/profiles app/[locale]/\(workspace\)/admin src/modules/profiles src/modules/reviews src/modules/agreements/ui/agreement-detail.tsx
git commit -m "feat: publish review aggregates with auditable redaction"
```

---

### Task 9: Complete bilingual, responsive, and accessible Phase 4 presentation

**Files:**

- Modify: `src/modules/localization/messages/en.json`
- Modify: `src/modules/localization/messages/ka.json`
- Modify: `src/modules/localization/messages.test.ts`
- Modify: `app/globals.css`
- Extend: `src/modules/agreements/ui/agreement-ui.test.tsx`
- Extend: `src/modules/notifications/ui/inbox-list.test.tsx`
- Extend: `src/modules/reviews/ui/review-ui.test.tsx`

**Interfaces:**

- Produces: matching `agreements`, `reviews`, `notifications`, and `moderation` catalog shapes in both locales.
- Consumes: existing `Messages = typeof en` compile-time catalog contract.

- [ ] **Step 1: Add failing message parity and render tests**

Extend the recursive catalog-shape test so Georgian and English keys match exactly. Render every lifecycle status and every outbox topic in both locales; fail if a message key is displayed literally. Assert buttons have accessible names, every form input has a label/error association, current steps use `aria-current`, alerts use `role="alert"`, and star/average output has readable text.

- [ ] **Step 2: Author complete English and Georgian catalogs**

Add exact keys for:

```text
agreements: list titles, empty states, immutable terms, every status, every action,
deadline/party checkpoints, cancellation reasons, success copy, no-disputes notice,
and every mapped error.

reviews: four dimension labels, derived overall, comment guidance, publication warning,
published/ineligible/already-reviewed states, public aggregate/count/empty state,
and validation errors.

notifications: inbox title/empty/unread/read/mark-read/generic plus one sentence template
for every OUTBOX_TOPICS value.

moderation: review queue, redaction reason, preserved-record notice, success, and errors.
```

Georgian content must be authored directly and fit the same controls without truncation. Do not mention dispute resolution, reimbursement, fault findings, or payment custody.

- [ ] **Step 3: Add focused responsive styles**

Reuse the existing typography, borders, colors, radii, and focused-column spacing. Add a two-column immutable-summary/lifecycle layout above 56rem and one column below it; convert agreement lists and moderation rows to labeled cards on narrow screens. Ensure 44px minimum action targets, visible `:focus-visible`, no horizontal scroll at 320px, text wrapping for Georgian, and `prefers-reduced-motion` compatibility.

- [ ] **Step 4: Run localization and render suites**

Run:

```powershell
pnpm test:unit -- src/modules/localization/messages.test.ts src/modules/agreements/ui src/modules/notifications/ui src/modules/reviews/ui
pnpm typecheck
```

Expected: PASS with no missing keys or unsafe index access.

- [ ] **Step 5: Commit**

```bash
git add src/modules/localization src/modules/agreements/ui src/modules/notifications/ui src/modules/reviews/ui app/globals.css
git commit -m "feat: localize and polish the phase 4 workflow"
```

---

### Task 10: Prove the functional MVP journey and add the release gate

**Files:**

- Create: `scripts/seed-phase-04.ts`
- Create: `src/test/e2e/fixtures/agreements.ts`
- Modify: `src/test/e2e/fixtures/accounts.ts`
- Create: `src/test/e2e/phase-04-agreement.spec.ts`
- Create: `src/test/e2e/phase-04-reviews.spec.ts`
- Create: `src/test/e2e/phase-04-accessibility.spec.ts`
- Modify: `package.json`
- Modify: `.github/workflows/verify.yml`
- Modify: `docs/development.md`

**Interfaces:**

- Produces: `pnpm seed:phase-4` and `pnpm verify:mvp`.
- Consumes: Phase 1 password, Phase 2/3 seed data, `SELECTION_WORKER_SECRET`, and new `AGREEMENT_WORKER_SECRET`.
- Preserves: `verify:phase-0` excludes all tagged Phase 1–4 journeys; each later phase gate remains cumulative.

- [ ] **Step 1: Write a deterministic Phase 4 seed**

`scripts/seed-phase-04.ts` must:

1. Refuse production and resolve only guarded `DATABASE_URL_TEST`.
2. Require the Phase 1 and Phase 3 seeded client/provider accounts and `PHASE_1_SEED_PASSWORD`.
3. Run the real selection worker for the seeded due tender if it has not run.
4. Leave that winning agreement in `PENDING_CONFIRMATION` for the browser journey.
5. Create `phase4.admin@tender.test` through Better Auth, complete its public profile, and grant `ADMIN` only through the fixture's explicit moderation-owned database step.
6. Delete only fixed Phase 4 reviews/inbox/audit records before reseeding; never truncate shared tables.
7. Print IDs and non-secret fixture names only; never print passwords or worker secrets.

Add `admin: "phase4.admin@tender.test"` to `seededAccounts`, and allow `signInSeededAccount` to accept it.

- [ ] **Step 2: Write the bilingual agreement journey**

For `ka` and `en`:

1. Sign in as the winning provider and confirm the immutable snapshot.
2. Open Inbox and verify the initial winner message is present and can be marked read.
3. Sign in as the client in a separate browser context and confirm; both now see `AGREED`.
4. Have client/provider acknowledge start in opposite order; both now see `IN_PROGRESS`.
5. Submit completion confirmations concurrently through the two browser contexts.
6. Assert both see `COMPLETED`, no completion action remains, and refresh/retry creates no duplicate event.

Use API responses only to locate deterministic IDs and verify exact status; perform participant actions through labeled page controls.

- [ ] **Step 3: Write reciprocal review and moderation journeys**

For each locale, publish a client review of the provider and a provider review of the client. Assert the derived overall and four dimensions on each public profile. Attempt a second review and assert no form/control can publish it. Sign in as admin, redact one seeded review with a reason, then assert its original profile aggregate count decreases and the other published review remains visible.

Add direct API assertions for outsider, incomplete agreement, duplicate, self-review-shaped payload (reviewed IDs are rejected as unknown fields), weak comment, and out-of-range score.

- [ ] **Step 4: Add accessibility and no-disputes acceptance checks**

On desktop and mobile Chromium, use keyboard navigation through confirm/start/complete/review. Assert one `<main>`, one page `<h1>`, visible focus, associated labels, status text, live errors, and no horizontal scroll at the mobile viewport. Search rendered Phase 4 pages in both locales for forbidden product claims equivalent to `resolve dispute`, `decide fault`, `guarantee payment`, or `award compensation`; the only dispute-related sentence allowed is the neutral disclaimer that the platform records status and does not adjudicate.

- [ ] **Step 5: Add package scripts**

```json
"seed:phase-4": "tsx scripts/seed-phase-04.ts",
"verify:mvp": "pnpm verify:phase-3 && pnpm db:migrate:test && pnpm test:integration -- agreements notifications reviews profiles && pnpm build && pnpm seed:phase-4 && pnpm test:e2e --grep @phase-4"
```

Extend `verify:phase-0` to grep-invert `@phase-4` as well as prior tags. Tag every new journey `@phase-4`.

- [ ] **Step 6: Add a Phase 4 CI job**

Copy the Phase 3 job as `phase-4`, name it `Phase 4 functional MVP`, add:

```yaml
AGREEMENT_WORKER_SECRET: ci-only-agreement-worker-secret-0123456789
```

to every job that builds the app, and run `pnpm verify:mvp` in the new job. Keep PostgreSQL 17, Node 24, pnpm setup, MinIO setup, password generation, Chromium installation, failure artifact upload, and the existing 30-minute timeout.

- [ ] **Step 7: Document local operation and invariants**

Append a Phase 4 section to `docs/development.md` covering:

- prerequisites and cumulative seeding order (`phase-1`, `phase-2`, `phase-3`, `phase-4`);
- how to generate `AGREEMENT_WORKER_SECRET` with the same 24-byte PowerShell RNG pattern already documented for selection;
- what `POST /api/agreements/expiry/run` does and why confirmation expires exactly at 48 hours;
- agreement/review invariants, including no fallback bidder and no dispute adjudication;
- inbox records versus outbox delivery (Phase 4 provides inbox; production email delivery remains Phase 5);
- `pnpm verify:mvp` and what it adds over `verify:phase-3`.

- [ ] **Step 8: Run the complete MVP gate**

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
$bytes = [byte[]]::new(24)
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:SELECTION_WORKER_SECRET = [Convert]::ToBase64String($bytes)
$bytes = [byte[]]::new(24)
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:AGREEMENT_WORKER_SECRET = [Convert]::ToBase64String($bytes)
pnpm verify:mvp
```

Expected: PASS end to end — formatting, lint, boundaries, typecheck, all unit/integration suites, production build, Phase 0–3 browser suites, then the complete `@phase-4` agreement/review journey on desktop and mobile Chromium.

- [ ] **Step 9: Confirm Phase 4 exit criteria explicitly**

Record evidence for:

1. **Functional MVP from registration to review:** cumulative `pnpm verify:mvp` plus reciprocal bilingual Playwright journeys.
2. **No dispute-resolution claim:** localization/render search and visible neutral cancellation copy.
3. **Published, non-redacted aggregate only:** review domain test, PostgreSQL redaction integration test, and admin Playwright journey.
4. **Every permitted/forbidden lifecycle transition and exact deadline boundary:** domain matrix.
5. **Completion exactly once under concurrency:** agreement integration race plus two-context Playwright completion.
6. **Authentic reviews only:** outsider/incomplete/duplicate/self-review/weak-comment/out-of-range tests.
7. **Lifecycle notifications are atomic:** rollback integration tests and inbox journey.

- [ ] **Step 10: Commit**

```bash
git add scripts src/test package.json .github/workflows/verify.yml docs/development.md
git commit -m "test: prove the functional marketplace MVP"
```

---

## Phase 4 completion checklist

- [ ] `pnpm verify:mvp` passes locally from a clean primary checkout.
- [ ] The CI `phase-4` job passes, and Phase 1–3 jobs still pass with the new required agreement worker secret.
- [ ] `pnpm verify:boundaries` reports no cross-domain or third-party import violation.
- [ ] Phase 3 still creates exactly one immutable pending agreement and never silently promotes a fallback bidder.
- [ ] Human confirmation is accepted only before the deadline; the expiry worker cancels at or after it and is retry-safe.
- [ ] Two simultaneous completion confirmations produce one `COMPLETED` transition, one audit event, and one terminal notification per party.
- [ ] Cancellation data is neutral and append-only; no route, copy, or UI claims adjudication, fault, custody, or compensation.
- [ ] Every lifecycle event commits agreement state, audit, outbox, and inbox together or rolls them all back.
- [ ] Each party can publish at most one review per completed agreement, and reviewed identity is always derived from the agreement.
- [ ] Public profile output contains no private contact or account-state data.
- [ ] Overall scores and profile aggregates are derived from published, non-redacted dimension scores only.
- [ ] Redaction preserves original review data and audit history while removing the record from public lists and aggregates.
- [ ] Georgian and English journeys pass on desktop and mobile, including keyboard-only agreement and review actions.
