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
  const validator = t.validators ? t.validators[0] : null;

  let transaction;
  switch (t.mode) {
    case "send":
      transaction = transferKeepAlive(
        {
          dest: t.recipient,
          value: t.amount.toString(),
        },
        txInfo,
      );
      break;

    // still not sure about this rule should get more info about that
    case "bond":
      transaction = isFirstBond(a)
        ? bond(
            {
              controller: !!t.recipient ? t.recipient : a.freshAddress,
              value: t.amount.toString(),
              // The rewards destination. Can be "Stash", "Staked", "Controller" or "{ Account: accountId }"".
              payee: t.rewardDestination || "Stash",
            },
            txInfo,
          )
        : bondExtra(
            { maxAdditional: t.amount.toString() },
            txInfo,
          );
      break;

    case "unbond":
      transaction = unbond(
        { value: t.amount.toString() },
        txInfo
      );
      break;

    case "rebond":
      transaction = rebond(
        { value: t.amount.toNumber() },
        txInfo
      );
      break;

    case "withdrawUnbonded":
      transaction = withdrawUnbonded(
        { numSlashingSpans: 0},
        txInfo
      );
      break;

    case "nominate":
      transaction = nominate(
        { targets: t.validators },
        txInfo
      );
      break;

    case "chill":
      transaction = chill({}, txInfo);
      break;

    case "claimReward":
      transaction = payoutStakers(
        { validatorStash: validator, era: t.era },
        txInfo
      );
      break;

    default:
      throw new Error("Unknown mode in transaction");
  }

  return transaction;
};

export default buildTransaction;
