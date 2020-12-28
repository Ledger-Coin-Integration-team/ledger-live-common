// @flow

import { BigNumber } from "bignumber.js";
import invariant from "invariant";

import type { AccountLike, Account } from "../../types";
import type { Transaction } from "./types";

import { getMainAccount } from "../../account";
import { calculateFees } from "./cache";
import { createTransaction } from "./bridge/js";

/**
 * Returns the maximum possible amount for transaction
 *
 * @param {Object} param - the account, parentAccount and transaction
 */
const estimateMaxSpendable = async ({
  account,
  parentAccount,
  transaction,
}: {
  account: AccountLike,
  parentAccount: ?Account,
  transaction: ?Transaction,
}): Promise<BigNumber> => {
  const a = getMainAccount(account, parentAccount);
  const t = {
    ...createTransaction(),
    ...transaction,
    useAllAmount: true,
  };

  const fees = await calculateFees({ a, t });

  return calculateAmount({ a, t: { ...t, fees } });
};

/**
 * Calculates max unbond amount which is the remaining active locked balance (not unlocking)
 *
 * @param {*} account
 */
const calculateMaxUnbond = (account: Account): BigNumber => {
  invariant(account.polkadotResources, "Should be a polkadot family");
  return account.polkadotResources.lockedBalance.minus(
    account.polkadotResources.unlockingBalance
  );
};

/**
 * Calculates max rebond amount which is the current unlocking balance (including unlocked)
 *
 * @param {*} account
 */
const calculateMaxRebond = (account: Account): BigNumber => {
  invariant(account.polkadotResources, "Should be a polkadot family");
  return account.polkadotResources.unlockingBalance;
};

/**
 * Calculates correct amount if useAllAmount
 *
 * @param {*} param
 */
export const calculateAmount = ({
  a,
  t,
}: {
  a: Account,
  t: Transaction,
}): BigNumber => {
  if (t.useAllAmount) {
    switch (t.mode) {
      case "unbond":
        return calculateMaxUnbond(a);

      case "rebond":
        return calculateMaxRebond(a);

      default:
        return a.spendableBalance.minus(t.fees || 0);
    }
  }

  return t.amount;
};

export default estimateMaxSpendable;
