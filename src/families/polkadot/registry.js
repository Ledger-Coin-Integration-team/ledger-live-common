// @flow

import { TypeRegistry } from '@polkadot/types';
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
