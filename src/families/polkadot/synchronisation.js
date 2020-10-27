//@flow

import type { GetAccountShape } from "../../bridge/jsHelpers";

import { mergeOps } from "../../bridge/jsHelpers";

import { getBalances, getOperations } from "../../api/polkadot";

export const getAccountShape: GetAccountShape = async (info) => {
  const { id, address, initialAccount } = info;
  const oldOperations = initialAccount?.operations || [];
  const startAt = oldOperations.length
    ? (oldOperations[0].blockHeight || 0) + 1
    : 0;

  const balances = await getBalances(address);
  const newOperations = await getOperations(id, address, startAt);
  const operations = mergeOps(oldOperations, newOperations);
  const blockHeight = operations.length ? operations[0].blockHeight : 0;

  console.log("getAccountShape", {
    id,
    address,
    ...balances,
    operationsCount: operations.length,
    blockHeight,
  });

  return {
    id,
    ...balances,
    operationsCount: operations.length,
    operations,
    blockHeight,
  };
};
