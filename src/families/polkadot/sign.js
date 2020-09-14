// @flow

import { methods, getRegistry } from "@substrate/txwrapper";
import type { Transaction } from "./types";
import type { Account } from "../../types";

const rpcToNode = (method: string, params: any[] = []): Promise<any> => {
  return fetch("http://localhost:9933", {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method,
      params,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  })
    .then((response) => response.json())
    .then(({ error, result }) => {
      if (error) {
        throw new Error(
          `${error.code} ${error.message}: ${JSON.stringify(error.data)}`
        );
      }

      return result;
    });
};

const getNonce = (a: Account) => {
  return (a.polkadotResources?.nonce || 0) + a.pendingOperations.length;
};

export const signPayload = async ({ a, t }: { a: Account, t: Transaction }) => {
  const { block } = await rpcToNode("chain_getBlock");
  const blockHash = await rpcToNode("chain_getBlockHash");
  const genesisHash = await rpcToNode("chain_getBlockHash", [0]);
  const metadataRpc = await rpcToNode("state_getMetadata");
  const { specVersion, transactionVersion } = await rpcToNode(
    "state_getRuntimeVersion"
  );

  const registry = getRegistry("Polkadot", "polkadot", specVersion);

  const unsigned = methods.balances.transferKeepAlive(
    {
      dest: t.recipient,
      value: t.amount.toString(),
    },
    {
      address: a.freshAddress,
      blockHash,
      blockNumber: registry
        .createType("BlockNumber", block.header.number)
        .toNumber(),
      genesisHash,
      metadataRpc, // must import from client RPC call state_getMetadata
      nonce: getNonce(a),
      specVersion,
      tip: 0,
      eraPeriod: 64, // number of blocks from checkpoint that transaction is valid
      transactionVersion,
    },
    {
      metadataRpc,
      registry, // Type registry
    }
  );

  const extrinsicPayload = registry.createType("ExtrinsicPayload", unsigned, {
    version: unsigned.version,
  });

  return extrinsicPayload.toU8a({ method: true });
};
