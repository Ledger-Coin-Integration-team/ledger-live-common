// @flow

import type Transport from "@ledgerhq/hw-transport";
import type { Transaction } from "./types";
import type { Account } from "../../types";

import { methods } from "@substrate/txwrapper";
import { getTxInfo } from "../../api/Polkadot";

const buildTransaction = async (a: Account, t: Transaction, txInfo: any) => {
  const { txBaseInfo, txOptions } = txInfo;

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
      transaction = a.polkadotResources?.bondedBalance.gte(0)
        ? methods.staking.bondExtra(
            {
              maxAdditional: t.amount.toString(),
            },
            txBaseInfo,
            txOptions
          )
        : methods.staking.bond(
            {
              controller: a.freshAddress,
              value: t.amount.toString(),
              payee: "Stash",
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

    default:
      throw new Error("Unknown mode in transaction");
  }

  return transaction;
};

export default buildTransaction;
