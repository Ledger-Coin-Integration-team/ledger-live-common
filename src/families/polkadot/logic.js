// @flow
import { BigNumber } from "bignumber.js";
import { decodeAddress } from "@polkadot/util-crypto";
import type { Account } from "../../types";

export const EXISTENTIAL_DEPOSIT = BigNumber(10000000000);
export const MINIMUM_BOND_AMOUNT = BigNumber(10000000000);

export const isValidAddress = (address: string) => {
  if (!address) return false;
  try {
    decodeAddress(address);
    return true;
  } catch (err) {
    return false;
  }
};

// when the account is a stash, we have the information of which account is the controller
export const isStash = (a: Account): boolean => {
  return !!a.polkadotResources?.controller;
};

// when account is a controller, we have the information of which stash it controls
export const isController = (a: Account): boolean => {
  return !!a.polkadotResources?.stash;
};
