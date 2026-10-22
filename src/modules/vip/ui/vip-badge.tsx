/**
 * The VIP mark: a gold diamond and the word "VIP". The diamond is decoration.
 * The accessible name is the caller's label (`vip.badgeLabel`), so the badge
 * reads the same to a screen reader wherever it appears. The badge is never
 * the only signal of an offer's or tender's terms; it only marks placement.
 */
export function VipBadge({
  label,
  className,
}: Readonly<{
  label: string;
  className?: string;
}>) {
  return (
    <span
      aria-label={label}
      className={className ? `vip-badge ${className}` : "vip-badge"}
      role="img"
    >
      <span aria-hidden="true" className="vip-badge-diamond" />
      <span aria-hidden="true">VIP</span>
    </span>
  );
}
