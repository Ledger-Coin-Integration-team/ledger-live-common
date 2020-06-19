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
  const stellarLikeAccount = await coreAccount.asStellarLikeAccount();
  let hash = ""; 
  // broadcast and get the transaction hash from signature 
  let startTime = Date.now();

  return patchOperationWithHash(operation, hash);
}

export default makeBroadcast({ broadcast });
