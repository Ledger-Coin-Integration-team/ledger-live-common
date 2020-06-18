// @flow
import { BigNumber } from "bignumber.js";
import type { Transaction, TransactionRaw } from "./types";
import {
  fromTransactionCommonRaw,
  toTransactionCommonRaw,
} from "../../transaction/common";
import type { Account } from "../../types";
import { getAccountUnit } from "../../account";
import { formatCurrencyUnit } from "../../currencies";

export const formatTransaction = (
  { amount, recipient, fees, useAllAmount }: Transaction,
  account: Account
): string =>
  `
    SEND ${
      useAllAmount
        ? "MAX"
        : formatCurrencyUnit(getAccountUnit(account), amount, {
            showCode: true,
            disableRounding: true,
          })
    }
    TO ${recipient}
    with fees=${
      !fees
        ? "?"
        : formatCurrencyUnit(getAccountUnit(account), fees, {
            showCode: true,
            disableRounding: true,
          })
    }`;

const fromTransactionRaw = (tr: TransactionRaw): Transaction => {
  const common = fromTransactionCommonRaw(tr);
  const { networkInfo } = tr;

  return {
    ...common,
    family: tr.family,
    fees: tr.fees ? BigNumber(tr.fees) : null,
    networkInfo: networkInfo
      ? {
          family: networkInfo.family,
          fees: BigNumber(networkInfo.fees),
        }
      : null,
  };
};

const toTransactionRaw = (t: Transaction): TransactionRaw => {
  const common = toTransactionCommonRaw(t);
  const { networkInfo } = t;
  return {
    ...common,
    family: t.family,
    fees: t.fees ? t.fees.toString() : null,
    networkInfo: networkInfo
      ? {
          family: networkInfo.family,
          fees: networkInfo.fees.toString(),
        }
      : null,
  };
};

export default { formatTransaction, fromTransactionRaw, toTransactionRaw };
