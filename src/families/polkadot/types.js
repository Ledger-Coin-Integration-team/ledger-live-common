// @flow

import type { BigNumber } from "bignumber.js";
import type {
  TransactionCommon,
  TransactionCommonRaw,
} from "../../types/transaction";

export type CoreStatics = {};

export type CoreAccountSpecifics = {};

export type CoreOperationSpecifics = {};

export type CoreCurrencySpecifics = {};

export type NetworkInfo = {|
  family: "polkadot",
|};

export type NetworkInfoRaw = {|
  family: "polkadot",
|};

export type Transaction = {|
  ...TransactionCommon,
  mode: string,
  family: "polkadot",
  networkInfo: ?NetworkInfo,
|};

export type TransactionRaw = {|
  ...TransactionCommonRaw,
  family: "polkadot",
  mode: string,
  networkInfo: ?NetworkInfoRaw,
|};

export const reflect = (_declare: *) => {};