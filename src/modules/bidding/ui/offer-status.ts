export function offerStatus(
  status: string,
  tenderStatus: string,
  deadline: Date | string,
  now = Date.now(),
) {
  if (status === "WITHDRAWN") return "withdrawn";
  if (tenderStatus === "CANCELLED") return "cancelled";
  if (status === "WINNER") return "won";
  if (status === "LOST") return "lost";
  // Still SUBMITTED while the client is choosing.
  if (tenderStatus === "AWAITING_SELECTION") return "pending";
  // The client chose another offer and that agreement is pending; this offer
  // stays on hold in case it falls through.
  if (tenderStatus === "CLOSED") return "standby";
  if (tenderStatus !== "PUBLISHED") return "ended";
  return new Date(deadline).getTime() > now ? "active" : "pending";
}
