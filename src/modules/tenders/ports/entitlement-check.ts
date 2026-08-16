// Bound at the composition root to `access`'s published
// `hasTenderEntitlement` query. Declaring it as a port keeps `tenders` free
// of a compile-time dependency on the `access` module.
export type EntitlementCheck = (
  providerId: string,
  tenderId: string,
  now: Date,
) => Promise<boolean>;
