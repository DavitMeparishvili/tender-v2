import type { APIRequestContext, Browser, Page } from "@playwright/test";
import type { Locale } from "../../../modules/localization/config";
import { signInSeededAccount } from "./accounts";

export const PHASE_3_DUE_TENDER = "Phase 3 tender whose deadline has passed";

export const PHASE_3_PROVIDERS = {
  b: "phase3.provider.b@tender.test",
  c: "phase3.provider.c@tender.test",
} as const;

// The three seeded amounts. The cheapest is the SECOND bid submitted, on
// purpose, so "the winner" is never simply "the first" or "the last" offer.
export const PHASE_3_BID_AMOUNTS = {
  providerA: 420_000,
  providerB: 380_000,
  providerC: 400_000,
} as const;
export const PHASE_3_WINNING_AMOUNT = PHASE_3_BID_AMOUNTS.providerB;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Same reason as `warmUpDevServer` in ./tenders.ts: outside CI Playwright runs
// `next dev`, which compiles each route on its first hit, and a bare
// `expect(...)` has a 5-second default timeout.
const WARM_UP_ROUTES = [
  "/continue",
  "/provider/tenders",
  "/provider/tenders/00000000-0000-0000-0000-000000000000",
  "/client/tenders",
] as const;

export async function warmUpBiddingRoutes(
  request: APIRequestContext,
): Promise<void> {
  for (const locale of ["ka", "en"] as const) {
    for (const route of WARM_UP_ROUTES) {
      await request.get(`/${locale}${route}`);
    }
  }
  // The worker route is not a page, but it compiles on first hit too, and an
  // unauthenticated POST is a cheap 401 that forces that compile.
  await request.post("/api/tenders/selection/run");
}

export function selectionWorkerSecret(): string {
  const secret = process.env.SELECTION_WORKER_SECRET;
  if (secret === undefined || secret.length < 32) {
    throw new Error(
      "SELECTION_WORKER_SECRET must contain at least 32 characters",
    );
  }
  return secret;
}

// Publishes a fresh, uniquely titled tender as the seeded client, through the
// real API, in its own browser context.
//
// The access journey buys access and sends an offer, so it CANNOT run twice
// against one seeded tender — and it runs four times (ka/en x desktop/mobile).
// Creating its own tender per run makes it repeatable and independent of
// whether any other spec has already run.
export async function publishTenderAsClient(
  browser: Browser,
  locale: Locale,
  title: string,
): Promise<string> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInSeededAccount(page, "client", locale);

    const created = await page.request.post("/api/tenders", {
      data: {
        specialty: "CONSTRUCTION_REPAIR",
        serviceCode: "GENERAL_CONSTRUCTION",
        title,
      },
    });
    if (!created.ok()) {
      throw new Error(`Could not create "${title}": ${created.status()}`);
    }
    const { tender } = (await created.json()) as { tender: { id: string } };

    const updated = await page.request.patch(`/api/tenders/${tender.id}`, {
      data: {
        shortDescription: "Repaint and refinish a two-bedroom flat",
        fullDescription:
          "Strip old finishes, repair walls, and repaint throughout a " +
          "two-bedroom apartment.",
        scopeOfWork:
          "Demolition of old finishes, wall repair, and painting across " +
          "two bedrooms and a hallway.",
        budgetMinorUnits: 450_000,
        currency: "GEL",
        deadline: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        conditions: "Work must be completed on weekdays between 9am and 5pm.",
      },
    });
    if (!updated.ok()) {
      throw new Error(`Could not complete "${title}": ${updated.status()}`);
    }

    const located = await page.request.patch(
      `/api/tenders/${tender.id}/location`,
      {
        data: {
          mode: "ADDRESS",
          city: "Tbilisi",
          district: null,
          addressLine: "12 Rustaveli Avenue",
        },
      },
    );
    if (!located.ok()) {
      throw new Error(`Could not locate "${title}": ${located.status()}`);
    }

    const published = await page.request.post(
      `/api/tenders/${tender.id}/publish`,
    );
    if (!published.ok()) {
      throw new Error(`Could not publish "${title}": ${published.status()}`);
    }
    return tender.id;
  } finally {
    await context.close();
  }
}

// Resolves a seeded tender's id from its title, for a page already signed in
// as its OWNER. `GET /api/tenders` lists only the caller's own tenders, which
// is the only place a settled tender's id is still discoverable — discovery
// deliberately drops it once the deadline passes.
export async function findOwnedTenderIdByTitle(
  page: Page,
  title: string,
): Promise<string> {
  const response = await page.request.get("/api/tenders");
  if (!response.ok()) {
    throw new Error(`Could not list owned tenders: ${response.status()}`);
  }
  const { tenders } = (await response.json()) as {
    tenders: ReadonlyArray<{ id: string; title: string }>;
  };
  const match = tenders.find((tender) => tender.title === title);
  if (match === undefined) {
    throw new Error(
      `No seeded tender titled "${title}". Run \`pnpm seed:phase-3\` first.`,
    );
  }
  return match.id;
}
