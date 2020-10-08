// @flow
import type { Account } from "../../types";

// when the account is a stash, we have the information of which account is the controller
export const isStash = (a: Account) => {
  return !a.polkadotResources?.controller;
};

// when account is a controller, we have the information of which stash it controls
export const isController = (a: Account) => {
  return !a.polkadotResources?.stash;
};
