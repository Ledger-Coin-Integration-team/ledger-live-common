// @flow

import type { BigNumber } from "bignumber.js";
import type {
  TransactionCommon,
  TransactionCommonRaw,
} from "../../types/transaction";

export type PolkadotOperationMode = "send" | "bond" | "nominate" | "unbond"

export type RewardDestinationType = "Staked" | "Stash" | "Account" | "Controller"

export type CoreStatics = {};

export type CoreAccountSpecifics = {};

export type CoreOperationSpecifics = {};

export type CoreCurrencySpecifics = {};


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
  controller: ?string,
  stash: ?string,
  nonce: number,
  bondedBalance: BigNumber,
  unbondings: ?PolkadotUnbonding[],
  nominations: ?PolkadotNomination[],
|};

export type PolkadotResourcesRaw = {|
  controller: ?string,
  stash: ?string,
  nonce: number,
  bondedBalance: string,
  unbondings: ?PolkadotUnbondingRaw[],
  nominations: ?PolkadotNominationRaw[],
|};

export type Transaction = {|
  ...TransactionCommon,
  mode: string,
  family: "polkadot",
  fees: ?BigNumber,
  validators: ?string[],
  era: ?string,
  rewardDestination: ?string,
|};

export type TransactionRaw = {|
  ...TransactionCommonRaw,
  family: "polkadot",
  mode: string,
  fees: ?string,
  validators: ?string[],
  era: ?string,
  rewardDestination: ?string,
|};

export type PolkadotValidator = {|
  address: string,
  identity: string,
  nominatorsCount: number,
  rewardPoints: number,
  commission: BigNumber,
  totalBonded: BigNumber,
  selfBonded: BigNumber,
  isElected: boolean,
  isOversubscribed: boolean,
|};

export const reflect = (_declare: *) => {};