// @flow

import type { BigNumber } from "bignumber.js";
import type {
  TransactionCommon,
  TransactionCommonRaw,
} from "../../types/transaction";

export type PolkadotOperationMode = "send" | "bond" | "nominate" | "unbond"

export type CoreStatics = {};

export type CoreAccountSpecifics = {};

export type CoreOperationSpecifics = {};

export type CoreCurrencySpecifics = {};

export type NetworkInfo = {|
  family: "polkadot",
  fees: BigNumber
|};

export type NetworkInfoRaw = {|
  family: "polkadot",
  fees: string
|};

export type PolkadotValidator = {|
  address: string,
  rewards: BigNumber,
  isElected: boolean,
|}

export type PolkadotValidatorRaw = {|
  address: string,
  rewards: BigNumber,
  isElected: boolean,
|}

export type PolkadotUnbondings = {|
  amount: BigNumber,
  completionDate: Date
|}

export type PolkadotResources = {|
  nonce: number,
  bondedBalance: BigNumber,
  unbondings: PolkadotUnbondings[],
  validators: PolkadotValidator,
|};

export type PolkadotResourcesRaw = {|
  nonce: number,
  bondedBalance: string,
  validators: ?PolkadotValidatorRaw;
|};

export type Transaction = {|
  ...TransactionCommon,
  mode: string,
  family: "polkadot",
  networkInfo: ?NetworkInfo,
  validators?: string[];
|};

export type TransactionRaw = {|
  ...TransactionCommonRaw,
  family: "polkadot",
  mode: string,
  networkInfo: ?NetworkInfoRaw,
  validators?: string[]
|};

export type PolkadotValidatorItem = {|
  validatorAddress: string,
  identity: string,
  isOversubscribed: boolean,
  nominatorCount: number,
  rewardsPoint: number,
  commission: number,
  totalBonded: BigNumber,
  selfBonded: BigNumber,
  status: "active" | "inactive" | "waiting"
|};

export type PolkadotValidatorItemRaw = {|
  validatorAddress: string,
  identity: string,
  isOversubscribed: boolean,
  nominatorCount: number,
  rewardsPoint: number,
  commission: number,
  totalBonded: string,
  selfBonded: string,
  status: "active" | "inactive" | "waiting"
|};

export const reflect = (_declare: *) => {};