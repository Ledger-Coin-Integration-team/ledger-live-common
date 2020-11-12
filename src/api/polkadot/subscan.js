// @flow
import uniqBy from "lodash/uniqBy";
import camelCase from "lodash/camelCase";
import type { Operation } from "../../types";

import network from "../../network";
import { BigNumber } from "bignumber.js";
import { getEnv } from "../../env";
import { encodeAddress } from "@polkadot/util-crypto";
import { getOperationType } from "./common";
import type { PolkadotValidator } from "../../families/polkadot/types";

const getBaseApiUrl = () => getEnv("API_POLKADOT_INDEXER");

const DOT_REDOMINATION_BLOCK = 1248328;
const SUBSCAN_MULTIPLIER = 10000000000;
const SUBSCAN_ROW = 100;
const SUBSCAN_VALIDATOR_OVERSUBSCRIBED = 128;
const SUBSCAN_VALIDATOR_COMISSION_RATIO = 1000000000;

const encodePolkadotAddr = (addr) => {
  return encodeAddress("0x" + addr, /* SS58FORMAT= */ 0);
};

const getExtra = (type, extrinsic) => {
  let extra = {
    palletMethod: extrinsic.call_module
      ? `${extrinsic.call_module}.${camelCase(extrinsic.call_module_function)}`
      : `${extrinsic.module_id}.${camelCase(extrinsic.event_id)}`,
  };

  const params = JSON.parse(extrinsic.params);
  let valueParam;
  switch (type) {
    case "BOND":
      valueParam =
        params.find((p) => p.name === "value")?.value ||
        params.find((p) => p.name === "max_additional")?.value;
      extra = { ...extra, bondedAmount: BigNumber(valueParam || 0) };
      break;

    case "UNBOND":
      extra = {
        ...extra,
        unbondedAmount: BigNumber(
          params.find((p) => p.name === "value")?.value || 0
        ),
      };
      break;

    case "SLASH":
    case "REWARD":
      extra = {
        ...extra,
        validatorStash: encodePolkadotAddr(
          params.find((p) => p.type === "AccountId").value
        ),
        amount: BigNumber(params.find((p) => p.type === "Balance").value),
      };
      break;

    case "NOMINATE":
      extra = {
        ...extra,
        validators: params
          .find((t) => t.name === "targets")
          .value.reduce((old, current) => {
            return current ? [...old, encodePolkadotAddr(current)] : old;
          }, []),
      };
      break;
  }

  return extra;
};

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
    recipients: [],
    senders: [],
    extra: getExtra(type, reward),
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
      palletMethod: "balances.transfer", // FIXME subscan plz
    },
    senders: [transfer.from],
    recipients: [transfer.to],
    hasFailed: !transfer.success,
  };
};

const mapSubscanExtrinsic = (
  { addr, accountId },
  extrinsic
): $Shape<Operation> => {
  const pallet = extrinsic.call_module;
  const palletMethod = camelCase(extrinsic.call_module_function);
  const type = getOperationType(pallet, palletMethod);

  // FIXME subscan plz
  const recipient =
    extrinsic.destination && encodePolkadotAddr(extrinsic.destination);

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
    senders: [addr],
    recipients: recipient ? [recipient] : [],
    extra: getExtra(type, extrinsic),
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
export const getValidators = async (stashes: string | string[] = "elected") => {
  if (stashes === "elected") {
    return fetchSubscanValidators(true);
  } else if (stashes === "waiting") {
    return fetchSubscanValidators(false);
  } else if (stashes === "all" || Array.isArray(stashes)) {
    const [elected, waiting] = await Promise.all([
      fetchSubscanValidators(true),
      fetchSubscanValidators(false),
    ]);

    if (Array.isArray(stashes)) {
      return [...elected, ...waiting].filter((v) =>
        stashes.includes(v.address)
      );
    }

    return [...elected, ...waiting];
  }

  return [];
};
