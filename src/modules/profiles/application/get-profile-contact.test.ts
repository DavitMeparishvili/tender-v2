import { describe, expect, it } from "vitest";
import type { Entitlement } from "../../access/domain/entitlement";
import { FakeClock } from "../../shared";
import {
  createGetProfileContact,
  type ProfileContactRepository,
} from "./get-profile-contact";

const now = new Date("2026-10-21T12:00:00.000Z");
const contact = { email: "client@example.test", phoneE164: "+995555123456" };

function entitlement(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    id: "entitlement-1",
    providerId: "viewer",
    kind: "SINGLE_TENDER",
    tenderId: "tender-1",
    grantedAt: new Date("2026-10-01T00:00:00.000Z"),
    expiresAt: null,
    ...overrides,
  };
}

function subject(facts: Partial<ProfileContactRepository> = {}) {
  const repository: ProfileContactRepository = {
    findContact: async () => contact,
    shareAgreement: async () => false,
    hasOfferTo: async () => false,
    listVisibleTenderIds: async () => ["tender-1"],
    listEntitlements: async () => [],
    ...facts,
  };
  return createGetProfileContact({ repository, clock: new FakeClock(now) });
}

describe("getProfileContact", () => {
  it("hides contacts from anonymous visitors", async () => {
    expect(await subject()("profile", null)).toBeNull();
  });

  it("hides contacts from an unconnected signed-in user", async () => {
    expect(await subject()("profile", { id: "viewer" })).toBeNull();
  });

  it("shows owners their own contacts", async () => {
    expect(await subject()("viewer", { id: "viewer" })).toEqual(contact);
  });

  it("shows contacts to the other party of an agreement", async () => {
    const get = subject({
      shareAgreement: async (first, second) =>
        first === "viewer" && second === "profile",
    });
    expect(await get("profile", { id: "viewer" })).toEqual(contact);
  });

  it("shows a client the contacts of a contractor who sent them an offer", async () => {
    const get = subject({
      hasOfferTo: async (providerId, clientId) =>
        providerId === "profile" && clientId === "viewer",
    });
    expect(await get("profile", { id: "viewer" })).toEqual(contact);
  });

  it("shows a contractor the client of a tender they paid to access", async () => {
    const get = subject({ listEntitlements: async () => [entitlement()] });
    expect(await get("profile", { id: "viewer" })).toEqual(contact);
  });

  it("shows a subscribed contractor any client with a visible tender", async () => {
    const get = subject({
      listEntitlements: async () => [
        entitlement({
          kind: "MONTHLY_PROVIDER",
          tenderId: null,
          expiresAt: new Date("2026-11-01T00:00:00.000Z"),
        }),
      ],
    });
    expect(await get("profile", { id: "viewer" })).toEqual(contact);
  });

  it("ignores paid access to another client's tender", async () => {
    const get = subject({
      listEntitlements: async () => [entitlement({ tenderId: "tender-9" })],
    });
    expect(await get("profile", { id: "viewer" })).toBeNull();
  });

  it("ignores an expired subscription", async () => {
    const get = subject({
      listEntitlements: async () => [
        entitlement({
          kind: "MONTHLY_PROVIDER",
          tenderId: null,
          expiresAt: new Date("2026-10-20T00:00:00.000Z"),
        }),
      ],
    });
    expect(await get("profile", { id: "viewer" })).toBeNull();
  });

  it("ignores a subscription when the client has no visible tender", async () => {
    const get = subject({
      listVisibleTenderIds: async () => [],
      listEntitlements: async () => [
        entitlement({ kind: "MONTHLY_PROVIDER", tenderId: null }),
      ],
    });
    expect(await get("profile", { id: "viewer" })).toBeNull();
  });
});
