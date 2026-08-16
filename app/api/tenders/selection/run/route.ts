import { getServerEnv } from "../../../../../src/config/env";
import { runDueSelections } from "../../../../../src/modules/bidding/application/run-deadline-selection";
import { createSelectionHandlers } from "../../../../../src/modules/bidding/http/selection-handlers";

export const { POST } = createSelectionHandlers({
  secret: getServerEnv().SELECTION_WORKER_SECRET,
  runDue: () => runDueSelections(),
});
