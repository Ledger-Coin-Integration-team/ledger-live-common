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

export type PolkadotNomination = {|
  address: string,
  pendingRewards: BigNumber,
  status: PolkadotValidatorStatus,
|}

export type PolkadotNominationRaw = {|
  address: string,
  pendingRewards: BigNumber,
  status: PolkadotValidatorStatus,
|}

export type PolkadotUnbonding = {|
  amount: BigNumber,
  completionDate: Date
|}

export type PolkadotResources = {|
  nonce: number,
  bondedBalance: BigNumber,
  unbondings: PolkadotUnbonding[],
  nominations: PolkadotNomination,
|};

export type PolkadotResourcesRaw = {|
  nonce: number,
  bondedBalance: string,
  unbondings: PolkadotUnbonding[],
  nominations: ?PolkadotNominationRaw;
|};

export type PolkadotValidatorStatus = "active" | "inactive" | "waiting";

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

export type PolkadotValidator = {|
  validatorAddress: string,
  identity: string,
  isOversubscribed: boolean,
  nominatorsCounts: number,
  rewardPoints: number,
  commission: number,
  totalBonded: BigNumber,
  selfBonded: BigNumber,
  status: PolkadotValidatorStatus
|};

export type PolkadotValidatorRaw = {|
  validatorAddress: string,
  identity: string,
  isOversubscribed: boolean,
  nominatorCount: number,
  rewardsPoint: number,
  commission: number,
  totalBonded: string,
  selfBonded: string,
  status: PolkadotValidatorStatus
|};

export const reflect = (_declare: *) => {};