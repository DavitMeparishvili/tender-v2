# Tender create/edit redesign verification

Implemented September 8, 2026 in the primary checkout, using the five supplied desktop/mobile references and the existing tender detail design. Existing unrelated typography and shell changes were preserved.

## Deployment and review

The optimized production build is deployed locally at `http://localhost:3000`. This is not a public/remote deployment. No Git push or remote database mutation was performed.

An independent reviewer received no conversation history, inspected all five reference images and reviewed the implementation. Findings about currency races, pin/address preservation, repeated draft saves, clearing fields, duplicate field IDs, upload mutability, and expiring attachment URLs were addressed. The reviewer confirmed no remaining material findings in those fixes.

## Implemented behavior

- Shared create/edit form with five sections, desktop summary/navigation sidebar, mobile section selector, responsive work rows, optional requirements, and persistent actions.
- One primary project description. Existing independent summary/scope text remains available; summaries previously derived from the description track description changes.
- Drafts save incomplete fields and explicitly clear description, budget, deadline, area, and location. Title and service classification remain the minimum needed to create a draft.
- Published edits save details, location, and attachment additions/removals together under the tender row lock. Editing remains restricted to future-deadline published tenders without any bid history. Currency is fixed after publication because providers may already be composing offers in that currency.
- Upload progress, cancellation, 10-file limit, 15 MB limit, byte-signature checks, and disabled save/review actions while uploading. Files remain pending until Save; merely previewing changes leaves the published record unchanged.
- Signed uploads are write-once. Reusing a completed PUT is rejected by object storage. DWG inspection now reads the 64-byte prefix required by its validator.
- DWG uses an explicit blob download with a fresh signed URL; it does not navigate the editor or open a CAD document in a new tab. PDF preview opens separately.
- Provider preview uses generic locked attachment illustrations and an approximate area circle. Exact address and private file URLs are absent from the preview. Owner editing preserves the actual pin and entered street address.
- English, Georgian, and Russian copy; repository service/place taxonomy and real file sizes are retained. District remains text because the current catalog has places, not district choices. Georgian calendar and number formatting are deterministic even in browsers without Georgian ICU data.

## Browser evidence

Initial checks used the configured Playwright MCP tools. After that transport closed, final checks used the installed Playwright MCP server through a local stdio bridge. The browser was restored with a local development account session; no password was reset.

Dedicated local QA records avoid altering the original examples:

- Published edit fixture: `/en/client/tenders/cf5866bd-aeeb-4afd-a956-0ae7a3454e1a/edit`
- Complete draft fixture: `/en/client/tenders/new?tenderId=f5089ae8-b66a-4581-88ed-703ab2c8b9e4`

The QA records contain the supplied example's GEL 48,000 budget, September 25, 2026 at 12:00 Tbilisi deadline, October 5 start, 96 m² project area, four quantity rows, four photos and PDF/DWG files. Dates were observed through the UI and stored API values: deadline `2026-09-25T08:00:00.000Z`; start `2026-10-05T00:00:00.000Z`. The entered address remains Chavchavadze Avenue 37; exact QA coordinates are 41.711529, 44.757378 and public coordinates are 41.71, 44.76.

| Reference                          | Captured implementation                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Desktop create, Image 1            | `.impeccable/review/authoring-create-desktop.png`                                |
| Mobile create sections, Image 2    | `.impeccable/review/authoring-create-mobile.png`                                 |
| Desktop edit, Image 3              | `.impeccable/review/authoring-edit-desktop.png`                                  |
| Mobile edit, Images 4/5            | `.impeccable/review/authoring-edit-mobile.png`                                   |
| Upload in progress, Images 4/5     | `.impeccable/review/authoring-upload-mobile.png`                                 |
| Final provider preview, Images 4/5 | `.impeccable/review/authoring-review-mobile.png`, `authoring-review-desktop.png` |

The layout follows the reference section order, white panels, emerald actions, desktop rail, mobile quantity cards/two-column photo grid, and approximate preview map. It uses the repository's current typography and real taxonomy/media rather than inventing the reference's illustrative service names or file sizes. The preview includes existing requirements for consistency with the detail view, so it is taller than the reference. The sticky action bar is captured at the viewport position in full-page screenshots.

Verified interactions:

- Create, save, reload, review, publish, edit, preview without live mutation, save, and inspect resulting detail/API values.
- Change budget to GEL 49,000 and quantity/area to 97; preview and save show those exact values; restore the QA fixture afterward.
- Resume location A, save B, restore A, save: server returns A. Clearing saved draft description, budget, and deadline produces null stored values.
- DWG downloads successfully as `Floor plan.dwg`, with no new tab or editor closure. PDF returns a valid PDF signature and its separate preview leaves the editor open.
- Pending upload disables both actions; cancelling removes the pending row and preserves the six saved files.
- First signed object upload returns 200; replay returns 412.
- Preview exposes no exact street address or private image URL.
- Desktop 1440px and mobile 390px comparisons; EN/KA/RU checks at 320px, 390px, and 1440px all have no page/action overflow or runtime page errors. No duplicated area ID.

## Automated checks

- Unit tests: 76 files, 396 tests passed.
- PostgreSQL/storage integration tests: 22 files, 89 tests passed.
- Production build and TypeScript: passed.
- Targeted ESLint and `git diff --check`: passed.
- Design detector findings were resolved using existing palette/type values. No ignore or suppression was added.

The pre-existing boundary check still flags the profiles domain's localization import. The existing local authentication-secret warning also remains. Neither is caused by this editor change.
