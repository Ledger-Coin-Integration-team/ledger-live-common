// @flow
import invariant from "invariant";
import type { Transaction, AccountLike } from "../../types";

const options = [
  {
    name: "mode",
    type: String,
    desc: "mode of transaction: send, deletage, undelegate",
  },
  {
    name: "fees",
    type: String,
    desc: "how much fees",
  },
  {
    name: "gasLimit",
    type: String,
    desc: "how much gasLimit. default is estimated with the recipient",
  },
];

function inferTransactions(
  transactions: Array<{ account: AccountLike, transaction: Transaction }>,
  opts: Object
): Transaction[] {
  return transactions.map(({ transaction }) => {
    invariant(transaction.family === "algorand", "algorand family");
    return {
      ...transaction,
    };
  });
}

export default {
  options,
  inferTransactions,
};
