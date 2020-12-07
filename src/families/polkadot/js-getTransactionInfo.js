// @flow
import { getRegistry } from "./registry";
import { getTransactionParams } from "./api";
import type { Account } from "../../types";

const ERA_PERIOD = 64; // number of blocks from checkpoint that transaction is valid

const getNonce = (a: Account): number => {
  const lastPendingOp = a.pendingOperations[0];

  const nonce = Math.max(
    a.polkadotResources?.nonce || 0,
    lastPendingOp && typeof lastPendingOp.transactionSequenceNumber === "number"
      ? lastPendingOp.transactionSequenceNumber + 1
      : 0
  );

  return nonce;
};

const getTxInfo = async (a: Account) => {
  const {
    blockHash,
    blockNumber,
    genesisHash,
    chainName,
    specName,
    specVersion,
    transactionVersion,
    metadataRpc,
  } = await getTransactionParams();

  const registry = getRegistry(specName, specVersion, metadataRpc);

  const txBaseInfo = {
    address: a.freshAddress,
    blockHash,
    blockNumber,
    genesisHash,
    metadataRpc,
    nonce: getNonce(a),
    specVersion,
    tip: 0,
    eraPeriod: ERA_PERIOD,
    transactionVersion,
  };

  const txOptions = {
    metadataRpc,
    registry,
  };

  return { txBaseInfo, txOptions };
};

export default getTxInfo;
