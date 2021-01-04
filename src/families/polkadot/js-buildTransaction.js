// @flow

import { stringCamelCase } from "@polkadot/util";

import type { Transaction } from "./types";
import type { Account } from "../../types";

import { isFirstBond } from "./logic";
import { createDecoratedTxs } from "./registry";

const EXTRINSIC_VERSION = 4;

// Default values for tx parameters, if the user doesn't specify any
const DEFAULTS = {
  tip: 0,
  eraPeriod: 64,
};

/**
 * Serialize an unsigned transaction in a format that can be signed.
 *
 * @param unsigned - The JSON representing the unsigned transaction.
 * @param registry - Registry used for constructing the payload.
 */
export const createSerializedUnsignedTx = (unsigned: any, registry: any) => {
  const payload = registry.createType("ExtrinsicPayload", unsigned, {
    version: unsigned.version,
  });
  return payload.toU8a({ method: true });
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
export const createSerializedSignedTx = (
  unsigned: any,
  signature: any,
  registry: any
) => {
  const extrinsic = registry.createType(
    "Extrinsic",
    { method: unsigned.method },
    { version: unsigned.version }
  );
  extrinsic.addSignature(unsigned.address, signature, unsigned);
  return extrinsic.toHex();
};

/**
 * Helper function to construct an offline method.
 *
 * @param params - Parameters required to construct the transaction.
 * @param info - Registry and metadata used for constructing the method.
 */
const createTransactionPayload = (params: any, info: any) => {
  const { metadataRpc, registry } = info;
  const metadata = createDecoratedTxs(registry, metadataRpc);
  const methodFunction = metadata[params.pallet][params.name];
  const method = methodFunction(
    ...methodFunction.meta.args.map((arg) => {
      if (params.args[stringCamelCase(arg.name.toString())] === undefined) {
        throw new Error(
          `Method ${params.pallet}::${
            params.name
          } expects argument ${arg.toString()}, but got undefined`
        );
      }
      return params.args[stringCamelCase(arg.name.toString())];
    })
  ).toHex();

  return {
    address: info.address,
    blockHash: info.blockHash,
    blockNumber: registry.createType("BlockNumber", info.blockNumber).toHex(),
    era: registry
      .createType("ExtrinsicEra", {
        current: info.blockNumber,
        period: DEFAULTS.eraPeriod,
      })
      .toHex(),
    genesisHash: info.genesisHash,
    method,
    nonce: registry.createType("Compact<Index>", info.nonce).toHex(),
    signedExtensions: registry.signedExtensions,
    specVersion: registry.createType("u32", info.specVersion).toHex(),
    tip: registry
      .createType("Compact<Balance>", info.tip || DEFAULTS.tip)
      .toHex(),
    transactionVersion: registry
      .createType("u32", info.transactionVersion)
      .toHex(),
    version: EXTRINSIC_VERSION,
  };
};

export const buildTransaction = async (
  a: Account,
  t: Transaction,
  txInfo: any
) => {
  const validator = t.validators ? t.validators[0] : null;

  let transaction;
  switch (t.mode) {
    case "send":
      // Construct a balance transfer transaction offline.
      transaction = createTransactionPayload(
        {
          args: {
            dest: t.recipient,
            value: t.amount.toString(),
          },
          name: "transferKeepAlive",
          pallet: "balances",
        },
        txInfo
      );
      break;

    case "bond":
      transaction = isFirstBond(a)
        ? // Construct a transaction to bond funds and create a Stash account.
          createTransactionPayload(
            {
              pallet: "staking",
              name: "bond",
              args: {
                // Spec choice: we always set the account as both the stash and its controller
                controller: a.freshAddress,
                value: t.amount.toString(),
                // The rewards destination. Can be "Stash", "Staked", "Controller" or "{ Account: accountId }"".
                payee: t.rewardDestination || "Stash",
              },
            },
            txInfo
          )
        : // Add some extra amount from the stash's `free_balance` into the staking balance.
          // Can only be called when `EraElectionStatus` is `Closed`.
          createTransactionPayload(
            {
              pallet: "staking",
              name: "bondExtra",
              args: { maxAdditional: t.amount.toString() },
            },
            txInfo
          );
      break;

    case "unbond":
      // Construct a transaction to unbond funds from a Stash account.
      // Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
      transaction = createTransactionPayload(
        {
          pallet: "staking",
          name: "unbond",
          args: { value: t.amount.toString() },
        },
        txInfo
      );
      break;

    case "rebond":
      // Rebond a portion of the stash scheduled to be unlocked.
      // Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
      transaction = createTransactionPayload(
        {
          pallet: "staking",
          name: "rebond",
          args: { value: t.amount.toNumber() },
        },
        txInfo
      );
      break;

    case "withdrawUnbonded":
      // Remove any unbonded chunks from the `unbonding` queue from our management
      // Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
      transaction = createTransactionPayload(
        {
          pallet: "staking",
          name: "withdrawUnbonded",
          args: { numSlashingSpans: 0 },
        },
        txInfo
      );
      break;

    case "nominate":
      // Construct a transaction to nominate validators.
      // Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
      transaction = createTransactionPayload(
        {
          pallet: "staking",
          name: "nominate",
          args: { targets: t.validators },
        },
        txInfo
      );
      break;

    case "chill":
      // Declare the desire to cease validating or nominating. Does not unbond funds.
      // Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
      transaction = createTransactionPayload(
        {
          pallet: "staking",
          name: "chill",
          args: {},
        },
        txInfo
      );
      break;

    case "claimReward":
      // Pay out all the stakers behind a single validator for a single era.
      // Any account can call this function, even if it is not one of the stakers.
      // Can only be called when `EraElectionStatus` is `Closed`.
      transaction = createTransactionPayload(
        {
          pallet: "staking",
          name: "payoutStakers",
          args: { validatorStash: validator, era: t.era },
        },
        txInfo
      );
      break;

    default:
      throw new Error("Unknown mode in transaction");
  }

  return transaction;
};
