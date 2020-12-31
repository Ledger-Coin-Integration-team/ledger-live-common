// @flow

import { TypeRegistry } from '@polkadot/types';
import { getSpecTypes } from '@polkadot/types-known';
import { Metadata } from '@polkadot/metadata';
import { extrinsicsFromMeta } from '@polkadot/metadata/decorate';

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

// TODO: Put this in cache
export const createDecoratedTxs = (registry: TypeRegistry, metadataRpc: any) => {
    return extrinsicsFromMeta(registry, new Metadata(registry, metadataRpc));
}

/**
 * Given a chain name, a spec name, and a spec version, return the corresponding type registry for Polkadot.
 * @see https://github.com/polkadot-js/api/tree/master/packages/types-known
 */
// TODO: Put this in cache
export const getRegistry = (info: any) => {

    const registry = new TypeRegistry();
    // Register types specific to chain/runtimeVersion
    registry.register(getSpecTypes(registry, info.chainName, info.specName, info.specVersion));
    // Register the chain properties for this registry
    registry.setChainProperties(registry.createType('ChainProperties', defaultPolkadotProperties));
    registry.setMetadata(new Metadata(registry, info.metadataRpc));

    return registry;
}
