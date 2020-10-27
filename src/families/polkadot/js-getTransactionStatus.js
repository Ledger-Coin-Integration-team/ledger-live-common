// @flow
import { BigNumber } from "bignumber.js";

import {
  NotEnoughBalance,
  RecipientRequired,
  InvalidAddress,
  InvalidAddressBecauseDestinationIsAlsoSource,
  AmountRequired,
  NotEnoughBalanceBecauseDestinationNotCreated,
} from "@ledgerhq/errors";

import type { Account, TransactionStatus } from "../../types";
import {
  PolkadotUnauthorizedOperation,
  PolkadotElectionClosed,
  PolkadotNotValidator,
} from "../../errors";

import { formatCurrencyUnit } from "../../currencies";

import {
  isElectionClosed,
  isNewAccount,
  isControllerAddress,
  getValidatorsStashesAddresses,
} from "../../api/polkadot";

import type { Transaction } from "./types";
import {
  isValidAddress,
  isStash,
  isController,
  EXISTENTIAL_DEPOSIT,
  MINIMUM_BOND_AMOUNT,
} from "./logic.js";
import getTxInfo from "./js-getTransactionInfo";
import { getEstimatedFees } from "./js-getFeesForTransaction";

// Should try to refacto
const getSendTransactionStatus = async (
  a: Account,
  t: Transaction
): Promise<TransactionStatus> => {
  const errors = {};
  const warnings = {};
  const useAllAmount = !!t.useAllAmount;

  if (!t.recipient) {
    errors.recipient = new RecipientRequired("");
  } else if (a.freshAddress === t.recipient) {
    errors.recipient = new InvalidAddressBecauseDestinationIsAlsoSource();
  } else if (!isValidAddress(t.recipient)) {
    errors.recipient = new InvalidAddress("");
  }

  const txInfo = await getTxInfo(a);

  let estimatedFees = BigNumber(0);
  if (!errors.recipient) {
    estimatedFees = await getEstimatedFees(a, t, txInfo);
  }

  const totalSpent = useAllAmount
    ? a.spendableBalance
    : BigNumber(t.amount).plus(estimatedFees);

  const amount = useAllAmount
    ? a.spendableBalance.minus(estimatedFees)
    : BigNumber(t.amount);

  if (amount.lte(0) && !t.useAllAmount) {
    errors.amount = new AmountRequired();
  }

  if (totalSpent.gt(a.spendableBalance)) {
    errors.amount = new NotEnoughBalance();
  }

  if ((await isNewAccount(t.recipient)) && amount.lt(EXISTENTIAL_DEPOSIT)) {
    errors.amount = new NotEnoughBalanceBecauseDestinationNotCreated("", {
      minimalAmount: formatCurrencyUnit(
        a.currency.units[0],
        EXISTENTIAL_DEPOSIT,
        { showCode: true }
      ),
    });
  }

  return Promise.resolve({
    errors,
    warnings,
    estimatedFees,
    amount,
    totalSpent,
  });
};

const getTransactionStatus = async (a: Account, t: Transaction) => {
  console.log("TRANSACTION", t);
  const errors = {};
  const warnings = {};
  const useAllAmount = !!t.useAllAmount;

  if (t.mode === "send") {
    return await getSendTransactionStatus(a, t);
  }

  if (await !isElectionClosed()) {
    errors.staking = new PolkadotElectionClosed();
  }

  let estimatedFees = BigNumber(0);
  let amount = t.amount;
  let totalSpent = estimatedFees;

  switch (t.mode) {
    case "bond":
      // Not a stash yet -> bond method sets the controller
      if (!isStash(a)) {
        if (!t.recipient) {
          errors.recipient = new RecipientRequired("");
        } else if (!isValidAddress(t.recipient)) {
          errors.recipient = new InvalidAddress("");
        } else if (await isControllerAddress(t.recipient)) {
          errors.recipient = new PolkadotUnauthorizedOperation(
            "Recipient is already a controller"
          );
        }
      }
      break;

    case "unbond":
      if (!isController(a)) {
        errors.staking = new PolkadotUnauthorizedOperation();
      }
      if (a.polkadotResources?.unbondings) {
        const totalUnbond = a.polkadotResources.unbondings.reduce(
          (old, current) => {
            return old.plus(current.amount);
          },
          BigNumber(0)
        );

        const remainingUnbond = a.polkadotResources?.bondedBalance.minus(
          totalUnbond
        );

        if (
          remainingUnbond
            ? remainingUnbond.lt(t.amount)
            : a.polkadotResources?.bondedBalance.lt(t.amount)
        ) {
          errors.amount = new NotEnoughBalance();
        }
      }
      break;

    case "nominate":
      if (!isController(a)) {
        errors.staking = new PolkadotUnauthorizedOperation();
      } else if (!t.validators || t.validators?.length === 0) {
        errors.staking = new PolkadotUnauthorizedOperation();
      } else {
        const validators = await getValidatorsStashesAddresses();

        for (const validator of t.validators || []) {
          if (!validators.includes(validator)) {
            errors.staking = new PolkadotNotValidator(null, { validator });
            break;
          }
        }
      }
      break;
  }

  if (!errors.amount) {
    const txInfo = await getTxInfo(a);
    estimatedFees = await getEstimatedFees(a, t, txInfo);
    totalSpent = estimatedFees;
  }

  if (t.mode === "bond" && !errors.staking) {
    amount = useAllAmount
      ? a.spendableBalance.minus(estimatedFees)
      : BigNumber(t.amount);

    totalSpent = useAllAmount
      ? a.spendableBalance
      : BigNumber(t.amount).plus(estimatedFees);

    // If not a stash yet, first bond must respect minimum amount of 1 DOT
    if (!isStash(a) && amount.lt(MINIMUM_BOND_AMOUNT)) {
      errors.amount = new NotEnoughBalanceBecauseDestinationNotCreated("", {
        minimalAmount: formatCurrencyUnit(
          a.currency.units[0],
          MINIMUM_BOND_AMOUNT,
          { showCode: true }
        ),
      });
    }

    if (amount.lte(0) && !t.useAllAmount) {
      errors.amount = new AmountRequired();
    }
  }

  if (totalSpent.gt(a.spendableBalance)) {
    errors.amount = new NotEnoughBalance();
  }

  return Promise.resolve({
    errors,
    warnings,
    estimatedFees,
    amount,
    totalSpent,
  });
};

export default getTransactionStatus;
