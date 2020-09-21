// @flow

import type Transport from "@ledgerhq/hw-transport";
import type { Transaction } from "./types";
import type { Account } from "../../types";

import { methods, getRegistry, createSignedTx } from "@substrate/txwrapper";
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
  const { txBaseInfo, txOptions } = await getTxInfo(a);

  const registry = getRegistry("Polkadot", "polkadot", txBaseInfo.specVersion);

  const unsigned = methods.balances.transferKeepAlive(
    {
      dest: t.recipient,
      value: t.amount.toString(),
    },
    txBaseInfo,
    txOptions
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

  const signedTx = createSignedTx(unsigned, r.signature, txOptions);

  console.log("signedTx", signedTx);

  return signedTx;
};

const getTxInfo = async (a) => {
  const {
    blockHash,
    blockNumber,
    genesisHash,
    metadataRpc,
    specVersion,
    transactionVersion,
  } = await getTransactionParams();

  const registry = getRegistry("Polkadot", "polkadot", specVersion);

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

export const hwUnbond = async (
  transport: Transport<*>,
  { a, t }: { a: Account, t: Transaction }
) => {
  const { txBaseInfo, txOptions } = await getTxInfo(a);
  console.log("hwUnbond");

  if (a.polkadotResources?.bondedBalance.lte(0)) {
    throw new Error("Nothing to unbound");
  }
  const unsigned = methods.staking.unbond(
    {
      value: t.amount.toString(),
    },
    txBaseInfo,
    txOptions
  );

  const payload = txOptions.registry.createType("ExtrinsicPayload", unsigned, {
    version: unsigned.version,
  });

  const polkadot = new Polkadot(transport);
  const r = await polkadot.sign(
    a.freshAddressPath,
    payload.toU8a({ method: true })
  );

  const signedTx = createSignedTx(unsigned, r.signature, txOptions);

  return signedTx;
};

export const hwBond = async (
  transport: Transport<*>,
  { a, t }: { a: Account, t: Transaction }
) => {
  const { txBaseInfo, txOptions } = await getTxInfo(a);
  console.log("hwBond");

  /**
   * The rewards destination. Can be "Stash", "Staked", "Controller" or "{ Account: accountId }"".
   */

  const unsigned = a.polkadotResources?.bondedBalance.gte(0)
    ? methods.staking.bondExtra(
        {
          maxAdditional: t.amount.toString(),
        },
        txBaseInfo,
        txOptions
      )
    : methods.staking.bond(
        {
          controller: a.freshAddress,
          value: t.amount.toString(),
          payee: "Stash",
        },
        txBaseInfo,
        txOptions
      );

  // const nominate = methods.staking.nominate(
  //   { targets: t.validators },
  //   txBaseInfo,
  //   txOptions
  // );

  // const unsigned = methods.utility.batch(
  //   {
  //     calls: [bond.method, nominate.method],
  //   },
  //   txBaseInfo,
  //   txOptions
  // );

  const payload = txOptions.registry.createType("ExtrinsicPayload", unsigned, {
    version: unsigned.version,
  });

  const polkadot = new Polkadot(transport);
  const r = await polkadot.sign(
    a.freshAddressPath,
    payload.toU8a({ method: true })
  );

  const signedTx = createSignedTx(unsigned, r.signature, txOptions);

  return signedTx;
};

export const hwNominate = async (
  transport: Transport<*>,
  { a, t }: { a: Account, t: Transaction }
) => {
  const { txBaseInfo, txOptions } = await getTxInfo(a);
  console.log("hwNominate");

  const unsigned = methods.staking.nominate(
    { targets: t.validators },
    txBaseInfo,
    txOptions
  );

  const payload = txOptions.registry.createType("ExtrinsicPayload", unsigned, {
    version: unsigned.version,
  });

  const polkadot = new Polkadot(transport);
  const r = await polkadot.sign(
    a.freshAddressPath,
    payload.toU8a({ method: true })
  );

  const signedTx = createSignedTx(unsigned, r.signature, txOptions);

  return signedTx;
};
