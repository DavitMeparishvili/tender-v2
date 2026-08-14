# Phase 1 Focused Column UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved bilingual Focused Column authentication, onboarding, profile, and capability-guarded workspace surfaces for Phase 1.

**Architecture:** Localized App Router pages render session and capability truth on the server, while small client forms own only pending, dirty, validation, and Better Auth interaction state. Shared UI primitives keep one stable 420–460 pixel frame across every state; the existing onboarding/profile HTTP routes and server-side capability guard remain the authorization boundary.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Better Auth 1.6.28, Zod 4, Tailwind CSS 4 plus authored CSS, Geist 1.7.2, Noto Sans Georgian 5.3.0, Vitest 4, Playwright 1.62.

## Global Constraints

- Implement `docs/superpowers/specs/2026-08-14-phase-01-identity-ui-design.md` exactly.
- Locales are `ka` and `en`; default locale is `ka`; Georgian and English catalogs have identical non-empty leaf keys.
- Use Geist for Latin text and Noto Sans Georgian for Georgian glyphs, both self-hosted from pinned packages.
- Keep primary content at 420–460 pixels on desktop and full width with 20–24 pixels inline padding on mobile.
- Use near-black, white, neutral gray, emerald only for verified/active trust, and red only for errors.
- Use 8-pixel control radii, crisp one-pixel borders, minimum 44-pixel targets, and WCAG 2.2 AA contrast.
- Do not add gradients, glass effects, illustrations, fake metrics, fake tenders, fake bids, ratings, revenue, or statistics.
- Server components resolve sessions and capabilities; client form input never authorizes a workspace or changes capability/restriction state.
- Keep proxy cookie checks optimistic; every protected page and mutation must call a server-side identity guard.
- Never expose verification/reset tokens in diagnostics, logs, response bodies, or rendered error copy.
- Keep the approved direction contract as emitted markup at the start of `<body>` and verify the production build contains seed key `b2510d4e`.

```html
<!--
THESIS: One centered task makes identity feel deliberate and calm; it refuses the split-screen marketing panel common to marketplace authentication.
OWN-WORLD: White and near-black lead, neutral rules carry structure, emerald means verified trust, red means repair; direct-on-page forms use crisp 1px borders and 8px controls without cards or shadows.
STORY: Choose marketplace intent, prove email ownership, complete the public profile, then enter only the workspace the server authorizes.
FIRST VIEWPORT: A compact persistent header sits above a top-anchored 420–460px column with title, plain guidance, fields, and one full-width primary action; desktop adds negative space and mobile keeps 20–24px gutters.
FORM: Focused Column, selected as the professional Vercel-craft direction; seed key b2510d4e.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->
```

---

## Planned file structure

```text
app/
  globals.css                                  Focused Column tokens and responsive rules
  [locale]/layout.tsx                          local fonts, shell header, locale control
  [locale]/page.tsx                            truthful identity entry surface
  [locale]/(auth)/register/page.tsx             intent choice
  [locale]/(auth)/register/client/page.tsx      client registration
  [locale]/(auth)/register/provider/page.tsx    provider registration
  [locale]/(auth)/login/page.tsx                email/password sign-in
  [locale]/(auth)/verify-email/page.tsx         verification outcomes/resend
  [locale]/(auth)/forgot-password/page.tsx      reset request
  [locale]/(auth)/reset-password/page.tsx       reset outcomes/form
  [locale]/(workspace)/client/page.tsx          guarded customer workspace
  [locale]/(workspace)/provider/page.tsx        guarded provider workspace
  [locale]/(workspace)/profile/page.tsx         own-profile editor
src/modules/
  localization/messages/{ka,en}.json            complete catalogs
  localization/get-messages.ts                 typed locale lookup
  localization/messages.test.ts                parity/non-empty contract
  identity/infrastructure/auth-client.ts        browser Better Auth adapter
  identity/ui/identity-shell.tsx                stable frame and progress rail
  identity/ui/identity-form.tsx                 pending/errors/dirty locale contract
  identity/ui/field.tsx                         accessible form field
  identity/ui/auth-state.tsx                    safe terminal states
  identity/ui/auth-forms.tsx                    register/login/recovery clients
  identity/ui/workspace-switcher.tsx            server-provided capability navigation
  identity/ui/render-contract.test.tsx          semantic static-render contract
  profiles/ui/onboarding-form.tsx               strict onboarding HTTP client
  profiles/ui/profile-form.tsx                  allowed own-profile editor
  profiles/ui/profile-form.test.ts              public-field serialization contract
src/test/e2e/phase-01-ui.spec.ts                keyboard, focus, locale, viewport proof
DESIGN.md                                       durable tokens and component language
.gitignore                                      ignored visual-review captures
```

### Task 1: Establish catalogs, fonts, tokens, and the stable shell

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/modules/localization/messages/ka.json`
- Create: `src/modules/localization/messages/en.json`
- Create: `src/modules/localization/get-messages.ts`
- Create: `src/modules/localization/messages.test.ts`
- Create: `src/modules/identity/ui/identity-shell.tsx`
- Modify: `app/[locale]/layout.tsx`
- Modify: `app/[locale]/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**

- Consumes: `Locale`, `SUPPORTED_LOCALES`, and `isLocale` from `src/modules/localization/config.ts`.
- Produces: `getMessages(locale: Locale): Messages`, `Messages`, `IdentityShell`, `IdentityHeader`, `LocaleLink`, and the global `--surface-*`, `--text-*`, `--border-*`, `--trust`, `--error`, `--focus`, `--font-latin`, and `--font-georgian` tokens.

- [ ] **Step 1: Write the failing catalog contract**

Create a recursive leaf flattener and assert the exact top-level groups plus identical, non-empty leaves:

```ts
import { describe, expect, it } from "vitest";
import en from "./messages/en.json";
import ka from "./messages/ka.json";

function leaves(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") return [[prefix, value]];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => leaves(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

describe("identity message catalogs", () => {
  it("has matching, non-empty common/auth/onboarding/profile/workspace/errors/access keys", () => {
    expect(Object.keys(en).sort()).toEqual([
      "access",
      "auth",
      "common",
      "errors",
      "onboarding",
      "profile",
      "workspace",
    ]);
    expect(Object.keys(ka).sort()).toEqual(Object.keys(en).sort());
    expect(
      leaves(ka)
        .map(([key]) => key)
        .sort(),
    ).toEqual(
      leaves(en)
        .map(([key]) => key)
        .sort(),
    );
    expect(
      [...leaves(ka), ...leaves(en)].every(
        ([, value]) => value.trim().length > 0,
      ),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the catalog test and verify RED**

Run: `pnpm exec vitest run src/modules/localization/messages.test.ts`

Expected: FAIL because both catalogs are absent.

- [ ] **Step 3: Add complete catalogs and typed lookup**

Populate all copy used by registration, sign-in, verification, recovery, onboarding, profile, workspaces, errors, and access denials. Export a stable lookup:

```ts
import en from "./messages/en.json";
import ka from "./messages/ka.json";
import type { Locale } from "./config";

const catalogs = { en, ka } as const;
export type Messages = (typeof catalogs)["en"];
export function getMessages(locale: Locale): Messages {
  return catalogs[locale] as Messages;
}
```

- [ ] **Step 4: Pin and load the local fonts**

Run: `pnpm add --save-exact geist@1.7.2 @fontsource/noto-sans-georgian@5.3.0`

Import `geist/font/sans` and the Georgian 400/500/600/700 CSS files from the locale layout. Set body classes/variables so `[lang="ka"]` prefers Noto Sans Georgian and Latin text prefers Geist.

- [ ] **Step 5: Implement shell and tokens**

Define these props and render the main column without a card:

```ts
type IdentityShellProps = Readonly<{
  locale: Locale;
  title: string;
  subtitle?: string;
  progress?: Readonly<{
    current: 1 | 2 | 3;
    labels: readonly [string, string, string];
  }>;
  children: ReactNode;
}>;
```

The header exposes Tender, contextual help, and logical-route locale links. Add the direction-contract HTML comment immediately after `<body>` and preserve skip-link behavior.

- [ ] **Step 6: Verify GREEN and static gates**

Run: `pnpm exec vitest run src/modules/localization/messages.test.ts src/test/recovery-language.test.ts; pnpm typecheck; pnpm lint; pnpm format:check`

Expected: all commands PASS; Georgian source remains valid UTF-8; no catalog leaf is empty.

- [ ] **Step 7: Commit**

```powershell
git add package.json pnpm-lock.yaml app src/modules/localization src/modules/identity/ui/identity-shell.tsx
git commit -m "feat: establish focused identity shell"
```

### Task 2: Build reusable accessible form and state primitives

**Files:**

- Create: `src/modules/identity/ui/field.tsx`
- Create: `src/modules/identity/ui/identity-form.tsx`
- Create: `src/modules/identity/ui/auth-state.tsx`
- Create: `src/modules/identity/ui/render-contract.test.tsx`

**Interfaces:**

- Consumes: localized strings from `Messages` and shell tokens from Task 1.
- Produces: `Field`, `ErrorSummary`, `SubmitButton`, `DirtyLocaleLink`, `AuthState`, `FormIssue`, and `focusErrorSummary(id: string): void`.

- [ ] **Step 1: Write failing semantic render tests**

Use `renderToStaticMarkup` to assert labeled controls, descriptions, linked field errors, an alert summary with field anchors, preserved button copy plus pending text, and token-free auth-state markup:

```tsx
const html = renderToStaticMarkup(
  <Field
    id="email"
    label="Email"
    description="Work address"
    error="Enter a valid email"
  >
    <input id="email" name="email" type="email" autoComplete="email" />
  </Field>,
);
expect(html).toContain('for="email"');
expect(html).toContain('aria-invalid="true"');
expect(html).toContain('aria-describedby="email-description email-error"');
```

- [ ] **Step 2: Run the render test and verify RED**

Run: `pnpm exec vitest run src/modules/identity/ui/render-contract.test.tsx`

Expected: FAIL because the UI primitives do not exist.

- [ ] **Step 3: Implement the primitives**

Use this issue contract across every form:

```ts
export type FormIssue = Readonly<{ field: string; message: string }>;
export function focusErrorSummary(id = "form-errors") {
  document.getElementById(id)?.focus();
}
```

`ErrorSummary` renders `role="alert"`, `tabIndex={-1}`, a problem count, and `href="#field-id"` links. `SubmitButton` remains at least 44 pixels tall, disables while pending, keeps its action label visible, and adds localized pending copy. `DirtyLocaleLink` checks for `form[data-dirty="true"]` and calls `window.confirm` only when unsaved input exists. `AuthState` accepts only `success | invalid | expired | reused | access-denied` and rendered copy/action props—never raw errors or tokens.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm exec vitest run src/modules/identity/ui/render-contract.test.tsx; pnpm typecheck; pnpm lint`

Expected: all commands PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/identity/ui app/globals.css
git commit -m "feat: add accessible identity form primitives"
```

### Task 3: Implement registration, sign-in, verification, and recovery

**Files:**

- Create: `src/modules/identity/infrastructure/auth-client.ts`
- Create: `src/modules/identity/ui/auth-forms.tsx`
- Create: `src/modules/identity/ui/auth-forms.test.ts`
- Create: `app/[locale]/(auth)/register/page.tsx`
- Create: `app/[locale]/(auth)/register/client/page.tsx`
- Create: `app/[locale]/(auth)/register/provider/page.tsx`
- Create: `app/[locale]/(auth)/login/page.tsx`
- Create: `app/[locale]/(auth)/verify-email/page.tsx`
- Create: `app/[locale]/(auth)/forgot-password/page.tsx`
- Create: `app/[locale]/(auth)/reset-password/page.tsx`

**Interfaces:**

- Consumes: `IdentityShell`, form primitives, `Messages`, and Better Auth browser endpoints.
- Produces: `authClient`, `RegistrationForm`, `LoginForm`, `VerificationActions`, `ForgotPasswordForm`, `ResetPasswordForm`, and public localized routes.

- [ ] **Step 1: Write failing pure validation tests**

Export and test strict parsers for the client forms:

```ts
expect(
  parseRegistration({ name: "A", email: "bad", password: "short" }),
).toEqual({
  ok: false,
  issues: expect.arrayContaining([
    expect.objectContaining({ field: "name" }),
    expect.objectContaining({ field: "email" }),
    expect.objectContaining({ field: "password" }),
  ]),
});
```

Registration requires a 2–120 character name, valid email, and password of at least 8 characters. Login requires email/password. Reset requires matching password/confirmation and never includes the token in returned issues.

- [ ] **Step 2: Run the auth-form test and verify RED**

Run: `pnpm exec vitest run src/modules/identity/ui/auth-forms.test.ts`

Expected: FAIL because the parsers/forms are absent.

- [ ] **Step 3: Create the browser auth adapter**

```ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient();
```

Call `authClient.signUp.email`, `authClient.signIn.email`, `authClient.sendVerificationEmail`, `authClient.requestPasswordReset`, `authClient.resetPassword`, and `authClient.signOut`. Pass locale-preserving callback URLs created from route props; never print returned errors or request URLs.

- [ ] **Step 4: Implement auth forms and routes**

The intent page links to client/provider registration and explains that another workspace can be added later. Both registration pages state the verification requirement; provider copy names `CONSTRUCTION_REPAIR`. Registration success renders the addressed-email verification state. Login redirects only to a locale-safe server-selected next path. Forgot-password always renders the same success copy to avoid account enumeration. Reset and verification pages normalize query outcomes to `success | invalid | expired | reused` before rendering `AuthState`.

- [ ] **Step 5: Verify GREEN and route compilation**

Run: `pnpm exec vitest run src/modules/identity/ui/auth-forms.test.ts src/modules/identity/ui/render-contract.test.tsx; pnpm typecheck; pnpm lint; pnpm build`

Expected: all commands PASS and all seven auth routes compile for `ka` and `en`.

- [ ] **Step 6: Commit**

```powershell
git add app/[locale] src/modules/identity
git commit -m "feat: build bilingual account access flows"
```

### Task 4: Implement verified onboarding

**Files:**

- Create: `src/modules/profiles/ui/onboarding-form.tsx`
- Create: `src/modules/profiles/ui/onboarding-form.test.ts`
- Modify: `app/[locale]/(auth)/register/client/page.tsx`
- Modify: `app/[locale]/(auth)/register/provider/page.tsx`

**Interfaces:**

- Consumes: `POST /api/onboarding/complete`, `CompleteOnboardingCommand`, verified server session state, form primitives, and localized messages.
- Produces: `OnboardingForm({ intent, locale, messages })` and `serializeOnboarding(formData, intent, locale)`.

- [ ] **Step 1: Write failing serialization tests**

```ts
expect(
  serializeOnboarding(validFormData, "CONSTRUCTION_PROVIDER", "ka"),
).toEqual({
  intent: "CONSTRUCTION_PROVIDER",
  accountKind: "COMPANY",
  displayName: "Build Georgia",
  phoneE164: "+995555123456",
  countryCode: "GE",
  city: "Tbilisi",
  activityDescription: "Construction and repair contractor",
  preferredLocale: "ka",
  preferredCurrency: "GEL",
});
```

Also assert that supplied `userId`, `ADMIN`, `capabilities`, `restrictedUntil`, and `disabledAt` entries are absent from the result.

- [ ] **Step 2: Run the onboarding-form test and verify RED**

Run: `pnpm exec vitest run src/modules/profiles/ui/onboarding-form.test.ts`

Expected: FAIL because the serializer/form is absent.

- [ ] **Step 3: Implement the verified-session branch**

On each registration-intent page, resolve `getCurrentUser(await headers())`. Render registration for no session, the addressed-email state for an unverified session, `OnboardingForm` for a verified incomplete session, and redirect an onboarded user to a server-authorized workspace. The form shows the restrained account/verification/profile progress rail and posts the strict command to `/api/onboarding/complete`.

- [ ] **Step 4: Implement errors and successful navigation**

Map `INVALID_INPUT`, `PHONE_CONFLICT`, and `EMAIL_UNVERIFIED` to localized field/form issues. Focus the summary on invalid response, keep the action label during pending state, and route successful client/provider onboarding to `/${locale}/client` or `/${locale}/provider` respectively.

- [ ] **Step 5: Verify GREEN**

Run: `pnpm exec vitest run src/modules/profiles/ui/onboarding-form.test.ts app/api/onboarding/complete/route.test.ts; pnpm typecheck; pnpm lint`

Expected: all commands PASS and forbidden properties are never serialized.

- [ ] **Step 6: Commit**

```powershell
git add app/[locale] src/modules/profiles/ui
git commit -m "feat: guide verified profile onboarding"
```

### Task 5: Implement guarded workspaces, switcher, and own-profile editing

**Files:**

- Create: `src/modules/identity/ui/workspace-switcher.tsx`
- Create: `src/modules/identity/ui/workspace-switcher.test.tsx`
- Create: `src/modules/profiles/ui/profile-form.tsx`
- Create: `src/modules/profiles/ui/profile-form.test.ts`
- Create: `app/[locale]/(workspace)/client/page.tsx`
- Create: `app/[locale]/(workspace)/provider/page.tsx`
- Create: `app/[locale]/(workspace)/profile/page.tsx`

**Interfaces:**

- Consumes: `requireCapability(headers, "CUSTOMER" | "PROVIDER")`, `getCurrentUser`, `getOwnProfile`, `PATCH /api/profile/me`, and `SafeProfileView`.
- Produces: server-guarded workspaces, `WorkspaceSwitcher({ locale, capabilities, active })`, `ProfileForm({ locale, profile, messages })`, and `serializeProfileUpdate(formData)`.

- [ ] **Step 1: Write failing switcher and profile serialization tests**

```tsx
expect(
  renderToStaticMarkup(
    <WorkspaceSwitcher
      locale="en"
      capabilities={["CUSTOMER"]}
      active="CUSTOMER"
      labels={labels}
    />,
  ),
).not.toContain("/en/provider");

expect(serializeProfileUpdate(profileFormData)).toEqual({
  displayName: "Updated Company",
  phoneE164: "+995555123456",
  city: "Batumi",
  activityDescription: "Updated activity",
  preferredLocale: "en",
  preferredCurrency: "USD",
  profilePhotoObjectKey: null,
});
```

Assert forged capability/restriction/user fields are excluded.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm exec vitest run src/modules/identity/ui/workspace-switcher.test.tsx src/modules/profiles/ui/profile-form.test.ts`

Expected: FAIL because the components and serializers are absent.

- [ ] **Step 3: Implement server-guarded workspace pages**

Call `requireCapability(await headers(), required)` before rendering. Redirect `UNAUTHENTICATED` to login; render localized `AuthState` for unverified, incomplete, disabled, restricted, or wrong-capability users. Allowed pages show verified status, welcome copy, exact current capability, truthful empty state, profile/security actions, and sign-out. Render the switcher only when the server result contains both `CUSTOMER` and `PROVIDER`.

- [ ] **Step 4: Implement own-profile page and form**

Resolve the current user and `getOwnProfile({ id: user.id })` on the server. Serialize only display name, phone, city, activity description, locale, currency, and photo metadata. A phone change receives localized copy explaining that phone verification becomes incomplete. Successful PATCH replaces form values with the returned safe profile and shows a non-color-only success status.

- [ ] **Step 5: Verify GREEN and authorization regression**

Run: `pnpm exec vitest run src/modules/identity src/modules/profiles app/api/profile/me/route.test.ts src/test/proxy.test.ts; pnpm typecheck; pnpm lint`

Expected: all commands PASS; a single-capability user never receives an unavailable workspace link.

- [ ] **Step 6: Commit**

```powershell
git add app/[locale] src/modules/identity/ui src/modules/profiles/ui
git commit -m "feat: add guarded identity workspaces"
```

### Task 6: Prove responsive, keyboard, locale, and visual behavior

**Files:**

- Create: `src/test/e2e/phase-01-ui.spec.ts`
- Create: `DESIGN.md`
- Modify: `app/globals.css`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: every Task 1–5 surface at desktop and mobile Playwright projects.
- Produces: focused UI acceptance coverage and durable design-system documentation for later phases.

- [ ] **Step 1: Write failing Playwright UI acceptance**

Tag tests `@phase-1-ui` and assert:

```ts
test("@phase-1-ui registration is keyboard-complete and focus-safe", async ({
  page,
}) => {
  await page.goto("/en/register/client");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.locator("[data-identity-frame]")).toHaveCSS(
    "max-width",
    "460px",
  );
});
```

Add cases for Georgian/English key headings, mobile horizontal overflow, stable pending button copy, dirty-form locale confirmation, and logical-route locale preservation. Authenticated workspace journeys remain in Phase 1 Task 7; the server-render contract and unit tests prove switcher visibility in this task without introducing a second fixture system.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm exec playwright test src/test/e2e/phase-01-ui.spec.ts --project=desktop-chromium --project=mobile-chromium`

Expected: one or more assertions FAIL before the final responsive/accessibility pass.

- [ ] **Step 3: Apply one batched responsive/accessibility correction**

Correct only findings demonstrated by the failing checks: 44-pixel targets, visible focus, 420–460 pixel desktop measure, 20–24 pixel mobile padding, Georgian header wrapping, reduced motion, autofill/selection colors, error-summary focus, and no horizontal overflow.

- [ ] **Step 4: Document durable design language**

Create `DESIGN.md` with the approved palette tokens, font roles, type scale, spacing scale, radii, focus/error/trust rules, `IdentityShell`/form/state/workspace component responsibilities, responsive breakpoints, prohibited visual patterns, and the direction-contract seed `b2510d4e`.

- [ ] **Step 5: Run Task 6 verification**

Run: `pnpm format:check; pnpm lint; pnpm verify:boundaries; pnpm typecheck; pnpm test:unit; pnpm build; pnpm exec playwright test src/test/e2e/phase-01-ui.spec.ts --project=desktop-chromium --project=mobile-chromium`

Expected: every command PASS in both locales and both browser projects.

- [ ] **Step 6: Inspect final desktop/mobile captures**

Add `/.impeccable/review/` to `.gitignore`. Capture `/en/register/client` at 1440×900 and `/ka/register/provider` at the Pixel 7 viewport into `.impeccable/review/desktop.png` and `.impeccable/review/mobile.png`. Confirm stable top anchor, generous negative space, correct Georgian font, visible focus, compact header, and no fake marketplace data.

- [ ] **Step 7: Commit**

```powershell
git add .gitignore DESIGN.md app/globals.css src/test/e2e/phase-01-ui.spec.ts
git commit -m "test: verify focused identity experience"
```

## Task 6 completion checkpoint

- [ ] Catalogs have identical non-empty Georgian and English leaf keys.
- [ ] Every auth state uses the same stable frame and safe localized copy.
- [ ] Registration and sign-in are keyboard-complete on desktop and mobile.
- [ ] Onboarding/profile clients serialize only approved public fields.
- [ ] Workspaces enforce capabilities server-side and never fabricate marketplace data.
- [ ] Locale changes preserve logical routes and protect dirty form input.
- [ ] Tokens and component rules are captured in `DESIGN.md`.
- [ ] Task 6 verification passes before Phase 1 Task 7 begins.
