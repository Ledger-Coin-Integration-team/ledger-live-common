import { disconnect as polkadotApiDisconnect } from "../families/polkadot/api";

export async function disconnectAll() {
  await polkadotApiDisconnect();
}
