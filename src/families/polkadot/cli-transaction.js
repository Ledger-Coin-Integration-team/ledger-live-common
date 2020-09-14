// @flow
import invariant from "invariant";
import flatMap from "lodash/flatMap";
import type { Transaction, AccountLike } from "../../types";

const options = [
  {
    name: "mode",
    type: String,
    desc: "mode of transaction: send, optIn, claimReward",
  },
  {
    name: "fees",
    type: String,
    desc: "how much fees",
  },
];

function inferTransactions(
  transactions: Array<{ account: AccountLike, transaction: Transaction }>,
  opts: Object,
  { inferAmount }: *
): Transaction[] {
  return flatMap(transactions, ({ transaction, account }) => {
    invariant(transaction.family === "polkadot", "polkadot family");

    if (account.type === "Account") {
      invariant(account.polkadotResources, "unactivated account");
    }

    return {
      ...transaction,
      family: "polkadot",
      fees: opts.fees ? inferAmount(account, opts.fees) : null,
      mode: opts.mode || "send",
    };
  });
}

export default {
  options,
  inferTransactions,
};
