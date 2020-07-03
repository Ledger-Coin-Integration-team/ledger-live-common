// @flow
import invariant from "invariant";
import { BigNumber } from "bignumber.js";
import {
  AmountRequired,
  NotEnoughBalance,
  InvalidAddressBecauseDestinationIsAlsoSource,
  NotEnoughSpendableBalance,
  NotEnoughBalanceBecauseDestinationNotCreated,
} from "@ledgerhq/errors";
import { validateRecipient } from "../../../bridge/shared";
import type { AccountBridge, CurrencyBridge, Account } from "../../../types";
import type { Transaction } from "../types";
import { scanAccounts } from "../../../libcore/scanAccounts";
import { getAccountNetworkInfo } from "../../../libcore/getAccountNetworkInfo";
import { sync } from "../../../libcore/syncAccount";
import { withLibcore } from "../../../libcore/access";
import type { CacheRes } from "../../../cache";
import { makeLRUCache } from "../../../cache";
import { getWalletName } from "../../../account";
import { getOrCreateWallet } from "../../../libcore/getOrCreateWallet";
import { getCoreAccount } from "../../../libcore/getCoreAccount";
import { getMainAccount } from "../../../account";
import { formatCurrencyUnit } from "../../../currencies";
import broadcast from "../libcore-broadcast";
import signOperation from "../libcore-signOperation";
import { getFeesForTransaction } from "../../../libcore/getFeesForTransaction";

export const calculateFees: CacheRes<
  Array<{ a: Account, t: Transaction }>,
  { estimatedFees: BigNumber, estimatedGas: ?BigNumber }
> = makeLRUCache(
  async ({
    a,
    t,
  }): Promise<{ estimatedFees: BigNumber, estimatedGas: ?BigNumber }> => {
    return await getFeesForTransaction({
      account: a,
      transaction: t,
    });
  },
  ({ a, t }) =>
    `${a.id}_${t.amount.toString()}_${t.recipient}_${String(t.useAllAmount)}_${
      t.memo ? t.memo.toString() : ""
    }`
);

const createTransaction = () => ({
  family: "algorand",
  amount: BigNumber(0),
  networkInfo: null,
  fees: null,
  recipient: "",
  useAllAmount: false,
  memo: null,
  mode: "send",
});

const updateTransaction = (t, patch) => {
  return { ...t, ...patch };
};

const getTransactionStatus = async (a: Account, t) => {
  const errors = {};
  const warnings = {};
  const amount = BigNumber(0);
  const totalSpent = BigNumber(0);
  const estimatedFees = BigNumber(0);

  return Promise.resolve({
    errors,
    warnings,
    estimatedFees,
    amount,
    totalSpent,
  });
};

const sameFees = (a, b) => (!a || !b ? a === b : a.eq(b));

const prepareTransaction = async (a, t) => {
  let fees = t.fees;

  if (t.recipient && t.amount.gt(0)) {
    const errors = (await validateRecipient(a.currency, t.recipient))
      .recipientError;
    if (!errors) {
      const res = await calculateFees({
        a,
        t,
      });

      fees = res.estimatedFees;
    }
  }

  if (!sameFees(t.fees, fees)) {
    return { ...t, fees };
  }

  return t;
};

const estimateMaxSpendable = async ({
  account,
  parentAccount,
  transaction,
}) => {
  const mainAccount = getMainAccount(account, parentAccount);
  const t = await prepareTransaction(mainAccount, {
    ...createTransaction(),
    recipient: "fakeAddressToBeDetermined",
    ...transaction,
    useAllAmount: true,
  });
  const s = await getTransactionStatus(mainAccount, t);
  return s.amount;
};

const preload = async () => {};

const hydrate = () => {};

const currencyBridge: CurrencyBridge = {
  preload,
  hydrate,
  scanAccounts,
};

const accountBridge: AccountBridge<Transaction> = {
  createTransaction,
  updateTransaction,
  prepareTransaction,
  getTransactionStatus,
  sync,
  signOperation,
  broadcast,
  estimateMaxSpendable,
};

export default { currencyBridge, accountBridge };
