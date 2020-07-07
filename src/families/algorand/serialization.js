// @flow

import { BigNumber } from "bignumber.js";
import type { AlgorandResourcesRaw, AlgorandResources } from "./types";

export function toAlgorandResourcesRaw(
  r: AlgorandResources
): AlgorandResourcesRaw {
  const { rewards, rewardsAccumulated } = r;
  return {
    rewards,
    rewardsAccumulated,
  };
}

export function fromAlgorandResourcesRaw(
  r: AlgorandResourcesRaw
): AlgorandResources {
  const { rewards, rewardsAccumulated } = r;
  return {
    rewards,
    rewardsAccumulated,
  };
}
