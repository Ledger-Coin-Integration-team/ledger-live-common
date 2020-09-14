// @flow

import network from "../network";
import { BigNumber } from "bignumber.js";
import { getEnv } from "../env";

const getBaseApiUrl = () => getEnv("API_POLKADOT_INDEXER");

async function networkFetch(url: string) {
  const { data } = await network({
    method: "GET",
    url,
  });

  return data;
}

export const rpcToNode = (method: string, params: any[] = []): Promise<any> => {
  return fetch("http://localhost:9933", {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method,
      params,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  })
    .then((response) => response.json())
    .then(({ error, result }) => {
      if (error) {
        throw new Error(
          `${error.code} ${error.message}: ${JSON.stringify(error.data)}`
        );
      }

      return result;
    });
};

export const getBalances = async (addr: string) => {
  const url = `${getBaseApiUrl()}/polkadot/api/v1/account/${addr}`;

  try {
    const { data } = await networkFetch(url);

    return {
      balance: BigNumber(data.attributes.balance_total),
      spendableBalance: BigNumber(data.attributes.balance_free),
      // delegated: data.attributes.balance_reserved,
      polkadotResources: { nonce: data.attributes.nonce },
    };
  } catch (e) {
    return {
      balance: BigNumber(0),
      spendableBalance: BigNumber(0),
      polkadotResources: { nonce: 0 },
    };
  }
};

// Only get the first 100 operations,
// we probably are going to change indexer because this one missing some important information like date
// It's just a semi-mock to be able to go forward on the code
export const getTransfers = async (accountId: string, addr: string) => {
  const page = 1;
  let operations = [];

  let url = `${getBaseApiUrl()}/polkadot/api/v1/balances/transfer?filter[address]=${addr}&page[number]=${page}&page[size]=100`;
  try {
    let data = await networkFetch(url);

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

export const nodeBroadcastTx = async (signature: string) => {
  const res = await rpcToNode('author_submitExtrinsic', [signature]);

  console.log("broadcast", res);

  return res;
}