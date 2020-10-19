// @flow
import type { Operation } from "../types";

import network from "../network";
import { BigNumber } from "bignumber.js";
import { getEnv } from "../env";
import { WsProvider, ApiPromise } from "@polkadot/api";

type AsyncApiFunction = (api: typeof ApiPromise) => Promise<any>;

const getBaseApiUrl = () => getEnv("API_POLKADOT_INDEXER");
const getWsUrl = () => getEnv("API_POLKADOT_NODE");
const SUBSCAN_MULTIPLIER = 10000000000;
const ROW = 100;

const fetch = async ({ method, url, args }) => {
  const { data } = await network({
    method,
    url,
    data: args,
  });

  // TODO: Code error test
  const list = data.data.extrinsics || data.data.list || data.data.transfers;

  return { count: data.data.count, list: list || [] };
};

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
 * List all validators for the current era, and their exposure.
 */
export const getValidators = async () =>
  withApi(async (api: typeof ApiPromise) => {
    const validators = await api.query.session.validators();

    let formattedValidator = [];
    if (validators && validators.length > 0) {
      // Retrieve the balances for all validators
      const validatorBalances = await Promise.all(
        validators.map((authorityId) => ({
          balances: api.query.system.account(authorityId),
          bonded: api.query.staking.bonded(authorityId),
        }))
      );

      formattedValidator = validators.map((authorityId, index) => ({
        address: authorityId.toString(),
        balance: validatorBalances[index].balances.data.free.toHuman(),
        nonce: validatorBalances[index].balances.nonce.toHuman(),
        bonded: validatorBalances[index].bonded,
      }));
    }

    return formattedValidator;
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
    const paymentInfo = await api.rpc.payment.queryInfo(extrinsic);

    console.log("paymentInfo", paymentInfo);

    return paymentInfo;
  });

/*
 * EXPLORER/INDEXER FEATURES
 */

/**
 * WIP - Fetch all operations for an account from Polkascan.
 * Only get the first 100 operations,
 * we probably are going to change indexer because this one missing some important information like date
 * It's just a semi-mock to be able to go forward on the code
 *
 * @param {string} accountId - the internal identifier for account
 * @param {string} addr - the account address on Substrate
 */

export const getTransfers = async (accountId: string, addr: string) => {
  const page = 1;
  let operations = [];

  let url = `${getBaseApiUrl()}/polkadot/api/v1/balances/transfer?filter[address]=${addr}&page[number]=${page}&page[size]=100`;
  try {
    const { data } = await network({
      method: "GET",
      url,
    });

    operations = data.data.map((op) => {
      const type =
        op.attributes.event_id === "Reward"
          ? "IN"
          : op.attributes.sender.attributes.address === addr
          ? "OUT"
          : "IN";

      return {
        id: `${accountId}-${op.attributes.event_idx}-${type}`,
        accountId,
        type,
        value: BigNumber(op.attributes.value),
        hash: op.attributes.event_idx,
        fee: BigNumber(op.attributes.fee),
        senders: [op.attributes.sender.attributes.address],
        recipients: [op.attributes.destination.attributes.address],
        blockHeight: op.attributes.block_id,
        date: new Date(),
      };
    });
  } catch (e) {
    operations = [];
  }

  return operations;
};

const mapSubscanReward = ({ accountId }, reward): $Shape<Operation> => {
  return {
    id: `${accountId}-${reward.extrinsic_hash}-REWARD`,
    accountId,
    fee: BigNumber(0),
    value: BigNumber(reward.amount),
    type: "REWARD", // TODO: Slash
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
): $Shape<Operation> => {
  const type = transfer.from === addr ? "OUT" : "IN";

  return {
    id: `${accountId}-${transfer.hash}-${type}`,
    accountId,
    fee: BigNumber(transfer.fee),
    value: !transfer.success
      ? BigNumber(0)
      : type === "IN"
      ? BigNumber(transfer.amount).multipliedBy(SUBSCAN_MULTIPLIER)
      : BigNumber(transfer.amount)
          .multipliedBy(SUBSCAN_MULTIPLIER)
          .plus(transfer.fee),
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
      console.log("==========");
      console.log(pallet);
      console.log(palletMethod);
      console.log("===========");
      return "NONE";
  }
};

const mapSubscanExtrinsic = ({ accountId }, extrinsic): $Shape<Operation> => {
  if (extrinsic.call_module === "balances") {
    return {};
  }

  const type = getOperationType(
    extrinsic.call_module,
    extrinsic.call_module_function
  );

  return {
    id: `${accountId}-${extrinsic.extrinsic_hash}-${type}`,
    accountId,
    fee: BigNumber(extrinsic.fee),
    value: BigNumber(extrinsic.fee),
    type,
    hash: extrinsic.extrinsic_hash,
    blockHeight: extrinsic.block_num,
    date: new Date(extrinsic.block_timestamp * 1000),
    extra: {
      module: extrinsic.call_module,
      function: extrinsic.call_module_function,
    },
    hasFailed: !extrinsic.success,
  };
};

const fetchSubscanList = async (
  url,
  mapFn,
  mapArgs,
  page = 0,
  prevOperations = []
) => {
  let operations;
  try {
    const { count, list } = await fetch({
      method: "POST",
      url,
      args: {
        address: mapArgs.addr,
        row: ROW,
        page,
      },
    });

    console.log(url);
    console.log(`${prevOperations.length} / ${count}`);

    operations = [...prevOperations, ...list.map(mapFn.bind(null, mapArgs))];

    console.log(operations.length);
    return operations.length < count
      ? fetchSubscanList(url, mapFn, mapArgs, page + 1, operations)
      : operations;
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }
};

export const getOperations = async (accountId: string, addr: string) => {
  const mapArgs = { addr, accountId };
  const [extrinsicsOp, transfersOp, rewardsOp] = await Promise.all([
    fetchSubscanList(
      `${getBaseApiUrl()}/api/scan/extrinsics`,
      mapSubscanExtrinsic,
      mapArgs
    ),
    fetchSubscanList(
      `${getBaseApiUrl()}/api/scan/transfers`,
      mapSubscanTransfer,
      mapArgs
    ),
    fetchSubscanList(
      `${getBaseApiUrl()}/api/scan/account/reward_slash`,
      mapSubscanReward,
      mapArgs
    ),
  ]);

  const operations = [
    ...extrinsicsOp.filter((op) => op.id),
    ...transfersOp,
    ...rewardsOp,
  ];

  return operations.sort((a, b) => {
    b.date - a.date;
  });
};
