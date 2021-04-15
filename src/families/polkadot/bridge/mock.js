// @flow
import { BigNumber } from "bignumber.js";
import type { Transaction } from "../types";
import type { AccountBridge, CurrencyBridge } from "../../../types";
import {
  NotEnoughBalance,
  RecipientRequired,
  InvalidAddress,
  FeeTooHigh,
} from "@ledgerhq/errors";
import {
  scanAccounts,
  signOperation,
  broadcast,
  sync,
  isInvalidRecipient,
  makeAccountBridgeReceive,
} from "../../../bridge/mockHelpers";
import { getMainAccount } from "../../../account";

const receive = makeAccountBridgeReceive();

const updateTransaction = (t, patch) => ({ ...t, ...patch });

const defaultFees = BigNumber(1510000);

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
  numSlashingSpans: Number(0),
});

const estimateMaxSpendable = ({ account, parentAccount, transaction }) => {
  const mainAccount = getMainAccount(account, parentAccount);
  const estimatedFees = defaultFees;
  return Promise.resolve(
    BigNumber.max(0, account.balance.minus(estimatedFees))
  );
};

const getTransactionStatus = (account, t) => {
  const errors = {};
  const warnings = {};
  const useAllAmount = !!t.useAllAmount;

  const estimatedFees = defaultFees;

  const totalSpent = useAllAmount
    ? account.balance
    : BigNumber(t.amount).plus(estimatedFees);

  const amount = useAllAmount
    ? account.balance.minus(estimatedFees)
    : BigNumber(t.amount);

  if (amount.gt(0) && estimatedFees.times(10).gt(amount)) {
    warnings.feeTooHigh = new FeeTooHigh();
  }

  // Fill up transaction errors...
  if (totalSpent.gt(account.balance)) {
    errors.amount = new NotEnoughBalance();
  }

  // Fill up recipient errors...
  if (!t.recipient) {
    errors.recipient = new RecipientRequired("");
  } else if (isInvalidRecipient(t.recipient)) {
    errors.recipient = new InvalidAddress("");
  }

  return Promise.resolve({
    errors,
    warnings,
    estimatedFees,
    amount,
    totalSpent,
  });
};

const prepareTransaction = async (a, t) => {
  if (!t.fees) {
    return {
      ...t,
      fees: defaultFees,
    };
  }
  return t;
};

const accountBridge: AccountBridge<Transaction> = {
  createTransaction,
  updateTransaction,
  getTransactionStatus,
  estimateMaxSpendable,
  prepareTransaction,
  sync,
  receive,
  signOperation,
  broadcast,
};

const currencyBridge: CurrencyBridge = {
  preload: () => Promise.resolve(),
  hydrate: () => {},
  scanAccounts,
};

export default { currencyBridge, accountBridge };
