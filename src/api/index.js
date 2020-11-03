const { disconnect } = require("../hw");

import { disconnect as polkadotApiDisconnect } from "./polkadot";

export async function disconnectAll() {
  await polkadotApiDisconnect();
}
