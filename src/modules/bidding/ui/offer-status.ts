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
  if (tenderStatus !== "PUBLISHED") return "ended";
  return new Date(deadline).getTime() > now ? "active" : "pending";
}
