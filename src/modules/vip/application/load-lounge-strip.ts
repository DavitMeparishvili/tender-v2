import { selectLoungeStrip, type LoungeStrip } from "../domain/lounge-strip";
import type { VipPartner } from "../domain/partner";
import {
  listVipPartners,
  type ListVipPartnersQuery,
} from "./list-vip-partners";

export type LoungeLogger = (message: string, error: unknown) => void;

/**
 * Loads the home page strip. A failed partner read must not take the whole
 * home page down: it is logged and the strip is hidden.
 */
export function createLoadLoungeStrip(
  dependencies: Readonly<{
    listPartners: (
      query: ListVipPartnersQuery,
    ) => Promise<readonly VipPartner[]>;
    log: LoungeLogger;
  }>,
) {
  return async function loadLoungeStrip(
    query: ListVipPartnersQuery,
  ): Promise<LoungeStrip<VipPartner>> {
    try {
      return selectLoungeStrip(await dependencies.listPartners(query));
    } catch (error) {
      dependencies.log("VIP Lounge partners could not be loaded.", error);
      return selectLoungeStrip([]);
    }
  };
}

export const loadLoungeStrip = createLoadLoungeStrip({
  listPartners: listVipPartners,
  log: (message, error) => console.error(message, error),
});
