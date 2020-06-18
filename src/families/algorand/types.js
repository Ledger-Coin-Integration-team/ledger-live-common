// @flow

import type { BigNumber } from "bignumber.js";
import type {
  TransactionCommon,
  TransactionCommonRaw,
} from "../../types/transaction";

import type { Operation, OperationRaw } from "../../types/operation";
import type { CoreAmount, CoreBigInt, Spec } from "../../libcore/types";

export type CoreStatics = {
};

export type CoreAccountSpecifics = {
};

export type CoreOperationSpecifics = {
};

export type CoreCurrencySpecifics = {};

export type NetworkInfo = {|
  family: "algorand",
  fees: BigNumber,
|};

export type NetworkInfoRaw = {|
  family: "algorand",
  fees: string,
|};

export type Transaction = {|
  ...TransactionCommon,
  family: "algorand",
  networkInfo: ?NetworkInfo,
  fees: ?BigNumber,
|};

export type TransactionRaw = {|
  ...TransactionCommonRaw,
  family: "algorand",
  networkInfo: ?NetworkInfoRaw,
  fees: ?string,
|};


export const reflect = (declare: (string, Spec) => void) => {

  return {
    OperationMethods: {
    },
    AccountMethods: {
    },
  };
};
