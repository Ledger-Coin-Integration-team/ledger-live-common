// @flow

import { log } from "@ledgerhq/logs";

/**
 * get the operation type by using his palletMethod
 * the method case depends from which indexer you are using
 * - camelCase for BisonTrails
 * - snake_case for Subscan
 * @param {*} pallet
 * @param {*} palletMethod
 */
export const getOperationType = (pallet: string, palletMethod: string) => {
  switch (palletMethod) {
    case "transfer":
    case "transferKeepAlive":
      return "OUT";

    case "bond":
    case "bondExtra":
    case "rebond":
      return "BOND";

    case "unbond":
      return "UNBOND";

    case "nominate":
      return "NOMINATE";

    case "chill":
      return "CHILL";

    case "withdrawUnbonded":
      return "WITHDRAW_UNBONDED";

    case "payoutStakers":
      return "FEES";

    default:
      log("polkadot/api", `Unhandled operation type ${pallet}.${palletMethod}`);
      return "FEES";
  }
};
