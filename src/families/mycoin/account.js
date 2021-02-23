// @flow
import invariant from "invariant";
import { BigNumber } from "bignumber.js";
import type { Account, Operation, Unit } from "../../types";
import { getAccountUnit } from "../../account";
import { formatCurrencyUnit } from "../../currencies";

function formatAccountSpecifics(account: Account): string {
  const { myCoinResources } = account;
  invariant(myCoinResources, "mycoin account expected");
  const unit = getAccountUnit(account);
  const formatConfig = {
    disableRounding: true,
    alwaysShowSign: false,
    showCode: true,
  };

  let str = " ";

  str +=
    formatCurrencyUnit(unit, account.spendableBalance, formatConfig) +
    " spendable. ";

  if (myCoinResources.additionalBalance.gt(0)) {
    str +=
      formatCurrencyUnit(
        unit,
        myCoinResources.additionalBalance,
        formatConfig
      ) + " additional. ";
  }

  if (myCoinResources.nonce) {
    str += "\nonce : " + myCoinResources.nonce;
  }

  return str;
}

function formatOperationSpecifics(op: Operation, unit: ?Unit): string {
  const { additionalField } = op.extra;

  let str = " ";

  const formatConfig = {
    disableRounding: true,
    alwaysShowSign: false,
    showCode: true,
  };

  str +=
    additionalField && !additionalField.isNaN()
      ? `\n    additionalField: ${
          unit
            ? formatCurrencyUnit(unit, additionalField, formatConfig)
            : additionalField
        }`
      : "";

  return str;
}

export function fromOperationExtraRaw(extra: ?Object) {
  if (extra && extra.additionalField) {
    extra = {
      ...extra,
      additionalField: BigNumber(extra.additionalField),
    };
  }
  return extra;
}

export function toOperationExtraRaw(extra: ?Object) {
  if (extra && extra.additionalField) {
    extra = {
      ...extra,
      additionalField: extra.additionalField.toString(),
    };
  }
  return extra;
}

export default {
  formatAccountSpecifics,
  formatOperationSpecifics,
  fromOperationExtraRaw,
  toOperationExtraRaw,
};
