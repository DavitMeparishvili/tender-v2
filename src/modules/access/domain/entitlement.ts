export type EntitlementKind =
  | "SINGLE_TENDER"
  | "MONTHLY_PROVIDER"
  | "ANNUAL_PROVIDER"
  // Reserved for audited support inspection (program design §4.7). No route
  // grants it in this phase; the policy honours it so Phase 6's admin surface
  // does not need a second disclosure rule.
  | "ADMIN_OVERRIDE";

export type Entitlement = Readonly<{
  id: string;
  providerId: string;
  kind: EntitlementKind;
  // Non-null only for SINGLE_TENDER (and an ADMIN_OVERRIDE scoped to one
  // tender). A subscription entitles every tender, so it stores no tender.
  tenderId: string | null;
  grantedAt: Date;
  // Null means "does not expire", which is only ever true for single-tender
  // access: the provider paid for that one tender permanently.
  expiresAt: Date | null;
}>;
