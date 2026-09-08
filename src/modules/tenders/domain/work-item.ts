export type WorkItem = Readonly<{
  name: string;
  quantity: number;
  unit: string;
}>;

export function readWorkItems(value: unknown): WorkItem[] {
  if (!Array.isArray(value) || value.length > 100) return [];
  return value
    .filter(
      (item): item is WorkItem =>
        item !== null &&
        typeof item === "object" &&
        typeof item.name === "string" &&
        item.name.length > 0 &&
        typeof item.quantity === "number" &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        typeof item.unit === "string" &&
        item.unit.length > 0,
    )
    .map(({ name, quantity, unit }) => ({ name, quantity, unit }));
}
