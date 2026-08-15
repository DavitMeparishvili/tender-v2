export function cancelTenderRequest(reason: string): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason }),
  };
}

export const publishTenderRequest: RequestInit = { method: "POST" };
