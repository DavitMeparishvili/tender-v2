import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owned: vi.fn(),
  list: vi.fn(),
  names: vi.fn(),
}));
vi.mock("../../tenders/application/get-owned-tender", () => ({
  getOwnedTender: mocks.owned,
}));
vi.mock("../infrastructure/prisma-bid-repository", () => ({
  prismaBidRepository: { listBids: mocks.list },
}));
vi.mock("../../profiles/application/get-provider-display-names", () => ({
  getProviderDisplayNames: mocks.names,
}));
vi.mock("../../vip/application/vip-membership", () => ({
  vipUserIds: async () => new Set<string>(),
}));
import { listTenderBids } from "./list-tender-bids";

beforeEach(() => vi.clearAllMocks());
it("keeps withdrawn offer history readable on a cancelled owned tender", async () => {
  mocks.owned.mockResolvedValue({
    ok: true,
    value: {
      ownerId: "client",
      status: "CANCELLED",
      currency: "GEL",
      deadline: new Date("2026-10-01"),
    },
  });
  mocks.list.mockResolvedValue([
    {
      id: "bid",
      providerId: "provider",
      status: "WITHDRAWN",
      currency: "GEL",
      amountMinorUnits: 123456789,
      qualifyingSubmittedAt: new Date("2026-09-29"),
      proposedStartDate: null,
      conditions: "Saved terms",
    },
  ]);
  mocks.names.mockResolvedValue(new Map([["provider", "Contractor"]]));
  const result = await listTenderBids("tender", { id: "client" });
  expect(result).toMatchObject({
    ok: true,
    value: [
      {
        id: "bid",
        status: "WITHDRAWN",
        amountMinorUnits: 123456789,
        conditions: "Saved terms",
      },
    ],
  });
  expect(mocks.owned).toHaveBeenCalledWith("tender", { id: "client" });
});
it("does not load offer history for another client", async () => {
  mocks.owned.mockResolvedValue({ ok: false, error: "NOT_OWNER" });
  expect(await listTenderBids("tender", { id: "other" })).toEqual({
    ok: false,
    error: "NOT_OWNER",
  });
  expect(mocks.list).not.toHaveBeenCalled();
});
it("flags choosable offers and the lowest price without choosing one", async () => {
  mocks.owned.mockResolvedValue({
    ok: true,
    value: {
      ownerId: "client",
      status: "AWAITING_SELECTION",
      currency: "GEL",
      deadline: new Date("2026-10-01"),
    },
  });
  const offer = (id: string, amountMinorUnits: number, status: string) => ({
    id,
    providerId: `provider-${id}`,
    status,
    currency: "GEL",
    amountMinorUnits,
    qualifyingSubmittedAt: new Date("2026-09-29"),
    proposedStartDate: null,
    conditions: "Saved terms",
  });
  mocks.list.mockResolvedValue([
    offer("withdrawn", 10_000, "WITHDRAWN"),
    offer("dear", 90_000, "SUBMITTED"),
    offer("cheap", 50_000, "SUBMITTED"),
  ]);
  mocks.names.mockResolvedValue(new Map());

  const result = await listTenderBids("tender", { id: "client" });

  expect(result).toMatchObject({
    ok: true,
    value: [
      { id: "cheap", choosable: true, lowestPrice: true },
      { id: "dear", choosable: true, lowestPrice: false },
      { id: "withdrawn", choosable: false, lowestPrice: false },
    ],
  });
});
