import { database } from "../../../infrastructure/db/client";

// The route supplies the authenticated provider ID; never accept it from a query string.
export async function listOwnOffers(providerId: string) {
  return database.bid.findMany({
    where: { providerId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      tenderId: true,
      amountMinorUnits: true,
      currency: true,
      status: true,
      updatedAt: true,
      tender: { select: { title: true, status: true, deadline: true } },
    },
  });
}
