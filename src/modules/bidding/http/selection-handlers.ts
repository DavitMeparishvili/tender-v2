import { timingSafeEqual } from "node:crypto";
import type { SelectionResult } from "../application/run-deadline-selection";

export const SELECTION_WORKER_HEADER = "x-selection-worker-secret";

// Constant-time comparison, and a length check first: `timingSafeEqual`
// throws on differing lengths, and an early `return false` on length is not
// a leak — the secret's length is not secret.
function matchesSecret(presented: string | null, expected: string): boolean {
  if (presented === null) return false;
  const presentedBytes = Buffer.from(presented, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (presentedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(presentedBytes, expectedBytes);
}

export function createSelectionHandlers({
  secret,
  runDue,
}: Readonly<{
  secret: string;
  runDue: () => Promise<readonly SelectionResult[]>;
}>) {
  return {
    POST: async (request: Request): Promise<Response> => {
      if (
        !matchesSecret(request.headers.get(SELECTION_WORKER_HEADER), secret)
      ) {
        // Deliberately terse: an unauthorized caller learns nothing about
        // which tenders are due.
        return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
      }
      return Response.json({ selections: await runDue() });
    },
  };
}
