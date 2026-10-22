import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { countVipPartnersBySpecialty } from "./count-vip-partners-by-specialty";
import { listVipPartners } from "./list-vip-partners";
import { isVipUser, vipUserIds } from "./vip-membership";

const PREFIX = "vip-it-";
const ids = {
  eligible: `${PREFIX}eligible`,
  unrated: `${PREFIX}unrated`,
  disabled: `${PREFIX}disabled`,
  client: `${PREFIX}client`,
  inactive: `${PREFIX}inactive`,
  unverified: `${PREFIX}unverified`,
  incomplete: `${PREFIX}incomplete`,
  reviewer: `${PREFIX}reviewer`,
} as const;
const allUserIds = Object.values(ids);
const now = new Date("2026-10-22T10:00:00Z");

async function cleanup(): Promise<void> {
  await database.review.deleteMany({
    where: { reviewerId: { in: allUserIds } },
  });
  await database.agreement.deleteMany({
    where: { id: { startsWith: PREFIX } },
  });
  await database.user.deleteMany({ where: { id: { in: allUserIds } } });
}

async function createUser(
  id: string,
  options: Readonly<{
    emailVerified?: boolean;
    onboarded?: boolean;
    disabled?: boolean;
    capability?: "PROVIDER" | "CUSTOMER";
    specialties?: ("TRANSPORT" | "EQUIPMENT")[];
    phone: string;
  }>,
): Promise<void> {
  await database.user.create({
    data: {
      id,
      name: id,
      email: `${id}@example.test`,
      emailVerified: options.emailVerified ?? true,
      profile: {
        create: {
          id: `${id}-profile`,
          accountKind: "COMPANY",
          displayName: `Display ${id}`,
          phoneE164: options.phone,
          city: "Kutaisi",
          activityDescription: "Integration fixture",
          onboardingCompleteAt:
            options.onboarded === false ? null : new Date("2026-01-01"),
          disabledAt: options.disabled ? new Date("2026-02-01") : null,
        },
      },
      capabilities: {
        create: {
          id: `${id}-capability`,
          code: options.capability ?? "PROVIDER",
        },
      },
      ...(options.specialties === undefined
        ? {}
        : {
            providerProfile: {
              create: {
                id: `${id}-provider`,
                specialties: options.specialties,
              },
            },
          }),
    },
  });
}

async function createMembership(userId: string, active = true): Promise<void> {
  await database.vipMembership.create({
    data: {
      id: `${userId}-membership`,
      userId,
      active,
      logoPath: `/vip/logos/${userId}_icon.svg`,
      serviceLabel: { en: "Transport & delivery", ka: "ტრანსპორტი" },
      description: { en: "Flatbed transport across western Georgia." },
    },
  });
}

async function createCompletedAgreement(
  index: number,
  providerId: string,
  status: "COMPLETED" | "IN_PROGRESS",
): Promise<string> {
  const id = `${PREFIX}agreement-${index}`;
  await database.agreement.create({
    data: {
      id,
      tenderId: `${PREFIX}tender-${index}`,
      clientId: ids.reviewer,
      providerId,
      bidId: `${PREFIX}bid-${index}`,
      status,
      amountMinorUnits: 100_000,
      currency: "GEL",
      tenderTitle: `Integration job ${index}`,
      snapshot: {},
      confirmDeadline: new Date("2026-01-03"),
    },
  });
  return id;
}

async function publishReview(
  agreementId: string,
  reviewedId: string,
  overall: number,
): Promise<void> {
  await database.review.create({
    data: {
      id: `${PREFIX}review-${agreementId}`,
      agreementId,
      reviewerId: ids.reviewer,
      reviewedId,
      quality: overall,
      deadline: overall,
      communication: overall,
      agreedPrice: overall,
      comment: "Delivered the flatbed transport on the agreed schedule.",
    },
  });
}

describe("VIP partners", () => {
  let baseline: Awaited<ReturnType<typeof countVipPartnersBySpecialty>>;

  beforeAll(async () => {
    await cleanup();
    baseline = await countVipPartnersBySpecialty();

    await createUser(ids.eligible, {
      specialties: ["TRANSPORT"],
      phone: "+995555900101",
    });
    await createMembership(ids.eligible);
    await createUser(ids.unrated, {
      specialties: ["EQUIPMENT"],
      phone: "+995555900102",
    });
    await createMembership(ids.unrated);
    await createUser(ids.disabled, {
      specialties: ["TRANSPORT"],
      disabled: true,
      phone: "+995555900103",
    });
    await createMembership(ids.disabled);
    await createUser(ids.client, {
      capability: "CUSTOMER",
      phone: "+995555900104",
    });
    await createMembership(ids.client);
    await createUser(ids.inactive, {
      specialties: ["TRANSPORT"],
      phone: "+995555900105",
    });
    await createMembership(ids.inactive, false);
    await createUser(ids.unverified, {
      specialties: ["TRANSPORT"],
      emailVerified: false,
      phone: "+995555900106",
    });
    await createMembership(ids.unverified);
    await createUser(ids.incomplete, {
      specialties: ["TRANSPORT"],
      onboarded: false,
      phone: "+995555900108",
    });
    await createMembership(ids.incomplete);
    await createUser(ids.reviewer, {
      capability: "CUSTOMER",
      phone: "+995555900107",
    });

    const completedA = await createCompletedAgreement(
      1,
      ids.eligible,
      "COMPLETED",
    );
    const completedB = await createCompletedAgreement(
      2,
      ids.eligible,
      "COMPLETED",
    );
    await createCompletedAgreement(3, ids.eligible, "IN_PROGRESS");
    await publishReview(completedA, ids.eligible, 5);
    await publishReview(completedB, ids.eligible, 4);
  });

  afterAll(async () => {
    await cleanup();
    await database.$disconnect();
  });

  it("lists only eligible partners, with real rating and completed counts", async () => {
    const partners = await listVipPartners({ locale: "ka", now });
    const ours = partners.filter((partner) =>
      partner.userId.startsWith(PREFIX),
    );

    expect(ours).toHaveLength(2);
    const eligible = ours.find((partner) => partner.userId === ids.eligible);
    expect(eligible).toMatchObject({
      name: "Display vip-it-eligible",
      city: "Kutaisi",
      specialty: "TRANSPORT",
      serviceLabel: "ტრანსპორტი",
      description: "Flatbed transport across western Georgia.",
      verified: true,
      rating: 4.5,
      completed: 2,
    });
    const unrated = ours.find((partner) => partner.userId === ids.unrated);
    expect(unrated).toMatchObject({
      specialty: "EQUIPMENT",
      rating: null,
      completed: 0,
    });
  });

  it("filters by category", async () => {
    const transport = await listVipPartners({
      locale: "en",
      now,
      specialty: "TRANSPORT",
    });
    expect(transport.some((partner) => partner.userId === ids.eligible)).toBe(
      true,
    );
    expect(transport.some((partner) => partner.userId === ids.unrated)).toBe(
      false,
    );
  });

  it("counts the full eligible set per category", async () => {
    const counts = await countVipPartnersBySpecialty();
    expect(counts.total - baseline.total).toBe(2);
    expect(counts.bySpecialty.TRANSPORT - baseline.bySpecialty.TRANSPORT).toBe(
      1,
    );
    expect(counts.bySpecialty.EQUIPMENT - baseline.bySpecialty.EQUIPMENT).toBe(
      1,
    );
  });

  it("treats any active membership as VIP, including clients and ineligible providers", async () => {
    expect(await isVipUser(ids.client)).toBe(true);
    expect(await isVipUser(ids.disabled)).toBe(true);
    expect(await isVipUser(ids.inactive)).toBe(false);
    expect(await isVipUser(ids.reviewer)).toBe(false);

    const vip = await vipUserIds([ids.client, ids.inactive, ids.eligible]);
    expect([...vip].sort()).toEqual([ids.client, ids.eligible].sort());
  });
});
