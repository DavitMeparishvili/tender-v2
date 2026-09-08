# Tender redesign — implementation and verification

Verified September 8, 2026 against the six supplied desktop/mobile references. The primary checkout was used throughout; no worktree was created.

## Deployment

The optimized production build is running locally at http://localhost:3000 using `pnpm start`. This is a local production-mode deployment, not a deployment to the live public site. No live database, remote deployment, or Git push was performed. The live target still needs confirmation.

## Implemented surfaces

| Surface          | Local route                                                 | Screenshot artifacts                                                             |
| ---------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Discovery detail | `/en/provider/tenders/c184d970-da56-49c2-9d22-a33a452d5210` | `.impeccable/review/discovery-detail-desktop.png`, `discovery-detail-mobile.png` |
| My tenders       | `/en/client/tenders?status=PUBLISHED`                       | `.impeccable/review/my-tenders-list-desktop.png`, `my-tenders-list-mobile.png`   |
| My tender detail | `/en/client/tenders/d4329b32-1f2a-4570-86bd-43e127e7721f`   | `.impeccable/review/my-tender-detail-desktop.png`, `my-tender-detail-mobile.png` |

Each detail also has legible mobile `-top`, `-quantities`, and `-location` screenshots in the same directory. The supplied mobile panels are implemented as scroll positions of a single page, not separate records or routes.

Shared overview, team/material requirements, quantities, attachment gallery/document actions, maps, section navigation, mobile actions, and history now serve the public and owner detail views. List search, real-status filters, sorting, counts, editing eligibility, and management actions use application records. New fields are also editable in the draft wizard and eligible published-detail editor. EN, KA, and RU copy is provided.

## Expected data versus observed data

The following were checked in rendered desktop and mobile pages, not just seed source code:

| Field                          | Discovery example                                                         | Owned example                                              |
| ------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Title                          | Apartment renovation in Tbilisi                                           | Full apartment renovation in Vake                          |
| Reference                      | TN-2026-0148                                                              | TN-2026-0147                                               |
| Budget                         | GEL 120,000                                                               | GEL 48,000                                                 |
| Bidding deadline, Asia/Tbilisi | Aug 21, 2026 · 17:16                                                      | Sep 5, 2026 · 12:00                                        |
| Desired start                  | Aug 23, 2026                                                              | Sep 14, 2026                                               |
| Published date                 | Aug 15, 2026                                                              | Aug 15, 2026                                               |
| Work quantities                | 96 m² floor preparation; 180 m² plastering; 85 m conduit; 250 kg adhesive | Same structured example quantities                         |
| Attachments                    | Four locked photo tiles, two locked document rows                         | Four accessible photos, PDF preview/download, DWG download |
| Offer count                    | 0                                                                         | 0                                                          |
| Address visibility             | Approximate area only                                                     | Chavchavadze Avenue 37, Vake, Tbilisi                      |

The existing extra client draft was preserved: All 2, Published 1, Draft 1. Filtering Published reproduces the single published card shown in the reference. Other supported filters are Closed, Expired, and Cancelled; no unsupported Completed status was invented.

Reference differences are intentional: both deadlines have passed, so discovery says Bidding ended and published editing is disabled with explanatory copy. Database publication status and dates were not falsified. Automatic winner selection remains the existing lowest-valid-offer-at-deadline rule; no winner was fabricated or selection job manually triggered. Actual PDF/DWG sizes display as 1 KB and 569 KB rather than the illustrative 2.4/4.8 MB. Stock media is illustrative, not actual property imagery. Public identity copy describes privacy without falsely promising identity disclosure on unlock or claiming unverified verification status.

The user explicitly approved moving the owned example pin from its inconsistent central-Tbilisi coordinates to Vake. Its example coordinates are now 41.7115293, 44.7573781; public coordinates are coarsened to 41.71, 44.76. This is illustrative seed data, not a surveyed apartment location.

## Database and safe example seeding

Applied additive migration `20260908163000_tender_work_items`: JSON work items, optional positive apartment area, and optional unique reference. Existing descriptions and tender records are preserved. Attachments continue using existing private object storage and server permission checks; metadata and byte-size fields already existed.

Inspect the two explicitly pinned example records:

```powershell
pnpm.cmd exec tsx scripts/seed-tender-redesign.ts
```

Enrich missing example fields and media in the development database only:

```powershell
pnpm.cmd exec tsx scripts/seed-tender-redesign.ts --apply
```

The separately approved map correction can be repeated with `--apply --align-vake`. It asserts the expected owner address and absence of bids. The seeder refuses databases whose name does not end in `_dev`, validates exact record IDs, owners, budgets and dates, creates no new tenders/accounts, preserves existing media, and fills only missing structured example fields. Public placeholder prose is replaced only while the original title is `with map`. No user records were deleted. Restoring the former example pin, if ever needed, would use 41.7151, 44.8271 and the normal coordinate-coarsening function.

### Example asset provenance

- Photos: Pexels [room under construction](https://www.pexels.com/photo/a-room-under-construction-7937304/), [unfinished wall](https://www.pexels.com/photo/unfinished-wall-804392/), [apartment before renovation](https://www.pexels.com/photo/neglected-apartment-before-renovation-12036084/), and [photo 1571460](https://www.pexels.com/photo/1571460/). Source usage terms: [Pexels license](https://www.pexels.com/license/). One low-resolution public stock image is reused as an explicitly illustrative locked preview; actual restricted media URLs never enter the locked page.
- PDF: generated synthetic one-page brief, explicitly marked sample data and not a construction instruction.
- DWG: [LibreDWG example_2000.dwg](https://github.com/LibreDWG/libredwg/blob/master/test/test-data/example_2000.dwg), an illustrative CAD fixture, not a floor plan of this apartment. Retain source provenance and consult the upstream repository's licensing before redistributing its test assets beyond this demo.
- Vake example coordinate reference: [37 Ilia Chavchavadze Avenue listing](https://ge.near-place.com/zoommer-zumeri-37-ilia-chavchavadze-avenue-tbilisi). The approved seed correction uses this as an illustrative pin, not a claim of precise surveyed location.

## Verification

- Production build and TypeScript check: passed.
- Targeted ESLint: passed for tender, bidding, shell, localization, app routes and seed script.
- Unit tests: 32 files, 237 tests passed.
- Database integration tests: 11 files, 59 tests passed.
- Whitespace validation: `git diff --check` passed.
- Independent zero-context reviewer: initially found one high cancellation/submission race plus material UI/seeder issues. All were fixed. Follow-up verdict: no remaining high, critical, or material findings within the reviewed scope. Reviewer inspected code and screenshots; parent executed the tests and browser checks.
- New deterministic race tests queue operations behind a Tender row lock and verify both cancellation-first and submission-first orderings, plus a deadline change during a blocked submission. A submitted offer cannot be stranded on a cancelled tender by this race.
- Browser: all six primary screenshots at desktop 1440px and mobile 390px; no horizontal overflow, broken images, or page runtime errors. Visible mobile detail cards consistently measure 358px. EN/KA/RU mobile checks passed for all three routes.
- Browser interactions: list search returns the owned Vake record, no-match state works, sort changes the query, active Tenders navigation is correct, gallery advances and closes with Escape, and PDF/DWG downloads complete successfully. PDF preview returns HTTP 200 with a PDF signature.
- Permission checks: foreign owner access 403, foreign restricted attachments 403, client bid attempt 403, anonymous attachments 401, invalid cancellation reason 400, overdue published edit 409. Rejected checks did not mutate the examples. Anonymous public HTML contains no private storage key/signed media URL or document download links. Locked gallery images reference only the generic public illustration.

## Existing issues outside this change

`pnpm verify:boundaries` still reports the pre-existing `src/modules/profiles/domain/profile.ts` import of `../../localization/config`; this unrelated module was not edited. The local environment also emits an existing low-entropy authentication-secret warning. A real production deployment must use a strong production secret and its own configured database/object storage. Neither warning was hidden or treated as a passing check.

The user-approved documentation merge records the scoped tender design in `DESIGN.md` and `.impeccable/design.json`, preserving unrelated existing design guidance. No design-hook suppressions were added.
