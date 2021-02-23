// @flow
import { BigNumber } from "bignumber.js";
import type { Account } from "../../types";

export const MAX_AMOUNT = 5000;

/**
 * Returns true if address is a valid md5
 *
 * @param {string} address
 */
export const isValidAddress = (address: string): boolean => {
  if (!address) return false;

  return !!address.match(/^[a-f0-9]{32}$/);
};

/**
 * Returns true if transaction amount is less than MAX AMOUNT and > 0
 *
 * @param {BigNumber} amount
 */
export const specificCheck = (amount: BigNumber): boolean => {
  return amount.gt(0) && amount.lte(MAX_AMOUNT);
};

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
