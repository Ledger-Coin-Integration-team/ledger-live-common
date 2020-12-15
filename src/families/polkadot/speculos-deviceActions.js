// @flow
import type { DeviceAction } from "../../bot/types";
import type { Transaction } from "./types";
import { deviceActionFlow } from "../../bot/specs";

const acceptTransaction: DeviceAction<Transaction, *> = deviceActionFlow({
  steps: [
    {
      title: "Staking",
      button: "Rr",
    },
    {
      title: "Balances",
      button: "Rr",
    },
    {
      title: "Dest",
      button: "Rr",
      expectedValue: ({ transaction }) => transaction.recipient,
    },
    {
      title: "Value",
      button: "Rr",
      // expectedValue: ({transaction}) => To redo when nano is update today formating is weird
    },
    {
      title: "Chain",
      button: "Rr",
      expectedValue: () => "Polkadot",
    },
    {
      title: "Nonce",
      button: "Rr",
      expectedValue: ({ account }) =>
        (account.polkadotResources?.nonce || 0).toString(),
    },
    {
      title: "Tip",
      button: "Rr",
    },
    {
      title: "Controller",
      button: "Rr",
    },
    {
      title: "Payee",
      button: "Rr",
    },
    {
      title: "Max additional",
      button: "Rr",
    },
    {
      title: "Targets",
      button: "Rr",
    },
    {
      title: "Era Phase",
      button: "Rr",
    },
    {
      title: "Era Period",
      button: "Rr",
    },
    {
      title: "Block",
      button: "Rr",
    },
    {
      title: "Approve",
      button: "LRlr",
    },
  ],
});

export default { acceptTransaction };
