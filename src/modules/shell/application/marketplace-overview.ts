import { database } from "../../../infrastructure/db/client";

export type MarketplaceOverview = Readonly<{
  openTenders: number;
  verifiedProviders: number;
  offersReceived: number;
  completedEngagements: number;
  /** Open tenders per service category, counted rather than sampled. */
  openBySpecialty: ReadonlyMap<string, number>;
}>;

export type LandingReview = Readonly<{
  id: string;
  overall: number;
  comment: string;
  tenderTitle: string;
  reviewerDisplayName: string;
  createdAt: Date;
}>;

const overallOf = (review: {
  quality: number;
  deadline: number;
  communication: number;
  agreedPrice: number;
}) =>
  (review.quality +
    review.deadline +
    review.communication +
    review.agreedPrice) /
  4;

/**
 * The landing page states figures a visitor can check against the rest of the
 * product, so every number here is counted rather than authored. A marketplace
 * with nothing in it reports zero — the page then says so instead of filling
 * the section with invented supply.
 */
export async function getMarketplaceOverview(
  now: Date = new Date(),
): Promise<MarketplaceOverview> {
  const [
    openTenders,
    verifiedProviders,
    offersReceived,
    completedEngagements,
    bySpecialty,
  ] = await Promise.all([
    database.tender.count({
      where: { status: "PUBLISHED", deadline: { gt: now } },
    }),
    database.user.count({
      where: {
        emailVerified: true,
        capabilities: { some: { code: "PROVIDER" } },
      },
    }),
    database.bid.count(),
    database.agreement.count({ where: { status: "COMPLETED" } }),
    // Counted across the whole open set. Deriving these from a page of search
    // results would silently report the page size as the category total.
    database.tender.groupBy({
      by: ["specialty"],
      where: { status: "PUBLISHED", deadline: { gt: now } },
      _count: { _all: true },
    }),
  ]);

  return {
    openTenders,
    verifiedProviders,
    offersReceived,
    completedEngagements,
    openBySpecialty: new Map(
      bySpecialty.map((row) => [row.specialty, row._count._all]),
    ),
  };
}

/**
 * Reviews shown on the landing page are the same job-bound reviews the profile
 * pages show — never testimonials written for marketing. A redacted review is
 * excluded here exactly as it is excluded from aggregates.
 */
export async function listRecentPublishedReviews(
  limit = 3,
): Promise<readonly LandingReview[]> {
  const rows = await database.review.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      quality: true,
      deadline: true,
      communication: true,
      agreedPrice: true,
      comment: true,
      createdAt: true,
      agreement: { select: { tenderTitle: true } },
      reviewer: { select: { profile: { select: { displayName: true } } } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    overall: overallOf(row),
    comment: row.comment,
    tenderTitle: row.agreement.tenderTitle,
    reviewerDisplayName: row.reviewer.profile?.displayName ?? "",
    createdAt: row.createdAt,
  }));
}
