import { describe, expect, it } from "vitest";
import { dailyRotation, loungeOrder, tbilisiDateKey } from "./lounge-rotation";

const partners = [
  "kartli-build",
  "mtkvari-steel",
  "colchis-logistics",
  "geolift",
  "iveria-roofing",
  "saguramo-stone",
  "rioni-concrete",
  "aragvi-electric",
].map((userId) => ({ userId }));

function orderOf(items: readonly { userId: string }[]): string[] {
  return items.map((item) => item.userId);
}

describe("tbilisiDateKey", () => {
  it("uses the Asia/Tbilisi calendar date, which is UTC+4 with no daylight saving", () => {
    // 19:59 UTC is 23:59 in Tbilisi on the same calendar day.
    expect(tbilisiDateKey(new Date("2026-10-21T19:59:00Z"))).toBe("2026-10-21");
    // 20:00 UTC is already 00:00 on the next day in Tbilisi.
    expect(tbilisiDateKey(new Date("2026-10-21T20:00:00Z"))).toBe("2026-10-22");
  });
});

describe("dailyRotation", () => {
  it("keeps the same order for the whole day", () => {
    const morning = dailyRotation(partners, "2026-10-22");
    const evening = dailyRotation(partners, "2026-10-22");
    expect(orderOf(evening)).toEqual(orderOf(morning));
  });

  it("does not depend on the order the caller passed the items in", () => {
    const forward = dailyRotation(partners, "2026-10-22");
    const reversed = dailyRotation([...partners].reverse(), "2026-10-22");
    expect(orderOf(reversed)).toEqual(orderOf(forward));
  });

  it("returns a permutation of its input and does not mutate it", () => {
    const input = [...partners];
    const rotated = dailyRotation(input, "2026-10-22");
    expect(orderOf(input)).toEqual(orderOf(partners));
    expect([...orderOf(rotated)].sort()).toEqual([...orderOf(partners)].sort());
  });

  it("changes the order from one day to the next", () => {
    const days = ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
    const orders = days.map((day) => orderOf(dailyRotation(partners, day)));
    const distinct = new Set(orders.map((order) => order.join(",")));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("is deterministic for a given date", () => {
    expect(orderOf(dailyRotation(partners, "2026-10-22"))).toEqual(
      orderOf(dailyRotation(partners, "2026-10-22")),
    );
    // Regression pin: the order for a fixed date must not drift when the
    // shuffle changes. Changing it reorders the Lounge for every visitor.
    expect(orderOf(dailyRotation(partners, "2026-10-22"))).toEqual([
      "geolift",
      "rioni-concrete",
      "kartli-build",
      "aragvi-electric",
      "colchis-logistics",
      "iveria-roofing",
      "saguramo-stone",
      "mtkvari-steel",
    ]);
  });

  it("handles an empty list", () => {
    expect(dailyRotation([], "2026-10-22")).toEqual([]);
  });
});

describe("loungeOrder", () => {
  const ranked = (ranks: Readonly<Record<string, number>>) =>
    partners.map((partner) => ({
      ...partner,
      pinnedRank: ranks[partner.userId] ?? null,
    }));

  it("puts pinned partners first, by rank, then the daily rotation", () => {
    const items = ranked({
      "saguramo-stone": 1,
      "aragvi-electric": 2,
      geolift: 3,
    });
    const rest = dailyRotation(
      items.filter((item) => item.pinnedRank === null),
      "2026-10-22",
    );
    expect(orderOf(loungeOrder(items, "2026-10-22"))).toEqual([
      "saguramo-stone",
      "aragvi-electric",
      "geolift",
      ...orderOf(rest),
    ]);
  });

  it("keeps the pinned order on every day", () => {
    const items = ranked({ "iveria-roofing": 1, "kartli-build": 2 });
    for (const day of ["2026-10-22", "2026-10-23", "2026-10-24"]) {
      expect(orderOf(loungeOrder(items, day)).slice(0, 2)).toEqual([
        "iveria-roofing",
        "kartli-build",
      ]);
    }
  });

  it("breaks equal ranks by userId", () => {
    const items = ranked({ "rioni-concrete": 1, geolift: 1 });
    expect(orderOf(loungeOrder(items, "2026-10-22")).slice(0, 2)).toEqual([
      "geolift",
      "rioni-concrete",
    ]);
  });

  it("is the daily rotation when nobody is pinned", () => {
    expect(orderOf(loungeOrder(ranked({}), "2026-10-22"))).toEqual(
      orderOf(dailyRotation(partners, "2026-10-22")),
    );
  });
});
