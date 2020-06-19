// @flow

import { makeSignOperation } from "../../libcore/signOperation";
import buildTransaction from "./libcore-buildTransaction";
import type { Transaction } from "./types";
import { libcoreAmountToBigNumber } from "../../libcore/buildBigNumber";
import Algorand from "./ledger-app/Algorand";

async function signTransaction({
  account: { freshAddressPath, spendableBalance, id, freshAddress },
  transport,
  transaction,
  coreTransaction,
  isCancelled,
  onDeviceSignatureGranted,
  onDeviceSignatureRequested,
}) {
  const hwApp = new Algorand(transport);
  const serialized = await coreTransaction.serializeForSignature();

  onDeviceSignatureRequested();
  // Call the hw-app signature
  // Note: That wont work until we dont change the code with the right call for Algorand
  // the code = ./ledger-app/Algorand
  onDeviceSignatureGranted();

  // Set signature here
  if (isCancelled()) return;

  // Get the serialization after signature to send it to broadcast
  // const hex = await coreTransaction.serializeForBroadcast("sync");

  if (isCancelled()) return;
  
  const type = "OUT";
  // Add fees, senders (= account.freshAddress) and recipients.
  

  const op = {
    id: `${id}--OUT`,
    hash: "",
    type,
    value: transaction.useAllAmount
      ? spendableBalance
      : transaction.amount.plus(fee),
    fee,
    blockHash: null,
    blockHeight: null,
    senders,
    recipients,
    accountId: id,
    date: new Date(),
    extra: {},
  };

  return {
    operation: op,
    expirationDate: null,
    signature: hex,
  };
}

export default makeSignOperation<Transaction, CoreCosmosLikeTransaction>({
  buildTransaction,
  signTransaction,
});
