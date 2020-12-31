// @flow
import { BigNumber } from "bignumber.js";
import { Observable } from "rxjs";
import { TypeRegistry } from "@polkadot/types";
import { u8aConcat } from "@polkadot/util";
import { FeeNotLoaded } from "@ledgerhq/errors";

import type { Transaction } from "./types";
import type { Account, Operation, SignOperationEvent } from "../../types";

import { open, close } from "../../hw";
import { encodeOperationId } from "../../operation";
import { Polkadot } from "./ledger-app/Polkadot";

import { buildTransaction } from "./js-buildTransaction";
import { calculateAmount, getNonce } from "./logic";

const MODE_TO_TYPE = {
  send: "OUT",
  bond: "BOND",
  unbond: "UNBOND",
  rebond: "BOND",
  withdrawUnbonded: "WITHDRAW_UNBONDED",
  nominate: "NOMINATE",
  chill: "CHILL",
  claimReward: "REWARD_PAYOUT",
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
  fee: BigNumber,
  nonce: number
): Operation => {
  const type = MODE_TO_TYPE[transaction.mode] ?? MODE_TO_TYPE.default;

  const value =
    type === "OUT" ? BigNumber(transaction.amount).plus(fee) : BigNumber(fee);

  const extra = getExtra(type, account, transaction);

  const operation: $Exact<Operation> = {
    id: encodeOperationId(account.id, "", type),
    hash: "",
    type,
    value,
    fee,
    blockHash: null,
    blockHeight: null,
    senders: [account.freshAddress],
    recipients: [transaction.recipient],
    accountId: account.id,
    transactionSequenceNumber: nonce,
    date: new Date(),
    extra,
  };

  return operation;
};

/**
 * Serialize a signed transaction in a format that can be submitted over the
 * Node RPC Interface from the signing payload and signature produced by the
 * remote signer.
 *
 * @param unsigned - The JSON representing the unsigned transaction.
 * @param signature - Signature of the signing payload produced by the remote signer.
 * @param registry - Registry used for constructing the payload.
 */
export const signExtrinsic = async (
  unsigned: Object,
  signature: any,
  registry: typeof TypeRegistry
) => {
  const extrinsic = registry.createType("Extrinsic", unsigned, {
    version: unsigned.version,
  });
  extrinsic.addSignature(unsigned.address, signature, unsigned);
  return extrinsic.toHex();
};

/**
 * Sign Extrinsic with a fake signature (for fees estimation).
 *
 * @param unsigned - The JSON representing the unsigned transaction.
 * @param registry - Registry used for constructing the payload.
 */
export const fakeSignExtrinsic = async (
  unsigned: Object,
  registry: typeof TypeRegistry
) => {
  const fakeSignature = u8aConcat(
    new Uint8Array([1]),
    new Uint8Array(64).fill(0x42)
  );
  return signExtrinsic(unsigned, fakeSignature, registry);
};

/**
 * Sign Transaction with Ledger hardware
 */
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

        if (!transaction.fees) {
          throw new FeeNotLoaded();
        }

        // Ensure amount is filled when useAllAmount
        const transactionToSign = {
          ...transaction,
          amount: calculateAmount({ a: account, t: transaction }),
        };

        const { unsigned, registry } = await buildTransaction(
          account,
          transactionToSign,
          true
        );

        const payload = registry
          .createType("ExtrinsicPayload", unsigned, {
            version: unsigned.version,
          })
          .toU8a({ method: true });

        // Sign by device
        const polkadot = new Polkadot(transport);
        const r = await polkadot.sign(account.freshAddressPath, payload);

        const signed = await signExtrinsic(unsigned, r.signature, registry);

        o.next({ type: "device-signature-granted" });

        const operation = buildOptimisticOperation(
          account,
          transactionToSign,
          transactionToSign.fees ?? BigNumber(0),
          getNonce(account)
        );

        o.next({
          type: "signed",
          signedOperation: {
            operation,
            signature: signed,
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
