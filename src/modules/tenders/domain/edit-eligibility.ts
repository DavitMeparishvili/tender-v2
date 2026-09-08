import type { TenderDraft } from "./tender";

export function canEditTender(
  tender: Pick<TenderDraft, "status" | "deadline">,
  bidCount: number,
  now = new Date(),
): boolean {
  return (
    tender.status === "DRAFT" ||
    (tender.status === "PUBLISHED" &&
      tender.deadline !== null &&
      tender.deadline > now &&
      bidCount === 0)
  );
}
