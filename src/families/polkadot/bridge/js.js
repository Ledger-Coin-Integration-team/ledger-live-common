// @flow
import { BigNumber } from "bignumber.js";
import {
  NotEnoughBalance,
  RecipientRequired,
  InvalidAddress,
  FeeTooHigh,
} from "@ledgerhq/errors";
import type { Transaction } from "../types";
import type { AccountBridge, CurrencyBridge } from "../../../types";
import {
  signOperation,
  broadcast,
  isInvalidRecipient,
} from "../../../bridge/mockHelpers";
import { getMainAccount } from "../../../account";
import { makeSync, makeScanAccounts, makeAccountBridgeReceive } from "../../../bridge/jsHelpers";
import { ApiPromise, WsProvider } from '@polkadot/api';

const receive = makeAccountBridgeReceive();

const createTransaction = (): Transaction => ({
  family: "polkadot",
  mode: "send",
  amount: BigNumber(0),
  recipient: "",
  useAllAmount: false,
  networkInfo: null,
});

const updateTransaction = (t, patch) => ({ ...t, ...patch });

const estimateMaxSpendable = ({ account, parentAccount, transaction }) => {
  const mainAccount = getMainAccount(account, parentAccount);
  const estimatedFees = BigNumber(5000);
  return Promise.resolve(
    BigNumber.max(0, account.balance.minus(estimatedFees))
  );
};

const getTransactionStatus = (account, t) => {
  const errors = {};
  const warnings = {};
  const useAllAmount = !!t.useAllAmount;

  const estimatedFees = BigNumber(5000);

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
  return t;
};

const getAccountShape =  async(info, syncConfig) => {
    const wsProvider = new WsProvider('wss://localhost:9933');
    const api = await ApiPromise.create({ provider: wsProvider });

    console.log(api.genesisHash.toHex());

    return {
    balance: BigNumber(0),
    spendableBalance: BigNumber(0),
    operationsCount: 0,
    operations: [],
    blockHeight: 1,
  };
}

const postSync = (parent) => {
  return parent;
};

const sync = makeSync(getAccountShape, postSync);

const scanAccounts = makeScanAccounts(getAccountShape);


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
  scanAccounts,
  preload: () => {
    return Promise.resolve();
  },
  hydrate: () => {},
};

export default { currencyBridge, accountBridge };
