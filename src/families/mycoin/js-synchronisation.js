//@flow
import type { Account } from "../../types";
import type { GetAccountShape } from "../../bridge/jsHelpers";
import { makeSync, makeScanAccounts, mergeOps } from "../../bridge/jsHelpers";

import { getAccount, getOperations } from "./api";

const getAccountShape: GetAccountShape = async (info) => {
  const { id, address, initialAccount } = info;
  const oldOperations = initialAccount?.operations || [];
  const startAt = oldOperations.length
    ? (oldOperations[0].blockHeight || 0) + 1
    : 0;

  const { blockHeight, balance, additionalBalance, nonce } = await getAccount(
    address,
    initialAccount?.myCoinResources?.nonce ?? 0
  );
  const newOperations = await getOperations(id, address, startAt);
  const operations = mergeOps(oldOperations, newOperations);

  const shape = {
    id,
    balance,
    spendableBalance: balance,
    operationsCount: operations.length,
    blockHeight,
    myCoinResources: {
      nonce,
      additionalBalance,
    },
  };

  return { ...shape, operations };
};

const postSync = (initial: Account, parent: Account) => parent;

export const scanAccounts = makeScanAccounts(getAccountShape);

export const sync = makeSync(getAccountShape, postSync);
