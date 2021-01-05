// @flow
import { BigNumber } from "bignumber.js";

import { makeLRUCache } from "../../cache";
import type { CacheRes } from "../../cache";
import type { Account } from "../../types";
import type { Transaction } from "./types";

import {
  isNewAccount as apiIsNewAccount,
  isControllerAddress as apiIsControllerAddress,
  isElectionClosed as apiIsElectionClosed,
} from "./api";
import getEstimatedFees from "./js-getFeesForTransaction";
import { TypeRegistry, ModulesWithCalls } from "@polkadot/types";
import { getRegistry as apiGetRegistry } from "./api";

/**
 * Create a hash for a transaction that is params-specific and stay unchanged if no influcing fees
 *
 * @param {*} a
 * @param {*} t
 */
const hashTransactionParams = (a: Account, t: Transaction) => {
  const prefix = `${a.id}_${a.polkadotResources?.nonce ?? 0}_${t.mode}`;
  const amount = t.amount.toString();

  switch (t.mode) {
    case "send":
      return `${prefix}_${amount}`;
    case "bond":
      return t.rewardDestination
        ? `${prefix}_${amount}_${t.rewardDestination}`
        : `${prefix}_${amount}`;
    case "unbond":
    case "rebond":
      return `${prefix}_${amount}`;
    case "nominate":
      return `${prefix}_${t.validators?.length ?? "0"}`;
    case "withdrawUnbonded":
    case "chill":
      return `${prefix}`;
    case "claimReward":
      return `${prefix}_${t.era || "0"}`;
    default:
      throw new Error("Unknown mode in transaction");
  }
};

export const getFees: CacheRes<
  Array<{ a: Account, t: Transaction }>,
  BigNumber
> = makeLRUCache(
  async ({ a, t }): Promise<BigNumber> => {
    return await getEstimatedFees(a, t);
  },
  ({ a, t }) => hashTransactionParams(a, t)
);

export const getRegistry: CacheRes<Array<void>, Object> = makeLRUCache(
  async (): Promise<{
    registry: typeof TypeRegistry,
    extrinsics: typeof ModulesWithCalls,
  }> => {
    return await apiGetRegistry();
  },
  () => "polkadot",
  {
    maxAge: 60 * 60 * 1000, // 1 hour - could be Infinity
  }
);

export const isNewAccount: CacheRes<Array<string>, boolean> = makeLRUCache(
  async (address): Promise<boolean> => {
    return apiIsNewAccount(address);
  },
  (address) => address,
  {
    maxAge: 60 * 1000, // 1 minute
  }
);

export const isControllerAddress: CacheRes<
  Array<string>,
  boolean
> = makeLRUCache(
  async (address): Promise<boolean> => {
    return apiIsControllerAddress(address);
  },
  (address) => address
);

export const isElectionClosed: CacheRes<Array<void>, boolean> = makeLRUCache(
  async (): Promise<boolean> => {
    return apiIsElectionClosed();
  },
  () => "",
  {
    maxAge: 60 * 1000, // 1 minute
  }
);
