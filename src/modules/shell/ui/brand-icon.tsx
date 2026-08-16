/*
  The design system ships its icons as monochrome black PNGs. They are used
  as-is on light surfaces and inverted on ink, never recoloured — so this is a
  plain <img> with a fixed size rather than a themed SVG component.
*/
export type BrandIconName =
  | "buildings"
  | "check"
  | "checklist"
  | "clock"
  | "handshake"
  | "invoice"
  | "magnify"
  | "mail"
  | "people"
  | "profile"
  | "secure"
  | "settings"
  | "shield"
  | "target"
  | "trophy";

export function BrandIcon({
  name,
  size = 16,
  opacity,
  onInk = false,
  className,
}: Readonly<{
  name: BrandIconName;
  size?: number;
  opacity?: number;
  onInk?: boolean;
  className?: string;
}>) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      aria-hidden="true"
      className={[onInk ? "icon-on-ink" : undefined, className]
        .filter(Boolean)
        .join(" ")}
      height={size}
      src={`/icons/${name}.png`}
      style={opacity === undefined ? undefined : { opacity }}
      width={size}
    />
  );
}
