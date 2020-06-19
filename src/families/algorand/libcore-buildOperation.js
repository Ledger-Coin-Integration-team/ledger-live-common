// @flow

import type { CoreOperation } from "../../libcore/types";
import type { Operation } from "../../types";
import { libcoreBigIntToBigNumber } from "../../libcore/buildBigNumber";

async function algorandBuildOperation({
  coreOperation,
}: {
  coreOperation: CoreOperation,
}) {
  const algorandLikeOperation = await coreOperation.asAlgorandOperation();
  const algorandLikeTransaction = await algorandLikeOperation.getTransaction();
  const hash = await algorandLikeTransaction.getId();

  const out: $Shape<Operation> = {
    hash,
  };

  return out;
}

export default algorandBuildOperation;
