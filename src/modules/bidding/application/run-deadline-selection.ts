import type { Clock, IdGenerator, Result } from "../../shared";

export type SelectionOutcome = "WINNER_SELECTED" | "EXPIRED_NO_BIDS";

export type SelectionResult = Readonly<{
  tenderId: string;
  outcome: SelectionOutcome;
  winningBidId: string | null;
  agreementId: string | null;
  // True when this call found a selection that had already run. The result is
  // identical either way; the flag exists so the worker can report how much
  // of a sweep was genuinely new without changing the returned result.
  alreadyRan: boolean;
}>;

export type SelectionError = "TENDER_NOT_FOUND" | "NOT_DUE";

export interface SelectionRepository {
  runSelection(
    tenderId: string,
    now: Date,
    ids: IdGenerator,
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
}) {
  return async function runDeadlineSelection(
    tenderId: string,
  ): Promise<Result<SelectionResult, SelectionError>> {
    return dependencies.repository.runSelection(
      tenderId,
      dependencies.clock.now(),
      dependencies.ids,
    );
  };
}

export function createRunDueSelections(dependencies: {
  repository: SelectionRepository;
  clock: Clock;
  ids: IdGenerator;
}) {
  return async function runDueSelections(
    limit: number = MAX_SELECTIONS_PER_SWEEP,
  ): Promise<readonly SelectionResult[]> {
    const now = dependencies.clock.now();
    const due = await dependencies.repository.listDueTenderIds(now, limit);
    const results: SelectionResult[] = [];
    // Sequential on purpose: each selection takes a row lock, and running the
    // sweep concurrently would only add lock contention against itself while
    // making a partial failure harder to reason about.
    for (const dueTenderId of due) {
      const result = await dependencies.repository.runSelection(
        dueTenderId,
        now,
        dependencies.ids,
      );
      // A tender that stopped being due between the list and the lock (a
      // concurrent worker got there first) is not an error; it simply
      // contributes nothing new to this sweep.
      if (result.ok) results.push(result.value);
    }
    return results;
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function runDeadlineSelection(
  tenderId: string,
): Promise<Result<SelectionResult, SelectionError>> {
  const { prismaSelectionRepository } =
    await import("../infrastructure/prisma-selection-repository");
  return createRunDeadlineSelection({
    repository: prismaSelectionRepository,
    clock: systemClock,
    ids: systemIds,
  })(tenderId);
}

export async function runDueSelections(
  limit: number = MAX_SELECTIONS_PER_SWEEP,
): Promise<readonly SelectionResult[]> {
  const { prismaSelectionRepository } =
    await import("../infrastructure/prisma-selection-repository");
  return createRunDueSelections({
    repository: prismaSelectionRepository,
    clock: systemClock,
    ids: systemIds,
  })(limit);
}
