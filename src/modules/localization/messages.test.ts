import { describe, expect, it } from "vitest";
import en from "./messages/en.json";
import ka from "./messages/ka.json";

function leaves(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") {
    return [[prefix, value]];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => leaves(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

describe("identity message catalogs", () => {
  it("has matching required groups and non-empty leaves", () => {
    expect(Object.keys(en).sort()).toEqual([
      "access",
      "agreements",
      "auth",
      "bidding",
      "common",
      "entitlements",
      "errors",
      "moderation",
      "notifications",
      "onboarding",
      "profile",
      "reviews",
      "tenders",
      "workspace",
    ]);
    expect(Object.keys(ka).sort()).toEqual(Object.keys(en).sort());
    expect(
      leaves(ka)
        .map(([key]) => key)
        .sort(),
    ).toEqual(
      leaves(en)
        .map(([key]) => key)
        .sort(),
    );
    expect(
      [...leaves(ka), ...leaves(en)].every(
        ([, value]) => value.trim().length > 0,
      ),
    ).toBe(true);
  });
});
