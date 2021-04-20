// @flow
import Prando from "prando";
import { BigNumber } from "bignumber.js";
import type {
  Account,
  AccountLike,
  Operation,
  OperationType,
} from "../../types";
import { genOperation } from "../../mock/account";
import { findCompoundToken } from "../../currencies";

function genBaseOperation({
  account,
  parentAccount,
  rng,
  type,
  amount,
}: {
  account: AccountLike,
  parentAccount: Account,
  rng: Prando,
  type: OperationType,
  amount?: BigNumber,
}): Operation {
  const { operations: ops } = account;
  const op = genOperation(parentAccount, account, ops, rng);
  op.type = type;

  if (["REDEEM", "SUPPLY"].includes(type)) {
    op.extra = {
      // FIXME make it more realistic using function of time
      rate: rng.next(0.005, 0.01),
    };
  }

  if (amount && ["REDEEM", "SUPPLY"].includes(type)) {
    op.extra = {
      ...op.extra,
      compoundValue: amount.toString(),
    };

    op.value = amount.times(op.extra.rate);
  } else if (amount) {
    op.value = amount;
  }

  ops.push(op);
  return op;
}

function addOperationWithType(
  account: Account,
  rng: Prando,
  type: OperationType,
  amount?: BigNumber
) {
  genBaseOperation({
    parentAccount: account,
    account: account,
    rng,
    type,
    amount,
  });
  return account;
}

function genAccountEnhanceOperations(account: Account, rng: Prando): Account {
  return account;
}

function postSyncAccount(account: Account): Account {
  return account;
}

function postScanAccount(account: Account): Account {
  return account;
}

export default {
  genAccountEnhanceOperations,
  postSyncAccount,
  postScanAccount,
};
