import { describe, expect, it } from "vitest";
import { VIP_CONTACT_FALLBACK_EMAIL, vipContactEmail } from "./contact";

describe("vipContactEmail", () => {
  it("falls back to the VIP address when none is configured", () => {
    expect(vipContactEmail(undefined)).toBe("vip@tender-market.online");
    expect(VIP_CONTACT_FALLBACK_EMAIL).toBe("vip@tender-market.online");
  });

  it("uses the configured address when one is set", () => {
    expect(vipContactEmail("partners@example.test")).toBe(
      "partners@example.test",
    );
  });
});
