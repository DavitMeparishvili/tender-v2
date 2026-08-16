import { describe, expect, it } from "vitest";
import { disclosureFor } from "./disclosure-policy";
import type { Entitlement } from "./entitlement";

const now = new Date("2026-06-01T12:00:00.000Z");
const request = { providerId: "provider-1", tenderId: "tender-1" };

function entitlement(overrides: Partial<Entitlement>): Entitlement {
  return {
    id: "entitlement-1",
    providerId: "provider-1",
    kind: "MONTHLY_PROVIDER",
    tenderId: null,
    grantedAt: new Date("2026-05-20T00:00:00.000Z"),
    expiresAt: new Date("2026-06-19T00:00:00.000Z"),
    ...overrides,
  };
}

describe("disclosureFor", () => {
  it("masks a provider with no entitlement at all", () => {
    expect(disclosureFor([], request, now)).toBe("MASKED");
  });

  it("masks an entitlement belonging to a different provider", () => {
    expect(
      disclosureFor([entitlement({ providerId: "provider-2" })], request, now),
    ).toBe("MASKED");
  });

  it("masks an expired subscription", () => {
    expect(
      disclosureFor(
        [entitlement({ expiresAt: new Date("2026-05-31T23:59:59.000Z") })],
        request,
        now,
      ),
    ).toBe("MASKED");
  });

  it("masks a subscription that has not started yet", () => {
    expect(
      disclosureFor(
        [entitlement({ grantedAt: new Date("2026-06-02T00:00:00.000Z") })],
        request,
        now,
      ),
    ).toBe("MASKED");
  });

  it("discloses fully for an active subscription", () => {
    expect(disclosureFor([entitlement({})], request, now)).toBe("FULL");
  });

  it("discloses fully for single-tender access to this tender only", () => {
    const single = entitlement({
      kind: "SINGLE_TENDER",
      tenderId: "tender-1",
      expiresAt: null,
    });
    expect(disclosureFor([single], request, now)).toBe("FULL");
    expect(
      disclosureFor([single], { ...request, tenderId: "tender-2" }, now),
    ).toBe("MASKED");
  });

  it("discloses fully for an audited administrator override", () => {
    expect(
      disclosureFor(
        [entitlement({ kind: "ADMIN_OVERRIDE", expiresAt: null })],
        request,
        now,
      ),
    ).toBe("FULL");
  });

  it("treats the expiry instant itself as expired", () => {
    expect(disclosureFor([entitlement({ expiresAt: now })], request, now)).toBe(
      "MASKED",
    );
  });
});
