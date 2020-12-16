// @flow
import { BigNumber } from "bignumber.js";
import { decodeAddress } from "@polkadot/util-crypto";
import type { Account } from "../../types";

export const EXISTENTIAL_DEPOSIT = BigNumber(10000000000);
export const MINIMUM_BOND_AMOUNT = BigNumber(10000000000);
export const MAX_NOMINATIONS = 16;
export const MAX_UNLOCKINGS = 32;
export const PRELOAD_MAX_AGE = 60 * 1000;

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

// returns true if account is controlled by an external account (not self)
export const hasExternalController = (a: Account): boolean =>
  a.polkadotResources?.controller
    ? a.polkadotResources?.controller !== a.freshAddress
    : false;

// returns true if accoutn controls an external stash (not self)
export const hasExternalStash = (a: Account): boolean =>
  a.polkadotResources?.stash
    ? a.polkadotResources?.stash !== a.freshAddress
    : false;

// Must have the minimum balance to bond
export const canBond = (a: Account): boolean => {
  const { balance } = a;

  return EXISTENTIAL_DEPOSIT.lte(balance);
};

export const haveMaxUnlockings = (a: Account) => {
  const { unlockings = [] } = a.polkadotResources || {};
  return (unlockings?.length || 0) < MAX_UNLOCKINGS;
};

export const haveEnoughLockedBalance = (a: Account) => {
  const { lockedBalance = BigNumber(0), unlockingBalance = BigNumber(0) } =
    a.polkadotResources || {};
  return lockedBalance.minus(unlockingBalance).gt(0);
};

// Must have locked Balance
export const canUnbond = (a: Account): boolean => {
  return haveEnoughLockedBalance(a) && haveMaxUnlockings(a);
};

// returns true if an account can nominate
export const canNominate = (a: Account): boolean => isController(a);

// returns true if account must do a first bond - false for a bond extra
export const isFirstBond = (a: Account): boolean => !isStash(a);

// return true if some BOND operation is pending and not yet synchronized
export const hasPendingBond = (a: Account): boolean =>
  a.pendingOperations?.some((op) => op.type === "BOND") ?? false;
