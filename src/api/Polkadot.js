import network from "../network";
import { BigNumber } from "bignumber.js";
import { getEnv } from "../env";

const getBaseApiUrl = () => getEnv("API_POLKADOT_INDEXER");

async function fetch(url: string) {
  const { data } = await network({
    method: "GET",
    url,
  });

  return data;
}

export const getBalances = async (addr: string) => {
  const url = `${getBaseApiUrl()}/polkadot/api/v1/account/${addr}`;
  console.log(url);
  const { data } = await fetch(url);

  return {
    balance: BigNumber(data.attributes.balance_total),
    spendableBalance: BigNumber(data.attributes.balance_free),
    // delegated: data.attributes.balance_reserved,
    polkadotResources: { nonce: data.attributes.nonce },
  };
};

export const getTransfers = async (accountId: string, addr: string) => {
  const page = 1;

  let url = `${getBaseApiUrl()}/polkadot/api/v1/balances/transfer?filter[address]=${addr}&page[number]=${page}&page[size]=100`;
  console.log(url);
  let data = await fetch(url);

  console.log("getTransfers", data);

  const operations = data.data.map((op) => {
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

  return operations;
};
