// @flow

const Util = require("@polkadot/util");

import { TypeRegistry } from '@polkadot/types';
import { ModulesWithCalls } from '@polkadot/types/types';
import { extrinsicsFromMeta } from '@polkadot/metadata/decorate';
import { stringCamelCase } from '@polkadot/util';

import { getSpecTypes } from '@polkadot/types-known';
import { Metadata } from '@polkadot/metadata';
import memoizee from 'memoizee';

const POLKADOT_CHAIN_NAME = "Polkadot";

// Prefix for SS58-encoded addresses on Polkadot.
const POLKADOT_SS58_FORMAT = 0;

// Hardcode some chain properties of Polkadot. These are normally returned
// by `system_properties` call, but since they don't change much, it's pretty
// safe to hardcode them.
const defaultPolkadotProperties = {
    ss58Format: POLKADOT_SS58_FORMAT,
    tokenDecimals: 12,
    tokenSymbol: 'DOT',
};

const EXTRINSIC_VERSION = 4;

// Default values for tx parameters, if the user doesn't specify any
const DEFAULTS = {
    tip: 0,
    eraPeriod: 64,
};

function createDecoratedTxs(registry: TypeRegistry, metadataRpc: string): ModulesWithCalls {
    return extrinsicsFromMeta(registry, createMetadata(registry, metadataRpc));
}

function createMetadataUnmemoized(registry: TypeRegistry, metadataRpc: string): Metadata {
    return new Metadata(registry, metadataRpc);
}

export const createMetadata = memoizee(createMetadataUnmemoized, { length: 2 });

/**
 * Given a a spec name, and a spec version, return the corresponding type registry for Polkadot.
 * 
 * @see https://github.com/polkadot-js/api/tree/master/packages/types-known
 * @param specName - The name of the runtime spec. Returned by RPC
 * `state_getRuntimeVersion`.
 * @param specVersion - The spec version of Polkadot for which we want to
 * create a type registry. Returned by RPC `state_getRuntimeVersion`.
 * @param metadataRpc - Used to run `registry.setMetadata()`
 */
export const getRegistry = (specName: string, specVersion: string, metadataRpc: any) => {
    console.log("XXXXX - getRegistry");
    const registry = new TypeRegistry();
    // Register types specific to chain/runtimeVersion
    registry.register(getSpecTypes(registry, POLKADOT_CHAIN_NAME, specName, specVersion));
    // Register the chain properties for this registry
    registry.setChainProperties(registry.createType('ChainProperties', defaultPolkadotProperties));
    registry.setMetadata(createMetadata(registry, metadataRpc));
    return registry;
}

/**
 * Serialize a signed transaction in a format that can be submitted over the
 * Node RPC Interface from the signing payload and signature produced by the
 * remote signer.
 *
 * @param unsigned - The JSON representing the unsigned transaction.
 * @param signature - Signature of the signing payload produced by the remote signer.
 * @param options - Registry and metadata used for constructing the method.
 */
export const createSignedTx = (unsigned: any, signature: any, options: any) => {
    const { registry } = options;
    const extrinsic = registry.createType('Extrinsic', { method: unsigned.method }, { version: unsigned.version });
    extrinsic.addSignature(unsigned.address, signature, unsigned);
    return extrinsic.toHex();
}

/**
 * Helper function to construct an offline method.
 *
 * @param info - Information required to construct the transaction.
 * @param options - Registry and metadata used for constructing the method.
 */
function createMethod(info: any, options: any) {
    const { metadataRpc, registry } = options;
    const metadata = createDecoratedTxs(registry, metadataRpc);
    const methodFunction = metadata[info.method.pallet][info.method.name];
    const method = methodFunction(...methodFunction.meta.args.map((arg) => {
        if (info.method.args[stringCamelCase(arg.name.toString())] === undefined) {
            throw new Error(`Method ${info.method.pallet}::${info.method.name} expects argument ${arg.toString()}, but got undefined`);
        }
        return info.method.args[stringCamelCase(arg.name.toString())];
    })).toHex();

    const eraPeriod = DEFAULTS.eraPeriod

    return {
        address: info.address,
        blockHash: info.blockHash,
        blockNumber: registry.createType('BlockNumber', info.blockNumber).toHex(),
        era: registry
            .createType('ExtrinsicEra', {
                current: info.blockNumber,
                period: eraPeriod,
            }).toHex(),
        genesisHash: info.genesisHash,
        metadataRpc,
        method,
        nonce: registry.createType('Compact<Index>', info.nonce).toHex(),
        signedExtensions: registry.signedExtensions,
        specVersion: registry.createType('u32', info.specVersion).toHex(),
        tip: registry
            .createType('Compact<Balance>', info.tip || DEFAULTS.tip)
            .toHex(),
        transactionVersion: registry
            .createType('u32', info.transactionVersion)
            .toHex(),
        version: EXTRINSIC_VERSION,
    };
}

// Construct a balance transfer transaction offline.
export const transferKeepAlive = (args: any, info: any, options: any) => {
    return createMethod(Object.assign({ method: {
        args,
        name: 'transferKeepAlive',
        pallet: 'balances',
    } }, info), options);
}

// Construct a transaction to bond funds and create a Stash account.
export const bond = (args: any, info: any, options: any) => {
    return createMethod(Object.assign({ method: {
        args,
        name: 'bond',
        pallet: 'staking',
    } }, info), options);
}

// Add some extra amount from the stash `free_balance` into the staking balance.
// Can only be called when `EraElectionStatus` is `Closed`.
export const bondExtra = (args: any, info: any, options: any) => {
    return createMethod(Object.assign({ method: {
        args,
        name: 'bondExtra',
        pallet: 'staking',
    } }, info), options);
}

// Construct a transaction to unbond funds from a Stash account.
// Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
export const unbond = (args: any, info: any, options: any) => {
    return createMethod(Object.assign({ method: {
        args,
        name: 'unbond',
        pallet: 'staking',
    } }, info), options);
}

// Rebond a portion of the stash scheduled to be unlocked.
// Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
export const rebond = (args: any, info: any, options: any) => {
    return createMethod(Object.assign({ method: {
        args,
        name: 'rebond',
        pallet: 'staking',
    } }, info), options);
}

// Remove any unlocked chunks from the `unlocking` queue from our management
export const withdrawUnbonded = (args: any, info: any, options: any) => {
    return createMethod(Object.assign({ method: {
        args,
        name: 'withdrawUnbonded',
        pallet: 'staking',
    } }, info), options);
}

// Construct a transaction to nominate. This must be called by the _Controller_ account.
// Can only be called when `EraElectionStatus` is `Closed`.
export const nominate = (args: any, info: any, options: any) => {
    return createMethod(Object.assign({ method: {
        args,
        name: 'nominate',
        pallet: 'staking',
    } }, info), options);
}

// Declare the desire to cease validating or nominating. Does not unbond funds.
// Can only be called when `EraElectionStatus` is `Closed`.
export const chill = (args: any, info: any, options: any) => {
    return createMethod(Object.assign({ method: {
        args,
        name: 'chill',
        pallet: 'staking',
    } }, info), options);
}

// Pay out all the stakers behind a single validator for a single era.
// Any account can call this function, even if it is not one of the stakers.
// Can only be called when `EraElectionStatus` is `Closed`.
export const payoutStakers = (args: any, info: any, options: any) =>  {
    return createMethod(Object.assign({ method: {
        args,
        name: 'payoutStakers',
        pallet: 'staking',
    } }, info), options);
}
