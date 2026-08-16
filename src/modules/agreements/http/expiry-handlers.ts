import { matchesWorkerSecret } from "../../shared/http/worker-secret";

export const AGREEMENT_WORKER_HEADER = "x-agreement-worker-secret";

export function createExpiryHandlers(dependencies: {
  secret: string;
  expireDue: () => Promise<readonly unknown[]>;
}) {
  return {
    POST: async (request: Request): Promise<Response> => {
      if (
        !matchesWorkerSecret(
          request.headers.get(AGREEMENT_WORKER_HEADER),
          dependencies.secret,
        )
      ) {
        return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
      }
      return Response.json({ expirations: await dependencies.expireDue() });
    },
  };
}
