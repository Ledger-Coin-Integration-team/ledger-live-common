// @flow
import { BigNumber } from "bignumber.js";
import { Observable } from "rxjs";
import { createSignedTx } from "@substrate/txwrapper";
import type { Transaction } from "./types";
import type { Account, Operation, SignOperationEvent } from "../../types";

import { open, close } from "../../hw";
import { Polkadot } from "./ledger-app/Polkadot";

import getTxInfo from "./js-getTransactionInfo";
import { getEstimatedFeesFromUnsignedTx } from "./js-getFeesForTransaction";
import buildTransaction from "./js-buildTransaction";

const MODE_TO_TYPE = {
  send: "OUT",
  bond: "BOND",
  unbond: "UNBOND",
  rebond: "BOND",
  withdrawUnbonded: "WITHDRAW_UNBONDED",
  nominate: "NOMINATE",
  chill: "CHILL",
  claimReward: "REWARD",
  default: "FEES",
};

const MODE_TO_PALLET_METHOD = {
  send: "balances.transferKeepAlive",
  bond: "staking.bond",
  unbond: "staking.unbond",
  rebond: "staking.rebond",
  withdrawUnbonded: "staking.withdrawUnbonded",
  nominate: "staking.nominate",
  chill: "staking.chill",
  claimReward: "staking.payoutStakers",
};

const getExtra = (type: string, account: Account, transaction: Transaction) => {
  const extra = MODE_TO_PALLET_METHOD[transaction.mode]
    ? { palletMethod: MODE_TO_PALLET_METHOD[transaction.mode] }
    : {};

  switch (type) {
    case "OUT":
      return { ...extra, transferAmount: BigNumber(transaction.amount) };
    case "BOND":
      return { ...extra, bondedAmount: BigNumber(transaction.amount) };
    case "UNBOND":
      return { ...extra, unbondedAmount: BigNumber(transaction.amount) };
    case "NOMINATE":
      return { ...extra, validators: transaction.validators };
  }
  return extra;
};

const buildOptimisticOperation = (
  account: Account,
  transaction: Transaction,
  fee: BigNumber
): Operation => {
  const type = MODE_TO_TYPE[transaction.mode] ?? MODE_TO_TYPE.default;

  const value =
    type === "OUT" ? BigNumber(transaction.amount).plus(fee) : BigNumber(fee);

  const extra = getExtra(type, account, transaction);

  const operation: $Exact<Operation> = {
    id: `${account.id}--${type}`,
    hash: "",
    type,
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

  return operation;
};

const signOperation = ({
  account,
  deviceId,
  transaction,
}: {
  account: Account,
  deviceId: *,
  transaction: Transaction,
}): Observable<SignOperationEvent> =>
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

        const fee = await getEstimatedFeesFromUnsignedTx(
          account,
          unsignedTransaction,
          txInfo
        );

        const operation = buildOptimisticOperation(account, transaction, fee);

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

export default signOperation;
