// Bound at the composition root to `bidding`'s published
// `tenderHasActiveBids` query. Program design §4.2: a client may cancel an
// open tender only while it has no submitted bids.
export type BidPresence = (tenderId: string) => Promise<boolean>;
