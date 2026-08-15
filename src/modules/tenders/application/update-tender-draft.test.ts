import { describe, expect, it, vi } from "vitest";
import { MAX_BUDGET_MINOR_UNITS } from "../domain/constraints";
import {
  createUpdateTenderDraft,
  updateTenderDraftCommandSchema,
  type UpdateTenderDraftCommand,
} from "./update-tender-draft";

describe("updateTenderDraft desired start date", () => {
  it("accepts explicit null as a clear command", async () => {
    const updateDraft = vi.fn(
      async (
        _id: string,
        command: UpdateTenderDraftCommand,
        actor: { id: string },
      ) => ({
        ok: true as const,
        value: {
          ownerId: actor.id,
          desiredStartDate: command.desiredStartDate,
        } as never,
      }),
    );
    const update = createUpdateTenderDraft({ updateDraft });

    await expect(
      update("tender-1", { desiredStartDate: null }, { id: "owner-1" }),
    ).resolves.toMatchObject({
      ok: true,
      value: { desiredStartDate: null },
    });
    expect(updateDraft).toHaveBeenCalledWith(
      "tender-1",
      { desiredStartDate: null },
      { id: "owner-1" },
    );
  });

  it("keeps omission distinct from clearing", () => {
    expect(
      updateTenderDraftCommandSchema.parse({ title: "Keep current date" }),
    ).not.toHaveProperty("desiredStartDate");
    expect(
      updateTenderDraftCommandSchema.parse({ desiredStartDate: null }),
    ).toEqual({ desiredStartDate: null });
  });
});

describe("updateTenderDraft budget ceiling", () => {
  it("accepts the largest budget the INTEGER column can hold", () => {
    expect(
      updateTenderDraftCommandSchema.safeParse({
        budgetMinorUnits: MAX_BUDGET_MINOR_UNITS,
      }).success,
    ).toBe(true);
  });

  it("rejects a budget one minor unit above the INTEGER column's ceiling", () => {
    expect(
      updateTenderDraftCommandSchema.safeParse({
        budgetMinorUnits: MAX_BUDGET_MINOR_UNITS + 1,
      }).success,
    ).toBe(false);
  });

  // An overflowing amount has to be refused by the contract, before the
  // repository ever sees it: reaching Prisma would raise an INT4 overflow the
  // handler cannot map, so the caller would get a 500 instead of a 400.
  it("refuses an overflowing budget without touching the repository", async () => {
    const updateDraft = vi.fn();
    const update = createUpdateTenderDraft({ updateDraft });

    await expect(
      update(
        "tender-1",
        { budgetMinorUnits: 3_000_000_000 },
        { id: "owner-1" },
      ),
    ).resolves.toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(updateDraft).not.toHaveBeenCalled();
  });
});
