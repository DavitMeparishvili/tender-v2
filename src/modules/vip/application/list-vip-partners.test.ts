import { describe, expect, it } from "vitest";
import type { ReviewScores } from "../../reviews/domain/review";
import { createCountVipPartnersBySpecialty } from "./count-vip-partners-by-specialty";
import { createListVipPartners } from "./list-vip-partners";
import type {
  VipPartnerCandidate,
  VipPartnerRepository,
} from "./vip-partner-repository";

const scores = (overall: number): ReviewScores => ({
  quality: overall,
  deadline: overall,
  communication: overall,
  agreedPrice: overall,
});

function candidate(
  userId: string,
  overrides: Partial<VipPartnerCandidate> = {},
): VipPartnerCandidate {
  return {
    userId,
    membershipActive: true,
    displayName: `Partner ${userId}`,
    city: "Tbilisi",
    isProvider: true,
    emailVerified: true,
    onboardingComplete: true,
    isDisabled: false,
    specialties: ["CONSTRUCTION_REPAIR"],
    serviceLabel: { en: "General contractor", ka: "გენერალური" },
    description: { en: "Builds on time." },
    logoPath: `/vip/logos/${userId}_icon.svg`,
    pinnedRank: null,
    ...overrides,
  };
}

function fakeRepository(
  rows: readonly VipPartnerCandidate[],
  reviews: Record<string, readonly ReviewScores[]> = {},
  completed: Record<string, number> = {},
): VipPartnerRepository {
  return {
    listMembershipCandidates: async () => rows,
    findActiveMemberIds: async (userIds) =>
      new Set(
        rows
          .filter((row) => row.membershipActive && userIds.includes(row.userId))
          .map((row) => row.userId),
      ),
    countCompletedAgreements: async (providerIds) =>
      new Map(
        providerIds
          .filter((id) => completed[id] !== undefined)
          .map((id) => [id, completed[id] ?? 0]),
      ),
    listPublishedReviewScores: async (reviewedIds) =>
      new Map(
        reviewedIds
          .filter((id) => reviews[id] !== undefined)
          .map((id) => [id, reviews[id] ?? []]),
      ),
  };
}

const now = new Date("2026-10-22T10:00:00Z");

describe("listVipPartners", () => {
  it("returns only eligible partners with rating, completed count and localized text", async () => {
    const repository = fakeRepository(
      [
        candidate("kartli-build"),
        candidate("client-one", { isProvider: false, specialties: [] }),
        candidate("unverified", { emailVerified: false }),
        candidate("disabled", { isDisabled: true }),
        candidate("no-label", { serviceLabel: null }),
        candidate("inactive", { membershipActive: false }),
      ],
      { "kartli-build": [scores(5), scores(4), scores(4)] },
      { "kartli-build": 3 },
    );
    const list = createListVipPartners({ repository });

    const partners = await list({ locale: "ka", now });

    expect(partners).toEqual([
      {
        userId: "kartli-build",
        name: "Partner kartli-build",
        city: "Tbilisi",
        specialty: "CONSTRUCTION_REPAIR",
        serviceLabel: "გენერალური",
        description: "Builds on time.",
        logoPath: "/vip/logos/kartli-build_icon.svg",
        verified: true,
        rating: 4.3,
        completed: 3,
      },
    ]);
  });

  it("reports null rating and zero completed for a partner with no history", async () => {
    const repository = fakeRepository([candidate("new-partner")]);
    const [partner] = await createListVipPartners({ repository })({
      locale: "en",
      now,
    });
    expect(partner?.rating).toBeNull();
    expect(partner?.completed).toBe(0);
  });

  it("filters by category after rotation", async () => {
    const repository = fakeRepository([
      candidate("a", { specialties: ["TRANSPORT"] }),
      candidate("b", { specialties: ["CONSTRUCTION_REPAIR"] }),
      candidate("c", { specialties: ["TRANSPORT", "EQUIPMENT"] }),
    ]);
    const partners = await createListVipPartners({ repository })({
      locale: "en",
      now,
      specialty: "TRANSPORT",
    });
    expect(partners.map((partner) => partner.userId).sort()).toEqual([
      "a",
      "c",
    ]);
  });

  it("lists pinned partners first, by rank, in every category", async () => {
    const repository = fakeRepository([
      candidate("a"),
      candidate("b", { pinnedRank: 2 }),
      candidate("c"),
      candidate("d", { pinnedRank: 1, specialties: ["TRANSPORT"] }),
      candidate("e", { specialties: ["TRANSPORT"] }),
    ]);
    const list = createListVipPartners({ repository });
    const all = await list({ locale: "en", now });
    expect(all.map((partner) => partner.userId).slice(0, 2)).toEqual([
      "d",
      "b",
    ]);
    const transport = await list({ locale: "en", now, specialty: "TRANSPORT" });
    expect(transport.map((partner) => partner.userId)).toEqual(["d", "e"]);
  });
});

describe("countVipPartnersBySpecialty", () => {
  it("counts the full eligible set and includes zero-count categories", async () => {
    const repository = fakeRepository([
      candidate("a", { specialties: ["TRANSPORT"] }),
      candidate("b", { specialties: ["TRANSPORT"] }),
      candidate("c", { specialties: ["DAILY_LABOR"] }),
      candidate("hidden", { isDisabled: true, specialties: ["TRANSPORT"] }),
    ]);
    const counts = await createCountVipPartnersBySpecialty({ repository })();
    expect(counts).toEqual({
      total: 3,
      bySpecialty: {
        CONSTRUCTION_REPAIR: 0,
        TRANSPORT: 2,
        EQUIPMENT: 0,
        DAILY_LABOR: 1,
        MATERIAL_SUPPLIER: 0,
      },
    });
  });
});
