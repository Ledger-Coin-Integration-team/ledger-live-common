// @flow
import invariant from "invariant";
import { BigNumber } from "bignumber.js";
import {
  AmountRequired,
  NotEnoughBalance,
  FeeNotLoaded,
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

// To be removed
import { signOperation, broadcast } from "../../../bridge/mockHelpers";

const createTransaction = () => ({
  family: "algorand",
  amount: BigNumber(0),
  networkInfo: null,
  fees: null,
  recipient: "",
  useAllAmount: false,
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

const prepareTransaction = async (a, t) => {
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
