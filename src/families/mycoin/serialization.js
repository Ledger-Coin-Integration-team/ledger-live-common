// @flow
import { BigNumber } from "bignumber.js";
import type { MyCoinResourcesRaw, MyCoinResources } from "./types";

export function toMyCoinResourcesRaw(r: MyCoinResources): MyCoinResourcesRaw {
  const { nonce, additionalBalance } = r;
  return {
    nonce,
    additionalBalance: additionalBalance.toString(),
  };
}

export function fromMyCoinResourcesRaw(r: MyCoinResourcesRaw): MyCoinResources {
  const { nonce, additionalBalance } = r;
  return {
    nonce,
    additionalBalance: BigNumber(additionalBalance),
  };
}
