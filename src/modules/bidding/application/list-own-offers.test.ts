import { expect, it, vi } from "vitest";
const findMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("../../../infrastructure/db/client", () => ({
  database: { bid: { findMany } },
}));
import { listOwnOffers } from "./list-own-offers";

it("scopes every offer lookup to the authenticated provider", async () => {
  await listOwnOffers("provider-a");
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { providerId: "provider-a" } }),
  );
});
