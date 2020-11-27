// @flow

import { BigNumber } from "bignumber.js";
import invariant from "invariant";

import type { AccountLike, Account } from "../../types";
import type { Transaction } from "./types";

import { getMainAccount } from "../../account";
import { createTransaction } from "./bridge/js";
import getTransactionStatus from "./js-getTransactionStatus";

const estimateMaxSpendable = async ({
  account,
  parentAccount,
  transaction,
}: {
  account: AccountLike,
  parentAccount: ?Account,
  transaction: ?Transaction,
}): Promise<BigNumber> => {
  const mainAccount = getMainAccount(account, parentAccount);
  const t = {
    ...createTransaction(),
    ...transaction,
    recipient:
      transaction?.recipient ||
      "1Z4QdzRrpVbggYoGK5pfbeMyzpVVDK7WxheVjWFxfv6sxjV", // need abandon seed and being empty
    useAllAmount: true,
  };

  const status = await getTransactionStatus(mainAccount, t);
  return status.amount;
};

export const calculateMaxUnbond = (account: Account): BigNumber => {
  invariant(account.polkadotResources, "Should be a polkadot family");
  return account.polkadotResources.lockedBalance.minus(
    account.polkadotResources.unlockingBalance
  );
};

export const getMaxRebond = (account: Account): BigNumber => {
  invariant(account.polkadotResources, "Should be a polkadot family");
  return account.polkadotResources.unlockingBalance;
};

export const estimateAmount = ({
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
        return getMaxRebond(a);

      default:
        return a.spendableBalance.minus(t.fees || 0);
    }
  }

  return t.amount;
};

export default estimateMaxSpendable;
