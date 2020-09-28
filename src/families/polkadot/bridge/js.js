// @flow
import { BigNumber } from "bignumber.js";
import { Observable } from "rxjs";
import { createSignedTx } from "@substrate/txwrapper";

import {
  NotEnoughBalance,
  RecipientRequired,
  InvalidAddress,
  FeeTooHigh,
} from "@ledgerhq/errors";

import type {
  Account,
  Operation,
  TransactionStatus,
  SignedOperation,
} from "../../../types";
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
import {
  getBalances,
  getTransfers,
  submitExtrinsic,
  paymentInfo,
  getTxInfo,
} from "../../../api/Polkadot";
import {
  getEstimatedFees,
  getEstimatedFeesFromUnsignedTx,
} from "../js-getFeesForTransaction";
import buildTransaction from "../js-buildTransaction";
import { Polkadot } from "../ledger-app/Polkadot";

const receive = makeAccountBridgeReceive();

const estimateMaxSpendable = ({ account, parentAccount, transaction }) => {
  const mainAccount = getMainAccount(account, parentAccount);
  const estimatedFees = BigNumber(5000);
  return Promise.resolve(
    BigNumber.max(0, account.balance.minus(estimatedFees))
  );
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

const scanAccounts = makeScanAccounts(getAccountShape);

const sync = makeSync(getAccountShape, postSync);

const createTransaction = (): Transaction => ({
  family: "polkadot",
  mode: "send",
  amount: BigNumber(0),
  recipient: "",
  useAllAmount: false,
  networkInfo: null,
  validators: [],
});

const updateTransaction = (t, patch) => ({ ...t, ...patch });

const prepareTransaction = async (a, t) => {
  return t;
};

// Still WIP only mock here
const getTransactionStatus = async (account, t) => {
  const errors = {};
  const warnings = {};
  const useAllAmount = !!t.useAllAmount;

  const estimatedFees = await getEstimatedFees(account, t);

  console.log(estimatedFees);

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

const signOperation = ({ account, transaction, deviceId }) =>
  Observable.create((o) => {
    async function main() {
      const transport = await open(deviceId);
      try {
        o.next({ type: "device-signature-requested" });

        // Sign by device

        const txInfo = await getTxInfo(account);

        const unsignedTransaction = await buildTransaction(
          account,
          transaction,
          txInfo
        );

        const payload = txInfo.txOptions.registry.createType(
          "ExtrinsicPayload",
          unsignedTransaction,
          {
            version: unsignedTransaction.version,
          }
        );

        const polkadot = new Polkadot(transport);
        const r = await polkadot.sign(
          account.freshAddressPath,
          payload.toU8a({ method: true })
        );

        const signature = createSignedTx(
          unsignedTransaction,
          r.signature,
          txInfo.txOptions
        );

        o.next({ type: "device-signature-granted" });

        const getValue = (): BigNumber => {
          return BigNumber(transaction.amount);
        };

        const fee = await getEstimatedFeesFromUnsignedTx(
          account,
          unsignedTransaction,
          txInfo
        );

        const value = getValue();
        const extra = {};

        const operationType = "OUT";

        const operation: $Exact<Operation> = {
          id: `${account.id}--${operationType}`,
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
  signedOperation: { signature, operation },
}: {
  signedOperation: SignedOperation,
}): Promise<Operation> => {
  const hash = await submitExtrinsic(signature);

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
