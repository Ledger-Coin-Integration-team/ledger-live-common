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
  PolkadotNoUnbondedBalance,
  PolkadotNoNominations,
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

  if (t.mode === "send") {
    return await getSendTransactionStatus(a, t);
  }

  if (await !isElectionClosed()) {
    errors.staking = new PolkadotElectionClosed();
  }

  let amount = t.amount;
  const useAllAmount = !!t.useAllAmount;
  
  const txInfo = await getTxInfo(a);
  const estimatedFees = await getEstimatedFees(a, t, txInfo);
  let totalSpent = estimatedFees;

  const currentUnbonding = a.polkadotResources?.unbondings ? 
  a.polkadotResources.unbondings.reduce(
    (old, current) => { return old.plus(current.amount); },
    BigNumber(0)
  )
  : BigNumber(0);

  const currentBonded = a.polkadotResources?.lockedBalance.minus(currentUnbonding);

  switch (t.mode) {
    case "bond":
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
      } else if (amount.gt(currentBonded.minus(MINIMUM_BOND_AMOUNT)) && amount.lt(currentBonded)) {
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
      } else if (amount.gt(currentUnbonding)) {
        errors.amount = new NotEnoughBalance();
      }
      break;
  
    case "withdrawUnbonded":
      if (!isController(a)) {
        errors.staking = new PolkadotUnauthorizedOperation();
      }
      
      // FIXME This always returns a warning, until unbondedBalance is retrieved from the API (see websocket.js)
      if (a.polkadotResources?.unbondedBalance.lte(0)) {
        warnings.amount = new PolkadotNoUnbondedBalance();
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

    case "chill":
      if (!isController(a)) {
        errors.staking = new PolkadotUnauthorizedOperation();
      } else if (!a.polkadotResources?.nominations) {
        errors.staking = new PolkadotNoNominations();
      }
      break;
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
