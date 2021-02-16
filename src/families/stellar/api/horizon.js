//@flow

import { BigNumber } from "bignumber.js";
import StellarSdk from "stellar-sdk";
import { getCryptoCurrencyById, parseCurrencyUnit } from "../../../currencies";
import { encodeOperationId } from "../../../operation";
import type { Operation, OperationType } from "../../../types";
import type { RawAccount, RawOperation, RawTransaction } from "./horizon.types";
import { getEnv } from "../../../env";

const LIMIT = 200;
const FALLBACK_BASE_FEE = 100;

const currency = getCryptoCurrencyById("stellar");

const getSDKInstance = () => {
  const baseAPIUrl = getEnv("API_STELLAR_HORIZON");
  return new StellarSdk.Server(baseAPIUrl);
};

const fetchBaseFee = async (): Promise<number> => {
  const server = getSDKInstance();
  let baseFee;

  try {
    baseFee = await server.fetchBaseFee();
  } catch (e) {
    baseFee = FALLBACK_BASE_FEE;
  }

  return baseFee;
};

const getMinimumBalance = (account: RawAccount): BigNumber => {
  const baseReserve = 0.5;
  const numberOfEntries = account.subentry_count;

  const minimumBalance = (2 + numberOfEntries) * baseReserve;

  return parseCurrencyUnit(currency.units[0], minimumBalance.toString());
};

const getAccountSpendableBalance = async (
  balance: BigNumber,
  account: RawAccount
): Promise<BigNumber> => {
  const minimumBalance = getMinimumBalance(account);
  const baseFee = await fetchBaseFee();
  return BigNumber.max(balance.minus(minimumBalance).minus(baseFee), 0);
};

/**
 * Get all account-related data
 *
 * @async
 * @param {*} addr
 */
export const getAccount = async (addr: string) => {
  const server = getSDKInstance();
  let account = {};
  let balance = {};
  try {
    account = await server.accounts().accountId(addr).call();
    balance = account.balances.find((balance) => {
      return balance.asset_type === "native";
    });
  } catch (e) {
    if (e.name === "NotFoundError") {
      balance.balance = "0";
    } else {
      throw e;
    }
  }

  const formattedBalance = parseCurrencyUnit(
    currency.units[0],
    balance.balance
  );
  const spendableBalance = await getAccountSpendableBalance(
    formattedBalance,
    account
  );

  return {
    blockHeight: account.sequence ? Number(account.sequence) : undefined,
    balance: formattedBalance,
    spendableBalance,
  };
};

const getOperationType = (operation, addr): OperationType => {
  switch (operation.type) {
    case "create_account":
      return operation.funder === addr ? "OUT" : "IN";
    case "payment":
      if (operation.from === addr && operation.to !== addr) {
        return "OUT";
      }
      return "IN";

    default:
      return "NONE";
  }
};

const getRecipients = (operation): string[] => {
  switch (operation.type) {
    case "create_account":
      return [operation.account];
    case "payment":
      return [operation.to];

    default:
      return [];
  }
};

/**
 * Fetch all operations for a single account from indexer
 *
 * @param {string} accountId
 * @param {string} addr
 * @param {number} startAt - blockHeight after which you fetch this op (included)
 *
 * @return {Operation[]}
 */
export const getOperations = async (
  accountId: string,
  addr: string,
  startAt: number = 0
): Promise<Operation[]> => {
  const transactions = await fetchTransactionsList(accountId, addr, startAt);
  return await fetchOperationList(accountId, addr, transactions);
};

const fetchTransactionsList = async (
  accountId: string,
  addr: string,
  startAt: number
): Promise<RawTransaction[]> => {
  const server = getSDKInstance();
  let transactions = {};
  let mergedTransactions = [];

  try {
    transactions = await server
      .transactions()
      .forAccount(addr)
      .cursor(startAt)
      .limit(LIMIT)
      .call();

    mergedTransactions = transactions.records;

    while (transactions.records.length > 0) {
      transactions = await transactions.next();
      mergedTransactions = mergedTransactions.concat(transactions.records);
    }
  } catch (e) {
    if (e.name !== "NotFoundError") {
      throw e;
    }

    return [];
  }

  return mergedTransactions;
};

const fetchOperationList = async (
  accountId: string,
  addr: string,
  transactions: RawTransaction[]
): Promise<Operation[]> => {
  const server = getSDKInstance();
  let formattedMergedOp = [];

  for (let i = 0; i < transactions.length; i++) {
    let operations = await server
      .operations()
      .forTransaction(transactions[i].id)
      .call();

    formattedMergedOp = formattedMergedOp.concat(
      operations.records.map((operation) => {
        return formatOperation(operation, transactions[i], accountId, addr);
      })
    );

    while (operations.records.length > 0) {
      operations = await operations.next();

      formattedMergedOp = formattedMergedOp.concat(
        operations.records.map((operation) => {
          return formatOperation(operation, transactions[i], accountId, addr);
        })
      );
    }
  }

  return formattedMergedOp;
};

const formatOperation = (
  rawOperation: RawOperation,
  transaction: RawTransaction,
  accountId: string,
  addr: string
): Operation => {
  const type = getOperationType(rawOperation, addr);
  const value = getValue(rawOperation, transaction, type);
  const recipients = getRecipients(rawOperation);

  return {
    id: encodeOperationId(accountId, rawOperation.transaction_hash, type),
    accountId,
    fee: parseCurrencyUnit(currency.units[0], transaction.fee_charged),
    value,
    type: type,
    hash: rawOperation.transaction_hash,
    blockHeight: transaction.ledger_attr,
    date: new Date(rawOperation.created_at),
    senders: [rawOperation.source_account],
    recipients,
    transactionSequenceNumber: transaction.source_account_sequence,
    hasFailed: !rawOperation.transaction_successful,
    blockHash: "",
    extra: {},
  };
};

const getValue = (
  operation: RawOperation,
  transaction: RawTransaction,
  type: OperationType
): BigNumber => {
  let value = BigNumber(0);

  if (!operation.transaction_successful) {
    return type === "IN" ? value : BigNumber(transaction.fee_charged || 0);
  }

  switch (operation.type) {
    case "create_account":
      value = parseCurrencyUnit(currency.units[0], operation.starting_balance);
      if (type === "OUT") {
        value = value.plus(transaction.fee_charged);
      }
      return value;

    case "payment":
      value = parseCurrencyUnit(currency.units[0], operation.amount);
      if (type === "OUT") {
        value = value.plus(transaction.fee_charged);
      }
      return value;

    default:
      return type === "OUT" ? BigNumber(transaction.fee_charged) : value;
  }
};
