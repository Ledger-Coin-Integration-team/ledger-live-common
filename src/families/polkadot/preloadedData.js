// @flow
import { Observable, Subject } from "rxjs";
import type { PolkadotPreloadData } from "./types";

// this module holds the cached state of preload()

// eslint-disable-next-line no-unused-vars
let currentPolkadotPreloadedData: PolkadotPreloadData = {
  // NB initial state because UI need to work even if it's currently "loading", typically after clear cache
  validators: [],
};

export function asSafePolkadotPreloadData(data: mixed): PolkadotPreloadData {
  // NB this function must not break and be resilient to changes in data
  const validators = [];
  if (typeof data === "object" && data) {
    const validatorsUnsafe = data.validators;
    if (
      typeof validatorsUnsafe === "object" &&
      validatorsUnsafe &&
      Array.isArray(validatorsUnsafe)
    ) {
      validatorsUnsafe.forEach((v) => {
        // FIXME if model changes, we should validate the object
        validators.push(v);
      });
    }
  }

  return {
    validators,
  };
}

const updates = new Subject<PolkadotPreloadData>();

export function setPolkadotPreloadData(data: PolkadotPreloadData) {
  if (data === currentPolkadotPreloadedData) return;
  currentPolkadotPreloadedData = data;
  updates.next(data);
}

export function getCurrentPolkadotPreloadData(): PolkadotPreloadData {
  return currentPolkadotPreloadedData;
}

export function getPolkadotPreloadDataUpdates(): Observable<PolkadotPreloadData> {
  return updates.asObservable();
}
