export const MAX_ATTACHMENTS_PER_TENDER = 10;
// `Tender.budgetMinorUnits` is a Postgres INTEGER (INT4) column, so an amount
// above this ceiling overflows on write and would surface as an uncaught
// driver error rather than a validation failure. Every layer that accepts a
// budget — the authoring wizard, the discovery filters, and the server-side
// draft and search schemas — bounds against this single constant so the
// ceiling cannot drift between them.
export const MAX_BUDGET_MINOR_UNITS = 2_147_483_647;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AllowedAttachmentMimeType =
  (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];
