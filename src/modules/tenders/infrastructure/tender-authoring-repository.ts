import { database } from "../../../infrastructure/db/client";
import { Prisma } from "../../../generated/prisma/client";
import type { TenderActor } from "../application/create-tender-draft";
import type { AuthoringDetails } from "../application/save-tender-authoring";
import type { TenderLocation } from "../domain/tender";

export async function authoringAccess(id: string, actor: TenderActor) {
  const row = await database.tender.findUnique({
    where: { id },
    include: { _count: { select: { bids: true, attachments: true } } },
  });
  if (!row) return { ok: false, error: "TENDER_NOT_FOUND" } as const;
  if (row.ownerId !== actor.id)
    return { ok: false, error: "NOT_OWNER" } as const;
  if (
    row.status !== "DRAFT" &&
    !(
      row.status === "PUBLISHED" &&
      row.deadline &&
      row.deadline > new Date() &&
      row._count.bids === 0
    )
  )
    return { ok: false, error: "NOT_DRAFT" } as const;
  // Pending uploads are not attached until save, so replacing a file at the limit works.
  return { ok: true, value: 0 } as const;
}

export async function saveAuthoring(
  id: string,
  actor: TenderActor,
  details: AuthoringDetails,
  location: TenderLocation | null | undefined,
  retained: string[],
  files: {
    id: string;
    objectKey: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
  }[],
) {
  return database.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Tender" WHERE "id" = ${id} FOR UPDATE`,
    );
    const row = await tx.tender.findUnique({
      where: { id },
      include: { attachments: true, _count: { select: { bids: true } } },
    });
    if (!row) return { ok: false, error: "TENDER_NOT_FOUND" } as const;
    if (row.ownerId !== actor.id)
      return { ok: false, error: "NOT_OWNER" } as const;
    if (
      row.status !== "DRAFT" &&
      !(
        row.status === "PUBLISHED" &&
        row.deadline &&
        row.deadline > new Date() &&
        row._count.bids === 0
      )
    )
      return { ok: false, error: "EDIT_NOT_ALLOWED" } as const;
    if (details.deadline && details.deadline <= new Date())
      return { ok: false, error: "DEADLINE_NOT_FUTURE" } as const;
    // Providers may already be composing an amount in the published currency.
    if (
      row.status === "PUBLISHED" &&
      details.currency !== undefined &&
      details.currency !== row.currency
    )
      return { ok: false, error: "INVALID_INPUT" } as const;
    if (
      row.status === "PUBLISHED" &&
      (location === null ||
        [
          details.fullDescription,
          details.shortDescription,
          details.scopeOfWork,
          details.budgetMinorUnits,
          details.deadline,
        ].some((value) => value === null))
    )
      return { ok: false, error: "INVALID_INPUT" } as const;
    if (
      retained.some(
        (fileId) => !row.attachments.some((file) => file.id === fileId),
      )
    )
      return { ok: false, error: "INVALID_INPUT" } as const;
    const existingKeys = new Set(row.attachments.map((file) => file.objectKey));
    const additions = files.filter((file) => !existingKeys.has(file.objectKey));
    // Repeated requests after a lost response are idempotent.
    const keep = [
      ...retained,
      ...row.attachments
        .filter((file) =>
          files.some((upload) => upload.objectKey === file.objectKey),
        )
        .map((file) => file.id),
    ];
    if (keep.length + additions.length > 10)
      return { ok: false, error: "TOO_MANY_ATTACHMENTS" } as const;
    const detailData = Object.fromEntries(
      Object.entries(details).filter(([, value]) => value !== undefined),
    ) as Prisma.TenderUncheckedUpdateInput;
    await tx.tender.update({
      where: { id },
      data: {
        ...detailData,
        ...(location === null
          ? {
              city: null,
              district: null,
              addressLine: null,
              locationMode: null,
              georgianPlaceId: null,
              exactLatitude: null,
              exactLongitude: null,
              publicLatitude: null,
              publicLongitude: null,
            }
          : location
            ? {
                countryCode: location.countryCode,
                locationMode: location.mode,
                georgianPlaceId: location.placeId ?? null,
                city: location.city,
                district: location.district,
                addressLine: location.addressLine,
                exactLatitude: location.exact.latitude,
                exactLongitude: location.exact.longitude,
                publicLatitude: location.public.latitude,
                publicLongitude: location.public.longitude,
              }
            : {}),
      },
    });
    await tx.tenderAttachment.deleteMany({
      where: { tenderId: id, id: { notIn: keep } },
    });
    if (additions.length)
      await tx.tenderAttachment.createMany({
        data: additions.map((file) => ({ ...file, tenderId: id })),
      });
    return { ok: true, value: null } as const;
  });
}
