// @flow
import uniq from "lodash/uniq";
import compact from "lodash/compact";
import { BigNumber } from "bignumber.js";
import { getEnv } from "../../env";
import { WsProvider, ApiPromise } from "@polkadot/api";
import { u8aToString } from "@polkadot/util";

import type {
  AccountId,
  RewardPoint,
  Registration,
} from "@polkadot/types/interfaces";
import type { Data, Option } from "@polkadot/types";
import type { ITuple } from "@polkadot/types/types";
import type { PolkadotValidator } from "../../families/polkadot/types";

type AsyncApiFunction = (api: typeof ApiPromise) => Promise<any>;

const VALIDATOR_COMISSION_RATIO = 1000000000;

const getWsUrl = () => getEnv("API_POLKADOT_NODE");

let api;

/**
 * Connects to Substrate Node, executes calls then disconnects
 *
 * @param {*} execute - the calls to execute on api
 */
async function withApi(execute: AsyncApiFunction): Promise<any> {
  if (api) {
    await api.isReady;
    const res = await execute(api);

    return res;
  }

  const wsProvider = new WsProvider(getWsUrl());
  api = await ApiPromise.create({ provider: wsProvider });

  try {
    await api.isReady;
    const res = await execute(api);

    return res;
  } finally {
    const disconnecting = api;
    api = undefined;

    await disconnecting.disconnect();
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

/**
 * Fetch all reward points for validators for current era
 *
 * @returns Map<String, BigNumber>
 */
export const fetchRewardPoints = async () =>
  withApi(async (api: typeof ApiPromise) => {
    const activeOpt = await api.query.staking.activeEra();

    const { index: activeEra } = activeOpt.unwrapOrDefault();

    const { individual } = await api.query.staking.erasRewardPoints(activeEra);

    // recast BTreeMap<AccountId,RewardPoint> to Map<String, RewardPoint> because strict equality does not work
    const rewards = new Map<String, RewardPoint>(
      [...individual.entries()].map(([k, v]) => [
        k.toString(),
        BigNumber(v.toString()),
      ])
    );

    return rewards;
  });

/**
 * @source https://github.com/polkadot-js/api/blob/master/packages/api-derive/src/accounts/info.ts
 */
function dataAsString(data: Data): string | undefined {
  return data.isRaw
    ? u8aToString(data.asRaw.toU8a(true))
    : data.isNone
    ? undefined
    : data.toHex();
}

/**
 * Fetch identity name of multiple addresses.
 * Get parent identity if any, and concatenate parent name with child name.
 *
 * @param {string[]} addresses
 */
export const fetchIdentities = async (addresses: string[]) =>
  withApi(async (api: typeof ApiPromise) => {
    const superOfOpts = await api.query.identity.superOf.multi<
      Option<ITuple<[AccountId, Data]>>
    >(addresses);

    const withParent = superOfOpts.map((superOfOpt) =>
      superOfOpt?.isSome ? superOfOpt?.unwrap() : undefined
    );

    const parentAddresses = uniq(
      compact(withParent.map((superOf) => superOf && superOf[0].toString()))
    );

    const [identities, parentIdentities] = await Promise.all([
      api.query.identity.identityOf.multi<Option<Registration>>(addresses),
      api.query.identity.identityOf.multi<Option<Registration>>(
        parentAddresses
      ),
    ]);

    const map = new Map<string, string>(
      addresses.map((addr, index) => {
        const indexOfParent = withParent[index]
          ? parentAddresses.indexOf(withParent[index][0].toString())
          : -1;

        const identityOpt =
          indexOfParent > -1
            ? parentIdentities[indexOfParent]
            : identities[index];

        if (identityOpt.isNone) {
          return [addr, ""];
        }

        const {
          info: { display },
        } = identityOpt.unwrap();

        const name = withParent[index]
          ? `${dataAsString(display)} / ${
              dataAsString(withParent[index][1]) || ""
            }`
          : dataAsString(display);

        return [addr, name];
      })
    );

    return map;
  });

/**
 * Transforms each validator into an internal Validator type.
 * @param {*} rewards - map of addres sand corresponding reward
 * @param {*} identities - map of address and corresponding identity
 * @param {*} elected - list of elected validator addresses
 * @param {*} maxNominators - constant for oversubscribed validators
 * @param {*} validator - the validator details to transform.
 */
const mapValidator = (
  rewards,
  identities,
  elected,
  maxNominators,
  validator
): PolkadotValidator => {
  const address = validator.accountId.toString();
  return {
    address: address,
    identity: identities.get(address) || "",
    nominatorsCount: validator.exposure.others.length,
    rewardPoints: rewards.get(address) || null,
    commission: BigNumber(validator.validatorPrefs.commission).dividedBy(
      VALIDATOR_COMISSION_RATIO
    ),
    totalBonded: BigNumber(validator.exposure.total),
    selfBonded: BigNumber(validator.exposure.own),
    isElected: elected.includes(address),
    isOversubscribed: validator.exposure.others.length >= maxNominators,
  };
};

/**
 * List all validators for the current era, and their exposure, and identity.
 */
export const getValidators = async (stashes: string | string[] = "elected") =>
  withApi(async (api: typeof ApiPromise) => {
    const [allStashes, elected] = await Promise.all([
      api.derive.staking.stashes(),
      api.query.session.validators(),
    ]);

    const electedIds = elected.map((s) => s.toString());
    let stashIds = allStashes.map((s) => s.toString());

    if (Array.isArray(stashes)) {
      stashIds = stashIds.filter((s) => stashes.includes(s));
    } else if (stashes === "elected") {
      stashIds = electedIds;
    } else if (stashes === "waiting") {
      stashIds = stashIds.filter((v) => !electedIds.includes(v));
    }

    const [validators, rewards, identities] = await Promise.all([
      api.derive.staking.accounts(stashIds),
      fetchRewardPoints(),
      fetchIdentities(stashIds),
    ]);

    return validators.map(
      mapValidator.bind(
        null,
        rewards,
        identities,
        electedIds,
        api.consts.staking.maxNominatorRewardedPerValidator
      )
    );
  });
