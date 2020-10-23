// @flow
import uniqBy from "lodash/uniqBy";
import type { Operation } from "../types";

import network from "../network";
import { BigNumber } from "bignumber.js";
import { getEnv } from "../env";
import { WsProvider, ApiPromise } from "@polkadot/api";
import { encodeAddress } from "@polkadot/util-crypto";
import type { PolkadotValidator } from "../families/polkadot/types";

type AsyncApiFunction = (api: typeof ApiPromise) => Promise<any>;

const getBaseApiUrl = () => getEnv("API_POLKADOT_INDEXER");
const getWsUrl = () => getEnv("API_POLKADOT_NODE");
const SUBSCAN_MULTIPLIER = 10000000000;
const SUBSCAN_ROW = 100;

/**
 * Connects to Substrate Node, executes calls then disconnects
 *
 * @param {*} execute - the calls to execute on api
 */
async function withApi(execute: AsyncApiFunction): Promise<any> {
  const wsProvider = new WsProvider(getWsUrl());
  const api = await ApiPromise.create({ provider: wsProvider });

  try {
    await api.isReady;
    const res = await execute(api);

    return res;
  } finally {
    await api.disconnect();
  }
}

/**
 * Returns true if ElectionStatus is Close. If ElectionStatus is Open, some features must be disabled.
 */
export const isElectionClosed = async () =>
  withApi(async (api: typeof ApiPromise) => {
    const status = await api.query.staking.eraElectionStatus();

    const res = status.isClose;

    return !!res;
  });

/**
 * WIP - Returns all the balances for an account
 *
 * @param {*} addr - the account address
 */
export const getBalances = async (addr: string) =>
  withApi(async (api: typeof ApiPromise) => {
    const [allBalances, unbondings, bonded] = await Promise.all([
      api.derive.balances.all(addr),
      api.query.staking.ledger(addr),
      api.query.staking.bonded(addr),
    ]);
    const json = JSON.parse(JSON.stringify(allBalances, null, 2));

    const unbondJson = JSON.parse(JSON.stringify(unbondings, null, 2));
    const stash = unbondJson ? unbondJson.stash : null;
    const controller = bonded.isSome ? bonded.unwrap().toString() : null;

    return {
      balance: BigNumber(json.freeBalance),
      spendableBalance: BigNumber(json.availableBalance),
      polkadotResources: {
        controller,
        stash,
        nonce: json.accountNonce,
        bondedBalance: BigNumber(json.lockedBalance),
        unbondings: unbondJson
          ? unbondJson.unlocking.map((unbond) => ({
              amount: BigNumber(unbond.value),
              completionDate: new Date(),
            }))
          : [], // TODO
        nominations: [], // TODO
      },
    };
  });

/**
 * Returns all the params from the chain to build an extrinsic (a transaction on Substrate)
 */
export const getTransactionParams = async () =>
  withApi(async (api: typeof ApiPromise) => {
    const chainName = await api.rpc.system.chain();
    const blockHash = await api.rpc.chain.getFinalizedHead();
    const genesisHash = await api.rpc.chain.getBlockHash(0);
    const { number } = await api.rpc.chain.getHeader(blockHash);
    const metadataRpc = await api.rpc.state.getMetadata(blockHash);
    const {
      specName,
      specVersion,
      transactionVersion,
    } = await api.rpc.state.getRuntimeVersion(blockHash);

    return {
      blockHash,
      blockNumber: number,
      genesisHash,
      chainName: chainName.toString(),
      specName: specName.toString(),
      specVersion,
      transactionVersion,
      metadataRpc,
    };
  });

/**
 * The broadcast function on Substrate
 *
 * @param {string} extrinsic - the encoded extrinsic to send
 */
export const submitExtrinsic = async (extrinsic: string) =>
  withApi(async (api: typeof ApiPromise) => {
    const tx = api.tx(extrinsic);
    const hash = await api.rpc.author.submitExtrinsic(tx);

    console.log("broadcast", hash);

    return hash;
  });

/**
 * Retrieve the transaction fees and weights
 * Note: fees on Substrate are not set by the signer, but directly by the blockchain runtime.
 *
 * @param {string} extrinsic - the encoded extrinsic to send with a fake signing
 */
export const paymentInfo = async (extrinsic: string) =>
  withApi(async (api: typeof ApiPromise) => {
    const info = await api.rpc.payment.queryInfo(extrinsic);

    console.log("paymentInfo", info);

    return info;
  });

/*
 * EXPLORER/INDEXER FEATURES
 */

const DOT_REDOMINATION_BLOCK = 1248328;

const subscanAmountToPlanck = (amount, blockHeight) => {
  if (blockHeight >= DOT_REDOMINATION_BLOCK) {
    return BigNumber(amount).multipliedBy(SUBSCAN_MULTIPLIER);
  }
  return BigNumber(amount).multipliedBy(100).multipliedBy(SUBSCAN_MULTIPLIER);
};

const mapSubscanReward = ({ accountId }, reward): $Shape<Operation> => {
  const type = reward.event_id === "Reward" ? "REWARD" : "SLASH";
  const hash = reward.extrinsic_hash || reward.event_index; // Slashes are not extrinsics

  return {
    id: `${accountId}-${hash}-${type}`,
    accountId,
    fee: BigNumber(0),
    value: BigNumber(reward.amount),
    type,
    hash: reward.extrinsic_hash,
    blockHeight: reward.block_num,
    date: new Date(reward.block_timestamp * 1000),
    extra: {
      module: reward.module_id,
    },
  };
};

const mapSubscanTransfer = (
  { addr, accountId },
  transfer
): $Shape<Operation> | null => {
  const type = transfer.from === addr ? "OUT" : "IN";

  return {
    id: `${accountId}-${transfer.hash}-${type}`,
    accountId,
    fee: BigNumber(transfer.fee),
    value: !transfer.success
      ? BigNumber(0)
      : subscanAmountToPlanck(transfer.amount, transfer.block_num),
    type,
    hash: transfer.hash,
    blockHeight: transfer.block_num,
    date: new Date(transfer.block_timestamp * 1000),
    extra: {
      module: transfer.module,
    },
    senders: [transfer.from],
    recipients: [transfer.to],
    hasFailed: !transfer.success,
  };
};

const getOperationType = (pallet, palletMethod) => {
  switch (palletMethod) {
    case "transfer":
    case "transfer_keep_alive":
      return "OUT";

    case "bond_extra":
    case "bond":
      return "FREEZE";

    case "unbond":
      return "UNFREEZE";

    case "nominate":
      return "DELEGATE";

    case "chill":
    case "payout_stakers":
      return "FEES";

    default:
      console.warn(`Unhandled operation type ${pallet}.${palletMethod}`);
      return "FEES";
  }
};

const mapSubscanExtrinsic = (
  { addr, accountId },
  extrinsic
): $Shape<Operation> => {
  const type = getOperationType(
    extrinsic.call_module,
    extrinsic.call_module_function
  );

  // FIXME subscan plz
  const recipient =
    extrinsic.destination &&
    encodeAddress("0x" + extrinsic.destination, /* SS58FORMAT= */ 0);

  // All successful transfers, but not self transfers (which only burn fees)
  const value =
    type === "OUT" && extrinsic.success && recipient !== addr
      ? subscanAmountToPlanck(extrinsic.amount, extrinsic.block_num).plus(
          extrinsic.fee
        )
      : BigNumber(extrinsic.fee);

  return {
    id: `${accountId}-${extrinsic.extrinsic_hash}-${type}`,
    accountId,
    fee: BigNumber(extrinsic.fee),
    value,
    type,
    hash: extrinsic.extrinsic_hash,
    blockHeight: extrinsic.block_num,
    date: new Date(extrinsic.block_timestamp * 1000),
    senders: recipient ? [addr] : undefined,
    recipients: recipient ? [recipient] : undefined,
    extra: {
      module: extrinsic.call_module,
      function: extrinsic.call_module_function,
    },
    hasFailed: !extrinsic.success,
  };
};

const fetchSubscanList = async (
  resourceName,
  url,
  mapFn,
  mapArgs,
  startAt,
  page = 0,
  prevOperations = []
) => {
  let operations;

  if (prevOperations.length) {
    const oldestBlockHeight =
      prevOperations[prevOperations.length - 1].blockHeight;

    if (oldestBlockHeight < startAt) {
      return prevOperations.filter((o) => o.blockHeight >= startAt);
    }
  }

  try {
    const { data } = await network({
      method: "POST",
      url: `${getBaseApiUrl()}${url}`,
      data: {
        address: mapArgs.addr,
        row: SUBSCAN_ROW,
        page,
      },
    });

    if (data.code !== 0) {
      throw new Error(`SUBSCAN: ${data.message} - code ${data.code}`);
    }
    const list = data.data[resourceName] || [];
    const count = data.data.count;

    // console.log(`${url} - ${prevOperations.length} / ${count}`);

    operations = [...prevOperations, ...list.map(mapFn.bind(null, mapArgs))];

    return operations.length < count
      ? fetchSubscanList(
          resourceName,
          url,
          mapFn,
          mapArgs,
          startAt,
          page + 1,
          operations
        )
      : operations;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const getOperations = async (
  accountId: string,
  addr: string,
  startAt: number = 0
) => {
  const mapArgs = { addr, accountId };
  const [extrinsicsOp, transfersOp, rewardsOp] = await Promise.all([
    fetchSubscanList(
      "extrinsics",
      "/api/scan/extrinsics",
      mapSubscanExtrinsic,
      mapArgs,
      startAt
    ),
    fetchSubscanList(
      "transfers",
      "/api/scan/transfers",
      mapSubscanTransfer,
      mapArgs,
      startAt
    ),
    fetchSubscanList(
      "list",
      "/api/scan/account/reward_slash",
      mapSubscanReward,
      mapArgs,
      startAt
    ),
  ]);

  const incomingTransfers = transfersOp.filter((t) => t.type === "IN");

  const operations = uniqBy<Operation>(
    [...extrinsicsOp, ...incomingTransfers, ...rewardsOp],
    (op) => op.id
  );

  operations.sort((a, b) => b.date - a.date);

  return operations;
};

const SUBSCAN_VALIDATOR_OVERSUBSCRIBED = 256;
const SUBSCAN_VALIDATOR_COMISSION_RATIO = 1000000000;

const mapSubscanValidator = (validator, isElected): PolkadotValidator => {
  return {
    address: validator.stash_account_display.address,
    identity: validator.stash_account_display.display,
    nominatorsCount: validator.count_nominators,
    rewardPoints: validator.reward_point,
    commission: BigNumber(validator.validator_prefs_value).dividedBy(
      SUBSCAN_VALIDATOR_COMISSION_RATIO
    ),
    totalBonded: BigNumber(validator.bonded_nominators).plus(
      validator.bonded_owner
    ),
    selfBonded: BigNumber(validator.bonded_owner),
    isElected,
    isOversubscribed:
      validator.count_nominators >= SUBSCAN_VALIDATOR_OVERSUBSCRIBED,
  };
};

const fetchSubscanValidators = async (isElected) => {
  // Cannot fetch both at the same time through subscan
  const url = isElected
    ? "/api/scan/staking/validators"
    : "/api/scan/staking/waiting";

  try {
    const { data } = await network({
      method: "POST",
      url: `${getBaseApiUrl()}${url}`,
      data: {},
    });

    if (data.code !== 0) {
      throw new Error(`SUBSCAN: ${data.message} - code ${data.code}`);
    }
    const validators = data.data.list.map((v) =>
      mapSubscanValidator(v, isElected)
    );

    return validators;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

/**
 * List all validators for the current era, and their exposure.
 */
export const getValidators = async (status: string = "elected") => {
  if (status === "elected") {
    return fetchSubscanValidators(true);
  } else if (status === "waiting") {
    return fetchSubscanValidators(false);
  } else if (status === "all") {
    const [elected, waiting] = await Promise.all([
      fetchSubscanValidators(true),
      fetchSubscanValidators(false),
    ]);

    return [...elected, ...waiting];
  }

  return [];
};
