import type { SelectHTMLAttributes } from "react";
import type { GeorgianPlaceOption } from "../application/list-georgian-places";

export function GeorgianPlaceSelect({
  places,
  placeholder,
  valueKey = "id",
  fallbackLabel,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  places: readonly GeorgianPlaceOption[];
  placeholder: string;
  valueKey?: "id" | "nameEn";
  fallbackLabel?: string | undefined;
}) {
  const hasSelection = places.some(
    (place) => String(place[valueKey]) === String(props.value),
  );
  // Discovery matches city names. Combine names shared by multiple regions
  // so its options describe the actual search, while authoring keeps each ID.
  const options = new Map<string, { label: string; regions: Set<string> }>();
  for (const place of places) {
    const value = String(place[valueKey]);
    const option = options.get(value);
    if (option) option.regions.add(place.regionLabel);
    else
      options.set(value, {
        label: place.label,
        regions: new Set([place.regionLabel]),
      });
  }

  return (
    <select {...props}>
      <option value="">{placeholder}</option>
      {!hasSelection && fallbackLabel ? (
        <option value={props.value}>{fallbackLabel}</option>
      ) : null}
      {[...options].map(([value, option]) => (
        <option value={value} key={value}>
          {option.label} · {[...option.regions].join(" / ")}
        </option>
      ))}
    </select>
  );
}
