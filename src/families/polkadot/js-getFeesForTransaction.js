// @flow
import { BigNumber } from "bignumber.js";
import { getAbandonSeedAddress } from "@ledgerhq/cryptoassets";

import type { Account } from "../../types";
import type { Transaction } from "./types";

import { paymentInfo } from "./api";
import { calculateAmount } from "./js-estimateMaxSpendable";
import { buildTransaction } from "./js-buildTransaction";
import { fakeSignExtrinsic } from "./js-signOperation";

/**
 * Fetch the transaction fees for a transaction
 *
 * @param {Account} a
 * @param {Transaction} t
 * @param {*} txInfo
 */
const getEstimatedFees = async (
  a: Account,
  t: Transaction
): Promise<BigNumber> => {
  const transaction = {
    ...t,
    recipient: getAbandonSeedAddress(a.currency.id), // Always use a fake recipient to estimate fees
    amount: calculateAmount({ a, t: { ...t, fees: null } }), // Remove fees if present since we are fetching fees
  };

  const { unsigned, registry } = await buildTransaction(a, transaction);
  const fakeSignedTx = await fakeSignExtrinsic(unsigned, registry);
  const payment = await paymentInfo(fakeSignedTx);

  return BigNumber(payment.partialFee);
};

export default getEstimatedFees;
