// @flow

import type { Transaction } from "./types";
import type { Account } from "../../types";

import { createTransactionPayload } from "./transactions";
import { isFirstBond } from "./logic";

const buildTransaction = async (a: Account, t: Transaction, txInfo: any) => {
  const validator = t.validators ? t.validators[0] : null;

  let transaction;
  switch (t.mode) {
    case "send":
      // Construct a balance transfer transaction offline.
      transaction = createTransactionPayload({
          args: {
            dest: t.recipient,
            value: t.amount.toString(),
          },
          name: 'transferKeepAlive',
          pallet: 'balances',
        }, txInfo);
      break;

    case "bond":
      transaction = isFirstBond(a)
        // Construct a transaction to bond funds and create a Stash account.
        ? createTransactionPayload({
            pallet: 'staking',
            name: 'bond',
            args: {
              controller: !!t.recipient ? t.recipient : a.freshAddress,
              value: t.amount.toString(),
              // The rewards destination. Can be "Stash", "Staked", "Controller" or "{ Account: accountId }"".
              payee: t.rewardDestination || "Stash",
            },
          }, txInfo)
        :
        // Add some extra amount from the stash's `free_balance` into the staking balance.
        // Can only be called when `EraElectionStatus` is `Closed`.
        createTransactionPayload({
            pallet: 'staking',
            name: 'bondExtra',
            args: { maxAdditional: t.amount.toString() },
          }, txInfo)
      break;

    case "unbond":
      // Construct a transaction to unbond funds from a Stash account.
      // Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
      transaction = createTransactionPayload({
          pallet: 'staking',
          name: 'unbond',
          args: { value: t.amount.toString() },
        }, txInfo);
      break;

    case "rebond":
      // Rebond a portion of the stash scheduled to be unlocked.
      // Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
      transaction = createTransactionPayload({
          pallet: 'staking',
          name: 'rebond',
          args: { value: t.amount.toNumber() },
        }, txInfo);
      break;

    case "withdrawUnbonded":
      // Remove any unbonded chunks from the `unbonding` queue from our management
      // Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
      transaction = createTransactionPayload({
          pallet: 'staking',
          name: 'withdrawUnbonded',
          args: { numSlashingSpans: 0},
        }, txInfo);
      break;

    case "nominate":
      // Construct a transaction to nominate validators.
      // Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
      transaction = createTransactionPayload({
          pallet: 'staking',
          name: 'nominate',
          args: { targets: t.validators },
        }, txInfo);
      break;

    case "chill":
      // Declare the desire to cease validating or nominating. Does not unbond funds.
      // Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
      transaction = createTransactionPayload({
          pallet: 'staking',
          name: 'chill',
          args: {},
        }, txInfo);
      break;

    case "claimReward":
      // Pay out all the stakers behind a single validator for a single era.
      // Any account can call this function, even if it is not one of the stakers.
      // Can only be called when `EraElectionStatus` is `Closed`.
      transaction = createTransactionPayload({
          pallet: 'staking',
          name: 'payoutStakers',
          args: { validatorStash: validator, era: t.era },
        }, txInfo);
      break;

    default:
      throw new Error("Unknown mode in transaction");
  }

  return transaction;
};

export default buildTransaction;
