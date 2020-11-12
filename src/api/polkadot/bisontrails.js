//@flow
import network from "../../network";
import https from "https";

import { BigNumber } from "bignumber.js";

import { getOperationType } from "./common";

// TMP
const agent = new https.Agent({
  rejectUnauthorized: false,
});

const LIMIT = 200;

const getExtra = (type, extrinsic) => {
  let extra = {
    palletMethod: `${extrinsic.section}.${extrinsic.method}`,
  };

  switch (type) {
    case "BOND":
      extra = { ...extra, bondedAmount: BigNumber(extrinsic.amount) };
      break;

    case "UNBOND":
      extra = {
        ...extra,
        unbondedAmount: BigNumber(extrinsic.amount),
      };
      break;

    case "REWARD":
    case "SLASH":
      extra = {
        ...extra,
        validatorStash: extrinsic.validatorStash,
      };
      break;

    case "NOMINATE":
      extra = {
        ...extra,
        validators: extrinsic.staking.validators.reduce((acc, current) => {
          return [...acc, current.address];
        }, []),
      };
      break;
  }

  return extra;
};

const getAccountOperation = (addr, offset, startAt, limit = LIMIT) =>
  `https://polkadot.indexer.dev.stagebison.net/accounts/${addr}/operations?limit=${limit}${
    offset ? `&offset=${offset}` : ``
  }${startAt ? `&startAt=${startAt}` : ``}`;

const getValue = (extrinsic, type) => {
  if (!extrinsic.isSuccess) {
    return type === "IN" ? BigNumber(0) : BigNumber(extrinsic.partialFee || 0);
  }

  switch (type) {
    case "OUT":
      if (extrinsic.signer !== extrinsic.affectedAddress1)
        return BigNumber(extrinsic.amount).plus(extrinsic.partialFee);

    case "IN":
    case "SLASH":
      return BigNumber(extrinsic.amount);

    default:
      return BigNumber(extrinsic.partialFee);
  }
};

const extrinsicToOperation = (addr, accountId, extrinsic) => {
  let type = getOperationType(extrinsic.section, extrinsic.method);
  if (
    type === "OUT" &&
    extrinsic.affectedAddress1 === addr &&
    extrinsic.signer !== addr
  ) {
    type = "IN";
  }
  return {
    id: `${accountId}-${extrinsic.hash}-${type}`,
    accountId,
    fee: BigNumber(extrinsic.partialFee || 0),
    value: getValue(extrinsic, type),
    type,
    hash: extrinsic.hash,
    blockHeight: extrinsic.blockNumber,
    date: new Date(extrinsic.timestamp),
    extra: getExtra(type, extrinsic),
    senders: [extrinsic.signer],
    recipients: [extrinsic.affectedAddress1, extrinsic.affectedAddress2].filter(
      Boolean
    ),
    hasFailed: !extrinsic.isSuccess,
  };
};

const rewardToOperation = (addr, accountId, reward) => {
  const hash = reward.extrinsicHash;
  const type = "REWARD";

  return {
    id: `${accountId}-${hash}-${type}`,
    accountId,
    fee: BigNumber(0),
    value: BigNumber(reward.value),
    type: type,
    hash: hash,
    blockHeight: reward.blockNumber,
    date: new Date(reward.timestamp),
    extra: getExtra(type, reward),
    senders: [reward.validatorStash].filter(Boolean),
    recipients: [reward.accountId].filter(Boolean),
  };
};

const slashToOperation = (addr, accountId, slash) => {
  const hash = `${slash.blockNumber}-0`; // to be compatible with explorer
  const type = "SLASH";

  return {
    id: `${accountId}-${hash}-${type}`,
    accountId,
    fee: BigNumber(0),
    value: BigNumber(slash.value),
    type: type,
    hash: hash,
    blockHeight: slash.blockNumber,
    senders: [slash.validatorStash].filter(Boolean),
    recipients: [slash.accountId].filter(Boolean),
    date: new Date(slash.timestamp),
    extra: getExtra(type, slash),
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

  const slashes = data.slashes.map(
    slashToOperation.bind(null, addr, accountId)
  );

  const mergedOp = [...prevOperations, ...operations, ...rewards, ...slashes];

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
