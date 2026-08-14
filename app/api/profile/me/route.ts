import {
  getOwnProfile,
  updateOwnProfile,
} from "../../../../src/modules/profiles/application/update-own-profile";
import { createProfileHandlers } from "../../../../src/modules/profiles/http/profile-handlers";

const resolveCurrentUser = async (headers: Headers) => {
  const { getCurrentUser } =
    await import("../../../../src/modules/identity/application/current-user");
  return getCurrentUser(headers);
};

export const { GET, PATCH } = createProfileHandlers({
  getCurrentUser: resolveCurrentUser,
  getOwn: getOwnProfile,
  updateOwn: updateOwnProfile,
});
