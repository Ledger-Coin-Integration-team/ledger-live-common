// @flow
import { getRegistry } from "@substrate/txwrapper";
import { getTransactionParams } from "../../api/Polkadot";
import type { Account } from "../../types";

const ERA_PERIOD = 64; // number of blocks from checkpoint that transaction is valid

const getNonce = (a: Account) => {
  return (a.polkadotResources?.nonce || 0) + a.pendingOperations.length;
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

  const registry = getRegistry(chainName, specName, specVersion);

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
