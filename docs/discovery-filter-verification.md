# Discovery filter verification

Implemented September 8, 2026 in the primary checkout. Existing unrelated work was preserved.

## Changes

- Shared Georgian city/settlement select in discovery and tender authoring, with localized catalog labels. Discovery submits canonical English city names; authoring retains place IDs. Same-name settlements are combined with their region labels for name-based discovery searches.
- Compact GEL / USD / Any currency control: 8px inner padding and white gaps between individual options, 12px block margins, 36px desktop and 44px mobile options.
- Phone/tablet filter sheet through 1024px, visible close action, focus containment/restoration, inert background, scroll locking, sticky actions, and safe-area padding.
- Validation stays in the form, including mobile; unchanged Apply does not get stuck loading. Category/currency chip removal clears dependent service/budget filters. Currency gets its own removable chip.

## Review and deployment

An independent reviewer received no conversation history. Its high breakpoint mismatch finding and medium duplicate-settlement finding were resolved and rechecked. It also reviewed the final currency-spacing adjustment; no remaining actionable findings.

The optimized production build was restarted at `http://localhost:3000`. This is a local deployment matching the supplied screenshot, not a remote deployment.

## Verification

- Production build including TypeScript passed; focused ESLint, Prettier, and `git diff --check` passed.
- 34 targeted unit tests passed across discovery UI, new regressions, authoring, and place catalog tests (33 initially, plus the new duplicate-name regression).
- Seven PostgreSQL search integration tests passed.
- After deployment, Playwright MCP verified city, category/service, currency-only and budget filtering, deadline shortcuts, empty results, reset, dependent chip removal, unchanged Apply, mobile invalid/valid ranges, Escape/focus restoration, and tablet-to-desktop modal cleanup.
- EN/KA/RU at widths 320, 390, 800, and 1440 showed no page/filter overflow or runtime page errors. Following the user's spacing adjustment, fresh deployed checks at 320, 390, and 1440 verified the computed padding/gaps, unclipped labels, mobile touch sizes, and budget validation/filtering.
- Screenshots were inspected for desktop and mobile. Final currency evidence: `.impeccable/review/discovery-currency-1440.png`, `discovery-currency-390.png`, and `discovery-currency-320.png`. Earlier full-page/layout evidence: `discovery-desktop.png`, `discovery-mobile-filters.png`, `discovery-mobile-results.png`, and localized mobile budget screenshots in the same folder.

The existing homepage glow color at `app/globals.css:1454` remains a design-detector finding outside this change. No suppression was added. The existing local authentication-secret warning also remains.
