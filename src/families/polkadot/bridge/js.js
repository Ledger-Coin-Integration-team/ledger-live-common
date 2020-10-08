// @flow
import { BigNumber } from "bignumber.js";
import { Observable } from "rxjs";
import invariant from "invariant";
import { createSignedTx } from "@substrate/txwrapper";

import {
  NotEnoughBalance,
  RecipientRequired,
  InvalidAddress,
  InvalidAddressBecauseDestinationIsAlsoSource,
  AmountRequired,
  NotEnoughBalanceBecauseDestinationNotCreated,
} from "@ledgerhq/errors";

import {
  PolkadotUnauthorizedOperation,
  PolkadotElectionClosed,
} from "../../../errors";

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
  isAddressValid,
  getElectionStatus,
} from "../../../api/Polkadot";
import {
  getEstimatedFees,
  getEstimatedFeesFromUnsignedTx,
} from "../js-getFeesForTransaction";
import buildTransaction from "../js-buildTransaction";
import { Polkadot } from "../ledger-app/Polkadot";
import { isStash, isController } from "../logic.js";

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
  console.log("getAccountShape", balances);
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
  fees: null,
  validators: [],
  era: null,
  rewardDestination: null,
});

const updateTransaction = (t, patch) => ({ ...t, ...patch });

const prepareTransaction = async (a, t) => {
  return t;
};

const isValid = async (recipient) => {
  return await isAddressValid(recipient);
};

const isNewAccount = async (recipient) => {
  const balances = await getBalances(recipient);

  return balances.polkadotResources.nonce === 0;
};

const isElectionStatusClosed = async () => {
  const status = await getElectionStatus();

  return status;
};

// Should try to refacto
const getSendTransactionStatus = async (a: Account, t: Transaction) => {
  const errors = {};
  const warnings = {};
  const useAllAmount = !!t.useAllAmount;
  let minAmountRequired = BigNumber(0);

  if (a.freshAddress === t.recipient) {
    errors.recipient = new InvalidAddressBecauseDestinationIsAlsoSource();
  }
  if (!t.recipient) {
    errors.recipient = new RecipientRequired("");
  }
  // TODO is valid with API ? how to check that properly ?
  if (!(await isValid(t.recipient))) {
    errors.recipient = new InvalidAddress("");
  }

  // Should be min 1 DOT
  if (
    !errors.recipient &&
    (await isNewAccount(t.recipient)) &&
    t.amount.lt(10000000000)
  ) {
    errors.amount = new NotEnoughBalanceBecauseDestinationNotCreated("", {
      minimalAmount: "1 DOT",
    });
  }

  const txInfo = await getTxInfo(a);
  let estimatedFees = BigNumber(0);
  if (!errors.recipient) {
    estimatedFees = await getEstimatedFees(a, t, txInfo);
  }

  const totalSpent = useAllAmount
    ? a.spendableBalance
    : BigNumber(t.amount).plus(estimatedFees);

  const amount = useAllAmount
    ? a.spendableBalance.minus(estimatedFees)
    : BigNumber(t.amount);

  if (amount.lte(0) && !t.useAllAmount) {
    errors.amount = new AmountRequired();
  }

  if (totalSpent.gt(a.spendableBalance)) {
    errors.amount = new NotEnoughBalance();
  }

  if (!errors.recipient && !errors.amount) {
    const txInfo = await getTxInfo(a);
    estimatedFees = await getEstimatedFees(a, t, txInfo);
  }

  return Promise.resolve({
    errors,
    warnings,
    estimatedFees,
    amount,
    totalSpent,
  });
};

// Still WIP only mock here
const getTransactionStatus = async (a: Account, t: Transaction) => {
  console.log("TRANSACTION", t);
  const errors = {};
  const warnings = {};
  const useAllAmount = !!t.useAllAmount;
  let minAmountRequired = BigNumber(0);

  if (t.mode === "send") {
    return await getSendTransactionStatus(a, t);
  }

  if (await !isElectionStatusClosed()) {
    errors.staking = new PolkadotElectionClosed();
  }

  let estimatedFees = t.fees || BigNumber(0);
  let amount = t.amount;
  let totalSpent = estimatedFees;

  switch (t.mode) {
    case "bond":
      if (isController(a)) {
        errors.staking = new PolkadotUnauthorizedOperation();
      }
      break;

    case "unbond":
      if (isController(a)) {
        errors.staking = new PolkadotUnauthorizedOperation();
      }
      if (a.polkadotResources?.unbondings) {
        const totalUnbond = a.polkadotResources.unbondings.reduce(
          (old, current) => {
            return old.plus(current.amount);
          },
          BigNumber(0)
        );

        const remainingUnbond = a.polkadotResources?.bondedBalance.minus(
          totalUnbond
        );

        if (
          remainingUnbond
            ? remainingUnbond.lt(t.amount)
            : a.polkadotResources?.bondedBalance.lt(t.amount)
        ) {
          errors.amount = new NotEnoughBalance();
        }
      }
      break;

    case "nominate":
      if (isStash(a)) {
        errors.staking = new PolkadotUnauthorizedOperation();
      }
      if (
        t.validators?.some(
          (v) => false //TODO check validator when we got validatorList
        ) ||
        t.validators?.length === 0
      )
        errors.recipient = new InvalidAddress(null, {
          currencyName: a.currency.name,
        });
      break;
  }

  if (!errors.amount) {
    const txInfo = await getTxInfo(a);
    estimatedFees = await getEstimatedFees(a, t, txInfo);
    totalSpent = estimatedFees;
  }

  if (t.mode === "bond" && !errors.staking) {
    amount = useAllAmount
      ? a.spendableBalance.minus(estimatedFees)
      : BigNumber(t.amount);

    totalSpent = useAllAmount
      ? a.spendableBalance
      : BigNumber(t.amount).plus(estimatedFees);

    if (!a.polkadotResources?.controller && t.amount.lt(10000000000)) {
      errors.amount = new NotEnoughBalanceBecauseDestinationNotCreated("", {
        minimalAmount: "1 DOT",
      });
    }

    if (amount.lte(0) && !t.useAllAmount) {
      errors.amount = new AmountRequired();
    }
  }

  if (totalSpent.gt(a.spendableBalance)) {
    errors.amount = new NotEnoughBalance();
  }

  return Promise.resolve({
    errors,
    warnings,
    estimatedFees,
    amount,
    totalSpent,
  });
};

// TODO : Need to fix when we got indexer
const signOperation = ({ account, transaction, deviceId }) =>
  Observable.create((o) => {
    async function main() {
      const transport = await open(deviceId);
      try {
        o.next({ type: "device-signature-requested" });

        // Sign by device

        const txInfo = await getTxInfo(account);
        console.log("buildTR");
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
