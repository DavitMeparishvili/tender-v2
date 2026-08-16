import { describe, expect, it, vi } from "vitest";
import {
  SELECTION_WORKER_HEADER,
  createSelectionHandlers,
} from "./selection-handlers";

const secret = "0123456789012345678901234567890123";

function workerRequest(headerValue?: string): Request {
  return new Request("http://localhost/api/tenders/selection/run", {
    method: "POST",
    ...(headerValue === undefined
      ? {}
      : { headers: { [SELECTION_WORKER_HEADER]: headerValue } }),
  });
}

describe("createSelectionHandlers", () => {
  it("rejects a request with no worker secret without running anything", async () => {
    const runDue = vi.fn();
    const { POST } = createSelectionHandlers({ secret, runDue });

    const response = await POST(workerRequest());

    expect(response.status).toBe(401);
    expect(runDue).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret, including one of a different length", async () => {
    const runDue = vi.fn();
    const { POST } = createSelectionHandlers({ secret, runDue });

    expect((await POST(workerRequest("wrong"))).status).toBe(401);
    expect((await POST(workerRequest(`${secret}-extra`))).status).toBe(401);
    expect(runDue).not.toHaveBeenCalled();
  });

  it("runs the sweep and reports what it settled", async () => {
    const runDue = vi.fn(async () => [
      {
        tenderId: "tender-1",
        outcome: "WINNER_SELECTED" as const,
        winningBidId: "bid-1",
        agreementId: "agreement-1",
        alreadyRan: false,
      },
    ]);
    const { POST } = createSelectionHandlers({ secret, runDue });

    const response = await POST(workerRequest(secret));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      selections: [
        {
          tenderId: "tender-1",
          outcome: "WINNER_SELECTED",
          winningBidId: "bid-1",
          agreementId: "agreement-1",
          alreadyRan: false,
        },
      ],
    });
  });
});
