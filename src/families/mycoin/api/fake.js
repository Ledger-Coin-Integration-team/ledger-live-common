// @flow
import { BigNumber } from "bignumber.js";
import md5 from "crypto-js/md5";
import { log } from "@ledgerhq/logs";

import type { Operation } from "../../../types";
import { encodeOperationId } from "../../../operation";

const firstEmptyAccountPath = "44'/8008'/3'/0/0";
const firstEmptyAccountAddress = md5(firstEmptyAccountPath).toString();

/**
 * Get account balances and nonce
 */
export const getAccount = async (addr: string, nonce: number) => {
  if (addr === firstEmptyAccountAddress) {
    return {
      blockHeight: null,
      balance: BigNumber(0),
      additionalBalance: BigNumber(0),
      nonce: 0,
    };
  }

  return {
    blockHeight: 1,
    balance: BigNumber(20000000000),
    additionalBalance: BigNumber(30000000000),
    nonce: nonce + 2,
  };
};

/**
 * Map the MyCoin history transaction to a Ledger Live Operation
 */
function transactionToOperation(
  accountId: string,
  addr: string,
  index
): $Shape<Operation> {
  const date = new Date();
  const type = index % 2 ? "IN" : "OUT";
  const hash = md5(date.toUTCString() + index).toString();
  const value = BigNumber(Math.ceil(Math.random() * 100000000000));
  const fakeAddr = md5("fake-addr").toString();

  return {
    id: encodeOperationId(accountId, hash, type),
    accountId,
    fee: BigNumber(0.1),
    value,
    type,
    hash,
    blockHash: null,
    date,
    extra: {
      additionalField: BigNumber(index / 10),
    },
    senders: type === "IN" ? [fakeAddr] : [addr],
    recipients: type === "OUT" ? [fakeAddr] : [addr],
    transactionSequenceNumber: type === "OUT" ? ~~(index / 2) : undefined,
    hasFailed: false,
  };
}

/**
 * Fetch operation list
 */
export const getOperations = async (
  accountId: string,
  addr: string,
  startAt: number
): Promise<Operation[]> => {
  if (addr === firstEmptyAccountAddress) return [];

  return [startAt + 1, startAt + 2, startAt + 3, startAt + 4].map((i) =>
    transactionToOperation(accountId, addr, i)
  );
};

/**
 * Estimate fees from blockchain
 */
export const getFees = async (blob: string): Promise<BigNumber> => {
  const fakeFeesHash = md5(blob).toString().substr(0, 5);
  return BigNumber(parseInt(fakeFeesHash, 16));
};

/**
 * Broadcast blob to blockchain
 */
export const submit = async (blob: string) => {
  log("api/mycoin", "BROADCASTED", blob);

  const hash = md5(blob).toString();
  return { hash, fees: BigNumber(0.1) };
};
