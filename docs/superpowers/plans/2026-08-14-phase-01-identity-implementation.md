# Phase 1 Identity and Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let clients and construction/repair providers register, verify email, authenticate, manage a basic profile, and enter the correct Georgian/English workspace under server-enforced capability rules.

**Architecture:** Better Auth owns credentials, sessions, verification tokens, and password-reset tokens through Prisma. The identity module owns marketplace capabilities and restriction policy; the profiles module owns business-facing personal/company data. Registration can create an unverified auth account, but commercial capability becomes usable only after verification and onboarding completion.

**Tech Stack:** Phase 0 stack plus Better Auth with Prisma adapter, Argon2/password defaults supplied by the maintained auth library, React server components for initial data, Zod route contracts, development/test mail outbox adapter, Vitest, PostgreSQL integration tests, and Playwright.

## Global Constraints

- Capabilities are `CUSTOMER`, `PROVIDER`, and `ADMIN`; provider specialty is a separate concept.
- Phase 1 provider specialty is `CONSTRUCTION_REPAIR` only.
- One user may hold both customer and provider capabilities.
- `ADMIN` cannot be requested during registration or granted by any public route.
- Email must be verified before a user can enter a commercial workspace.
- Phone is collected and normalized but phone verification is deferred to Phase 6.
- Initial countries are restricted to Georgia (`GE`), locales to `ka`/`en`, currencies to `GEL`/`USD`.
- Every authorization decision is server-side and covered by a negative test.
- Test-only inbox and verification helpers must be impossible to enable in production.
- UI styling follows the separately approved original design direction, never the reference app.

---

## Planned file structure

```text
app/
  api/auth/[...all]/route.ts                 Better Auth transport adapter
  api/onboarding/complete/route.ts           marketplace onboarding command
  api/profile/me/route.ts                    own-profile query/update
  api/test/mailbox/route.ts                  non-production verification helper
  [locale]/(auth)/register/page.tsx           choose client/provider onboarding
  [locale]/(auth)/register/client/page.tsx
  [locale]/(auth)/register/provider/page.tsx
  [locale]/(auth)/login/page.tsx
  [locale]/(auth)/verify-email/page.tsx
  [locale]/(auth)/forgot-password/page.tsx
  [locale]/(auth)/reset-password/page.tsx
  [locale]/(workspace)/client/page.tsx
  [locale]/(workspace)/provider/page.tsx
  [locale]/(workspace)/profile/page.tsx
src/modules/
  identity/domain/                          capability/restriction policies
  identity/application/                     current user and guards
  identity/infrastructure/                  Better Auth and Prisma adapters
  identity/http/                            request/result mapping
  profiles/domain/                          profile validation/value objects
  profiles/application/                     onboarding and profile use cases
  profiles/infrastructure/                  Prisma repository
  notifications/ports/mail-sender.ts        provider-neutral email port
  notifications/adapters/test-mailbox.ts    deterministic test adapter
  localization/messages/ka.json
  localization/messages/en.json
proxy.ts                                     optimistic route redirection only
```

### Task 1: Add identity and profile persistence contracts

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_identity_profiles/migration.sql`
- Create: `src/modules/identity/domain/capability.ts`
- Create: `src/modules/identity/domain/access-policy.ts`
- Create: `src/modules/identity/domain/access-policy.test.ts`
- Create: `src/modules/profiles/domain/profile.ts`

**Interfaces:**
- Consumes: `Result<T, E>` from `@/src/modules/shared`.
- Produces: `Capability`, `ProviderSpecialty`, `AccountAccessState`, `canUseCapability(state, capability, now)`, and profile value types.

- [ ] **Step 1: Write failing access-policy tests**

```ts
import { describe, expect, it } from "vitest";
import { canUseCapability } from "./access-policy";

const active = {
  emailVerified: true,
  onboardingComplete: true,
  disabledAt: null,
  restrictedUntil: null,
  capabilities: ["CUSTOMER"] as const,
};
const now = new Date("2026-08-14T12:00:00.000Z");

describe("canUseCapability", () => {
  it("allows an active verified capability", () => {
    expect(canUseCapability(active, "CUSTOMER", now)).toEqual({ ok: true, value: undefined });
  });

  it.each([
    [{ ...active, emailVerified: false }, "EMAIL_UNVERIFIED"],
    [{ ...active, onboardingComplete: false }, "ONBOARDING_INCOMPLETE"],
    [{ ...active, disabledAt: new Date() }, "ACCOUNT_DISABLED"],
    [{ ...active, capabilities: [] }, "CAPABILITY_MISSING"],
  ] as const)("denies invalid state", (state, error) => {
    expect(canUseCapability(state, "CUSTOMER", now)).toEqual({ ok: false, error });
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm vitest run src/modules/identity/domain/access-policy.test.ts`

Expected: FAIL because the policy is absent.

- [ ] **Step 3: Define database models**

Add Prisma enums and models with these required fields and constraints:

```prisma
enum CapabilityCode {
  CUSTOMER
  PROVIDER
  ADMIN
}

enum ProviderSpecialtyCode {
  CONSTRUCTION_REPAIR
  TRANSPORT
  EQUIPMENT
  DAILY_LABOR
  MATERIAL_SUPPLIER
}

model UserCapability {
  id        String         @id
  userId    String
  code      CapabilityCode
  grantedAt DateTime       @default(now())
  grantedBy String?
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, code])
  @@index([code, userId])
}

model UserProfile {
  id                   String   @id
  userId               String   @unique
  accountKind          String
  displayName          String
  phoneE164            String   @unique
  countryCode          String   @default("GE")
  city                 String
  activityDescription  String
  preferredLocale      String   @default("ka")
  preferredCurrency    String   @default("GEL")
  profilePhotoObjectKey String?
  onboardingCompleteAt DateTime?
  disabledAt           DateTime?
  restrictedUntil      DateTime?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ProviderProfile {
  id          String                @id
  userId      String                @unique
  specialties ProviderSpecialtyCode[]
  user        User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt
}
```

Use the exact Better Auth `User`, `Session`, `Account`, and `Verification` schema produced for the installed Better Auth version; commit the generated result and migration rather than inventing incompatible fields.

- [ ] **Step 4: Implement domain policy**

Use these public types:

```ts
export type Capability = "CUSTOMER" | "PROVIDER" | "ADMIN";
export type ProviderSpecialty = "CONSTRUCTION_REPAIR";
export type AccessDenial =
  | "EMAIL_UNVERIFIED"
  | "ONBOARDING_INCOMPLETE"
  | "ACCOUNT_DISABLED"
  | "ACCOUNT_RESTRICTED"
  | "CAPABILITY_MISSING";

export function canUseCapability(
  state: AccountAccessState,
  required: Capability,
  now: Date,
): Result<void, AccessDenial>;
```

Restriction is active when `restrictedUntil` is later than the injected current time; adjust the function to receive `now: Date` rather than reading the system clock.

- [ ] **Step 5: Migrate and verify constraints**

Run: `pnpm prisma migrate dev --name identity_profiles; pnpm db:migrate:test; pnpm test:unit`

Expected: migration and policy tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add prisma src/modules/identity/domain src/modules/profiles/domain
git commit -m "feat: model identity capabilities and profiles"
```

### Task 2: Configure Better Auth and secure session transport

**Files:**
- Create: `src/modules/notifications/ports/mail-sender.ts`
- Create: `src/modules/notifications/adapters/log-mail-sender.ts`
- Create: `src/modules/identity/infrastructure/auth.ts`
- Create: `src/modules/identity/application/current-user.ts`
- Create: `src/modules/identity/application/current-user.integration.test.ts`
- Create: `app/api/auth/[...all]/route.ts`
- Create: `proxy.ts`
- Modify: `src/config/env.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Prisma adapter, `AUTH_SECRET`, and `APP_URL`.
- Produces: `MailSender`, `createAuth({ mailSender })`, `auth`, `getCurrentUser(headers): Promise<CurrentUser | null>`, and Better Auth HTTP routes.

- [ ] **Step 1: Install auth dependencies**

Run:

```powershell
pnpm add --save-exact better-auth @better-auth/prisma-adapter
```

Expected: packages install and the lockfile changes.

- [ ] **Step 2: Create the mail port and auth factory**

Create the provider-neutral mail contract:

```ts
export type MailTemplate = "VERIFY_EMAIL" | "RESET_PASSWORD";
export type MailMessage = Readonly<{
  to: string;
  template: MailTemplate;
  locale: "ka" | "en";
  variables: Readonly<Record<string, string>>;
}>;
export interface MailSender { send(message: MailMessage): Promise<void> }
```

`createAuth({ mailSender })` configures the Prisma adapter, email/password, email verification requirement, password reset callback, secure cookies in production, trusted origin equal to `APP_URL`, and no social providers. The log sender records template and a redacted recipient only; it never logs tokenized URLs. Export `auth` with the environment-selected sender.

- [ ] **Step 3: Generate and migrate the exact auth schema**

Run:

```powershell
pnpm exec auth generate --config src/modules/identity/infrastructure/auth.ts --output prisma/better-auth.generated.prisma
```

Expected: the generated schema documents the installed version's exact fields. Merge those models into `prisma/schema.prisma`, remove the temporary generated file in the same reviewed patch, and create a forward migration with `pnpm prisma migrate dev --name better_auth`.

- [ ] **Step 4: Write a failing current-user integration test**

The test creates a verified user with a customer capability and profile, creates a session through Better Auth, passes its cookie headers to `getCurrentUser`, and expects:

```ts
{
  id: expect.any(String),
  email: "client@example.test",
  emailVerified: true,
  displayName: "Test Client",
  capabilities: ["CUSTOMER"],
  providerSpecialties: [],
  preferredLocale: "ka",
  preferredCurrency: "GEL",
  onboardingComplete: true,
  disabledAt: null,
  restrictedUntil: null,
}
```

Run: `pnpm test:integration -- current-user.integration.test.ts`

Expected: FAIL because auth/current-user are absent.

- [ ] **Step 5: Export the auth handler and implement the server current-user query**

Export the Next.js handler through `toNextJsHandler(auth)` in `app/api/auth/[...all]/route.ts`. `getCurrentUser` obtains the Better Auth session server-side, loads profile/capabilities/provider specialties in one repository query, normalizes ordering, and returns `null` for missing/expired sessions. It must not accept a user ID from query params, form fields, or custom headers.

- [ ] **Step 6: Add optimistic proxy redirects only**

`proxy.ts` may check for the presence of a session cookie to redirect obviously unauthenticated workspace requests to `/{locale}/login`. It must not authorize access; every workspace and mutation calls `getCurrentUser` and the domain policy.

- [ ] **Step 7: Run auth tests**

Run: `pnpm test:integration -- current-user.integration.test.ts; pnpm typecheck`

Expected: current-user test PASSes and auth configuration typechecks.

- [ ] **Step 8: Commit**

```powershell
git add package.json pnpm-lock.yaml prisma src/modules/identity src/modules/notifications app/api/auth proxy.ts src/config
git commit -m "feat: establish secure account sessions"
```

### Task 3: Implement email verification and password recovery through a port

**Files:**
- Create: `src/modules/notifications/adapters/test-mailbox.ts`
- Create: `src/modules/notifications/adapters/test-mailbox.test.ts`
- Create: `app/api/test/mailbox/route.ts`
- Modify: `src/modules/identity/infrastructure/auth.ts`
- Modify: `src/config/env.ts`

**Interfaces:**
- Consumes: `MailSender` from Task 2, injected clock/ID, and `NODE_ENV`.
- Produces: `MailSender.send(message): Promise<void>`, `TestMailbox.latestFor(address, template)`, and non-production mailbox HTTP access.

- [ ] **Step 1: Test deterministic mail capture**

```ts
import { expect, it } from "vitest";
import { TestMailbox } from "./test-mailbox";

it("captures a verification link without logging secrets", async () => {
  const mailbox = new TestMailbox();
  await mailbox.send({
    to: "client@example.test",
    template: "VERIFY_EMAIL",
    locale: "ka",
    variables: { verificationUrl: "http://localhost:3000/api/auth/verify?token=secret" },
  });
  expect(mailbox.latestFor("client@example.test", "VERIFY_EMAIL")?.variables).toHaveProperty("verificationUrl");
});
```

- [ ] **Step 2: Implement the test mailbox adapter**

Implement `MailSender` by retaining messages in process memory. It exposes typed `latestFor(address, template)` only when `NODE_ENV` is `development` or `test`; construction throws if production attempts to enable it.

- [ ] **Step 3: Bind Better Auth callbacks**

Email verification sends `VERIFY_EMAIL`; forgot-password sends `RESET_PASSWORD`. Build URLs from `APP_URL`, use the user's preferred locale when known, and fall back to `ka`.

- [ ] **Step 4: Prove production cannot expose the test mailbox**

Route-contract tests set `NODE_ENV` through dependency injection and assert the mailbox route returns 404 in production and returns only addressed messages in development/test mode.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm test:unit; pnpm test:integration -- auth`

Expected: mail and auth flows PASS.

```powershell
git add src/modules/notifications src/modules/identity app/api/test src/config
git commit -m "feat: add verification and recovery mail adapters"
```

### Task 4: Add reusable server-side capability guards

**Files:**
- Create: `src/modules/identity/application/require-capability.ts`
- Create: `src/modules/identity/application/require-capability.test.ts`
- Create: `src/modules/identity/http/map-access-denial.ts`
- Create: `src/modules/identity/http/map-access-denial.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `canUseCapability`, and injected `Clock`.
- Produces: `requireCapability(headers, capability): Promise<Result<CurrentUser, AuthError>>` and `mapAccessDenial(error, locale): Response`.

- [ ] **Step 1: Write the authorization matrix**

Cover no session → `UNAUTHENTICATED`, unverified → `EMAIL_UNVERIFIED`, incomplete → `ONBOARDING_INCOMPLETE`, disabled/restricted, missing capability, and valid customer/provider. Include a test proving customer/provider cannot request `ADMIN` through any guard parameter derived from request input.

- [ ] **Step 2: Implement exact error mapping**

Use status codes:

```ts
UNAUTHENTICATED        -> 401
EMAIL_UNVERIFIED       -> 403
ONBOARDING_INCOMPLETE  -> 403
ACCOUNT_DISABLED       -> 403
ACCOUNT_RESTRICTED     -> 403
CAPABILITY_MISSING     -> 403
```

Responses contain `{ code, messageKey }`, not hard-coded prose. Pages may redirect for convenience, but API routes preserve these statuses.

- [ ] **Step 3: Run unit tests and boundary scan**

Run: `pnpm vitest run src/modules/identity; pnpm verify:boundaries`

Expected: all cases PASS and domain purity remains intact.

- [ ] **Step 4: Commit**

```powershell
git add src/modules/identity/application src/modules/identity/http
git commit -m "feat: enforce marketplace capability guards"
```

### Task 5: Implement atomic marketplace onboarding and profile editing

**Files:**
- Create: `src/modules/profiles/application/complete-onboarding.ts`
- Create: `src/modules/profiles/application/update-own-profile.ts`
- Create: `src/modules/profiles/infrastructure/prisma-profile-repository.ts`
- Create: `src/modules/profiles/application/complete-onboarding.integration.test.ts`
- Create: `app/api/onboarding/complete/route.ts`
- Create: `app/api/profile/me/route.ts`

**Interfaces:**
- Consumes: verified Better Auth user, Prisma transaction, ID generator.
- Produces: `completeOnboarding(command, actor)`, `updateOwnProfile(command, actor)`, GET/PATCH own profile.

- [ ] **Step 1: Define and test onboarding commands**

```ts
export type CompleteOnboardingCommand = Readonly<{
  intent: "CLIENT" | "CONSTRUCTION_PROVIDER";
  accountKind: "PERSON" | "COMPANY";
  displayName: string;
  phoneE164: string;
  countryCode: "GE";
  city: string;
  activityDescription: string;
  preferredLocale: "ka" | "en";
  preferredCurrency: "GEL" | "USD";
}>;
```

Integration cases: verified client succeeds, verified provider gets provider capability/specialty, unverified user is rejected, duplicate normalized phone conflicts, `ADMIN`/unknown input is rejected by strict Zod parsing, retry returns the existing completed profile without duplicate capabilities.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test:integration -- complete-onboarding.integration.test.ts`

Expected: FAIL because the use case is absent.

- [ ] **Step 3: Implement one-transaction onboarding**

Inside one Prisma transaction, lock/load the user, require verified email, insert/update `UserProfile`, grant `CUSTOMER` or `PROVIDER`, create `ProviderProfile` with `CONSTRUCTION_REPAIR` for provider intent, write `AuditEvent`, and return a safe profile view. The client route never accepts `userId`, `capabilities`, `specialties`, `disabledAt`, or `restrictedUntil`.

- [ ] **Step 4: Implement limited own-profile updates**

Allow display name, city, activity description, preferred locale/currency, and profile photo metadata reference. Phone change creates an unverified-phone state for Phase 6; it does not claim verification. Capability, restriction, identity status, review totals, and trust-list state are immutable through this route.

- [ ] **Step 5: Run integration and route tests**

Run: `pnpm test:integration -- profiles; pnpm typecheck`

Expected: all onboarding idempotency, constraint, ownership, and forbidden-field tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/profiles app/api/onboarding app/api/profile
git commit -m "feat: add verified marketplace onboarding"
```

### Task 6: Build bilingual authentication and workspace surfaces

**Files:**
- Create: `src/modules/localization/messages/ka.json`
- Create: `src/modules/localization/messages/en.json`
- Create: `src/modules/localization/get-messages.ts`
- Create: `src/modules/identity/ui/auth-error.tsx`
- Create: `src/modules/profiles/ui/onboarding-form.tsx`
- Create: `src/modules/profiles/ui/profile-form.tsx`
- Create: routes listed under Planned file structure

**Interfaces:**
- Consumes: Better Auth client API, onboarding/profile routes, approved design tokens/components.
- Produces: accessible registration, sign-in, verification, recovery, client workspace, provider workspace, and profile UI.

- [ ] **Step 1: Define message-catalog parity test**

Flatten both JSON catalogs and assert identical key sets. Required groups: `common`, `auth`, `onboarding`, `profile`, `workspace`, `errors`, and `access`. The test also rejects empty strings.

- [ ] **Step 2: Implement auth pages with complete states**

Each form includes label, description where needed, field-level error, form-level error summary with focus transfer, pending state, success state, disabled double-submit protection, and password-manager-compatible autocomplete attributes. Email verification and reset pages handle invalid, expired, already-used, and successful links.

- [ ] **Step 3: Implement onboarding paths**

The registration index explains client versus provider intent without implying permanent exclusivity. Client/provider pages share fields but provider copy explains the `CONSTRUCTION_REPAIR` specialty. Display the email-verification requirement before submission.

- [ ] **Step 4: Implement guarded workspaces**

The client workspace requires `CUSTOMER`; provider workspace requires `PROVIDER`. Phase 1 contains truthful empty states and profile actions only—no fake tenders, bids, revenue, ratings, or statistics. A dual-capability account gets a visible workspace switcher.

- [ ] **Step 5: Verify responsive and keyboard behavior**

Run component/unit tests, then Playwright at desktop and mobile. Tab order must follow the visual order, error summary must focus after invalid submit, and changing locale must preserve the logical route without losing unsaved-form warning behavior.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/localization src/modules/identity/ui src/modules/profiles/ui app
git commit -m "feat: build bilingual identity workspaces"
```

### Task 7: Add Phase 1 end-to-end journeys and CI gate

**Files:**
- Create: `src/test/e2e/fixtures/accounts.ts`
- Create: `src/test/e2e/phase-01-client.spec.ts`
- Create: `src/test/e2e/phase-01-provider.spec.ts`
- Create: `src/test/e2e/phase-01-authorization.spec.ts`
- Create: `scripts/seed-phase-01.ts`
- Modify: `package.json`
- Modify: `.github/workflows/verify.yml`
- Modify: `docs/development.md`

**Interfaces:**
- Consumes: public auth/onboarding/profile interfaces and test mailbox.
- Produces: `seed:phase-1`, `verify:phase-1`, and repeatable browser acceptance.

- [ ] **Step 1: Write client and provider browser journeys**

For each `ka` and `en`:

1. Register with a unique address.
2. Read the verification URL from the test mailbox.
3. Verify email.
4. Complete client or construction-provider onboarding.
5. Confirm correct workspace and localized heading.
6. Edit an allowed profile field.
7. Sign out and confirm workspace redirects.
8. Sign in and confirm the change persisted.

- [ ] **Step 2: Write negative authorization journeys**

Prove that an unauthenticated user, unverified user, onboarding-incomplete user, client-only user on provider workspace, provider-only user on client workspace, disabled user, and time-restricted user receive the specified safe state. Send forged `userId`, `ADMIN`, `capabilities`, and `restrictedUntil` fields and assert no database change.

- [ ] **Step 3: Add deterministic seed/reset**

Seed one verified client, one verified construction provider, one dual-capability company, one unverified user, one restricted user, and one disabled user through application use cases. Use fixed test emails and random secrets supplied only through environment variables; do not commit passwords.

- [ ] **Step 4: Add the phase verification command**

```json
{
  "verify:phase-1": "pnpm verify:phase-0 && pnpm db:migrate:test && pnpm test:integration -- identity profiles && pnpm build && pnpm test:e2e --grep @phase-1"
}
```

Tag Phase 1 Playwright tests `@phase-1`. Update CI to run the command against PostgreSQL 17.

- [ ] **Step 5: Run the full phase gate**

Run: `pnpm install --frozen-lockfile; pnpm db:generate; pnpm db:migrate:test; pnpm verify:phase-1`

Expected: all Phase 0 and Phase 1 checks PASS on desktop/mobile Chromium; the test-mailbox route always returns 404 under production configuration.

- [ ] **Step 6: Commit**

```powershell
git add src/test scripts package.json .github docs/development.md
git commit -m "test: gate bilingual identity workflows"
```

## Phase 1 completion checklist

- [ ] Client and construction-provider journeys pass in Georgian and English.
- [ ] Dual-capability accounts can switch workspaces without a second login.
- [ ] Unverified, incomplete, disabled, restricted, and wrong-capability accounts are denied server-side.
- [ ] No public input can grant admin or mutate restrictions.
- [ ] Verification/reset secrets are absent from logs and production responses.
- [ ] Test mailbox is unreachable in a production build.
- [ ] Registration, login, verification, and profile editing pass keyboard/mobile checks.
- [ ] `pnpm verify:phase-1` passes from a frozen clean install.
