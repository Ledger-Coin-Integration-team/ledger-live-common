/* eslint-disable no-prototype-builtins */
// @flow
import { BigNumber } from "bignumber.js";
import { Observable, Subject } from "rxjs";
import { log } from "@ledgerhq/logs";
import { getEnv } from "../../env";

import { PRELOAD_MAX_AGE, getMinRewarded } from "./logic";
import { getRegistry } from "./cache";
import type { PolkadotPreloadData, PolkadotValidator } from "./types";
import { getStakingProgress, getValidators } from "./validators";

let currentPolkadotPreloadedData: PolkadotPreloadData = {
  validators: [],
  staking: null,
  minRewarded: BigNumber(0),
};

function fromHydrateValidator(validatorRaw: Object): PolkadotValidator {
  return {
    address: validatorRaw.address,
    identity: validatorRaw.identity,
    nominatorsCount: Number(validatorRaw.nominatorsCount),
    rewardPoints:
      validatorRaw.rewardPoints === null
        ? null
        : BigNumber(validatorRaw.rewardPoints),
    commission: BigNumber(validatorRaw.commission),
    totalBonded: BigNumber(validatorRaw.totalBonded),
    selfBonded: BigNumber(validatorRaw.selfBonded),
    isElected: !!validatorRaw.isElected,
    isOversubscribed: !!validatorRaw.isOversubscribed,
    minRewarded: validatorRaw.minRewarded
      ? BigNumber(validatorRaw.minRewarded)
      : null,
    minNominated: validatorRaw.minNominated
      ? BigNumber(validatorRaw.minNominated)
      : null,
  };
}

function fromHydratePreloadData(data: mixed): PolkadotPreloadData {
  let validators = [];
  let staking = null;
  let minRewarded = BigNumber(0);

  if (typeof data === "object" && data) {
    if (Array.isArray(data.validators)) {
      validators = data.validators.map(fromHydrateValidator);
    }

    if (data.staking !== null && typeof data.staking === "object") {
      const {
        electionClosed,
        activeEra,
        maxNominatorRewardedPerValidator,
        bondingDuration,
      } = data.staking;

      staking = {
        electionClosed: !!electionClosed,
        activeEra: Number(activeEra),
        maxNominatorRewardedPerValidator:
          Number(maxNominatorRewardedPerValidator) || 128,
        bondingDuration: Number(bondingDuration) || 28,
      };
    }

    if (typeof data.minRewarded === "string") {
      minRewarded = BigNumber(data.minRewarded);
    }
  }

  return {
    validators,
    staking,
    minRewarded,
  };
}

const updates = new Subject<PolkadotPreloadData>();

export function getCurrentPolkadotPreloadData(): PolkadotPreloadData {
  // Override the value with ENV for testing purpose.
  const minRewarded =
    getEnv("POLKADOT_MINIMUM_REWARDED") ||
    currentPolkadotPreloadedData.minRewarded;

  return {
    validators: currentPolkadotPreloadedData.validators,
    staking: currentPolkadotPreloadedData.staking,
    minRewarded,
  };
}

export function setPolkadotPreloadData(data: PolkadotPreloadData) {
  if (data === currentPolkadotPreloadedData) return;

  currentPolkadotPreloadedData = data;

  updates.next(data);
}

export function getPolkadotPreloadDataUpdates(): Observable<PolkadotPreloadData> {
  return updates.asObservable();
}

/**
 * load max cache time for the validators
 */
export const getPreloadStrategy = () => ({
  preloadMaxAge: PRELOAD_MAX_AGE,
});

const shouldRefreshValidators = (previousState, currentState) => {
  return !previousState || currentState.activeEra !== previousState.activeEra;
};

export const preload = async (): Promise<PolkadotPreloadData> => {
  await getRegistry(); // ensure registry is already in cache.
  const currentStakingProgress = await getStakingProgress();

  const {
    validators: previousValidators,
    staking: previousStakingProgress,
    minRewarded: previousMinRewarded,
  } = currentPolkadotPreloadedData;

  let validators = previousValidators;
  let minRewarded = previousMinRewarded;

  if (
    !minRewarded ||
    minRewarded.eq(0) ||
    !validators ||
    !validators.length ||
    shouldRefreshValidators(previousStakingProgress, currentStakingProgress)
  ) {
    log("polkadot/preload", "refreshing polkadot validators...");
    try {
      validators = await getValidators("all");
      minRewarded = getMinRewarded(validators);
    } catch (error) {
      log("polkadot/preload", "failed to fetch validators", { error });
    }
  }

  return {
    validators,
    staking: currentStakingProgress,
    minRewarded,
  };
};

export const hydrate = (data: mixed) => {
  const hydrated = fromHydratePreloadData(data);

  log(
    "polkadot/preload",
    "hydrate " + hydrated.validators.length + " polkadot validators"
  );

  setPolkadotPreloadData(hydrated);
};
