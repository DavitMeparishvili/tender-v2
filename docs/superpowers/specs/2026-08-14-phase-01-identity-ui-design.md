# Phase 1 Focused Column Identity UI Design

**Status:** Focused Column direction approved on 2026-08-14; written specification pending final review

## Purpose

Phase 1 identity surfaces must let Georgian and English users register, verify email, recover credentials, complete a profile, and reach the correct client or provider workspace without visual or behavioral drift between states.

The chosen direction is **Focused Column**, with Vercel as the craft benchmark rather than a visual template. The product remains original: its interface exposes verification, capability, and workspace truth specific to Tender.

## Visual contract

The surface is light, monochrome, and typographically led. Near-black and white own the page; neutral grays establish hierarchy. Emerald is reserved for verified or safely active trust states. Red is reserved for errors. There are no gradients, decorative glass, fabricated illustrations, fake metrics, or themed construction motifs.

Forms sit directly on the page rather than inside floating cards. The primary content column is 420–460 pixels wide on desktop and fills the available width with 20–24 pixels of inline padding on mobile. Its top anchor remains stable while pending, error, verification, expired-link, already-used-link, and success states replace one another. This prevents layout jumps and makes every state feel like one coherent task.

Typography uses Geist for Latin text and Noto Sans Georgian for Georgian glyphs. Headings use tight but legible tracking no lower than `-0.04em`. Body copy stays compact and plain. Inputs and buttons use an 8-pixel radius, crisp one-pixel borders, and at least 44-pixel targets. Shadows are unnecessary for the primary surfaces.

The persistent header contains the Tender wordmark, contextual help, and locale control. Authenticated workspaces replace help with profile and sign-out actions where appropriate. Locale changes preserve the logical route and warn before discarding dirty form state.

## Surface family

### Registration and sign-in

Registration begins with client or construction-provider intent. The copy explicitly states that the initial choice is not permanent and that another workspace may be added later. Provider copy names the `CONSTRUCTION_REPAIR` specialty. The email-verification requirement appears before submission.

Sign-in, forgot-password, and reset-password screens use the same frame, field rhythm, and action hierarchy. Password-manager autocomplete attributes and standard email/password field semantics are mandatory.

### Verification and recovery

Verification is a complete state, not a transient toast. It names the addressed email, explains that commercial workspace access is blocked until ownership is verified, and provides resend and wrong-address recovery actions.

Verification and reset links render successful, invalid, expired, and already-used outcomes in the stable frame. Each outcome names the next safe action. No token or tokenized URL appears in visible diagnostics, client logs, or production responses.

### Onboarding and profile editing

Onboarding uses a restrained three-part progress rail: account, verification, profile. The rail communicates location without gamification. It is hidden when it adds no information, such as ordinary sign-in.

Invalid submission moves focus to a form-level error summary above the affected fields. The summary names the number of problems and links to each invalid input. Every invalid field also has specific repair copy. Pending state disables duplicate submission without replacing the button label with an ambiguous spinner-only control.

Profile editing exposes only display name, phone, city, activity description, locale, currency, and photo metadata. Capability, restriction, verification, ratings, and trust state are never editable controls.

### Workspaces

The client and provider workspaces retain the centered composition for Phase 1. They show a verified-account state, a concise welcome, the current capability, truthful empty-state copy, profile action, account-security action, and sign-out.

A dual-capability user receives a compact segmented workspace switcher. A single-capability user does not see an unavailable destination. Phase 1 renders no fake tenders, bids, ratings, revenue, or statistics.

## Component boundaries

- `IdentityShell` owns the persistent header, centered measure, page title, localized subtitle, and optional progress rail.
- `IdentityForm` owns submission state, disabled double-submit protection, error-summary focus transfer, and dirty-form locale warnings.
- `Field` owns label, description, input, field error, and autocomplete semantics.
- `AuthState` renders verification, recovery, expired, already-used, success, and access-denial states without changing the shell geometry.
- `WorkspaceSwitcher` receives server-resolved capabilities and never accepts capability values from URL or form input.
- `ProfileForm` submits only the public profile command contract and reuses the same field/error primitives.

Server components load the initial session, profile, locale, and capability state. Client components own interactive form state only. Protected pages and mutations call server-side identity guards; proxy cookie checks remain optimistic redirects rather than authorization.

## Data and interaction flow

1. A localized route loads its message catalog and server session state.
2. A user submits through Better Auth or a strict onboarding/profile route contract.
3. Pending state disables repeat submission while preserving the action label.
4. Field-contract failures return localized message keys and focus the summary.
5. Successful registration moves to the verification state; successful verification moves to onboarding; successful onboarding moves to the server-authorized workspace.
6. Access denials render or redirect according to page context while API routes retain exact 401/403 status contracts.

## Responsive behavior

The mobile layout is the primary constraint. The header remains one row where copy permits and becomes two compact rows without truncation when Georgian content expands. The form column becomes full width. Paired choices stack only when their minimum target size or label measure would be compromised.

Desktop adds negative space rather than additional decoration. The centered task never becomes an arbitrary two-column marketing layout. Workspace actions remain within the same readable measure until later phases introduce data dense enough to justify an application shell.

## Accessibility and motion

- WCAG 2.2 AA contrast is required for text, controls, focus, errors, and verified states.
- Keyboard order matches visual order; all controls have visible focus and semantic names.
- Error summaries receive programmatic focus after invalid submission and link to fields.
- Status is never communicated by color alone.
- Motion is limited to one short state transition using exponential ease-out; reduced-motion users receive immediate state changes.
- Georgian and English catalogs have identical non-empty key sets.
- Browser selection, caret, focus ring, and autofill colors use the same restrained token system.

## Verification strategy

Unit tests prove catalog parity, field state rendering, error-summary focus transfer, double-submit protection, and capability-switcher visibility. Route tests preserve the negative authorization matrix and forbidden-field rejection.

Playwright runs client and provider registration, verification, onboarding, profile editing, sign-out, and sign-in in Georgian and English on desktop and mobile. It also covers invalid, expired, and reused links; keyboard-only completion; locale preservation; wrong-capability access; restricted/disabled accounts; and production mailbox unavailability.

Visual inspection uses one desktop and one mobile screenshot round, followed by a single batched correction and confirmation round. The final implementation must document the resulting durable tokens and component language in `DESIGN.md`.
