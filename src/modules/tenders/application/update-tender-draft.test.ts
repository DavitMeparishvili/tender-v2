import { describe, expect, it, vi } from "vitest";
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
