// @flow

import { from } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { asDerivationMode } from "@ledgerhq/live-common/lib/derivation";
import { withDevice } from "@ledgerhq/live-common/lib/hw/deviceAccess";
import getAddress from "@ledgerhq/live-common/lib/hw/getAddress";
import { currencyOpt, deviceOpt, inferCurrency } from "../scan";

export default {
  description:
    "Get an address with the device on specific derivations (advanced)",
  args: [
    currencyOpt,
    deviceOpt,
    { name: "path", type: String, desc: "HDD derivation path" },
    { name: "derivationMode", type: String, desc: "derivationMode to use" },
    {
      name: "verify",
      alias: "v",
      type: Boolean,
      desc: "ask for verification on device",
    },
    {
      name: "askChainCode",
      type: Boolean,
      desc: "ask for chainCode",
    },
  ],
  job: (
    arg: $Shape<{
      currency: string,
      device: string,
      path: string,
      derivationMode: string,
      verify: boolean,
      askChainCode: boolean,
    }>
  ) =>
    inferCurrency(arg).pipe(
      mergeMap((currency) => {
        if (!currency) {
          throw new Error("no currency found");
        }
        if (!arg.path) {
          throw new Error("--path is required");
        }
        asDerivationMode(arg.derivationMode || "");
        return withDevice(arg.device || "")((t) =>
          from(
            getAddress(t, {
              currency,
              path: arg.path,
              verify: !!arg.verify,
              askChainCode: !!arg.askChainCode,
              derivationMode: asDerivationMode(arg.derivationMode || ""),
            })
          )
        );
      })
    ),
};
