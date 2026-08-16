import { getAgreement } from "../../../../src/modules/agreements/application/get-agreement";
import { createManageAgreement } from "../../../../src/modules/agreements/application/manage-agreement";
import { prismaAgreementGateway } from "../../../../src/modules/agreements/infrastructure/prisma-agreement-gateway";
import { createAgreementHandlers } from "../../../../src/modules/agreements/http/agreement-handlers";
import { requireAnyCommercialCapability } from "../../../../src/modules/identity/application/require-capability";
import { randomUUID } from "node:crypto";
const handlers = createAgreementHandlers({
  require: requireAnyCommercialCapability,
  list: async () => [],
  get: getAgreement,
  manage: createManageAgreement({
    repository: prismaAgreementGateway,
    now: () => new Date(),
    ids: { next: randomUUID },
  }),
});
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handlers.get(request, (await context.params).id);
}
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handlers.patch(request, (await context.params).id);
}
