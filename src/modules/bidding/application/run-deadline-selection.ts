import type { Clock, IdGenerator, Result } from "../../shared";
import { SELECTION_WINDOW_DAYS } from "../domain/selection";

// What the deadline sweep did to one tender. The sweep never picks a winner:
// it moves a tender whose bidding closed into the client's selection window
// (or expires it when there is nothing to choose), and it expires a tender
// whose selection window ran out. `WINNER_SELECTED` is only ever REPORTED, for
// a tender the client already settled.
export type SelectionOutcome =
  | "AWAITING_SELECTION"
  | "EXPIRED_NO_BIDS"
  | "SELECTION_EXPIRED"
  | "WINNER_SELECTED";

export type SelectionResult = Readonly<{
  tenderId: string;
  outcome: SelectionOutcome;
  winningBidId: string | null;
  agreementId: string | null;
  // End of the client's selection window, when the tender is awaiting one.
  selectionExpiresAt: Date | null;
  // True when this call found the tender already settled for this step. The
  // result is identical either way; the flag exists so the worker can report
  // how much of a sweep was genuinely new without changing the result.
  alreadyRan: boolean;
}>;

export type SelectionError = "TENDER_NOT_FOUND" | "NOT_DUE";

export interface SelectionRepository {
  runSelection(
    tenderId: string,
    now: Date,
    ids: IdGenerator,
    selectionWindowDays: number,
  ): Promise<Result<SelectionResult, SelectionError>>;
  listDueTenderIds(now: Date, limit: number): Promise<readonly string[]>;
}

// A single sweep never processes more than this many tenders, so one worker
// invocation has a bounded runtime and a stuck tender cannot starve the rest
// forever — the next invocation picks up where this one stopped.
export const MAX_SELECTIONS_PER_SWEEP = 50;

export function createRunDeadlineSelection(dependencies: {
  repository: SelectionRepository;
  clock: Clock;
  ids: IdGenerator;
  selectionWindowDays: number;
}) {
  return async function runDeadlineSelection(
    tenderId: string,
  ): Promise<Result<SelectionResult, SelectionError>> {
    return dependencies.repository.runSelection(
      tenderId,
      dependencies.clock.now(),
      dependencies.ids,
      dependencies.selectionWindowDays,
    );
  };
}

export function createRunDueSelections(dependencies: {
  repository: SelectionRepository;
  clock: Clock;
  ids: IdGenerator;
  selectionWindowDays: number;
}) {
  return async function runDueSelections(
    limit: number = MAX_SELECTIONS_PER_SWEEP,
  ): Promise<readonly SelectionResult[]> {
    const now = dependencies.clock.now();
    const due = await dependencies.repository.listDueTenderIds(now, limit);
    const results: SelectionResult[] = [];
    // Sequential on purpose: each step takes a row lock, and running the
    // sweep concurrently would only add lock contention against itself while
    // making a partial failure harder to reason about.
    for (const dueTenderId of due) {
      const result = await dependencies.repository.runSelection(
        dueTenderId,
        now,
        dependencies.ids,
        dependencies.selectionWindowDays,
      );
      // A tender that stopped being due between the list and the lock (the
      // client chose, or a concurrent worker got there first) is not an
      // error; it simply contributes nothing new to this sweep.
      if (result.ok) results.push(result.value);
    }
    return results;
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

async function systemDependencies(clock: Clock) {
  const { prismaSelectionRepository } =
    await import("../infrastructure/prisma-selection-repository");
  return {
    repository: prismaSelectionRepository,
    clock,
    ids: systemIds,
    selectionWindowDays: SELECTION_WINDOW_DAYS,
  };
}

export async function runDeadlineSelection(
  tenderId: string,
  clock: Clock = systemClock,
): Promise<Result<SelectionResult, SelectionError>> {
  return createRunDeadlineSelection(await systemDependencies(clock))(tenderId);
}

export async function runDueSelections(
  limit: number = MAX_SELECTIONS_PER_SWEEP,
  clock: Clock = systemClock,
): Promise<readonly SelectionResult[]> {
  return createRunDueSelections(await systemDependencies(clock))(limit);
}
