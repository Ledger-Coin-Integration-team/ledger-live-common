// @flow
import { from, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { getValidators } from "../../api/Polkadot";
import invariant from "invariant";
import flatMap from "lodash/flatMap";
import type { Transaction, AccountLike } from "../../types";

const options = [
  {
    name: "mode",
    type: String,
    desc: "mode of transaction: send, nominate, bond, claimReward",
  },
  {
    name: "fees",
    type: String,
    desc: "how much fees",
  },
  {
    name: "validator",
    type: String,
    multiple: true,
    desc: "address of recipient validator that will receive the delegate",
  },
  {
    name: "era",
    type: String,
    desc: "Era of when to claim rewards",
  },
];

const polkadotValidatorsFormatters = {
  json: (list) => JSON.stringify(list),
  default: (list) => list.map((v) => `${v.validatorAddress}`).join("\n"),
};

const polkadotValidators = {
  args: [
    {
      name: "format",
      desc: Object.keys(polkadotValidatorsFormatters).join("|"),
      type: String,
    },
  ],
  job: ({ format }: $Shape<{ format: string }>): Observable<string> =>
    from(getValidators()).pipe(
      map((validators) => {
        const f =
          polkadotValidatorsFormatters[format] ||
          polkadotValidatorsFormatters.default;
        return f(validators);
      })
    ),
};

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

    const validators: string[] = opts["validator"] || [];

    return {
      ...transaction,
      family: "polkadot",
      fees: opts.fees ? inferAmount(account, opts.fees) : null,
      mode: opts.mode || "send",
      validators,
      era: opts.era || null,
    };
  });
}

export default {
  options,
  inferTransactions,
  commands: {
    polkadotValidators,
  },
};
