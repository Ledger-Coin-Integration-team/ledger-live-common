// @flow

import { disconnect as rippleApiDisconnect } from "./Ripple";
import { disconnect as polkadotApiDisconnect } from "./polkadot";

export async function disconnectAll() {
  await rippleApiDisconnect();
  await polkadotApiDisconnect();
}
