// @flow
import { BigNumber } from "bignumber.js";
import { decodeAddress } from "@polkadot/util-crypto";
import type { Account } from "../../types";

import type { Transaction } from "./types";

export const EXISTENTIAL_DEPOSIT = BigNumber(10000000000);
export const MINIMUM_BOND_AMOUNT = BigNumber(10000000000);
export const MAX_NOMINATIONS = 16;
export const MAX_UNLOCKINGS = 32;
export const PRELOAD_MAX_AGE = 60 * 1000;
export const MAX_AMOUNT_INPUT = 18446744072;

/**
 * Returns true if address is valid, false if it's invalid (can't parse or wrong checksum)
 *
 * @param {*} address
 */
export const isValidAddress = (address: string): boolean => {
  if (!address) return false;
  try {
    decodeAddress(address);
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Returns true if account is a stash.
 * When the account is a stash, we have the information of which account is the controller
 *
 * @param {Account} a
 */
export const isStash = (a: Account): boolean => {
  return !!a.polkadotResources?.controller;
};

/**
 * Returns true if account is a controller.
 * when account is a controller, we have the information of which stash it controls
 *
 * @param {Account} a
 */
export const isController = (a: Account): boolean => {
  return !!a.polkadotResources?.stash;
};

/**
 * Returns true if account is controlled by an external account (not self)
 *
 * @param {Account} a
 */
export const hasExternalController = (a: Account): boolean => {
  return a.polkadotResources?.controller
    ? a.polkadotResources?.controller !== a.freshAddress
    : false;
};

/**
 * Returns true if account controls an external stash (not self)
 *
 * @param {Account} a
 */
export const hasExternalStash = (a: Account): boolean => {
  return a.polkadotResources?.stash
    ? a.polkadotResources?.stash !== a.freshAddress
    : false;
};

/**
 * Must have the minimum balance to bond
 *
 * @param {Account} a
 */
export const canBond = (a: Account): boolean => {
  const { balance } = a;

  return EXISTENTIAL_DEPOSIT.lte(balance);
};

/**
 * Return true if some BOND operation is pending and not yet synchronized
 *
 * @param {Account} a
 */
export const hasPendingBond = (a: Account): boolean => {
  return a.pendingOperations?.some((op) => op.type === "BOND") ?? false;
};

/**
 * Retyrns true if has reached the maximum of unlocking slots
 *
 * @param {Account} a
 */
export const hasMaxUnlockings = (a: Account) => {
  const { unlockings = [] } = a.polkadotResources || {};
  return (unlockings?.length || 0) >= MAX_UNLOCKINGS;
};

/**
 * Return true if account has enough Locked Balance to rebond
 *
 * @param {Account} a
 */
export const hasLockedBalance = (a: Account) => {
  const { lockedBalance = BigNumber(0), unlockingBalance = BigNumber(0) } =
    a.polkadotResources || {};
  return lockedBalance.minus(unlockingBalance).gt(0);
};

/**
 * Must have locked Balance
 *
 * @param {Account} a
 */
export const canUnbond = (a: Account): boolean => {
  return hasLockedBalance(a) && !hasMaxUnlockings(a);
};

/**
 * Returns true if an account can nominate
 *
 * @param {Account} a
 */
export const canNominate = (a: Account): boolean => isController(a);

/**
 * Returns true if account must do a first bond - false for a bond extra
 *
 * @param {Account} a
 */
export const isFirstBond = (a: Account): boolean => !isStash(a);

/**
 * Returns nonce for an account
 *
 * @param {Account} a
 */
export const getNonce = (a: Account): number => {
  const lastPendingOp = a.pendingOperations[0];

  const nonce = Math.max(
    a.polkadotResources?.nonce || 0,
    lastPendingOp && typeof lastPendingOp.transactionSequenceNumber === "number"
      ? lastPendingOp.transactionSequenceNumber + 1
      : 0
  );

  return nonce;
};

/**
 * Calculates max unbond amount which is the remaining active locked balance (not unlocking)
 *
 * @param {*} account
 */
const calculateMaxUnbond = (a: Account): BigNumber => {
  return (
    a.polkadotResources?.lockedBalance.minus(
      a.polkadotResources.unlockingBalance
    ) ?? BigNumber(0)
  );
};

/**
 * Calculates max rebond amount which is the current unlocking balance (including unlocked)
 *
 * @param {*} account
 */
const calculateMaxRebond = (a: Account): BigNumber => {
  return a.polkadotResources?.unlockingBalance ?? BigNumber(0);
};

/**
 * Calculate the real spendable
 *
 * @param {*} a
 */
const calculateMaxSend = (a: Account, t: Transaction): BigNumber => {
  const amount = isFirstBond(a)
    ? a.spendableBalance.minus(EXISTENTIAL_DEPOSIT).minus(t.fees || 0)
    : a.spendableBalance.minus(t.fees || 0);
  return amount.lt(0) ? BigNumber(0) : amount;
};

/**
 * Calculates correct amount if useAllAmount
 *
 * @param {*} param
 */
export const calculateAmount = ({
  a,
  t,
}: {
  a: Account,
  t: Transaction,
}): BigNumber => {
  if (t.amount.gt(MAX_AMOUNT_INPUT)) {
    return BigNumber(MAX_AMOUNT_INPUT);
  }

  if (t.useAllAmount) {
    switch (t.mode) {
      case "send":
        return calculateMaxSend(a, t);

      case "unbond":
        return calculateMaxUnbond(a);

      case "rebond":
        return calculateMaxRebond(a);

      default:
        return a.spendableBalance.minus(t.fees || 0);
    }
  }

  return t.amount;
};
