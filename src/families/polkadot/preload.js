/* eslint-disable no-prototype-builtins */
// @flow
import { BigNumber } from "bignumber.js";
import { Observable, Subject } from "rxjs";
import { log } from "@ledgerhq/logs";

import type { PolkadotPreloadData, PolkadotValidator } from "./types";
import { getStakingProgress, getValidators } from "./validators";

let currentPolkadotPreloadedData: PolkadotPreloadData = {
  validators: [],
  staking: null,
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
  };
}

const shouldRefreshValidators = (previousState, currentState) => {
  return !previousState || currentState.activeEra !== previousState.activeEra;
};

export function fromHydratePreloadData(data: mixed): PolkadotPreloadData {
  let validators = [];
  let staking = null;

  if (typeof data === "object" && data) {
    if (Array.isArray(data.validators)) {
      validators = data.validators.map(fromHydrateValidator);
    }

    if (data.staking !== null && typeof data.staking === "object") {
      staking = {
        electionClosed: !!data.staking.electionClosed,
        activeEra: Number(data.staking.activeEra),
      };
    }
  }

  return {
    validators,
    staking,
  };
}

const updates = new Subject<PolkadotPreloadData>();

export function getCurrentPolkadotPreloadData(): PolkadotPreloadData {
  return currentPolkadotPreloadedData;
}

export function setPolkadotPreloadData(data: PolkadotPreloadData) {
  if (data === currentPolkadotPreloadedData) return;

  currentPolkadotPreloadedData = data;

  updates.next(data);
}

export function getPolkadotPreloadDataUpdates(): Observable<PolkadotPreloadData> {
  return updates.asObservable();
}

export const preload = async (): Promise<PolkadotPreloadData> => {
  const currentStakingProgress = await getStakingProgress();

  const {
    validators: previousValidators,
    staking: previousStakingProgress,
  } = currentPolkadotPreloadedData;

  let validators = previousValidators;

  if (
    shouldRefreshValidators(previousStakingProgress, currentStakingProgress)
  ) {
    log("polkadot/preload", "refreshing polkadot validators...");
    try {
      validators = await getValidators("all");
    } catch (error) {
      log("polkadot/preload", "failed to fetch validators", { error });
    }
  }

  return {
    validators,
    staking: currentStakingProgress,
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