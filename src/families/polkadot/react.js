// @flow
import { useEffect, useState, useMemo } from "react";
import useMemoOnce from "../../hooks/useMemoOnce";

import {
  getCurrentPolkadotPreloadData,
  getPolkadotPreloadDataUpdates,
} from "./preloadedData";

import type {
  PolkadotValidator,
  PolkadotNomination,
  PolkadotSearchFilter,
} from "./types";

export function usePolkadotPreloadData() {
  const [state, setState] = useState(getCurrentPolkadotPreloadData);
  useEffect(() => {
    const sub = getPolkadotPreloadDataUpdates().subscribe((data) => {
      setState(data);
    });
    return () => sub.unsubscribe();
  }, []);
  return state;
}

export const searchFilter: PolkadotSearchFilter = (query) => (validator) => {
  const terms = `${validator?.identity ?? ""} ${validator?.address ?? ""}`;
  return terms.toLowerCase().includes(query.toLowerCase().trim());
};

/** Hook to search and sort SR list according to initial votes and query */
export function useSortedValidators(
  search: string,
  validators: PolkadotValidator[],
  nominations: PolkadotNomination[],
  validatorSearchFilter?: PolkadotSearchFilter = searchFilter
): PolkadotValidator[] {
  const initialVotes = useMemoOnce(() =>
    nominations.map(({ address }) => address)
  );

  const sortedVotes = useMemo(
    () =>
      validators
        .filter((validator) => initialVotes.includes(validator.address))
        .concat(
          validators.filter(
            (validator) => !initialVotes.includes(validator.address)
          )
        ),
    [validators, initialVotes]
  );

  const sr = useMemo(
    () =>
      search ? validators.filter(validatorSearchFilter(search)) : sortedVotes,
    [search, validators, sortedVotes, validatorSearchFilter]
  );

  return sr;
}