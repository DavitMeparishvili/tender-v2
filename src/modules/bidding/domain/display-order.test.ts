import { describe, expect, it } from "vitest";
import { orderVipFirst } from "./display-order";

type Row = Readonly<{ id: string; vip: boolean; amount: number }>;

const isVip = (row: Row) => row.vip;

describe("orderVipFirst", () => {
  it("lists VIP rows first and keeps the price order inside each group", () => {
    // Already in price-rank order, as listTenderBids supplies it.
    const ranked: Row[] = [
      { id: "std-cheapest", vip: false, amount: 10 },
      { id: "vip-mid", vip: true, amount: 20 },
      { id: "std-mid", vip: false, amount: 30 },
      { id: "vip-high", vip: true, amount: 40 },
      { id: "std-high", vip: false, amount: 50 },
    ];

    expect(orderVipFirst(ranked, isVip).map((row) => row.id)).toEqual([
      "vip-mid",
      "vip-high",
      "std-cheapest",
      "std-mid",
      "std-high",
    ]);
  });

  it("is stable: equal-status rows never swap relative to each other", () => {
    const ranked: Row[] = [
      { id: "a", vip: true, amount: 1 },
      { id: "b", vip: false, amount: 1 },
      { id: "c", vip: true, amount: 1 },
      { id: "d", vip: false, amount: 1 },
      { id: "e", vip: true, amount: 1 },
    ];

    expect(orderVipFirst(ranked, isVip).map((row) => row.id)).toEqual([
      "a",
      "c",
      "e",
      "b",
      "d",
    ]);
  });

  it("does not mutate its input", () => {
    const ranked: Row[] = [
      { id: "std", vip: false, amount: 10 },
      { id: "vip", vip: true, amount: 20 },
    ];
    const snapshot = [...ranked];

    orderVipFirst(ranked, isVip);

    expect(ranked).toEqual(snapshot);
  });

  it("returns the input order unchanged when no row is VIP", () => {
    const ranked: Row[] = [
      { id: "first", vip: false, amount: 10 },
      { id: "second", vip: false, amount: 20 },
    ];

    expect(orderVipFirst(ranked, isVip).map((row) => row.id)).toEqual([
      "first",
      "second",
    ]);
  });

  it("returns an empty list for no rows", () => {
    expect(orderVipFirst([], isVip)).toEqual([]);
  });
});
