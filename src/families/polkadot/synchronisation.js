//@flow

import type { GetAccountShape } from "../../bridge/jsHelpers";
import { mergeOps } from "../../bridge/jsHelpers";

import { getAccount, getOperations } from "../../api/polkadot";

export const getAccountShape: GetAccountShape = async (info) => {
  const { id, address, initialAccount } = info;
  const oldOperations = initialAccount?.operations || [];
  const startAt = oldOperations.length
    ? (oldOperations[0].blockHeight || 0) + 1
    : 0;

  const {
    balance,
    spendableBalance,
    nonce,
    lockedBalance,
    controller,
    stash,
    unlockedBalance,
    unlockingBalance,
    unlockings,
    nominations,
  } = await getAccount(address);
  const newOperations = await getOperations(id, address, startAt);
  const operations = mergeOps(oldOperations, newOperations);
  const blockHeight = operations.length ? operations[0].blockHeight || 0 : 0;

  const shape = {
    id,
    balance,
    spendableBalance,
    operationsCount: operations.length,
    blockHeight,
    polkadotResources: {
      nonce,
      controller,
      stash,
      lockedBalance,
      unlockedBalance,
      unlockingBalance,
      unlockings,
      nominations,
    },
  };
  console.log("getAccountShape", JSON.stringify(shape, null, 2));

  return { ...shape, operations };
};
