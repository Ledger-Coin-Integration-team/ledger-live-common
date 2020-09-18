// @flow

import { BigNumber } from "bignumber.js";
import type { PolkadotResourcesRaw, PolkadotResources } from "./types";

export function toPolkadotResourcesRaw(
  r: PolkadotResources
): PolkadotResourcesRaw {
  const { nonce } = r;
  return {
    nonce,
    bondedBalance: r.bondedBalance.toString(),
  };
}

export function fromPolkadotResourcesRaw(
  r: PolkadotResourcesRaw
): PolkadotResources {
  const { nonce } = r;
  return {
    nonce,
    bondedBalance: BigNumber(r.bondedBalance),
  };
}
