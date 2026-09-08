# Reusing the browser verification scripts

These scripts and captures accompany [the completed test plan](../app-flow-test-plan.md). They were executed through Playwright MCP against `http://localhost:3000`; they are not automatically discovered by `pnpm test:e2e`.

PNG captures are local, ignored artifacts and are not included in Git. The scripts can regenerate them; the committed Markdown and JSON retain the verification results.

## Browser scripts

Load a script with Playwright MCP's `browser_run_code_unsafe` tool using its `filename` argument. Each file contains a single named async function receiving the MCP `page` object. Update the base URL and screenshot directory when using a different checkout or server; the original capture directory is an absolute Windows path in the scripts. Save returned observations separately if preserving this historical run.

| Script                | Purpose                                                                                                                                | Prerequisites                                                                                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public-flows.js`     | Locale navigation, discovery filters/sort, masked detail, protected routes, 404s, keyboard access and overflow                         | Running app with published tenders, including a mapped tender. Assertions assume the test catalog has no Transport matches. Creates and closes guest contexts.                                                                               |
| `auth-flows.js`       | Client/provider registration, verification, onboarding recovery, profile save, login/logout and password reset at desktop/mobile sizes | Development server with the local test mailbox available. Creates fresh QA accounts with generated passwords and leaves their records in the local database.                                                                                 |
| `responsive-flows.js` | Authenticated route/viewport matrix, main landmarks, language abbreviations, console and HTTP failures                                 | Existing authenticated MCP contexts: 1 desktop client, 2 mobile provider, 4 mobile client, 5 desktop provider. Update the context indexes and fixture URLs for a new session/database. Clones session state without writing cookies to disk. |

The captured fixture IDs refer to this local database, not a clean installation. `fixture-ids.json` lists supplementary lifecycle records; the test plan records the main tenders and agreements. The final browser results also document keyboard navigation, deadline filters and wrong-role checks performed interactively through MCP.

## Fixture helper

Run from the repository root with `pnpm exec tsx docs/qa-20260908/fixtures.ts <operation> [id]`. It loads the configured local database and refuses non-local database hosts.

| Operation                     | Effect                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `catalog`                     | Read-only comparison of place names against the existing migration.                                                           |
| `repair-catalog`              | Restore only corrupted `???` place names from that migration.                                                                 |
| `settle <tender-id>`          | Advance a QA tender deadline and invoke the real selection service.                                                           |
| `selection-retry <tender-id>` | Invoke selection again without changing the deadline.                                                                         |
| `expire <tender-id>`          | Advance a pending QA agreement's confirmation deadline and invoke expiry.                                                     |
| `admin <qa-email>`            | Grant ADMIN capability to a QA account.                                                                                       |
| `qa-provider-login`           | Set a password supplied through `QA_FIXTURE_PASSWORD` for the latest mobile QA provider created by the authentication runner. |

Tender/account mutations are restricted to this run's QA prefixes. These operations change local fixtures; they do not reproduce UI actions or verify an external scheduler. Credentials and session storage are not included in the committed evidence.

## Evidence

- `execution-results.json`: observations from the main journeys and automated check totals.
- `final-browser-results.json`: final 62 assertions, including the responsive matrix and navigation checks.
- PNG files: visual evidence at the indicated viewport. Files ending in `-final` supersede earlier captures of the same view; earlier captures retain the progression of the test run.

For normal regressions, use the repository's unit/integration tests in addition to these browser scripts. This run passed 406 unit tests and 89 integration tests; the report records browser scope and limitations.
