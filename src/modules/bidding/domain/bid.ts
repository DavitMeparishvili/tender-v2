export type BidStatus = "SUBMITTED" | "WINNER" | "LOST" | "WITHDRAWN";
export type BidCurrency = "GEL" | "USD";

export type Bid = Readonly<{
  id: string;
  tenderId: string;
  providerId: string;
  amountMinorUnits: number;
  currency: BidCurrency;
  status: BidStatus;
  proposedStartDate: Date | null;
  durationDays: number | null;
  includedCosts: string | null;
  exclusions: string | null;
  conditions: string;
  // Reset on every revision, so a provider cannot revise downward at the last
  // moment and still keep an earlier bid's tie-break advantage.
  qualifyingSubmittedAt: Date;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

// The minimum a bid must carry to be ranked. Selection reads only these
// fields, so ranking cannot accidentally depend on terms.
export type RankableBid = Readonly<{
  id: string;
  amountMinorUnits: number;
  currency: BidCurrency;
  status: BidStatus;
  qualifyingSubmittedAt: Date;
}>;

// The tender facts a bid is judged against. Declared here rather than
// imported from `tenders/domain`, which the module-boundary gate forbids.
export type BidTenderTerms = Readonly<{
  currency: BidCurrency;
  deadline: Date;
}>;
