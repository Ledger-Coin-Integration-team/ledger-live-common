// @flow
import { BigNumber } from "bignumber.js";
import querystring from "querystring";

import { getEnv } from "../../../env";
import network from "../../../network";

import type {
  PolkadotValidator,
  PolkadotStakingProgress,
} from "../../../families/polkadot/types";

/**
 * get base url
 */
const getBaseSidecarUrl = () => getEnv("API_POLKADOT_SIDECAR");

/**
 *
 * @param {*} route
 */
const getSidecarUrl = (route) => `${getBaseSidecarUrl()}${route || ""}`;

const VALIDATOR_COMISSION_RATIO = 1000000000;

/**
 * fetchBalance from the api
 * @param {string} addr
 */
const fetchBalanceInfo = async (addr: string) => {
  const { data } = await network({
    method: "GET",
    url: getSidecarUrl(`/accounts/${addr}/balance-info`),
  });

  return data;
};

/**
 * @param {string} addr
 */
const fetchStashAddr = async (addr: string) => {
  const { data } = await network({
    method: "GET",
    url: getSidecarUrl(`/pallets/staking/storage/ledger?key1=${addr}`),
  });

  return data.value?.stash;
};

/**
 * @param {string} addr
 */
const fetchControllerAddr = async (addr: string) => {
  const { data } = await network({
    method: "GET",
    url: getSidecarUrl(`/pallets/staking/storage/bonded?key1=${addr}`),
  });

  return data.value;
};

/**
 * @param {string} addr
 */
const fetchStakingInfo = async (addr: string) => {
  const { data } = await network({
    method: "GET",
    url: getSidecarUrl(`/accounts/${addr}/staking-info`),
  });

  return data;
};

/**
 * @param {string} addr
 */
const fetchNominations = async (addr: string) => {
  const { data } = await network({
    method: "GET",
    url: getSidecarUrl(`/accounts/${addr}/nominations`),
  });

  return data;
};

const fetchConstants = async () => {
  const { data } = await network({
    method: "GET",
    url: getSidecarUrl(`/runtime/constants`),
  });

  return data.consts;
};

const fetchActiveEra = async () => {
  const { data } = await network({
    method: "GET",
    url: getSidecarUrl("/pallets/staking/storage/activeEra"),
  });

  return data;
};

/**
 *
 * @param {string} status
 * @param {string[]} addresses
 */
const fetchValidators = async (
  status: string = "all",
  addresses?: string[]
) => {
  let params = {};

  if (status) {
    params = { ...params, status };
  }

  if (addresses && addresses.length) {
    params = { ...params, addresses: addresses.join(",") };
  }

  const { data } = await network({
    method: "GET",
    url: getSidecarUrl(`/validators?${querystring.stringify(params)}`),
  });

  return data;
};

const fetchStakingProgress = async () => {
  const { data } = await network({
    method: "GET",
    url: getSidecarUrl("/pallets/staking/progress"),
  });

  return data;
};

// Not relevant when not using websocket
export const disconnect = () => {};

/**
 * Returns true if ElectionStatus is Close. If ElectionStatus is Open, some features must be disabled.
 */
export const isElectionClosed = async (): Promise<boolean> => {
  const progress = await fetchStakingProgress();

  return !progress.electionStatus?.status?.Open;
};

/**
 * Returns true if the address is a new account with no balance
 *
 * @param {*} addr
 */
export const isNewAccount = async (addr: string): Promise<boolean> => {
  const { nonce, free } = await fetchBalanceInfo(addr);

  return BigNumber(0).isEqualTo(nonce) && BigNumber(0).isEqualTo(free);
};

/**
 * Returns true if the address is a new account with no balance
 *
 * @param {*} addr
 */
export const isControllerAddress = async (addr: string): Promise<boolean> => {
  const stash = await fetchStashAddr(addr);

  return !!stash;
};

/**
 * Returns all addresses that are not validators
 */
export const verifyValidatorAddresses = async (
  validators: string[]
): Promise<string[]> => {
  const existingValidators = await fetchValidators("all", validators);
  const existingIds = existingValidators.map((v) => v.accountId);

  return validators.filter((v) => !existingIds.includes(v));
};

/**
 * Get all account-related data
 *
 * @param {*} addr
 */
export const getAccount = async (addr: string) => {
  const balances = await getBalances(addr);
  const stakingInfo = await getStakingInfo(addr);
  const nominations = await getNominations(addr);

  return {
    ...balances,
    ...stakingInfo,
    nominations,
  };
};

/**
 * Returns all the balances for an account
 *
 * @param {*} addr - the account address
 */
const getBalances = async (addr: string) => {
  const balanceInfo = await fetchBalanceInfo(addr);

  // Locked is the highest value among locks
  const totalLocked = balanceInfo.locks.reduce((total, lock) => {
    const amount = BigNumber(lock.amount);
    if (amount.gt(total)) {
      return amount;
    }
    return total;
  }, BigNumber(0));

  const balance = BigNumber(balanceInfo.free);
  const spendableBalance = totalLocked.gt(balance)
    ? BigNumber(0)
    : balance.minus(totalLocked);

  return {
    blockHeight: balanceInfo.at?.height ? Number(balanceInfo.at.height) : null,
    balance,
    spendableBalance,
    nonce: Number(balanceInfo.nonce),
    lockedBalance: BigNumber(balanceInfo.miscFrozen),
  };
};

/**
 * Returns all staking-related data for an account
 *
 * @param {*} addr
 */
export const getStakingInfo = async (addr: string) => {
  const [stash, controller] = await Promise.all([
    fetchStashAddr(addr),
    fetchControllerAddr(addr),
  ]);

  // If account is not a stash, no need to fetch staking-info (it would return an error)
  if (!controller) {
    return {
      controller: null,
      stash: stash || null,
      unlockedBalance: BigNumber(0),
      unlockingBalance: BigNumber(0),
      unlockings: [],
    };
  }

  const [stakingInfo, activeEra, consts] = await Promise.all([
    fetchStakingInfo(addr),
    fetchActiveEra(),
    fetchConstants(),
  ]);

  const activeEraIndex = Number(activeEra.value.index);
  const activeEraStart = Number(activeEra.value.start);

  const blockTime = BigNumber(consts?.babe?.expectedBlockTime || 6000); // 6000 ms
  const epochDuration = BigNumber(consts?.babe?.epochDuration || 2400); // 2400 blocks
  const sessionsPerEra = BigNumber(consts?.staking?.sessionsPerEra || 6); // 6 sessions
  const eraLength = sessionsPerEra
    .multipliedBy(epochDuration)
    .multipliedBy(blockTime)
    .toNumber();

  const unlockings = stakingInfo?.staking.unlocking
    ? stakingInfo.staking.unlocking.map((lock) => ({
        amount: BigNumber(lock.value),
        completionDate: new Date(
          activeEraStart + (lock.era - activeEraIndex) * eraLength
        ), // This is an estimation of the date of completion, since it depends on block validation speed
      }))
    : [];

  const now = new Date();
  const unlocked = unlockings.filter((lock) => lock.completionDate <= now);
  const unlockingBalance = unlockings.reduce(
    (sum, lock) => sum.plus(lock.amount),
    BigNumber(0)
  );
  const unlockedBalance = unlocked.reduce(
    (sum, lock) => sum.plus(lock.amount),
    BigNumber(0)
  );

  return {
    controller: controller || null,
    stash: stash || null,
    unlockedBalance,
    unlockingBalance,
    unlockings,
  };
};

/**
 * Returns nominations for an account including validator address, status and associated stake.
 *
 * @param {*} addr
 */
export const getNominations = async (addr: string) => {
  const nominations = await fetchNominations(addr);

  if (!nominations) return [];

  return nominations.targets.map((nomination) => ({
    address: nomination.address,
    value: BigNumber(nomination.value || 0),
    status: nomination.status,
  }));
};

/**
 * Returns all the params from the chain to build an extrinsic (a transaction on Substrate)
 */
export const getTransactionParams = async () => {
  const { data } = await network({
    method: "GET",
    url: getSidecarUrl("/transaction/material"),
  });

  return {
    blockHash: data.at.hash,
    blockNumber: data.at.height,
    chainName: data.chainName,
    genesisHash: data.genesisHash,
    specName: data.specName,
    transactionVersion: data.txVersion,
    specVersion: data.specVersion,
    metadataRpc: data.metadata,
  };
};

/**
 * Broadcast the transaction to the substrate node
 *
 * @param {string} extrinsic - the encoded extrinsic to send
 */
export const submitExtrinsic = async (extrinsic: string) => {
  const { data } = await network({
    method: "POST",
    url: getSidecarUrl("/transaction"),
    data: {
      tx: extrinsic,
    },
  });
  return data.hash;
};

/**
 * Retrieve the transaction fees and weights
 * Note: fees on Substrate are not set by the signer, but directly by the blockchain runtime.
 *
 * @param {string} extrinsic - the encoded extrinsic to send with a fake signing
 */
export const paymentInfo = async (extrinsic: string) => {
  const { data } = await network({
    method: "POST",
    url: getSidecarUrl("/transaction/fee-estimate"),
    data: {
      tx: extrinsic,
    },
  });

  return data;
};

/**
 * List all validators for the current era, and their exposure, and identity.
 */
export const getValidators = async (
  stashes: string | string[] = "elected"
): Promise<PolkadotValidator> => {
  let validators;

  if (Array.isArray(stashes)) {
    validators = await fetchValidators("all", stashes);
  } else {
    validators = await fetchValidators(stashes);
  }

  return validators.map((v) => ({
    address: v.accountId,
    identity: v.identity
      ? [v.identity.displayParent, v.identity.display]
          .filter(Boolean)
          .join(" - ")
          .trim()
      : "",
    nominatorsCount: Number(v.nominatorsCount),
    rewardPoints: v.rewardPoints ? BigNumber(v.rewardPoints) : null,
    commission: BigNumber(v.commission).dividedBy(VALIDATOR_COMISSION_RATIO),
    totalBonded: BigNumber(v.total),
    selfBonded: BigNumber(v.own),
    isElected: v.isElected,
    isOversubscribed: v.isOversubscribed,
  }));
};

/**
 * Get Active Era progress
 */
export const getStakingProgress = async (): Promise<PolkadotStakingProgress> => {
  const progress = await fetchStakingProgress();

  return {
    activeEra: Number(progress.activeEra),
    electionClosed: !progress.electionStatus?.status?.Open,
  };
};
