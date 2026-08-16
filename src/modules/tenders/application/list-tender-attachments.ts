import type { Clock, Result } from "@/src/modules/shared";
import type { EntitlementCheck } from "../ports/entitlement-check";
import type { TenderActor } from "./create-tender-draft";
import type { AttachmentRecord } from "./upload-tender-attachment";

export type ListAttachmentsError = "TENDER_NOT_FOUND" | "NOT_OWNER";

export interface ListTenderAttachmentsRepository {
  // Any status is accepted here: the owner must still see attachments on a
  // published or cancelled tender, unlike `countForOwnedDraft`, which is
  // draft-only because it guards uploads.
  listForOwnedTender(
    tenderId: string,
    actor: TenderActor,
  ): Promise<Result<readonly AttachmentRecord[], ListAttachmentsError>>;
}

export function createListTenderAttachments(
  repository: ListTenderAttachmentsRepository,
) {
  return (tenderId: string, actor: TenderActor) =>
    repository.listForOwnedTender(tenderId, actor);
}

export async function listTenderAttachments(
  tenderId: string,
  actor: TenderActor,
): Promise<Result<readonly AttachmentRecord[], ListAttachmentsError>> {
  const { prismaAttachmentRepository } =
    await import("../infrastructure/prisma-attachment-repository");
  return createListTenderAttachments(prismaAttachmentRepository)(
    tenderId,
    actor,
  );
}

export interface ListPublishedAttachmentsRepository {
  listForPublishedTender(
    tenderId: string,
  ): Promise<readonly AttachmentRecord[]>;
}

export function createListEntitledAttachments(dependencies: {
  repository: ListPublishedAttachmentsRepository;
  clock: Clock;
  isEntitled: EntitlementCheck;
}) {
  return async function listEntitledAttachments(
    tenderId: string,
    actor: TenderActor,
  ): Promise<Result<readonly AttachmentRecord[], "NOT_ENTITLED">> {
    // Entitlement first, for the same reason as the download path: a
    // non-entitled provider must not learn how many files a tender carries.
    const entitled = await dependencies.isEntitled(
      actor.id,
      tenderId,
      dependencies.clock.now(),
    );
    if (!entitled) return { ok: false, error: "NOT_ENTITLED" };
    return {
      ok: true,
      value: await dependencies.repository.listForPublishedTender(tenderId),
    };
  };
}

export async function listEntitledAttachments(
  tenderId: string,
  actor: TenderActor,
): Promise<Result<readonly AttachmentRecord[], "NOT_ENTITLED">> {
  const [{ prismaAttachmentRepository }, { hasTenderEntitlement }] =
    await Promise.all([
      import("../infrastructure/prisma-attachment-repository"),
      import("../../access/application/has-tender-entitlement"),
    ]);
  return createListEntitledAttachments({
    repository: prismaAttachmentRepository,
    clock: { now: () => new Date() },
    isEntitled: hasTenderEntitlement,
  })(tenderId, actor);
}
