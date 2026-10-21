import { randomUUID } from "node:crypto";
import { getServerEnv } from "../../../../../src/config/env";
import { createExpireDueAgreements } from "../../../../../src/modules/agreements/application/expire-agreements";
import { createExpiryHandlers } from "../../../../../src/modules/agreements/http/expiry-handlers";
import { prismaAgreementGateway } from "../../../../../src/modules/agreements/infrastructure/prisma-agreement-gateway";
import { SELECTION_WINDOW_DAYS } from "../../../../../src/modules/bidding/domain/selection";

const expireDue = createExpireDueAgreements({
  repository: prismaAgreementGateway,
  now: () => new Date(),
  ids: { next: randomUUID },
  selectionWindowDays: SELECTION_WINDOW_DAYS,
});

export const { POST } = createExpiryHandlers({
  secret: getServerEnv().AGREEMENT_WORKER_SECRET,
  expireDue,
});
