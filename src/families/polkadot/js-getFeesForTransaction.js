// @flow
import { BigNumber } from "bignumber.js";
import { u8aConcat } from "@polkadot/util";

import type { Account } from "../../types";
import type { Transaction } from "./types";
import type { CacheRes } from "../../cache";
import getTxInfo from "./js-getTransactionInfo";
import { makeLRUCache } from "../../cache";
import { paymentInfo } from "./api";
import { buildTransaction, createSerializedSignedTx } from "./js-buildTransaction";

export const calculateFees: CacheRes<
  Array<{ a: Account, t: Transaction }>,
  BigNumber
> = makeLRUCache(
  async ({ a, t }): Promise<BigNumber> => {
    const txInfo = await getTxInfo(a);
    return await getEstimatedFees(a, t, txInfo);
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
  t: Transaction,
  txInfo: any
): Promise<BigNumber> => {

  const txPayload = await buildTransaction(a, t, txInfo);

  const fakeSignature = u8aConcat(
    new Uint8Array([1]),
    new Uint8Array(64).fill(0x42)
  );

  const fakeSignedTx = createSerializedSignedTx(txPayload, fakeSignature, txInfo.registry);

  const payment = await paymentInfo(fakeSignedTx);

  const fee = BigNumber(payment.partialFee);

  return fee;
};
