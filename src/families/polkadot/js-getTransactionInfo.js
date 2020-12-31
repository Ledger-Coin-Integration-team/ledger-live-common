// @flow
import type { Account } from "../../types";
import { getTransactionParams } from "./api";
import { getRegistry } from "./registry";

// Default values for tx info, if the user doesn't specify any
const DEFAULTS = {
  tip: 0,
  eraPeriod: 64, // number of blocks from checkpoint that transaction is valid
};

const getNonce = (a: Account): number => {
  const lastPendingOp = a.pendingOperations[0];

  const nonce = Math.max(
    a.polkadotResources?.nonce || 0,
    lastPendingOp && typeof lastPendingOp.transactionSequenceNumber === "number"
      ? lastPendingOp.transactionSequenceNumber + 1
      : 0
  );

  return nonce;
};

const getTxInfo = async (a: Account) => {
  const params = await getTransactionParams();

  const registry = getRegistry(params);

  return {
    ...params,
    address: a.freshAddress,
    nonce: getNonce(a),
    tip: DEFAULTS.tip,
    eraPeriod: DEFAULTS.eraPeriod,
    registry,
  };
};

export default getTxInfo;
