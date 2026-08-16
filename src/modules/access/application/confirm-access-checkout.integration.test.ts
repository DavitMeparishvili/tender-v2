import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { confirmAccessCheckout } from "./confirm-access-checkout";
import { hasTenderEntitlement } from "./has-tender-entitlement";
import { startAccessCheckout } from "./start-access-checkout";

async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: "Provider",
      email: `${id}@tender.test`,
      emailVerified: true,
    },
  });
  return id;
}

async function seedPublishedTender(ownerId: string): Promise<string> {
  const id = randomUUID();
  await database.tender.create({
    data: {
      id,
      ownerId,
      status: "PUBLISHED",
      specialty: "CONSTRUCTION_REPAIR",
      serviceCode: "GENERAL_CONSTRUCTION",
      title: "Repaint two rooms",
      shortDescription: "Interior repaint",
      fullDescription: "Sand, prime, and repaint two bedrooms.",
      scopeOfWork: "Sanding, priming, painting",
      budgetMinorUnits: 80_000,
      currency: "GEL",
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      countryCode: "GE",
      locationMode: "ADDRESS",
      city: "Tbilisi",
      addressLine: "1 Chavchavadze Ave",
      exactLatitude: 41.7151,
      exactLongitude: 44.8271,
      publicLatitude: 41.72,
      publicLongitude: 44.83,
      publishedAt: new Date(),
    },
  });
  return id;
}

afterAll(async () => {
  await database.$disconnect();
});

describe("access checkout", () => {
  it("grants single-tender access and refuses to sell it twice", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId);

    const checkout = await startAccessCheckout(
      { product: "SINGLE_TENDER", tenderId },
      { id: providerId },
    );
    expect(checkout).toMatchObject({
      ok: true,
      value: { amountMinorUnits: 100, currency: "USD" },
    });
    if (!checkout.ok) throw new Error("checkout failed");

    const confirmed = await confirmAccessCheckout(checkout.value.checkoutId, {
      id: providerId,
    });
    expect(confirmed).toMatchObject({
      ok: true,
      value: { kind: "SINGLE_TENDER", tenderId, expiresAt: null },
    });

    await expect(
      hasTenderEntitlement(providerId, tenderId, new Date()),
    ).resolves.toBe(true);

    const second = await startAccessCheckout(
      { product: "SINGLE_TENDER", tenderId },
      { id: providerId },
    );
    expect(second).toEqual({ ok: false, error: "ALREADY_ENTITLED" });
  });

  it("applies a replayed payment event exactly once", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId);

    const checkout = await startAccessCheckout(
      { product: "SINGLE_TENDER", tenderId },
      { id: providerId },
    );
    if (!checkout.ok) throw new Error("checkout failed");

    const first = await confirmAccessCheckout(checkout.value.checkoutId, {
      id: providerId,
    });
    const replay = await confirmAccessCheckout(checkout.value.checkoutId, {
      id: providerId,
    });
    expect(first.ok && replay.ok).toBe(true);
    if (!first.ok || !replay.ok) throw new Error("confirm failed");
    expect(replay.value.id).toBe(first.value.id);

    const granted = await database.accessEntitlement.count({
      where: { providerId },
    });
    expect(granted).toBe(1);
  });

  it("refuses to confirm another provider's checkout", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const intruderId = await seedUser();
    const tenderId = await seedPublishedTender(clientId);

    const checkout = await startAccessCheckout(
      { product: "SINGLE_TENDER", tenderId },
      { id: providerId },
    );
    if (!checkout.ok) throw new Error("checkout failed");

    await expect(
      confirmAccessCheckout(checkout.value.checkoutId, { id: intruderId }),
    ).resolves.toEqual({ ok: false, error: "NOT_CHECKOUT_OWNER" });
  });

  it("entitles every tender through a monthly subscription", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const firstTender = await seedPublishedTender(clientId);
    const secondTender = await seedPublishedTender(clientId);

    const checkout = await startAccessCheckout(
      { product: "MONTHLY_PROVIDER" },
      { id: providerId },
    );
    if (!checkout.ok) throw new Error("checkout failed");
    expect(checkout.value.amountMinorUnits).toBe(2_000);
    await confirmAccessCheckout(checkout.value.checkoutId, { id: providerId });

    const now = new Date();
    await expect(
      hasTenderEntitlement(providerId, firstTender, now),
    ).resolves.toBe(true);
    await expect(
      hasTenderEntitlement(providerId, secondTender, now),
    ).resolves.toBe(true);
    // ...and it lapses at the 30-day boundary rather than lasting forever.
    const afterExpiry = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
    await expect(
      hasTenderEntitlement(providerId, firstTender, afterExpiry),
    ).resolves.toBe(false);
  });

  it("rejects a subscription checkout that names a tender", async () => {
    const clientId = await seedUser();
    const providerId = await seedUser();
    const tenderId = await seedPublishedTender(clientId);

    await expect(
      startAccessCheckout(
        { product: "MONTHLY_PROVIDER", tenderId },
        { id: providerId },
      ),
    ).resolves.toEqual({ ok: false, error: "TENDER_NOT_ALLOWED" });
  });
});
