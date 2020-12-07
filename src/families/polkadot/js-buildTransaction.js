// @flow

import type { Transaction } from "./types";
import type { Account } from "../../types";

import {
  transferKeepAlive,
  bond,
  bondExtra,
  unbond,
  rebond,
  withdrawUnbonded,
  nominate,
  chill,
  payoutStakers
} from "./transactions";
import { isFirstBond } from "./logic";

const buildTransaction = async (a: Account, t: Transaction, txInfo: any) => {
  const { txBaseInfo, txOptions } = txInfo;
  const validator = t.validators ? t.validators[0] : null;

  let transaction;
  switch (t.mode) {
    case "send":
      transaction = transferKeepAlive(
        {
          dest: t.recipient,
          value: t.amount.toString(),
        },
        txBaseInfo,
        txOptions
      );
      break;

    // still not sure about this rule should get more info about that
    case "bond":
      transaction = isFirstBond(a)
        ? bond(
            {
              controller: t.recipient,
              value: t.amount.toString(),
              // The rewards destination. Can be "Stash", "Staked", "Controller" or "{ Account: accountId }"".
              payee: t.rewardDestination || "Stash",
            },
            txBaseInfo,
            txOptions
          )
        : bondExtra(
            { maxAdditional: t.amount.toString() },
            txBaseInfo,
            txOptions
          );
      break;

    case "unbond":
      transaction = unbond(
        { value: t.amount.toString() },
        txBaseInfo,
        txOptions
      );
      break;

    case "rebond":
      transaction = rebond(
        { value: t.amount.toNumber() },
        txBaseInfo,
        txOptions
      );
      break;

    case "withdrawUnbonded":
      transaction = withdrawUnbonded(
        { numSlashingSpans: 0},
        txBaseInfo,
        txOptions
      );
      break;

    case "nominate":
      transaction = nominate(
        { targets: t.validators },
        txBaseInfo,
        txOptions
      );
      break;

    case "chill":
      transaction = chill({}, txBaseInfo, txOptions);
      break;

    case "claimReward":
      transaction = payoutStakers(
        { validatorStash: validator, era: t.era },
        txBaseInfo,
        txOptions
      );
      break;

    default:
      throw new Error("Unknown mode in transaction");
  }

  return transaction;
};

export default buildTransaction;
