// @flow

import type Transport from "@ledgerhq/hw-transport";
import type { Transaction } from "./types";
import type { Account, } from "../../types";

import { methods, getRegistry, createSignedTx, decode } from "@substrate/txwrapper";
import { Polkadot } from "./ledger-app/Polkadot";
import { rpcToNode } from "../../api/Polkadot";

const getNonce = (a: Account) => {
  return (a.polkadotResources?.nonce || 0) + a.pendingOperations.length;
};

export const hwSign = async (transport: Transport<*>, { a, t }: { a: Account, t: Transaction }) => {
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

  const payload = registry.createType("ExtrinsicPayload", unsigned, {
    version: unsigned.version,
  });

  const polkadot = new Polkadot(transport);
  const r = await polkadot.sign(a.freshAddressPath, payload.toU8a({ method: true }));

  console.log("hw signed", r);

  const signedTx = createSignedTx(unsigned, r.signature, { metadataRpc, registry });

  console.log("signedTx", signedTx);

  return signedTx;
};
