// @flow

import { stringCamelCase } from '@polkadot/util';
import { createDecoratedTxs } from './registry';

const EXTRINSIC_VERSION = 4;

// Default values for tx parameters, if the user doesn't specify any
const DEFAULTS = {
    tip: 0,
    eraPeriod: 64,
};

/**
 * Serialize an unsigned transaction in a format that can be signed.
 *
 * @param unsigned - The JSON representing the unsigned transaction.
 * @param registry - Registry used for constructing the payload.
 */
export const createSerializedUnsignedTx = (unsigned: any, registry: any) => {
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
 * @param registry - Registry used for constructing the payload.
 */
export const createSerializedSignedTx = (unsigned: any, signature: any, registry: any) => {
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
export const createTransactionPayload = (params: any, info: any) => {
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
