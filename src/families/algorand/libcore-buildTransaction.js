// @flow
import invariant from "invariant";
import { BigNumber } from "bignumber.js";
import { FeeNotLoaded } from "@ledgerhq/errors";
import type { Account } from "../../types";
import {
  bigNumberToLibcoreAmount,
  bigNumberToLibcoreBigInt,
  libcoreBigIntToBigNumber,
  libcoreAmountToBigNumber,
} from "../../libcore/buildBigNumber";
import type {
  Core,
  CoreCurrency,
  CoreAccount,
  CoreWallet,
} from "../../libcore/types";
import type { CoreAlgorandTransaction, Transaction } from "./types";

export async function algorandBuildTransaction({
  account,
  core,
  coreAccount,
  coreCurrency,
  transaction,
  isCancelled,
  isPartial,
}: {
  account: Account,
  core: Core,
  coreAccount: CoreAccount,
  coreCurrency: CoreCurrency,
  transaction: Transaction,
  isPartial: boolean,
  isCancelled: () => boolean,
}): Promise<?CoreAlgorandTransaction> {
  const { recipient, amount, fees } = transaction;
  if (!fees) {
    throw new FeeNotLoaded();
  }
  const algorandAccount = await coreAccount.asAlgorandAccount();
  if (isCancelled()) return;

  const buildedTransaction = await algorandAccount.createEmptyTransaction();
  if (isCancelled()) return;

  // set Payment or Asset if token
  const paymentinfo = await core.AlgorandPaymentInfo.init(
    amount.toString(),
    recipient
  );
  await buildedTransaction.setPaymentInfo(paymentinfo);

  // TODO : part with token here

  // if Partial getEstimateFees here
  let feesToSet = isPartial
    ? await libcoreAmountToBigNumber(
        await algorandAccount.getFeeEstimate(buildedTransaction)
      )
    : fees;

  // then setFees here in any case
  buildedTransaction.setFee(feesToSet);

  // return transaction
  return buildedTransaction;
}

export default algorandBuildTransaction;
