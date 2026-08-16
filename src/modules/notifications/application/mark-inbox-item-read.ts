import { prismaInboxRepository } from "../infrastructure/prisma-inbox-repository";
export const markInboxItemRead = (id: string, actor: { id: string }) =>
  prismaInboxRepository.markRead(id, actor.id, new Date());
