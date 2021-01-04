// @flow
import { TypeRegistry, ModulesWithCalls } from "@polkadot/types";
import type { CacheRes } from "../../cache";
import { makeLRUCache } from "../../cache";
import { getRegistry as apiGetRegistry } from "./api";

export const getRegistry: CacheRes<Array<void>, Object> = makeLRUCache(
  async (): Promise<{
    registry: typeof TypeRegistry,
    extrinsics: typeof ModulesWithCalls,
  }> => {
    return await apiGetRegistry();
  },
  () => "polkadot",
  {
    maxAge: 60 * 60 * 1000, // 1 hour - could be Infinity
  }
);
