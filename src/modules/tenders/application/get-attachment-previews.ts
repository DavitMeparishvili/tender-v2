// Public metadata contains neither storage keys nor media URLs. Filenames are
// generic because an uploaded filename can itself contain a private address.
export async function getAttachmentPreviews(tenderId: string) {
  const { database } = await import("../../../infrastructure/db/client");
  const rows = await database.tenderAttachment.findMany({
    where: {
      tenderId,
      tender: { status: { in: ["PUBLISHED", "CLOSED", "EXPIRED"] } },
    },
    select: { id: true, mimeType: true, sizeBytes: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row, index) => ({
    ...row,
    originalFileName:
      row.mimeType === "application/pdf"
        ? "Project brief.pdf"
        : row.mimeType === "image/vnd.dwg"
          ? "Floor plan.dwg"
          : `Photo ${index + 1}`,
    url: null,
  }));
}
