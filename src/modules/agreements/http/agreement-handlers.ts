import { z } from "zod";
import type { Result } from "../../shared";
import type { ManageAgreementCommand } from "../application/manage-agreement";
import { mapAgreementError } from "./map-agreement-error";
const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CONFIRM") }).strict(),
  z.object({ action: z.literal("DECLINE"), explanation: z.string() }).strict(),
  z.object({ action: z.literal("ACKNOWLEDGE_START") }).strict(),
  z.object({ action: z.literal("CONFIRM_COMPLETION") }).strict(),
  z
    .object({
      action: z.literal("CANCEL"),
      reasonCode: z.enum(["SCHEDULE_CHANGED", "SCOPE_CANNOT_PROCEED", "OTHER"]),
      explanation: z.string(),
    })
    .strict(),
]);
type Actor = { id: string };
type Require = (headers: Headers) => Promise<Result<Actor, string>>;
export function createAgreementHandlers(deps: {
  require: Require;
  list: (actor: Actor, role: "CLIENT" | "PROVIDER") => Promise<unknown>;
  get: (id: string, actor: Actor) => Promise<Result<unknown, string>>;
  manage: (
    id: string,
    command: ManageAgreementCommand,
    actor: Actor,
  ) => Promise<Result<unknown, string>>;
}) {
  const actor = async (headers: Headers) => {
    const access = await deps.require(headers);
    return access.ok
      ? access.value
      : Response.json(
          { code: access.error },
          { status: access.error === "UNAUTHENTICATED" ? 401 : 403 },
        );
  };
  return {
    list: async (request: Request) => {
      const user = await actor(request.headers);
      if (user instanceof Response) return user;
      const role = new URL(request.url).searchParams.get("role");
      return role === "CLIENT" || role === "PROVIDER"
        ? Response.json({ agreements: await deps.list(user, role) })
        : Response.json({ code: "INVALID_ROLE" }, { status: 422 });
    },
    get: async (_: Request, id: string) => {
      const user = await actor(_.headers);
      if (user instanceof Response) return user;
      const result = await deps.get(id, user);
      return result.ok
        ? Response.json({ agreement: result.value })
        : mapAgreementError(result.error);
    },
    patch: async (request: Request, id: string) => {
      const user = await actor(request.headers);
      if (user instanceof Response) return user;
      const parsed = commandSchema.safeParse(
        await request.json().catch(() => null),
      );
      if (!parsed.success)
        return Response.json({ code: "INVALID_COMMAND" }, { status: 422 });
      const { action: _action, ...command } = parsed.data;
      const result = await deps.manage(
        id,
        { type: _action, ...command } as ManageAgreementCommand,
        user,
      );
      return result.ok
        ? Response.json({ agreement: result.value })
        : mapAgreementError(result.error);
    },
  };
}
