// @flow

import type Transport from "@ledgerhq/hw-transport";
import type { Transaction } from "./types";
import type { Account } from "../../types";

import {
  methods,
  getRegistry,
  createSignedTx,
  decode,
} from "@substrate/txwrapper";
import { Polkadot } from "./ledger-app/Polkadot";
import { getTransactionParams } from "../../api/Polkadot";

const ERA_PERIOD = 64; // number of blocks from checkpoint that transaction is valid

const getNonce = (a: Account) => {
  return (a.polkadotResources?.nonce || 0) + a.pendingOperations.length;
};

export const hwSign = async (
  transport: Transport<*>,
  { a, t }: { a: Account, t: Transaction }
) => {
  const {
    blockHash,
    blockNumber,
    genesisHash,
    metadataRpc,
    specVersion,
    transactionVersion,
  } = await getTransactionParams();

  const registry = getRegistry("Polkadot", "polkadot", specVersion);

  const unsigned = methods.balances.transferKeepAlive(
    {
      dest: t.recipient,
      value: t.amount.toString(),
    },
    {
      address: a.freshAddress,
      blockHash,
      blockNumber,
      genesisHash,
      metadataRpc, // must import from client RPC call state_getMetadata
      nonce: getNonce(a),
      specVersion,
      tip: 0,
      eraPeriod: ERA_PERIOD,
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
  const r = await polkadot.sign(
    a.freshAddressPath,
    payload.toU8a({ method: true })
  );

  console.log("hw signed", r);

  const signedTx = createSignedTx(unsigned, r.signature, {
    metadataRpc,
    registry,
  });

  console.log("signedTx", signedTx);

  return signedTx;
};
