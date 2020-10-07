// @flow
import { BigNumber } from "bignumber.js";
import { u8aConcat } from "@polkadot/util";
import { createSignedTx } from "@substrate/txwrapper";

import type { Account } from "../../types";
import type { Transaction } from "./types";
import { paymentInfo } from "../../api/Polkadot";
import buildTransaction from "./js-buildTransaction";

export const getEstimatedFeesFromUnsignedTx = async (
  a: Account,
  unsignedTx: string,
  txInfo: any
) => {
  const { txOptions } = txInfo;

  const signature = u8aConcat(
    new Uint8Array([1]),
    new Uint8Array(64).fill(0x42)
  );

  const fakeSignedTx = createSignedTx(unsignedTx, signature, txOptions);

  const payment = await paymentInfo(fakeSignedTx);

  const fee = BigNumber(payment.partialFee);

  return fee;
};

export const getEstimatedFees = async (
  a: Account,
  t: Transaction,
  txInfo: any
) => {
  return getEstimatedFeesFromUnsignedTx(
    a,
    await buildTransaction(a, t, txInfo),
    txInfo
  );
};
