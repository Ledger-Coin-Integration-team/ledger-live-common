// @flow
import { BigNumber } from "bignumber.js";
import { decodeAddress } from "@polkadot/util-crypto";
import type { Account } from "../../types";

export const EXISTENTIAL_DEPOSIT = BigNumber(10000000000);
export const MINIMUM_BOND_AMOUNT = BigNumber(10000000000);
export const ESTIMATED_FEES = BigNumber(154000000);
export const MAX_NOMINATIONS = 16;
export const MAX_UNLOCKINGS = 32;

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

// Must have the minimum balance to bond
export const canBond = (a: Account): boolean => {
  const { balance } = a;

  return EXISTENTIAL_DEPOSIT.lte(balance);
};

// Must have locked Balance
export const canUnbond = (a: Account): boolean => {
  const {
    lockedBalance = BigNumber(0),
    unlockingBalance = BigNumber(0),
    unlockings = [],
  } = a.polkadotResources || {};

  return (
    lockedBalance.minus(unlockingBalance).gt(0) &&
    (unlockings?.length || 0) < MAX_UNLOCKINGS
  );
};

// returns true if an account can nominate
export const canNominate = (a: Account): boolean => isController(a);
