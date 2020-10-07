// @flow

import network from "../network";
import { BigNumber } from "bignumber.js";
import { getEnv } from "../env";
import { WsProvider, ApiPromise } from "@polkadot/api";
import { getRegistry } from "@substrate/txwrapper";
import type { Account } from "../types";

const getBaseApiUrl = () => getEnv("API_POLKADOT_INDEXER");
const getRpcUrl = () => getEnv("API_POLKADOT_NODE");

async function fetch(url: string) {
  const { data } = await network({
    method: "GET",
    url,
  });

  return data;
}

async function getApi() {
  const wsProvider = new WsProvider("ws://localhost:9944");
  const api = await ApiPromise.create({ provider: wsProvider });

  await api.isReady;
  return api;
}

const rpc = async (method: string, params: any[] = []): Promise<any> => {
  const {
    data: { result, error },
  } = await network({
    url: getRpcUrl(),
    method: "POST",
    data: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method,
      params,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (error) {
    throw new Error(
      `${error.code} ${error.message}: ${JSON.stringify(error.data)}`
    );
  }

  return result;
};

export const ApigetBalances = async (addr: string) => {
  const url = `${getBaseApiUrl()}/polkadot/api/v1/account/${addr}`;

  console.log("===== GET BALANCES");
  try {
    const { data } = await fetch(url);

    console.log(data);

    return {
      balance: BigNumber(data.attributes.balance_total || 0),
      spendableBalance: BigNumber(data.attributes.balance_free || 0),
      // delegated: data.attributes.balance_reserved,
      polkadotResources: { nonce: data.attributes.nonce || 0 },
    };
  } catch (e) {
    console.log(e);
    return {
      balance: BigNumber(0),
      spendableBalance: BigNumber(0),
      polkadotResources: { nonce: 0, controller: null },
    };
  }
};

export const getElectionStatus = async () => {
  const api = await getApi();

  const status = await api.query.staking.eraElectionStatus();

  const res = status.isClose;

  await api.disconnect();

  return res;
};

export const isAddressValid = async (addr: string) => {
  const api = await getApi();

  try {
    await api.query.balances.account(addr);
  } catch (error) {
    await api.disconnect();
    return false;
  }

  await api.disconnect();
  return true;
};

export const getBalances = async (addr: string) => {
  const api = await getApi();

  const [allBalances, unbondings, bonded] = await Promise.all([
    api.derive.balances.all(addr),
    api.query.staking.ledger(addr),
    api.query.staking.bonded(addr),
  ]);
  const json = JSON.parse(JSON.stringify(allBalances, null, 2));

  const unbondJson = JSON.parse(JSON.stringify(unbondings, null, 2));
  const stash = unbondJson ? unbondJson.stash : null;
  const controller = bonded.isSome ? bonded.unwrap().toString() : null;

  await api.disconnect();

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
};

// Only get the first 100 operations,
// we probably are going to change indexer because this one missing some important information like date
// It's just a semi-mock to be able to go forward on the code
export const getTransfers = async (accountId: string, addr: string) => {
  const page = 1;
  let operations = [];

  let url = `${getBaseApiUrl()}/polkadot/api/v1/balances/transfer?filter[address]=${addr}&page[number]=${page}&page[size]=100`;
  try {
    let data = await fetch(url);

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

/*
 * RPC calls
 */

export const getTransactionParams = async () => {
  const { block } = await rpc("chain_getBlock");
  const blockHash = await rpc("chain_getBlockHash");
  const genesisHash = await rpc("chain_getBlockHash", [0]);
  const metadataRpc = await rpc("state_getMetadata");
  const { specVersion, transactionVersion } = await rpc(
    "state_getRuntimeVersion"
  );

  return {
    blockHash,
    blockNumber: block.header.number,
    genesisHash,
    metadataRpc,
    specVersion,
    transactionVersion,
  };
};

export const getValidators = async () => {
  const api = await getApi();

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

  await api.disconnect();

  return formattedValidator;
};

export const submitExtrinsic = async (extrinsic: string) => {
  const res = await rpc("author_submitExtrinsic", [extrinsic]);

  console.log("broadcast", res);

  return res;
};

export const paymentInfo = async (extrinsic: string) => {
  const res = await rpc("payment_queryInfo", [extrinsic]);

  console.log("paymentInfo", res);

  return res;
};

const ERA_PERIOD = 64; // number of blocks from checkpoint that transaction is valid

const getNonce = (a: Account) => {
  return (a.polkadotResources?.nonce || 0) + a.pendingOperations.length;
};

export const getTxInfo = async (a: Account) => {
  const {
    blockHash,
    blockNumber,
    genesisHash,
    metadataRpc,
    specVersion,
    transactionVersion,
  } = await getTransactionParams();

  const registry = getRegistry("Polkadot", "polkadot", specVersion);

  const txBaseInfo = {
    address: a.freshAddress,
    blockHash,
    blockNumber,
    genesisHash,
    metadataRpc,
    nonce: getNonce(a),
    specVersion,
    tip: 0,
    eraPeriod: ERA_PERIOD,
    transactionVersion,
  };

  const txOptions = {
    metadataRpc,
    registry,
  };

  return { txBaseInfo, txOptions };
};
