import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../src/modules/identity/infrastructure/auth";

export const { GET, POST } = toNextJsHandler(auth);
