// @flow

import type { Transaction } from "./types";
import type { Account } from "../../types";

import { methods } from "@substrate/txwrapper";
import { isStash } from "./logic";

const buildTransaction = async (a: Account, t: Transaction, txInfo: any) => {
  const { txBaseInfo, txOptions } = txInfo;
  const validator = t.validators ? t.validators[0] : null;

  let transaction;
  switch (t.mode) {
    case "send":
      transaction = methods.balances.transferKeepAlive(
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
      transaction = isStash(a)
        ? methods.staking.bondExtra(
            {
              maxAdditional: t.amount.toString(),
            },
            txBaseInfo,
            txOptions
          )
        : methods.staking.bond(
            {
              controller: t.recipient,
              value: t.amount.toString(),
              payee: t.rewardDestination,
            },
            txBaseInfo,
            txOptions
          );
      break;

    case "unbond":
      transaction = methods.staking.unbond(
        {
          value: t.amount.toString(),
        },
        txBaseInfo,
        txOptions
      );
      break;

    case "nominate":
      transaction = methods.staking.nominate(
        { targets: t.validators },
        txBaseInfo,
        txOptions
      );
      break;

    case "claimReward":
      transaction = methods.staking.payoutStakers(
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
