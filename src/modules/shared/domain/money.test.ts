import { describe, expect, it } from "vitest";
import { Money } from "./money";

describe("Money", () => {
  it("stores integer minor units", () => {
    expect(Money.create(1250, "GEL")).toEqual({ minor: 1250, currency: "GEL" });
  });

  it("rejects fractional and negative minor units", () => {
    expect(() => Money.create(1.5, "USD")).toThrow(/integer/);
    expect(() => Money.create(-1, "USD")).toThrow(/non-negative/);
  });

  it("rejects unsupported currency", () => {
    expect(() => Money.create(100, "EUR" as "GEL")).toThrow(/currency/);
  });
});
