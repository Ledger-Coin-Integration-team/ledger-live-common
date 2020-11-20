// @flow

import { fetchValidators } from "../../api/polkadot";
import { makeLRUCache } from "../../cache";

const cacheValidators = makeLRUCache(
  async (stashes: string | string[]) => await fetchValidators(stashes),
  (stashes: string | string[]) => (Array.isArray(stashes)) ? stashes.join("-") : stashes 
);

export const getValidators = async (stashes: string | string[]) => {
  return await cacheValidators(stashes);
};
