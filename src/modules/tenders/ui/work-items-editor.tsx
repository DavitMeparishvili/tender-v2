"use client";
import type { WorkItem } from "../domain/work-item";
import type { Locale } from "../../localization/config";
import { tenderPageCopy } from "./tender-page-copy";
import { TenderIcon } from "./tender-icon";
export function WorkItemsEditor({
  items,
  onChange,
  locale,
}: {
  items: readonly WorkItem[];
  onChange: (items: readonly WorkItem[]) => void;
  locale: Locale;
}) {
  const c = tenderPageCopy(locale);
  const change = (
    index: number,
    field: keyof WorkItem,
    value: string | number,
  ) =>
    onChange(
      items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  return (
    <fieldset className="tender-work-editor">
      <legend>{c.quantities}</legend>
      <div className="tender-edit-items">
        {items.map((item, index) => (
          <div key={index} className="tender-edit-item">
            <label>
              {c.item}
              <input
                required
                maxLength={160}
                value={item.name}
                onChange={(event) => change(index, "name", event.target.value)}
              />
            </label>
            <label>
              {c.quantity}
              <input
                type="number"
                required
                min="0.0001"
                max="1000000000"
                step="any"
                value={item.quantity || ""}
                onChange={(event) =>
                  change(index, "quantity", Number(event.target.value))
                }
              />
            </label>
            <label>
              {c.unit}
              <select
                required
                value={item.unit}
                onChange={(event) => change(index, "unit", event.target.value)}
              >
                {[
                  ...new Set([
                    "m²",
                    "m",
                    "m³",
                    "kg",
                    "pcs",
                    "hours",
                    "days",
                    item.unit,
                  ]),
                ]
                  .filter(Boolean)
                  .map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="tender-button icon-only"
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label={`${c.remove} ${index + 1}`}
            >
              <TenderIcon name="trash" size={17} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="tender-button"
        type="button"
        disabled={items.length >= 100}
        onClick={() =>
          onChange([...items, { name: "", quantity: 0, unit: "m²" }])
        }
      >
        <TenderIcon name="plus" size={16} />
        {c.addItem}
      </button>
    </fieldset>
  );
}
