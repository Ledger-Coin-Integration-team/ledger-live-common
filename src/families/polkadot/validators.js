import { fetchValidators } from "../../api/polkadot";
import { makeLRUCache } from "../../cache";

const cacheValidators = makeLRUCache(
  async (stashes: string) => await fetchValidators(stashes),
  () => ""
);

export const getValidators = async (stashes: string) => {
  return await cacheValidators(stashes);
};
