# Desktop and mobile application verification

Started: 2026-09-08. Target: http://localhost:3000. Browser: Chromium through Playwright MCP.
Desktop: 1440 × 900. Mobile: 390 × 844 with touch/mobile emulation; additional 320 px overflow checks.
Accounts: supplied demo client and provider. Passwords are deliberately omitted from this artifact.
Records created for this run use the prefix `QA MCP 20260908`.

This plan was written before executing the flows. Check a box only after observing the expected outcome. Failed checks remain open until fixed and retested. Record unavailable prerequisites explicitly; do not count them as passing.

## Planned actions and expected outcomes

| ID  | Action                                                                   | Expected outcome                                                                        | Desktop | Mobile |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------- | ------ |
| G01 | Open root and homepage; follow primary navigation                        | Default Georgian locale, working navigation, readable layout                            | [x]     | [x]    |
| G02 | Switch Georgian, English, Russian                                        | Correct translated page and locale-preserving links                                     | [x]     | [x]    |
| G03 | Browse public tenders and open detail                                    | Listings load; confidential address/contact and bidding remain protected                | [x]     | [x]    |
| G04 | Search, category/location/budget filters, sorting, clear, no results     | Correct results and URL state; clear restores list                                      | [x]     | [x]    |
| G05 | Open detail map; inspect masked and unlocked location                    | Map loads; approximate/exact location follows access policy (no list/map switch exists) | [x]     | [x]    |
| A01 | Submit invalid login, then supplied client/provider login                | Generic invalid-credential error; valid login reaches correct workspace                 | [x]     | [x]    |
| A02 | Log out; visit protected and wrong-role routes                           | Session cleared; protected data unavailable; appropriate redirect/error                 | [x]     | [x]    |
| A03 | Client registration validation, submit, verify email, onboarding         | Invalid fields explained; verification and client onboarding succeed                    | [x]     | [x]    |
| A04 | Provider registration, verification, onboarding validation               | Provider profile/capabilities saved and provider workspace accessible                   | [x]     | [x]    |
| A05 | Forgot/reset password, invalid token, login with new password            | Generic request confirmation; invalid token handled; new password works                 | [x]     | [x]    |
| P01 | Edit profile, invalid values, save and reload                            | Validation is understandable and valid changes persist                                  | [x]     | [x]    |
| T01 | Open new tender; attempt incomplete progression/publication              | Required fields identified; no incomplete publication                                   | [x]     | [x]    |
| T02 | Fill categories, location/map, budget, dates, work items                 | Controls accept valid input and preserve values between steps                           | [x]     | [x]    |
| T03 | Save draft, leave, reopen, edit, save                                    | Draft and work items persist accurately                                                 | [x]     | [x]    |
| T04 | Upload valid image/PDF, reject spoofed/oversized file, remove attachment | Valid files preview/download; invalid files explained; removal persists                 | [x]     | [x]    |
| T05 | Leave dirty form, including locale change                                | Unsaved-change guard prevents accidental loss when cancelled                            | [x]     | [x]    |
| T06 | Publish complete tender and view owned/public details                    | Published status, accurate content, listing appears, sensitive data protected           | [x]     | [x]    |
| T07 | Edit published tender before bids and check persisted detail             | Allowed changes persist and protected fields obey policy                                | [x]     | [x]    |
| T08 | Cancel own tender without bids                                           | Terminal cancelled state; no longer available for new bids                              | [x]     | [x]    |
| B01 | Open locked tender; attempt protected attachment/bid access              | Masked details and access requirement enforced                                          | [x]     | [x]    |
| B02 | Buy single tender access through mock checkout                           | Full detail and attachments unlock; entitlement persists after reload                   | [x]     | [x]    |
| B03 | Submit invalid then valid bid                                            | Invalid offer rejected; one valid offer saved and displayed                             | [x]     | [x]    |
| B04 | Revise bid and inspect anonymous summary                                 | Updated amount/terms persist; summary accurate without competitor identity              | [x]     | [x]    |
| B05 | Client inspects bids; attempts disallowed edit/cancellation              | Own bids visible; policies prevent invalid mutations                                    | [x]     | [x]    |
| B06 | Withdraw bid and attempt another offer                                   | Withdrawn status persists; prohibited resubmission rejected                             | [x]     | [x]    |
| B07 | Purchase category access and revisit matching tender                     | Scope correctly unlocks matching category, entitlement displayed                        | [x]     | [x]    |
| L01 | Deadline selection of a QA tender with bids                              | Lowest eligible bid wins once; immutable agreement generated                            | [x]     | [x]    |
| L02 | Both parties confirm, acknowledge start, confirm completion              | Correct pending/agreed/in-progress/completed transitions                                | [x]     | [x]    |
| L03 | Decline pending agreement                                                | Terminal cancelled agreement with clear status and no fallback winner                   | [x]     | [x]    |
| L04 | Cancel agreed/in-progress agreement                                      | Allowed cancellation produces terminal neutral status                                   | [x]     | [x]    |
| L05 | Expire overdue pending agreement; retry terminal action                  | Expiry applied once; invalid terminal actions rejected                                  | [x]     | [x]    |
| R01 | Review before completion; invalid and valid completed review             | Premature/short review rejected; valid review published                                 | [x]     | [x]    |
| R02 | Duplicate review and public profile aggregates                           | One review per party; public score/comment accurate                                     | [x]     | [x]    |
| R03 | Admin moderation and non-admin denial                                    | Only authorized moderator can redact; redaction removes public review                   | [x]     | [x]    |
| N01 | Inbox, mark read, reload, follow notification                            | Accurate notification, persisted read state, correct destination                        | [x]     | [x]    |
| U01 | Keyboard, focus, dialogs, dropdowns and bottom navigation                | Controls operable; overlays dismiss; focus visible; active nav correct                  | [x]     | [x]    |
| U02 | Overflow, narrow reflow, long content, empty/error/not-found routes      | Readable usable screens without clipping or unexpected errors                           | [x]     | [x]    |
| U03 | Inspect console/network during all journeys                              | No unexplained application errors or failed critical requests                           | [x]     | [x]    |

## Execution evidence

Screenshot links below refer to local, ignored captures. Git retains the scripts, checklist, and JSON observations; the PNG evidence is not included in the repository.

Completed 2026-09-09 through Playwright MCP. Separate browser contexts covered both supplied accounts on desktop and mobile. Supplementary QA accounts covered registration, verification, onboarding, password reset, annual access, and moderation.

The final pass contains **62 passing assertions**, including 46 route/viewport layout checks and four clean browser diagnostic groups. [Final browser results](qa-20260908/final-browser-results.json) include keyboard bottom navigation, compact languages, wrong-role access, and deadline filters. The seven-day filter correctly retained the Gori tender closing September 14 and excluded later tenders. GPT-5.6 Sol at medium reviewed these final results and the mobile language screenshot; the original Playwright session was retained to preserve authenticated contexts.

- [Machine-readable observations](qa-20260908/execution-results.json), [authentication runner](qa-20260908/auth-flows.js), [public-flow runner](qa-20260908/public-flows.js), [responsive runner](qa-20260908/responsive-flows.js).
- Screenshots: [mobile language menu](qa-20260908/mobile-language-menu.png), [desktop discovery](qa-20260908/desktop-discovery.png), [mobile tender](qa-20260908/mobile-owned-tender.png), [completed agreement](qa-20260908/mobile-completed-agreement-final.png), [client public profile](qa-20260908/mobile-public-profile-final.png).
- Desktop-authored tender `ba08b3d5-328c-4283-affb-653e8ca1db3e`: saved draft/work items, uploaded files, published, edited budget to GEL 5,600. Mobile provider unlocked, bid GEL 4,900, revised to GEL 4,700 while retaining October 1 start date. Both parties completed agreement `f9e0d8b8-fc70-4cd8-89a3-1585aa851965`.
- Mobile-authored tender `b1eca10a-976b-4e43-85c7-3b4e0700dc1c`: published GEL 6,200 with a real image and 24 m² work item. Desktop provider unlocked, bid GEL 5,800, revised to GEL 5,500 while retaining October 2 start date. Both parties completed agreement `346f7ea1-8f1f-401c-b116-38b182c51188`.
- Both layouts: published tender edits persisted; unused tenders cancelled; missing cancellation reasons rejected. Active offers disabled owner edits/cancellation; direct cancellation returned 409. Withdrawals persisted and prohibited rebids returned 409.
- Pending agreements declined on both layouts. Desktop cancellation tested from AGREED; mobile cancellation from IN_PROGRESS. Overdue pending agreements expired; subsequent confirmation returned 409. Repeated expiry returned INVALID_STATE. Repeated selection returned `alreadyRan: true` with the same winner/agreement.
- Monthly access purchased on desktop and verified on mobile. Annual access purchased on mobile with a separate QA provider. Locked attachment/bid requests returned 402 NOT_ENTITLED before purchase.
- Both parties published completed-agreement reviews. Short comments and premature publication were rejected; duplicate publication returned 409. Moderator redaction was performed at desktop and mobile sizes; public review counts then became zero. Non-admin moderation returned 403.
- Both layouts: PDF downloaded with the expected filename; real images decoded after save/reload and opened in the gallery; Escape closed the gallery. Spoofed PDF rejected on save, 16 MB upload rejected, attachment removal persisted. Cancelling the dirty-form locale warning preserved the unsaved title.
- Inbox read state persisted after reload. Winning-offer notifications opened the corresponding agreement on desktop and mobile.
- Public journeys switched ka/en/ru, searched by city, applied/cleared category and budget filters, sorted, opened detail maps, verified protected-route redirects and usable 404 pages. Responsive sweep covered 320/390 px mobile and 720/1440 px desktop layouts, with one main landmark and no page overflow.
- All four role/device authentication journeys included verification, onboarding, profile validation/save, logout, invalid/valid login, invalid reset token, mismatch validation, successful reset, and login using the new password.

Additional cancellation/withdrawal/expiry fixture IDs are in [fixture-ids.json](qa-20260908/fixture-ids.json). Attachment-only QA drafts remain available for inspection.

## Bugs, fixes, and retests

| Finding                                                                         | Fix                                                                                          | Observed retest                                                                                                    |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Mobile language dropdown labels were too long                                   | Compact mobile header options; visible KA / EN / RU, full accessible language names retained | Locale links work and options fit at 320/390 px                                                                    |
| Bid revision cleared proposed start date                                        | Restore the existing date into the form                                                      | October 1/2 dates survived price revision and reload                                                               |
| Entitled providers still saw a private client placeholder                       | Retrieve/render client contact only after entitlement succeeds                               | Unlocked contact/profile links visible; guest/unentitled projection omits contact and never queries it             |
| Choosing a deadline without typing time silently lost the date                  | Visible default time of 12:00                                                                | Date-only selection saved/reloaded as September 26 at 12:00                                                        |
| Incomplete tender validation repeated generated description/scope errors        | Remove redundant errors for generated empty fields                                           | Required-description issue appears once; incomplete publication still blocked                                      |
| Client profiles used provider labels/sections and reported zero completed jobs  | Render client-specific content; count completed engagements for either party                 | Client shows Verified account, About the client, and two completed engagements; irrelevant provider claims removed |
| Public profile had a nested main landmark                                       | Replace inner main with content div                                                          | One main landmark on both layouts                                                                                  |
| Agreement proposed start showed an invented time                                | Render date only                                                                             | October 2 displays without a time                                                                                  |
| Winner-selection notifications had no destination                               | Add known tender-event routes, including agreement destinations                              | Client/provider Open links reach agreement; routing regression tests pass                                          |
| Profile/onboarding network failures left forms stuck saving                     | Catch failures, show error, re-enable retry                                                  | Deliberately aborted requests recover; profile save and all four onboarding journeys succeed after retry           |
| Homepage suggested keyword search although it searches cities                   | Use City or settlement placeholder                                                           | Tbilisi search preserves city URL state and returns listings                                                       |
| Browser icon request failed                                                     | Add app icon from existing brand asset                                                       | Production icon route available; clean browser sweeps have no critical asset failures                              |
| Wrong-role workspace repeated its heading                                       | Render title once                                                                            | Denied view retains message/back action with one heading                                                           |
| Local city catalog had 43 corrupted name rows                                   | Restore only corrupted local rows from existing UTF-8 migration                              | Canonical catalog comparison reports zero differences                                                              |
| Repository checks failed on domain localization import/generated helper scripts | Domain locale union; exclude generated Impeccable helper scripts from lint                   | Boundary and lint checks pass                                                                                      |

The catalog repair is a local data correction, not a migration change. Code fixes are in the primary checkout.

## Verification and limitations

- [x] Unit tests: **77 files, 406 tests passed**.
- [x] Integration tests: **22 files, 89 tests passed** against isolated `tender_test`; all 12 migrations already applied.
- [x] Type checking, lint, and module-boundary checks passed.
- [x] Production build passed; local app is running the resulting build.
- [x] Browser observations, screenshots, and API assertions are linked above.

Scope and prerequisites:

- Chromium desktop and mobile/touch emulation were tested. Physical devices, Safari, and Firefox were not tested. The 720 px desktop sweep checks reflow equivalent to halving a 1440 px layout; it is not physical-browser 200% zoom certification.
- Registration/reset used the local test mailbox in development. Final marketplace/responsive checks used production. No external email was sent and no real money moved; checkout is explicitly simulated.
- Main tender authoring, purchases, bids, agreement actions, reviews, moderation, profiles, and inbox actions were performed through the UI. Browser API calls additionally checked authorization and invalid/duplicate operations.
- Supplementary lifecycle tenders/bids were prepared through authenticated local APIs. The guarded [fixture helper](qa-20260908/fixtures.ts) advanced only QA deadlines, invoked real selection/expiry services, granted a QA moderator capability, and prepared a separate QA provider login. Advancing time is fixture setup, not evidence of a UI action or the deployment scheduler.
- Discovery has no list/map toggle; G05 covers implemented detail maps. Saved-search email subscriptions and provider portfolio-photo uploads are placeholders; these unavailable features are not counted as successful actions.
- Expected validation, authentication, entitlement, duplicate-action, and not-found responses were tested deliberately. Earlier development reload interruptions were retested against production.
- QA records/screenshots remain for review. Supplied demo passwords are unchanged. No worktree, commit, deployment, or real payment was created.
