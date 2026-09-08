# Tender typography verification — 8 September 2026

Implemented in the primary checkout and verified against the local production
server at `http://localhost:3000`. Tender data, permissions, price ranking,
selection, and deadline behavior were not changed.

## Confirmed font configuration

Screenshot paths in this report refer to local, ignored captures. The PNGs are not stored in Git; the written findings and JSON measurements are retained.

- Before: Georgian pages declared Manrope first, then Noto Sans Georgian.
  Chromium's platform-font inspection confirmed that Georgian heading glyphs
  actually came from **Noto Sans Georgian Bold**, and paragraph glyphs from
  **Noto Sans Georgian Regular**. Manrope supplied Latin/punctuation. English
  and Russian used Inter. Georgian headings requested 800 despite only loading
  Georgian 400–700, with tight tracking and locale-specific size overrides.
- After: `ka` uses `Noto Sans Georgian, Noto Sans, Segoe UI, sans-serif`.
  `en` and `ru` use `Noto Sans, Noto Sans Georgian, Segoe UI, sans-serif`.
  The validated route locale already set `<html lang>` correctly; this is preserved.
- Loading retains the existing **self-hosted Fontsource CSS** approach, using
  `@fontsource/noto-sans-georgian@5.3.0` and `@fontsource/noto-sans@5.3.0`.
  Production WOFF2 files identify themselves as Noto Sans Georgian **2.005** and
  Noto Sans **2.015**. Four genuine static weights load: **400, 500, 600, 700**.
  The interface no longer requests 550/650/750/800, and `font-synthesis: none`
  prevents artificial bold/italic rendering.
- Noto Sans uses the package's Unicode-ranged weight stylesheets. The browser
  downloads only subsets needed by visible content; Latin Extended supplies
  `₾`, Cyrillic supplies Russian, and Latin supplies English and `m²`.
  Georgian and Mtavruli come from the existing Georgian subset. No duplicate
  font requests occurred in the six cold-context loading checks.
- Upstream provenance: [Google Fonts Georgian metadata](https://raw.githubusercontent.com/google/fonts/main/ofl/notosansgeorgian/METADATA.pb)
  and [Noto Sans metadata](https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/METADATA.pb).
  Upstream OFL licenses remain in the packages and are also distributed as
  [Noto Sans OFL](../../public/fonts/licenses/NotoSans-OFL.txt) and
  [Noto Sans Georgian OFL](../../public/fonts/licenses/NotoSansGeorgian-OFL.txt).

The shared roles are in [typography.css](../../app/typography.css). They apply
through global and tender component styles, including buttons, inputs, dialogs,
navigation, lists, cards, and mobile actions.

| Role               | Desktop        | Mobile         | Weight  |
| ------------------ | -------------- | -------------- | ------- |
| Hero               | 44 / 52.8 px   | 32 / 39 px     | 700     |
| Detail/list title  | 32 / 40 px     | 28 / 35 px     | 700     |
| Section            | 24 px / 1.35   | 22 px / 1.35   | 600     |
| Card title         | 20 px / 1.4    | 18 px / 1.4    | 600     |
| Body               | 16 / 26 px     | 16 / 26 px     | 400     |
| Navigation/buttons | 15 px / 1.4    | 14–15 px / 1.4 | 500–600 |
| Labels             | 13–14 px / 1.5 | 13–14 px / 1.5 | 400–500 |
| Editable inputs    | 16 / 24 px     | 16 / 24 px     | 400     |

Mobile bottom tabs are the deliberate compact exception: 12 px, or 11 px at
320 px. Short labels remain whole. Enlarging text reduces the number of grid
columns, and an observer reserves the actual height of the navigation and
action bars, including safe-area padding. At 320 px, paired card actions stack
instead of breaking Georgian words. Desktop navigation stays in one row at
1280 and 1440 px in all three locales. Normal Georgian letter spacing is zero.

## Readability and copy

Removed the hero grid, used a maximum 65ch prose measure, increased how-it-works
body copy to 16/26 px, darkened muted labels/placeholders, and standardized
white-label actions on emerald `#047857` with `#065F46` hover. On charcoal,
emerald text uses the lighter `#6EE7B7`. Pending button status inherits the
button foreground. Category chips retain natural case; intentional uppercase
overlines retain Mtavruli coverage. Amounts and quantities use tabular numerals.

The revised Georgian hero explanation is:

> თქვენ აქვეყნებთ მოთხოვნებს, დადასტურებული შემსრულებლები — შესადარებელ შეთავაზებებს. ვადის ამოწურვისას ყველაზე დაბალი ვალიდური შეთავაზება ავტომატურად იმარჯვებს.

The fuller explanation remains in the existing how-it-works section. Other
shortened Georgian controls: `ტენდერების ძებნა`, mobile `ტენდერი` / `გარიგება`,
and `რედაქტირება`. Destinations and actions are unchanged.

## Browser verification

**72 checks passed:** landing, My tenders, owner detail, and discovery detail ×
`ka`/`en`/`ru` × **320, 375, 390, 442, 1280, 1440 px**. Checked the existing
how-it-works section separately at 390 and 1440 px in all locales. Tests reused
the authenticated client browser profile from the prior session, without
resetting passwords or changing application records. Public detail retained
the existing provider-access gate. No payment, bid, or publication was submitted.

All matrix checks had zero page overflow, clipped controls, split Georgian
control words, fixed-bar overlap, or application exceptions. Desktop menu items
and the menu row remained single-line at the requested desktop widths.
Final Georgian mobile and desktop PNGs were visually inspected as well as
measured; the screenshots below are actual application renders.

The photo gallery opened and closed correctly at 390 px with the inherited
Noto stack and no dialog overflow. The cancellation textarea and list search
rendered at 16/24 px; the search retained its 44 px touch height. The draft
filter navigated to the correct query and displayed three existing records.
No cancellation was submitted. [Shared-control evidence](shared-controls.json).

- **Actual fonts:** Chromium CDP platform-font inspection confirmed the loaded
  Noto families and real Regular/Medium/SemiBold/Bold faces, rather than relying
  only on CSS family names. [Rendered font evidence](rendered-fonts.json).
- **Glyph coverage:** checked Georgian, Mtavruli, English, Russian, `₾`, `m²`,
  `მ²`, dates, filenames, and budget digits. Font cmap checks covered all four
  weights; a transient browser probe exercised mixed strings without editing
  stored tender data. [Font file coverage](font-coverage.json).
- **Contrast:** 849 rendered text checks across 45 distinct foreground/background
  combinations on the four surfaces at 390/1440 px had no failures. White on
  the primary emerald is approximately **5.49:1**. Requirements were **4.5:1**
  for normal text and **3:1** for qualifying large text, following
  [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
  The script composites computed solid/alpha backgrounds; image/gradient pixels
  and all possible hover/error states are not an exhaustive accessibility audit.
  The hero gradient's light endpoints and dark-panel combinations were also
  visually reviewed. [Contrast evidence](contrast.json).
- **Loading:** cold browser contexts, fonts delayed by 1.5 seconds, all locales
  at 390/1440 px. Text remained visible, with zero overflow and zero duplicate
  font requests. Maximum cumulative layout shift was **0.031903** (Russian
  mobile); Georgian measurements were **0.000048** mobile and **0.000259** desktop.
  [Loading evidence](font-loading.json).
- **Text enlargement:** 200% root text size on landing and owner detail in all
  locales at 320/390/640/720/1280 px: 30 checks, no horizontal overflow or
  insufficient fixed-bar content space. [Enlargement evidence](text-zoom.json).
  Narrower CSS viewports also exercise the reflow needed for desktop zoom.

Environment: **Google Chrome on Windows**, automated headless browser rendering.
Playwright MCP captured the baseline and initial browser passes. Its connection
closed during a later loading check; local Playwright with the same saved profile
completed final verification. Physical phones, iOS Safari, Firefox, macOS, and
headed Windows/ClearType comparisons were unavailable. Chrome toolbar zoom
shortcuts did not change the automated viewport; native toolbar zoom is therefore
not claimed as tested. Text enlargement and viewport reflow were tested explicitly.

## Actual screenshots

Each comparison uses the same locale, route, and viewport width. Baselines were
captured before editing, from the previous local production build. Full-page
PNG files include the rest of the workflow; viewport PNGs show the first screen.

| Georgian surface       | Mobile before / after (390 px)                                                                              | Desktop before / after (1440 px)                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Landing + how it works | [Before](screenshots/typography-before-ka-390.png) · [After](screenshots/after-ka-landing-390.png)          | [Before](screenshots/typography-before-ka-1440.png) · [After](screenshots/after-ka-landing-1440.png)          |
| My tenders             | [Before](screenshots/typography-before-owned-390.png) · [After](screenshots/after-ka-owned-390.png)         | [Before](screenshots/typography-before-owned-1440.png) · [After](screenshots/after-ka-owned-1440.png)         |
| Owner detail           | [Before](screenshots/typography-before-owner-390.png) · [After](screenshots/after-ka-owner-390.png)         | [Before](screenshots/typography-before-owner-1440.png) · [After](screenshots/after-ka-owner-1440.png)         |
| Discovery detail       | [Before](screenshots/typography-before-discovery-390.png) · [After](screenshots/after-ka-discovery-390.png) | [Before](screenshots/typography-before-discovery-1440.png) · [After](screenshots/after-ka-discovery-1440.png) |

Also saved: Georgian 320 px screenshots; English/Russian 390/1440 px screenshots
for all four surfaces; how-it-works viewport screenshots in all locales; and
Georgian 200% text-enlargement screenshots. See [screenshots](screenshots/).

## Code review and checks

The requested fresh-context reviewer found **no critical/high issues**. Both
medium findings were addressed and re-reviewed: enlarged mobile tab wrapping
and pending status foreground contrast. Browser checks additionally caught and
resolved a legacy body-color/size token collision, an old Georgian hero override,
and narrow-screen language/action layout issues.

- Production build, TypeScript, lint, changed-file formatting and `git diff --check`: pass.
- Existing unit checks: **391 passed in 75 files**.
- Existing integration checks against the separate test database: **88 passed in 21 files**.
- Existing browser shell/identity checks: **21 passed, 3 skipped, 2 failed**.
  The skips are the CI-only mailbox assertions and desktop-only exclusion of
  the mobile menu check. Both failures concern the existing unsupported-locale
  not-found document, outside these typography changes: the old test incorrectly
  treated `/ru` as unsupported. It now requests `/de`, which returns 404 but
  retains `Tender Marketplace` instead of the expected localized not-found title.
- Module boundaries: existing failure in `src/modules/profiles/domain/profile.ts`
  importing `../../localization/config`; that file was not modified.

The production preview remains available at `http://localhost:3000`.
