//@flow
import network from "../../network";
import https from "https";

import { BigNumber } from "bignumber.js";

import { getOperationType } from "./common";

// TMP
const agent = new https.Agent({
  rejectUnauthorized: false,
});

const LIMIT = 100;

const getAccountOperation = (addr, offset, startAt, limit = LIMIT) =>
  `https://polkadot.indexer.dev.stagebison.net/accounts/${addr}/operations?limit=${limit}${
    offset ? `&offset=${offset}` : ``
  }${startAt ? `&startAt=${startAt}` : ``}`;

const rewardToOperation = (addr, accountId, reward) => {
  const hash = reward.extrinsicHash;

  return {
    id: `${accountId}-${hash}-REWARD`,
    accountId,
    fee: BigNumber(0),
    value: BigNumber(reward.value),
    type: "REWARD",
    hash: hash,
    blockHeight: reward.blockNumber,
    date: new Date(reward.timestamp),
    extra: {
      module: reward.description,
    },
  };
};

const extrinsicToOperation = (addr, accountId, extrinsic) => {
  let type = getOperationType(extrinsic.section, extrinsic.method);
  if (type === "OUT" && extrinsic.affectedAddress1 === addr) {
    type = "IN";
  }
  return {
    id: `${accountId}-${extrinsic.hash}-${type}`,
    accountId,
    fee: BigNumber(extrinsic.partialFee),
    value:
      type === "FEES"
        ? BigNumber(extrinsic.partialFee)
        : !extrinsic.isSuccess
        ? BigNumber(0)
        : BigNumber(extrinsic.amount),
    type,
    hash: extrinsic.hash,
    blockHeight: extrinsic.blockNumber,
    date: new Date(extrinsic.timestamp),
    extra: {
      section: extrinsic.section,
      method: extrinsic.method,
    },
    senders: [extrinsic.signer],
    recipients: [extrinsic.affectedAddress1],
    hasFailed: !extrinsic.isSuccess,
  };
};

const fetchOperationList = async (
  accountId,
  addr,
  startAt,
  offset = 0,
  prevOperations = []
) => {
  const { data } = await network({
    method: "GET",
    url: getAccountOperation(addr, offset, startAt),
    httpsAgent: agent,
  });

  const operations = data.extrinsics.map(
    extrinsicToOperation.bind(null, addr, accountId)
  );

  const rewards = data.rewards.map(
    rewardToOperation.bind(null, addr, accountId)
  );

  const mergedOp = [...prevOperations, ...operations, ...rewards];

  if (operations.length < LIMIT && rewards.length < LIMIT) {
    return mergedOp.sort((a, b) => b.date - a.date);
  }

  return await fetchOperationList(
    accountId,
    addr,
    startAt,
    offset + LIMIT,
    mergedOp
  );
};

export const getOperations = async (
  accountId: string,
  addr: string,
  startAt: number = 0
) => {
  return await fetchOperationList(accountId, addr, startAt);
};
