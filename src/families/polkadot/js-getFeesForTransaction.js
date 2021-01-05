// @flow
import { BigNumber } from "bignumber.js";

import type { Account } from "../../types";
import type { Transaction } from "./types";
import type { CacheRes } from "../../cache";
import { makeLRUCache } from "../../cache";
import { paymentInfo } from "./api";
import { buildTransaction } from "./js-buildTransaction";
import { fakeSignExtrinsic } from "./js-signOperation";

export const calculateFees: CacheRes<
  Array<{ a: Account, t: Transaction }>,
  BigNumber
> = makeLRUCache(
  async ({ a, t }): Promise<BigNumber> => {
    return await getEstimatedFees(a, t);
  },
  ({ a, t }) =>
    `${a.id}_${t.amount.toString()}_${t.recipient}_${String(t.useAllAmount)}_${
      t.mode
    }_${t.validators?.join("-") || ""}_${t.rewardDestination || ""}_${
      t.era || ""
    }`
);

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
  const { unsigned, registry } = await buildTransaction(a, t);

  const fakeSignedTx = await fakeSignExtrinsic(unsigned, registry);

  const payment = await paymentInfo(fakeSignedTx);

  const fee = BigNumber(payment.partialFee);

  return fee;
};
