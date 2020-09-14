// @flow

import type { PolkadotResourcesRaw, PolkadotResources } from "./types";

export function toPolkadotResourcesRaw(
  r: PolkadotResources
): PolkadotResourcesRaw {
  const { nonce } = r;
  return {
    nonce,
  };
}

export function fromPolkadotResourcesRaw(
  r: PolkadotResourcesRaw
): PolkadotResources {
  const { nonce } = r;
  return {
    nonce,
  };
}
