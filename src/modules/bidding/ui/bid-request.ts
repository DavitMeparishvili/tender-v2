export type BidFormValues = Readonly<{
  amountMinorUnits: number;
  proposedStartDate?: string;
  durationDays?: number;
  includedCosts?: string;
  exclusions?: string;
  conditions: string;
}>;

export function submitBidRequest(values: BidFormValues): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values),
  };
}

export function reviseBidRequest(values: BidFormValues): RequestInit {
  return {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values),
  };
}

export const withdrawBidRequest: RequestInit = { method: "DELETE" };
