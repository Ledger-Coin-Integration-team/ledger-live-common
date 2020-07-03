// @flow
import invariant from "invariant";
import flatMap from "lodash/flatMap";
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
  opts: Object,
  { inferAmount }: *
): Transaction[] {
  return flatMap(transactions, ({ transaction, account }) => {
    invariant(transaction.family === "algorand", "algorand family");
    return {
      ...transaction,
      family: "algorand",
      fees: opts.fees ? inferAmount(account, opts.fees) : null,
      note: opts.note,
    };
  });
}

export default {
  options,
  inferTransactions,
};
