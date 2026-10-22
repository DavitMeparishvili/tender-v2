// Bound to `profiles`'s published `getProviderDisplayNames` query. Bidding
// must not read the profiles tables itself, and it deliberately asks for
// display names only — never phone, email, or address.
export type ProviderDirectory = (
  providerIds: readonly string[],
) => Promise<ReadonlyMap<string, string>>;

// Bound to `vip`'s published `vipUserIds` query, for the same reason: bidding
// learns which providers hold an active VIP membership and nothing else about
// the membership.
export type ProviderVipDirectory = (
  providerIds: readonly string[],
) => Promise<ReadonlySet<string>>;
