// @flow
import expect from "expect";
import invariant from "invariant";

import { BigNumber } from "bignumber.js";

import type { Transaction } from "../../families/cosmos/types";
import { getCryptoCurrencyById } from "../../currencies";
import { pickSiblings } from "../../bot/specs";
import type { AppSpec } from "../../bot/types";
import { toOperationRaw } from "../../account";

const POLKADOT_MIN_SAFE = BigNumber(1000000);

const polkadot: AppSpec<Transaction> = {
  name: "Polkadot",
  currency: getCryptoCurrencyById("polkadot"),
  appQuery: {
    model: "nanoS",
    appName: "Polkadot",
  },
  transactionCheck: ({ maxSpendable }) => {
    invariant(maxSpendable.gt(POLKADOT_MIN_SAFE), "balance is too low");
  },
  test: ({ operation, optimisticOperation }) => {
    const opExpected: Object = toOperationRaw({
      ...optimisticOperation,
    });
    delete opExpected.value;
    delete opExpected.fee;
    delete opExpected.date;
    delete opExpected.blockHash;
    delete opExpected.blockHeight;
    expect(toOperationRaw(operation)).toMatchObject(opExpected);
  },
  mutations: [
    {
      name: "send some",
      maxRun: 1,
      transaction: ({ account, siblings, bridge }) => {
        return {
          transaction: bridge.createTransaction(account),
          updates: [
            { recipient: pickSiblings(siblings, 1).freshAddress },
            {
              amount: BigNumber(10000),
            },
          ],
        };
      },
    },
    // {
    //   name: "send max",
    //   maxRun: 1,
    //   transaction: ({ account, siblings, bridge }) => {
    //     return {
    //       transaction: bridge.createTransaction(account),
    //       updates: [
    //         {
    //           recipient: pickSiblings(siblings, 30).freshAddress,
    //         },
    //         { useAllAmount: true },
    //       ],
    //     };
    //   },
    //   test: ({ account }) => {
    //     expect(account.spendableBalance.toString()).toBe("0");
    //   },
    // },
  ],
};

export default { polkadot };
