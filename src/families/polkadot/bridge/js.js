// @flow
import { BigNumber } from "bignumber.js";

// import invariant from "invariant";

import type { Account, Operation, SignedOperation } from "../../../types";
import type { Transaction } from "../types";

import type { AccountBridge, CurrencyBridge } from "../../../types";
// import { isInvalidRecipient } from "../../../bridge/mockHelpers";
import {
  makeSync,
  makeScanAccounts,
  makeAccountBridgeReceive,
} from "../../../bridge/jsHelpers";
import { submitExtrinsic } from "../../../api/polkadot";
import { getAccountShape } from "../synchronisation";

import getTransactionStatus from "../js-getTransactionStatus";
import estimateMaxSpendable from "../js-estimateMaxSpendable";
import signOperation from "../js-signOperation";

import { preload, hydrate } from "../preload";

import { calculateFees } from "../js-getFeesForTransaction";
import { patchOperationWithHash } from "../../../operation";
import { isValidAddress } from "../logic";

const receive = makeAccountBridgeReceive();

const postSync = (initial: Account, parent: Account) => {
  return parent;
};

const scanAccounts = makeScanAccounts(getAccountShape);

const sync = makeSync(getAccountShape, postSync);

export const createTransaction = (): Transaction => ({
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

const sameFees = (a, b) => (!a || !b ? a === b : a.eq(b));

const prepareTransaction = async (a, t) => {
  let fees = t.fees;

  if (t.useAllAmount && (await isValidAddress(t.recipient))) {
    fees = await calculateFees({ a, t });
  }

  if (!sameFees(t.fees, fees)) {
    return { ...t, fees };
  }

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

const currencyBridge: CurrencyBridge = {
  preload,
  hydrate,
  scanAccounts,
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

export default { currencyBridge, accountBridge };
