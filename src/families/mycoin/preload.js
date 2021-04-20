// @flow
import { Observable, Subject } from "rxjs";
import { log } from "@ledgerhq/logs";

import type { MyCoinPreloadData } from "./types";
import { getPreloadedData } from "./api";

const PRELOAD_MAX_AGE = 30 * 60 * 1000; // 30 minutes

let currentPreloadedData: MyCoinPreloadData = {
  somePreloadedData: {},
};

function fromHydratePreloadData(data: mixed): MyCoinPreloadData {
  let foo = null;

  if (typeof data === "object" && data) {
    if (typeof data.somePreloadedData === "object" && data.somePreloadedData) {
      foo = data.somePreloadedData.foo || "bar";
    }
  }

  return {
    somePreloadedData: { foo },
  };
}

const updates = new Subject<MyCoinPreloadData>();

export function getCurrentMyCoinPreloadData(): MyCoinPreloadData {
  return currentPreloadedData;
}

export function setMyCoinPreloadData(data: MyCoinPreloadData) {
  if (data === currentPreloadedData) return;

  currentPreloadedData = data;

  updates.next(data);
}

export function getMyCoinPreloadDataUpdates(): Observable<MyCoinPreloadData> {
  return updates.asObservable();
}

export const getPreloadStrategy = () => ({
  preloadMaxAge: PRELOAD_MAX_AGE,
});

export const preload = async (): Promise<MyCoinPreloadData> => {
  log("mycoin/preload", "preloading mycoin data...");

  const somePreloadedData = await getPreloadedData();

  return { somePreloadedData };
};

export const hydrate = (data: mixed) => {
  const hydrated = fromHydratePreloadData(data);

  log("mycoin/preload", `hydrated foo with ${hydrated.somePreloadedData.foo}`);

  setMyCoinPreloadData(hydrated);
};
