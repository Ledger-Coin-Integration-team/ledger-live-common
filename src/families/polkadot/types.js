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
  fees: BigNumber,
|};

export type NetworkInfoRaw = {|
  family: "polkadot",
  fees: string,
|};

export type PolkadotNominationStatus = "active" | "inactive" | "waiting";

export type PolkadotNomination = {|
  address: string,
  pendingRewards: BigNumber,
  status: PolkadotNominationStatus,
|};

export type PolkadotNominationRaw = {|
  address: string,
  pendingRewards: string,
  status: PolkadotNominationStatus,
|};

export type PolkadotUnbonding = {|
  amount: BigNumber,
  completionDate: Date,
|};

export type PolkadotUnbondingRaw = {|
  amount: string,
  completionDate: Date,
|};

export type PolkadotResources = {|
  nonce: number,
  bondedBalance: BigNumber,
  unbondings: ?PolkadotUnbonding[],
  nominations: ?PolkadotNomination[],
|};

export type PolkadotResourcesRaw = {|
  nonce: number,
  bondedBalance: string,
  unbondings: ?PolkadotUnbondingRaw[],
  nominations: ?PolkadotNominationRaw[],
|};

export type Transaction = {|
  ...TransactionCommon,
  mode: string,
  family: "polkadot",
  networkInfo: ?NetworkInfo,
  validators: ?string[],
|};

export type TransactionRaw = {|
  ...TransactionCommonRaw,
  family: "polkadot",
  mode: string,
  networkInfo: ?NetworkInfoRaw,
  validators: ?string[],
|};

export type PolkadotValidator = {|
  address: string,
  identity: string,
  isOversubscribed: boolean,
  nominatorsCounts: number,
  rewardPoints: number,
  commission: number,
  totalBonded: BigNumber,
  selfBonded: BigNumber,
  isElected: boolean,
|};

export type PolkadotValidatorRaw = {|
  address: string,
  identity: string,
  isOversubscribed: boolean,
  nominatorsCounts: number,
  rewardPoints: number,
  commission: number,
  totalBonded: string,
  selfBonded: string,
  isElected: boolean,
|};

export const reflect = (_declare: *) => {};