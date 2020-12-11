//@flow
import network from "../../network";
import https from "https";
import querystring from "querystring";

import { BigNumber } from "bignumber.js";
import { encodeOperationId } from "../../operation";

import { getEnv } from "../../env";
import { getOperationType } from "./common";

// TMP
const agent = new https.Agent({
  rejectUnauthorized: false,
});

const LIMIT = 200;

const getBaseApiUrl = () => getEnv("API_POLKADOT_INDEXER");

const getAccountOperationUrl = (addr, offset, startAt, limit = LIMIT) =>
  `${getBaseApiUrl()}/accounts/${addr}/operations?${querystring.stringify({
    limit,
    offset,
    startAt,
  })}`;

const getExtra = (type, extrinsic) => {
  let extra = {
    palletMethod: `${extrinsic.section}.${extrinsic.method}`,
  };

  switch (type) {
    case "IN":
    case "OUT":
      if (extrinsic.amount) {
        extra = { ...extra, transferAmount: BigNumber(extrinsic.amount) };
      }
      break;

    case "BOND":
      if (extrinsic.amount) {
        extra = { ...extra, bondedAmount: BigNumber(extrinsic.amount) };
      }
      break;

    case "UNBOND":
      if (extrinsic.amount) {
        extra = {
          ...extra,
          unbondedAmount: BigNumber(extrinsic.amount),
        };
      }
      break;

    case "REWARD_PAYOUT":
    case "SLASH":
      extra = {
        ...extra,
        validatorStash: extrinsic.validatorStash,
        amount: BigNumber(extrinsic.value),
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

const getValue = (extrinsic, type) => {
  if (!extrinsic.isSuccess) {
    return type === "IN" ? BigNumber(0) : BigNumber(extrinsic.partialFee || 0);
  }

  switch (type) {
    case "OUT":
      return extrinsic.signer !== extrinsic.affectedAddress1
        ? BigNumber(extrinsic.amount).plus(extrinsic.partialFee)
        : BigNumber(extrinsic.partialFee);
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

  if (type === "BOND" && extrinsic.signer !== addr) {
    return null;
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
    transactionSequenceNumber:
      extrinsic.signer === addr ? extrinsic.nonce : undefined,
    hasFailed: !extrinsic.isSuccess,
  };
};

const rewardToOperation = (addr, accountId, reward) => {
  const hash = reward.extrinsicHash;
  const type = "REWARD_PAYOUT";

  return {
    id: encodeOperationId(accountId, `${hash}+${reward.index}`, type),
    accountId,
    fee: BigNumber(0),
    value: BigNumber(reward.value),
    type: type,
    hash,
    blockHeight: reward.blockNumber,
    date: new Date(reward.timestamp),
    extra: getExtra(type, reward),
    senders: [reward.validatorStash].filter(Boolean),
    recipients: [reward.accountId].filter(Boolean),
  };
};

const slashToOperation = (addr, accountId, slash) => {
  const hash = `${slash.blockNumber}`;
  const type = "SLASH";

  return {
    id: encodeOperationId(accountId, `${hash}+${slash.index}`, type),
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
    url: getAccountOperationUrl(addr, offset, startAt),
    httpsAgent: agent,
  });

  const operations = data.extrinsics.map((extrinsic) =>
    extrinsicToOperation(addr, accountId, extrinsic)
  );

  const rewards = data.rewards.map((reward) =>
    rewardToOperation(addr, accountId, reward)
  );

  const slashes = data.slashes.map((slash) =>
    slashToOperation(addr, accountId, slash)
  );

  const mergedOp = [...prevOperations, ...operations, ...rewards, ...slashes];

  if (
    operations.length < LIMIT &&
    rewards.length < LIMIT &&
    slashes.length < LIMIT
  ) {
    return mergedOp.filter(Boolean).sort((a, b) => b.date - a.date);
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
