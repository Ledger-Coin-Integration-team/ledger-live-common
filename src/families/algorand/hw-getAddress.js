// @flow

import type { Resolver } from "../../hw/getAddress/types";
import Algorand from "./ledger-app/Algorand";
import BIPPath from "bip32-path";

const resolver: Resolver = async (transport, { path, verify }) => {
  const algorand = new Algorand(transport);

  const r = await algorand.getAddress(path, verify || false);

  return {
    address: "",
    publicKey: r.publicKey,
    path,
  };
};

export default resolver;
