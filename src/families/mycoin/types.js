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

export type MyCoinResources = {|
  nonce: number,
  additionalBalance: BigNumber,
|};

export type MyCoinResourcesRaw = {|
  nonce: number,
  additionalBalance: string,
|};

export type Transaction = {|
  ...TransactionCommon,
  mode: string,
  family: "mycoin",
  fees: ?BigNumber,
|};

export type TransactionRaw = {|
  ...TransactionCommonRaw,
  family: "mycoin",
  mode: string,
  fees: ?string,
|};

export type MyCoinPreloadData = {|
  somePreloadedData: Object,
|};

export const reflect = (_declare: *) => {};
