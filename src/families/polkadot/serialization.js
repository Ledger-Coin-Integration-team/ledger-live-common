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
    unlockedBalance: r.unlockedBalance.toString(),
    unlockingBalance: r.unlockingBalance.toString(),
    unlockings: r.unlockings?.map((u) => ({
      amount: u.amount.toString(),
      completionDate: u.completionDate,
    })),
    nominations: r.nominations?.map((n) => ({
      address: n.address,
      value: n.value.toString(),
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
    unlockedBalance: BigNumber(r.unlockedBalance),
    unlockingBalance: BigNumber(r.unlockingBalance),
    unlockings: r.unlockings?.map((u) => ({
      amount: BigNumber(u.amount),
      completionDate: u.completionDate,
    })),
    nominations: r.nominations?.map((n) => ({
      address: n.address,
      value: BigNumber(n.value),
      status: n.status,
    })),
  };
}
