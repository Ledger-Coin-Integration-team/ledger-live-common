// @flow
import type { Account } from "../../types";
import type { Transaction } from "./types";

import getEstimatedFees from "./js-getFeesForTransaction";
import { isTransactionComplete } from "./logic";
import { BigNumber } from "bignumber.js";

const sameFees = (a, b) => (!a || !b ? a === b : a.eq(b));

/**
 * Calculate fees for the current transaction
 * @param {Account} a
 * @param {Transaction} t
 */
const prepareTransaction = async (a: Account, t: Transaction) => {

  // Fees can't be estimated if some fields are missing
  if (!isTransactionComplete(t)) {
    return t;
  }

  let fees = t.fees;

  fees = await getEstimatedFees({ a, t });

  if (!sameFees(t.fees, fees)) {
    return { ...t, fees };
  }

  return t;
};

export default prepareTransaction;
