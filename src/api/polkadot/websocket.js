// @flow
import { BigNumber } from "bignumber.js";
import { getEnv } from "../../env";
import { WsProvider, ApiPromise } from "@polkadot/api";

type AsyncApiFunction = (api: typeof ApiPromise) => Promise<any>;

const getWsUrl = () => getEnv("API_POLKADOT_NODE");

/**
 * Connects to Substrate Node, executes calls then disconnects
 *
 * @param {*} execute - the calls to execute on api
 */
async function withApi(execute: AsyncApiFunction): Promise<any> {
  const wsProvider = new WsProvider(getWsUrl());
  const api = await ApiPromise.create({ provider: wsProvider });

  try {
    await api.isReady;
    const res = await execute(api);

    return res;
  } finally {
    await api.disconnect();
  }
}

/**
 * Returns true if ElectionStatus is Close. If ElectionStatus is Open, some features must be disabled.
 */
export const isElectionClosed = async (): Promise<Boolean> =>
  withApi(async (api: typeof ApiPromise) => {
    const status = await api.query.staking.eraElectionStatus();

    const res = status.isClose;

    return !!res;
  });

/**
 * Get all validators addresses to check for validity.
 */
export const getValidatorsStashesAddresses = async (): Promise<string[]> =>
  withApi(async (api: typeof ApiPromise) => {
    const list = await api.derive.staking.stashes();

    return list.map((v) => v.toString());
  });

/**
 * Returns true if the address is a new account with no balance
 *
 * @param {*} addr
 */
export const isNewAccount = async (address: string): Promise<Boolean> =>
  withApi(async (api: typeof ApiPromise) => {
    const {
      nonce,
      data: { free },
    } = await api.query.system.account(address);

    return BigNumber(0).isEqualTo(nonce) && BigNumber(0).isEqualTo(free);
  });

/**
 * Returns true if the address is a new account with no balance
 *
 * @param {*} addr
 */
export const isControllerAddress = async (address: string): Promise<Boolean> =>
  withApi(async (api: typeof ApiPromise) => {
    const ledgetOpt = await api.query.staking.ledger(address);

    return ledgetOpt.isSome;
  });

/**
 * WIP - Returns all the balances for an account
 *
 * @param {*} addr - the account address
 */
export const getBalances = async (addr: string) =>
  withApi(async (api: typeof ApiPromise) => {
    const [allBalances, ledgerOpt, bonded] = await Promise.all([
      api.derive.balances.all(addr),
      api.query.staking.ledger(addr),
      api.query.staking.bonded(addr),
    ]);
    const json = JSON.parse(JSON.stringify(allBalances, null, 2));

    const ledgerJSON = JSON.parse(JSON.stringify(ledgerOpt, null, 2));
    const stash = ledgerJSON ? ledgerJSON.stash : null;
    const controller = bonded.isSome ? bonded.unwrap().toString() : null;

    return {
      balance: BigNumber(json.freeBalance),
      spendableBalance: BigNumber(json.availableBalance),
      polkadotResources: {
        controller,
        stash,
        nonce: json.accountNonce,
        lockedBalance: BigNumber(json.lockedBalance),
        unbondedBalance: BigNumber(0), // TODO
        unbondings: ledgerJSON
          ? ledgerJSON.unlocking.map((unbond) => ({
              amount: BigNumber(unbond.value),
              completionDate: new Date(),
            }))
          : [], // TODO
      },
    };
  });

export const getNominations = async (addr: string) =>
  withApi(async (api: typeof ApiPromise) => {
    const json = await api.query.staking.nominators(addr);
    const apiNominations = JSON.parse(JSON.stringify(json, null, 2));
    const nominations = apiNominations?.targets.map((t) => ({
      address: t.toString(),
    }));
    return nominations;
  });

/**
 * Returns all the params from the chain to build an extrinsic (a transaction on Substrate)
 */
export const getTransactionParams = async () =>
  withApi(async (api: typeof ApiPromise) => {
    const chainName = await api.rpc.system.chain();
    const blockHash = await api.rpc.chain.getFinalizedHead();
    const genesisHash = await api.rpc.chain.getBlockHash(0);
    const { number } = await api.rpc.chain.getHeader(blockHash);
    const metadataRpc = await api.rpc.state.getMetadata(blockHash);
    const {
      specName,
      specVersion,
      transactionVersion,
    } = await api.rpc.state.getRuntimeVersion(blockHash);

    return {
      blockHash,
      blockNumber: number,
      genesisHash,
      chainName: chainName.toString(),
      specName: specName.toString(),
      specVersion,
      transactionVersion,
      metadataRpc,
    };
  });

/**
 * The broadcast function on Substrate
 *
 * @param {string} extrinsic - the encoded extrinsic to send
 */
export const submitExtrinsic = async (extrinsic: string) =>
  withApi(async (api: typeof ApiPromise) => {
    const tx = api.tx(extrinsic);
    const hash = await api.rpc.author.submitExtrinsic(tx);

    console.log("broadcast", hash);

    return hash;
  });

/**
 * Retrieve the transaction fees and weights
 * Note: fees on Substrate are not set by the signer, but directly by the blockchain runtime.
 *
 * @param {string} extrinsic - the encoded extrinsic to send with a fake signing
 */
export const paymentInfo = async (extrinsic: string) =>
  withApi(async (api: typeof ApiPromise) => {
    const info = await api.rpc.payment.queryInfo(extrinsic);

    return info;
  });
