/** Used when VIP_CONTACT_EMAIL is not configured. */
export const VIP_CONTACT_FALLBACK_EMAIL = "vip@tender-market.online";

/** The address behind both "Become a VIP partner" links. */
export function vipContactEmail(configured: string | undefined): string {
  return configured ?? VIP_CONTACT_FALLBACK_EMAIL;
}
