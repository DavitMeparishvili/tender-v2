import {
  prismaAgreementGateway,
  type AgreementRepository,
} from "../infrastructure/prisma-agreement-gateway";
export const getAgreement = (id: string, actor: { id: string }) =>
  prismaAgreementGateway.get(id, actor.id);
export const getAgreementForTender = (
  tenderId: string,
  actor: { id: string },
) => prismaAgreementGateway.getForTender(tenderId, actor.id);
export const listAgreements = (
  actor: { id: string },
  role: "CLIENT" | "PROVIDER",
  repository: AgreementRepository = prismaAgreementGateway,
) => repository.list(actor.id, role);
