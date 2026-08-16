import { prismaInboxRepository } from "../infrastructure/prisma-inbox-repository";
export const listInbox = (actor: { id: string }) =>
  prismaInboxRepository.list(actor.id);
