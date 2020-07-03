// @flow
import { log } from "@ledgerhq/logs";
import type { Operation } from "../../types";
import { makeBroadcast } from "../../libcore/broadcast";
import { patchOperationWithHash } from "../../operation";

const THRESHOLD_FALSE_NEGATIVE_BROADCAST_FAILURE = 20 * 1000;

async function broadcast({
  coreAccount,
  signedOperation: { operation, signature },
}): Promise<Operation> {
  const algorandAccount = await coreAccount.asAlgorandAccount();
  let hash = "";
  hash = await algorandAccount.broadcastRawTransaction(signature);

  return patchOperationWithHash(operation, hash);
}

export default makeBroadcast({ broadcast });
