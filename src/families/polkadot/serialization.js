// @flow

import { BigNumber } from "bignumber.js";
import type { PolkadotResourcesRaw, PolkadotResources } from "./types";

export function toPolkadotResourcesRaw(
  r: PolkadotResources
): PolkadotResourcesRaw {
  const { nonce, controller, stash } = r;
  return {
    controller,
    stash,
    nonce,
    lockedBalance: r.lockedBalance.toString(),
    unbondedBalance: r.unbondedBalance.toString(),
    unbondings: r.unbondings?.map((u) => ({
      amount: u.amount.toString(),
      completionDate: u.completionDate,
    })),
    nominations: r.nominations?.map((n) => ({
      address: n.address,
      pendingRewards: n.pendingRewards.toString(),
      status: n.status,
    })),
  };
}

export function fromPolkadotResourcesRaw(
  r: PolkadotResourcesRaw
): PolkadotResources {
  const { nonce, controller, stash } = r;
  return {
    controller,
    stash,
    nonce,
    lockedBalance: BigNumber(r.lockedBalance),
    unbondedBalance: BigNumber(r.unbondedBalance),
    unbondings: r.unbondings?.map((u) => ({
      amount: BigNumber(u.amount),
      completionDate: u.completionDate,
    })),
    nominations: r.nominations?.map((n) => ({
      address: n.address,
      pendingRewards: BigNumber(n.pendingRewards),
      status: n.status,
    })),
  };
}
