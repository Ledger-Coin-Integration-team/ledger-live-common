// @flow

import { TypeRegistry } from '@polkadot/types';
import { ModulesWithCalls } from '@polkadot/types/types';
import { extrinsicsFromMeta } from '@polkadot/metadata/decorate';
import { stringCamelCase } from '@polkadot/util';
import { createMetadata } from './registry';

const EXTRINSIC_VERSION = 4;

// Default values for tx parameters, if the user doesn't specify any
const DEFAULTS = {
    tip: 0,
    eraPeriod: 64,
};

function createDecoratedTxs(registry: TypeRegistry, metadataRpc: string): ModulesWithCalls {
    return extrinsicsFromMeta(registry, createMetadata(registry, metadataRpc));
}

/**
 * Serialize an unsigned transaction in a format that can be signed.
 *
 * @param unsigned - The JSON representing the unsigned transaction.
 * @param registry - Registry used for constructing the payload.
 */
export const createUnsignedTx = (unsigned: any, registry: any) => {
    const payload = registry.createType("ExtrinsicPayload", unsigned, { version: unsigned.version });
    return payload.toU8a({ method: true });
}

/**
 * Serialize a signed transaction in a format that can be submitted over the
 * Node RPC Interface from the signing payload and signature produced by the
 * remote signer.
 *
 * @param unsigned - The JSON representing the unsigned transaction.
 * @param signature - Signature of the signing payload produced by the remote signer.
 * @param registry - Registry and metadata used for constructing the payload.
 */
export const createSignedTx = (unsigned: any, signature: any, registry: any) => {
    const extrinsic = registry.createType('Extrinsic', { method: unsigned.method }, { version: unsigned.version });
    extrinsic.addSignature(unsigned.address, signature, unsigned);
    return extrinsic.toHex();
}

/**
 * Helper function to construct an offline method.
 *
 * @param params - Parameters required to construct the transaction.
 * @param info - Registry and metadata used for constructing the method.
 */
function createMethod(params: any, info: any) {
    const { metadataRpc, registry } = info;
    const metadata = createDecoratedTxs(registry, metadataRpc);
    const methodFunction = metadata[params.pallet][params.name];
    const method = methodFunction(...methodFunction.meta.args.map((arg) => {
        if (params.args[stringCamelCase(arg.name.toString())] === undefined) {
            throw new Error(`Method ${params.pallet}::${params.name} expects argument ${arg.toString()}, but got undefined`);
        }
        return params.args[stringCamelCase(arg.name.toString())];
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
export const transferKeepAlive = (args: any, info: any) => {
    return createMethod({
        args,
        name: 'transferKeepAlive',
        pallet: 'balances',
    }, info);
}

// Construct a transaction to bond funds and create a Stash account.
export const bond = (args: any, info: any) => {
    return createMethod({
        args,
        name: 'bond',
        pallet: 'staking',
    }, info);
}

// Add some extra amount from the stash `free_balance` into the staking balance.
// Can only be called when `EraElectionStatus` is `Closed`.
export const bondExtra = (args: any, info: any) => {
    return createMethod({
        args,
        name: 'bondExtra',
        pallet: 'staking',
    }, info);
}

// Construct a transaction to unbond funds from a Stash account.
// Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
export const unbond = (args: any, info: any) => {
    return createMethod({
        args,
        name: 'unbond',
        pallet: 'staking',
    }, info);
}

// Rebond a portion of the stash scheduled to be unlocked.
// Must be signed by the controller, and can be only called when `EraElectionStatus` is `Closed`.
export const rebond = (args: any, info: any) => {
    return createMethod({
        args,
        name: 'rebond',
        pallet: 'staking',
    }, info);
}

// Remove any unlocked chunks from the `unlocking` queue from our management
export const withdrawUnbonded = (args: any, info: any) => {
    return createMethod({
        pallet: 'staking',
        name: 'withdrawUnbonded',
        args,
    }, info);
}

// Construct a transaction to nominate. This must be called by the _Controller_ account.
// Can only be called when `EraElectionStatus` is `Closed`.
export const nominate = (args: any, info: any) => {
    return createMethod({
        args,
        name: 'nominate',
        pallet: 'staking',
    }, info);
}

// Declare the desire to cease validating or nominating. Does not unbond funds.
// Can only be called when `EraElectionStatus` is `Closed`.
export const chill = (args: any, info: any) => {
    return createMethod({
        args,
        name: 'chill',
        pallet: 'staking',
    }, info);
}

// Pay out all the stakers behind a single validator for a single era.
// Any account can call this function, even if it is not one of the stakers.
// Can only be called when `EraElectionStatus` is `Closed`.
export const payoutStakers = (args: any, info: any) =>  {
    return createMethod({
        args,
        name: 'payoutStakers',
        pallet: 'staking',
    }, info);
}
