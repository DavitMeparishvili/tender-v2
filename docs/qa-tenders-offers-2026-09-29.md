# Georgian tender and offer QA — 2026-09-29

Playwright MCP browser testing against `http://localhost:3000`, local `tender_dev` only. Primary locale: Georgian. Separate authenticated client and contractor browser contexts. No production changes, emails, or production deployment.

## Fixture

- Client: dedicated local `phase1.client@tender.test`; contractor: existing demo provider.
- Created through client UI: tender `95844eca-c9ea-4ff4-87fa-6324bed73b0a` (Georgian QA title).
- Budget: 1,250,000.50 GEL. Offer: 1,234,567.89 GEL, revised to 1,100,000.25 GEL.
- Offer `65318bd2-0e78-4425-acd0-044b4a94dfbe` was withdrawn through confirmation. Tender was subsequently canceled through the client UI with a QA completion reason.
- User's existing tender `403bb3a3-e58b-432d-a525-5facf1690d71` and saved 24,000 GEL offer were not edited.
- Additional draft `394919d6-b4ca-4c0c-8583-20cce3f83987` retained for mobile authoring and map-pin reproduction; not published.

## Functional coverage

- Client login; navigate from workspace to tender creation.
- Empty publish review reports eight named Georgian required-field errors.
- Save minimal draft with category, service, and title; complete description, decimal budget, city, address, and calendar deadline; preview; publish.
- Own tender list and detail navigation; received-offers anchor; large amount display.
- Contractor login; discovery lists the newly published tender; open details.
- Empty offer submission reports amount, mandatory duration, and minimum conditions errors.
- Submit valid offer; read-only summary, saved confirmation, pending status, amount, and duration.
- Explicit edit; cancel changes retains saved amount; revise amount and duration with a 700 ms request delay; revised read summary matches saved values.
- Client comparison receives offer and subsequently displays revised amount/duration and withdrawn status.
- Withdrawal confirmation explains irreversibility; keep-offer action preserves editing; confirmed withdrawal returns HTTP 200 and removes edit controls after refresh.
- My offers reached through actual mobile navigation; current pending, withdrawn, and existing won offers visible.
- Existing won offer detail inspected read-only; green status and no editing controls.
- Client editing restriction explained after offers exist; cancellation requires a reason and succeeds after active offer withdrawal.
- Mobile authoring calendar, full decimal amount, required markers, sticky controls, and preview inspected at 320 and 390 px. Date selection succeeds at both sizes; no final viewport overflow.
- Map error reproduced by selecting a pin then immediately disabling adjustment: Leaflet `_onZoomTransitionEnd` read `_leaflet_pos` after map removal. Latest fix passes four rapid toggle/click cycles at 320 px plus desktop marker drag/save/reload without page errors. Saved draft location remains PIN mode; API reads exact coordinates 41.692174, 44.837351 after reload.

## Visual coverage and findings

Inspected Georgian client comparison, contractor detail/read summary, and My offers at 1280, 390, and 320 px. Checked document width and screenshots, including long Georgian titles, conditions, and seven-digit decimal money. No document horizontal overflow in these final views.

1. **Fixed and retested:** Mobile navigation had no reachable My offers link. Added bottom tab and workspace tile; actual tab navigation passes at 320 px, label fits.
2. **Fixed and retested:** Desktop client comparison table hid status offscreen and broke Georgian words in narrow columns. Container-responsive cards show status and amount immediately, conditions use the full row. Mobile cards remain readable.
3. **Fixed and retested:** Canceling a tender removed historical offers from its client detail, incorrectly reporting zero while the list retained one. Owner-authorized history lookup now retains the withdrawn offer. Reloaded canceled detail at 1280 and 320 px: amount, duration, terms, provider, and withdrawn status remain present with no document overflow.
4. **Fixed and retested:** Map adjustment could leave a Leaflet zoom completion callback using a removed map. Lifecycle guards and disabled zoom animation pass the reproduced rapid-toggle sequence and desktop drag/save/reload.
5. **Fixed and retested:** Mobile calendar extended offscreen and budget field clipped long decimal amounts. Calendar now fits within viewport gutters, all weekdays/days are visible, and amount/currency stack for sufficient input width.
6. **Fixed and retested:** At 320 px, authoring attachment heading left its final Georgian letter on a separate line beside the file-count badge. Heading now remains one 27 px line; badge wraps below as a unit, with no overflow.

The client comparison no longer promises a future automatic winner on canceled tenders.

Status styling observed: amber pending, gray withdrawn, green won. No lost fixture for this provider was available during this pass.

## Evidence

Screenshots are local ignored artifacts under `.playwright-mcp/`:

- `qa-provider-mobile-menu-before.png` — missing mobile offers entry before fix.
- `qa-client-1280.png` — original clipped comparison table.
- `qa-client-comparison-fixed1280.png` — readable comparison card after correction.
- `qa-final-client-{320,390,1280}.png` — client comparison responsive checks.
- `qa-final-provider-{320,390,1280}.png` — withdrawn read summary responsive checks.
- `qa-offers-final-{320,390,1280}.png` — My offers navigation/status/money checks.
- `qa-canceled-client-fixed-{320,1280}.png` — historical comparison retained after cancellation.
- `qa-calendar-fixed-{320,390}.png` — bounded calendar and readable full amount.
- `qa-client-preview-{320,390}.png` — mobile tender preview and sticky actions.
- `qa-attachments-fixed320.png` — Georgian attachment heading and count wrap cleanly.

## Limits

- Desktop creation and mobile offer submission were exercised; mobile authoring/preview checked without publishing the second fixture.
- Existing contractor already had full access, so paid/free unlock checkout was not exercised.
- No upload, payment, email, automatic deadline selection, or agreement lifecycle mutation in this pass.
- Won outcome inspected from an existing fixture; lost outcome and other locales not exercised.
- Next development indicator overlapped bottom-left mobile navigation; hidden only in QA browser for product layout interaction. Not a production UI defect.
