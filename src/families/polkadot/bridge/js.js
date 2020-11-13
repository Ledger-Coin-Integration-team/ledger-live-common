// @flow
import { BigNumber } from "bignumber.js";

// import invariant from "invariant";

import type { Account, Operation, SignedOperation } from "../../../types";
import type { Transaction } from "../types";

import type { AccountBridge, CurrencyBridge } from "../../../types";
// import { isInvalidRecipient } from "../../../bridge/mockHelpers";
import { getMainAccount } from "../../../account";
import {
  makeSync,
  makeScanAccounts,
  makeAccountBridgeReceive,
} from "../../../bridge/jsHelpers";
import { submitExtrinsic } from "../../../api/polkadot";
import { getAccountShape } from "../synchronisation";

import getTransactionStatus from "../js-getTransactionStatus";
import signOperation from "../js-signOperation";
import { getValidators } from "../validators";
import {
  setPolkadotPreloadData,
  asSafePolkadotPreloadData,
} from "../preloadedData";

import { patchOperationWithHash } from "../../../operation";
import { ESTIMATED_FEES } from "../logic";

const receive = makeAccountBridgeReceive();

const estimateMaxSpendable = async ({
  account,
  parentAccount /*,transaction ,*/,
}) => {
  const mainAccount = getMainAccount(account, parentAccount);
  const estimatedFees = ESTIMATED_FEES; // Around 0.0154 DOT
  return BigNumber.max(0, mainAccount.spendableBalance.minus(estimatedFees));
};

const postSync = (initial: Account, parent: Account) => {
  return parent;
};

const scanAccounts = makeScanAccounts(getAccountShape);

const sync = makeSync(getAccountShape, postSync);

const createTransaction = (): Transaction => ({
  family: "polkadot",
  mode: "send",
  amount: BigNumber(0),
  recipient: "",
  useAllAmount: false,
  fees: null,
  validators: [],
  era: null,
  rewardDestination: null,
});

const updateTransaction = (t, patch) => ({ ...t, ...patch });

const prepareTransaction = async (a, t) => {
  return t;
};

const broadcast = async ({
  signedOperation: { signature, operation },
}: {
  signedOperation: SignedOperation,
}): Promise<Operation> => {
  const hash = await submitExtrinsic(signature);

  return patchOperationWithHash(operation, hash);
};

const accountBridge: AccountBridge<Transaction> = {
  estimateMaxSpendable,
  createTransaction,
  updateTransaction,
  getTransactionStatus,
  prepareTransaction,
  sync,
  receive,
  signOperation,
  broadcast,
};

const currencyBridge: CurrencyBridge = {
  preload: async () => {
    const validators = await getValidators("all");
    setPolkadotPreloadData({ validators });
    return Promise.resolve({ validators });
  },
  hydrate: (data: mixed) => {
    if (!data || typeof data !== "object") return;
    const { validators } = data;
    if (
      !validators ||
      typeof validators !== "object" ||
      !Array.isArray(validators)
    )
      return;
    setPolkadotPreloadData(asSafePolkadotPreloadData(data));
  },
  scanAccounts,
};

export default { currencyBridge, accountBridge };
