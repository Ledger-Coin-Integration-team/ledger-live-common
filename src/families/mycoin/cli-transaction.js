// @flow
import invariant from "invariant";
import flatMap from "lodash/flatMap";
import type { Transaction, AccountLike } from "../../types";

const options = [
  {
    name: "mode",
    type: String,
    desc: "mode of transaction: send",
  },
];

function inferTransactions(
  transactions: Array<{ account: AccountLike, transaction: Transaction }>,
  opts: Object
): Transaction[] {
  return flatMap(transactions, ({ transaction, account }) => {
    invariant(transaction.family === "mycoin", "mycoin family");

    if (account.type === "Account") {
      invariant(account.myCoinResources, "unactivated account");
    }

    return {
      ...transaction,
      family: "mycoin",
      mode: opts.mode || "send",
    };
  });
}

export default {
  options,
  inferTransactions,
};
