// @flow
import { BigNumber } from "bignumber.js";
import network from "../../network";

const getSidecarUrl = () => "http://127.0.0.1:8080";

// Fetch data
const fetchStakingInfo = async (addr: string) => {
  try {
    const stakingInfoUrl = `${getSidecarUrl()}/accounts/${addr}/staking-info`;
    const { data } = await network({
      method: "GET",
      url: stakingInfoUrl,
    });

    return data;
  } catch (e) {
    return null;
  }
};

const fetchBalanceInfo = async (addr: string) => {
  const balanceUrl = `${getSidecarUrl()}/accounts/${addr}/balance-info`;
  const { data } = await network({
    method: "GET",
    url: balanceUrl,
  });

  return data;
};

export const getTransactionParams = async () => {
  const url = `${getSidecarUrl()}/transaction/material`;
  const { data } = await network({
    method: "GET",
    url,
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

export const paymentInfo = async (extrinsic: string) => {
  const url = `${getSidecarUrl()}/transaction/fee-estimate`;
  const { data } = await network({
    method: "POST",
    url,
    data: {
      tx: extrinsic,
    },
  });

  return data;
};

const getStakingInfo = async (addr: string) => {
  const fetchActiveEra = async () => {
    const { data } = await network({
      method: "GET",
      url: `${getSidecarUrl()}/pallets/staking/storage/activeEra `,
    });

    return data;
  };

  const [stakingInfo, activeEra] = await Promise.all([
    fetchStakingInfo(addr),
    fetchActiveEra(),
  ]);

  const activeEraIndex = Number(activeEra.value.index);
  const activeEraStart = Number(activeEra.value.start);

  // TODO : Apply real value
  const blockTime = 6000; // 6000 ms
  const epochDuration = 2400; // 2400 blocks
  const eraLength = 6 * blockTime * epochDuration;

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
    controller: stakingInfo?.staking.controller || null,
    stash: stakingInfo?.staking.stash || null,
    unlockedBalance,
    unlockingBalance,
    unlockings,
  };
};

/**
 * WIP - Returns all the balances for an account
 *
 * @param {*} addr - the account address
 */
const getBalances = async (addr: string) => {
  const balanceInfo = await fetchBalanceInfo(addr);

  return {
    balance: BigNumber(balanceInfo.free),
    spendableBalance: BigNumber(balanceInfo.free), // TODO: Need to find info on sidecar
    nonce: Number(balanceInfo.nonce),
    lockedBalance: BigNumber(balanceInfo.miscFrozen),
  };
};

export const getAccount = async (addr: string) => {
  const balances = await getBalances(addr);
  const stakingInfo = await getStakingInfo(addr);

  return {
    ...balances,
    ...stakingInfo,
  };
};

/**
 * Returns true if ElectionStatus is Close. If ElectionStatus is Open, some features must be disabled.
 */
export const isElectionClosed = async (): Promise<boolean> => {
  const fetchStakingProgress = async () => {
    const { data } = await network({
      method: "GET",
      url: `${getSidecarUrl()}/pallets/staking/progress`,
    });

    return data;
  };

  const stakingProgress = await fetchStakingProgress();
  const status = await stakingProgress.electionStatus.status.Close;

  console.log("STATUS");
  console.log(status);

  return status === null;
};

export const submitExtrinsic = async (extrinsic: string) => {
  const url = `${getSidecarUrl()}/transaction`;
  const { data } = await network({
    method: "POST",
    url,
    data: {
      tx: extrinsic,
    },
  });

  return data.hash;
};

export const isNewAccount = async (addr: string): Promise<boolean> => {
  const { nonce, free } = await fetchBalanceInfo(addr);

  return BigNumber(0).isEqualTo(nonce) && BigNumber(0).isEqualTo(free);
};

export const isControllerAddress = async (addr: string): Promise<boolean> => {
  const stakingInfo = await fetchStakingInfo(addr);

  return stakingInfo !== null;
};
