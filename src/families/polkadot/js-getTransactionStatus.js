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
  PolkadotLowBondedBalance,
  PolkadotNoUnlockedBalance,
  PolkadotNoNominations,
} from "../../errors";

import { formatCurrencyUnit } from "../../currencies";

import {
  isElectionClosed,
  isNewAccount,
  isControllerAddress,
  verifyValidatorAddresses,
} from "../../api/polkadot";

import type { Transaction } from "./types";
import {
  isValidAddress,
  isStash,
  isController,
  EXISTENTIAL_DEPOSIT,
  MINIMUM_BOND_AMOUNT,
} from "./logic.js";
import { calculateFees } from "./js-getFeesForTransaction";

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

  let estimatedFees = BigNumber(0);
  if (!errors.recipient) {
    estimatedFees = await calculateFees({
      a,
      t: { ...t, amount: t.useAllAmount ? a.spendableBalance : t.amount },
    });
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

  if (
    !errors.recipient &&
    (await isNewAccount(t.recipient)) &&
    amount.lt(EXISTENTIAL_DEPOSIT)
  ) {
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
    amount: amount.lt(0) ? BigNumber(0) : amount,
    totalSpent,
  });
};

const getTransactionStatus = async (a: Account, t: Transaction) => {
  const errors = {};
  const warnings = {};

  if (t.mode === "send") {
    return await getSendTransactionStatus(a, t);
  }

  if (await !isElectionClosed()) {
    errors.staking = new PolkadotElectionClosed();
  }

  let amount = t.amount;
  const useAllAmount = !!t.useAllAmount;

  const unlockingBalance =
    a.polkadotResources?.unlockingBalance || BigNumber(0);

  const unlockedBalance = a.polkadotResources?.unlockedBalance || BigNumber(0);

  const currentBonded =
    a.polkadotResources?.lockedBalance.minus(unlockingBalance) || BigNumber(0);

  switch (t.mode) {
    case "bond":
      if (!isStash(a)) {
        // Not a stash yet -> bond method sets the controller
        if (!t.recipient) {
          errors.recipient = new RecipientRequired("");
        } else if (!isValidAddress(t.recipient)) {
          errors.recipient = new InvalidAddress("");
        } else if (await isControllerAddress(t.recipient)) {
          errors.recipient = new PolkadotUnauthorizedOperation(
            "Recipient is already a controller"
          );
        }

        // If not a stash yet, first bond must respect minimum amount of 1 DOT
        if (amount.lt(MINIMUM_BOND_AMOUNT)) {
          errors.amount = new NotEnoughBalanceBecauseDestinationNotCreated("", {
            minimalAmount: formatCurrencyUnit(
              a.currency.units[0],
              MINIMUM_BOND_AMOUNT,
              { showCode: true }
            ),
          });
        }
      }

      break;

    case "unbond":
      if (!isController(a)) {
        errors.staking = new PolkadotUnauthorizedOperation();
      }

      if (amount.lte(0)) {
        errors.amount = new AmountRequired();
      } else if (
        amount.gt(currentBonded.minus(MINIMUM_BOND_AMOUNT)) &&
        amount.lt(currentBonded)
      ) {
        warnings.amount = new PolkadotLowBondedBalance();
      } else if (amount.gt(currentBonded)) {
        errors.amount = new NotEnoughBalance();
      }
      break;

    case "rebond":
      if (!isController(a)) {
        errors.staking = new PolkadotUnauthorizedOperation();
      }

      if (amount.lte(0)) {
        errors.amount = new AmountRequired();
      } else if (amount.gt(unlockingBalance)) {
        errors.amount = new NotEnoughBalance();
      }
      break;

    case "withdrawUnbonded":
      if (!isController(a)) {
        errors.staking = new PolkadotUnauthorizedOperation();
      }

      if (unlockedBalance.lte(0)) {
        errors.amount = new PolkadotNoUnlockedBalance();
      }

      break;

    case "nominate":
      if (!isController(a)) {
        errors.staking = new PolkadotUnauthorizedOperation();
      } else if (!t.validators || t.validators?.length === 0) {
        errors.staking = new PolkadotUnauthorizedOperation();
      } else {
        const notValidators = await verifyValidatorAddresses(
          t.validators || []
        );

        if (notValidators.length) {
          errors.staking = new PolkadotNotValidator(null, {
            validators: notValidators,
          });
          break;
        }
      }
      break;

    case "chill":
      if (!isController(a)) {
        errors.staking = new PolkadotUnauthorizedOperation();
      } else if (!a.polkadotResources?.nominations) {
        errors.staking = new PolkadotNoNominations();
      }
      break;
  }

  // Estimated fees and totalSpent should be at the end
  // We can't manage error like incorrect recipient in the transaction builder
  const estimatedFees =
    !errors.staking && !errors.amount && !errors.recipient
      ? await calculateFees({ a, t })
      : BigNumber(0);
  let totalSpent = estimatedFees;

  if (t.mode === "bond") {
    amount = useAllAmount
      ? a.spendableBalance.minus(estimatedFees)
      : BigNumber(t.amount);

    totalSpent = useAllAmount
      ? a.spendableBalance
      : BigNumber(t.amount).plus(estimatedFees);

    if (amount.lte(0) && !useAllAmount) {
      errors.amount = new AmountRequired();
    }
    if (amount.gt(a.spendableBalance)) {
      errors.amount = new NotEnoughBalance();
    }
  }

  if (totalSpent.gt(a.spendableBalance)) {
    errors.amount = new NotEnoughBalance();
  }

  return Promise.resolve({
    errors,
    warnings,
    estimatedFees,
    amount: amount.lt(0) ? BigNumber(0) : amount,
    totalSpent,
  });
};

export default getTransactionStatus;
