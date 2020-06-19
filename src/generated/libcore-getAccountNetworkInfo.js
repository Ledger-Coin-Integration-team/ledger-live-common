// @flow
import algorand from "../families/algorand/libcore-getAccountNetworkInfo.js";
import bitcoin from "../families/bitcoin/libcore-getAccountNetworkInfo.js";
import ethereum from "../families/ethereum/libcore-getAccountNetworkInfo.js";
import ripple from "../families/ripple/libcore-getAccountNetworkInfo.js";
import stellar from "../families/stellar/libcore-getAccountNetworkInfo.js";
import tezos from "../families/tezos/libcore-getAccountNetworkInfo.js";

export default {
  algorand,
  bitcoin,
  ethereum,
  ripple,
  stellar,
  tezos,
};
