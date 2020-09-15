// @flow
import { BigNumber } from "bignumber.js";
import { Observable } from "rxjs";
import BIPPath from "bip32-path";
import { Polkadot } from "../ledger-app/Polkadot";

import type { Account, Operation, TransactionStatus } from "../../../types";
import {
  NotEnoughBalance,
  RecipientRequired,
  InvalidAddress,
  FeeTooHigh,
} from "@ledgerhq/errors";
import type { Transaction } from "../types";
import { open, close } from "../../../hw";
import type { AccountBridge, CurrencyBridge } from "../../../types";
import { isInvalidRecipient } from "../../../bridge/mockHelpers";
import { getMainAccount } from "../../../account";
import {
  makeSync,
  makeScanAccounts,
  makeAccountBridgeReceive,
} from "../../../bridge/jsHelpers";
import { ApiPromise, WsProvider } from "@polkadot/api";
import {
  getBalances,
  getTransfers,
  nodeBroadcastTx,
} from "../../../api/Polkadot";
import { hwSign } from "../hw-sign";

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

const getAccountShape = async (info, syncConfig) => {
  const balances = await getBalances(info.address);
  const operations = await getTransfers(info.id, info.address);

  return {
    id: info.id,
    ...balances,
    operationsCount: operations.length,
    operations,
    blockHeight: operations.length,
  };
};

const postSync = (parent) => {
  return parent;
};

const getEstimatedFees = async () => {
  return BigNumber(0);
};

const sync = makeSync(getAccountShape, postSync);

const scanAccounts = makeScanAccounts(getAccountShape);

const signOperation = ({ account, transaction, deviceId }) =>
  Observable.create((o) => {
    async function main() {
      const transport = await open(deviceId);
      try {
        o.next({ type: "device-signature-requested" });

        // Sign by device

        const signature = await hwSign(transport, {
          a: account,
          t: transaction,
        });

        o.next({ type: "device-signature-granted" });

        const getValue = (): BigNumber => {
          return BigNumber(transaction.amount);
        };

        const fee = await getEstimatedFees(); // TODO: calculate fees

        const value = getValue();
        const extra = {};

        const operationType = "OUT";

        const operation: $Exact<Operation> = {
          id: `${account.id}-""-${operationType}`,
          hash: "",
          // if it's a token op and there is no fee, this operation does not exist and is a "NONE"
          type: value.eq(0) ? "NONE" : operationType,
          value,
          fee,
          blockHash: null,
          blockHeight: null,
          senders: [account.freshAddress],
          recipients: [transaction.recipient],
          accountId: account.id,
          date: new Date(),
          extra,
        };

        o.next({
          type: "signed",
          signedOperation: {
            operation,
            signature,
            expirationDate: null,
          },
        });
      } finally {
        close(transport, deviceId);
      }
    }
    main().then(
      () => o.complete(),
      (e) => o.error(e)
    );
  });

const broadcast = async ({
  signedOperation: { signature, operation, signatureRaw },
}) => {
  await nodeBroadcastTx(signature);

  return operation;
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
  scanAccounts,
  preload: () => {
    return Promise.resolve();
  },
  hydrate: () => {},
};

export default { currencyBridge, accountBridge };
