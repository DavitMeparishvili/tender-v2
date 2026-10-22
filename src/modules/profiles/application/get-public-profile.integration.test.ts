import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { getPublicProfile } from "./get-public-profile";

afterAll(async () => {
  await database.$disconnect();
});

async function seedProvider(
  specialties: ("CONSTRUCTION_REPAIR" | "MATERIAL_SUPPLIER")[],
): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: id,
      email: `${id}@tender.test`,
      emailVerified: true,
      capabilities: { create: [{ id: randomUUID(), code: "PROVIDER" }] },
      providerProfile: {
        create: { id: randomUUID(), specialties },
      },
      profile: {
        create: {
          id: randomUUID(),
          accountKind: "COMPANY",
          displayName: `Provider ${id.slice(0, 8)}`,
          phoneE164: `+9955${Math.floor(Math.random() * 1e8)
            .toString()
            .padStart(8, "0")}`,
          city: "Tbilisi",
          activityDescription: "Supplier",
          onboardingCompleteAt: new Date(),
        },
      },
    },
  });
  return id;
}

describe("getPublicProfile specialties", () => {
  it("returns a non-construction specialty so the account renders as a provider", async () => {
    const userId = await seedProvider(["MATERIAL_SUPPLIER"]);

    const result = await getPublicProfile(userId);

    expect(result).toMatchObject({
      ok: true,
      value: { providerSpecialties: ["MATERIAL_SUPPLIER"] },
    });
  });

  it("keeps every stored specialty, in stored order", async () => {
    const userId = await seedProvider([
      "MATERIAL_SUPPLIER",
      "CONSTRUCTION_REPAIR",
    ]);

    const result = await getPublicProfile(userId);

    expect(result).toMatchObject({
      ok: true,
      value: {
        providerSpecialties: ["MATERIAL_SUPPLIER", "CONSTRUCTION_REPAIR"],
      },
    });
  });
});
