import type { AgreementAction } from "../domain/agreement";
import type { AgreementRepository } from "../infrastructure/prisma-agreement-gateway";

export type AgreementActor = Readonly<{ id: string }>;
export type ManageAgreementCommand =
  | Readonly<{ type: "CONFIRM" }>
  | Readonly<{ type: "DECLINE"; explanation: string }>
  | Readonly<{ type: "ACKNOWLEDGE_START" }>
  | Readonly<{ type: "CONFIRM_COMPLETION" }>
  | Readonly<{
      type: "CANCEL";
      reasonCode: "SCHEDULE_CHANGED" | "SCOPE_CANNOT_PROCEED" | "OTHER";
      explanation: string;
    }>;

export function createManageAgreement(dependencies: {
  repository: AgreementRepository;
  now: () => Date;
  ids: { next(): string };
  selectionWindowDays: number;
}) {
  return (
    id: string,
    command: ManageAgreementCommand,
    actor: AgreementActor,
  ) => {
    const action: AgreementAction = {
      ...command,
      actorId: actor.id,
    } as AgreementAction;
    return dependencies.repository.manage(
      id,
      action,
      dependencies.now(),
      dependencies.ids,
      { selectionWindowDays: dependencies.selectionWindowDays },
    );
  };
}
