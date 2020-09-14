// @flow

import type { Resolver } from "../../hw/getAddress/types";
import Polkadot from "./ledger-app/Polkadot";
import BIPPath from "bip32-path";

const resolver: Resolver = async (transport, { path, verify }) => {
  const polkadot = Polkadot.newPolkadotApp(transport);

  const bipPath = BIPPath.fromString(path).toPathArray();
  const r = await polkadot.getAddress(
    bipPath[2],
    bipPath[3],
    bipPath[4],
    verify
  );

  return {
    address: r.address,
    publicKey: r.pubKey,
    path,
  };
};

export default resolver;
