// @flow

import { from } from "rxjs";
import { mergeMap } from "rxjs/operators";
import {
  findCryptoCurrencyByKeyword,
  listSupportedCurrencies,
} from "@ledgerhq/live-common/lib/currencies";
import {
  getDerivationModesForCurrency,
  runDerivationScheme,
  getDerivationScheme,
} from "@ledgerhq/live-common/lib/derivation";
import { setEnv, getEnv } from "@ledgerhq/live-common/lib/env";
import { getAccountPlaceholderName } from "@ledgerhq/live-common/lib/account";

export default {
  args: [
    {
      name: "currency",
      type: String,
      desc:
        "Currency name or ticker. If not provided, it will derive all supported currencies",
    },
  ],
  job: (
    arg: $Shape<{
      currency: string,
    }>
  ) =>
    from(
      arg.currency
        ? [findCryptoCurrencyByKeyword(arg.currency)].filter(Boolean)
        : listSupportedCurrencies()
    ).pipe(
      mergeMap((currency) => {
        const value = getEnv("SCAN_FOR_INVALID_PATHS");
        setEnv("SCAN_FOR_INVALID_PATHS", true);
        const modes = getDerivationModesForCurrency(currency);
        setEnv("SCAN_FOR_INVALID_PATHS", value);

        return modes.map((derivationMode) => {
          const scheme = getDerivationScheme({
            derivationMode,
            currency,
          });
          const path = runDerivationScheme(scheme, currency, {
            account: "<account>",
            node: "<change>",
            address: "<address>",
          });
          return (
            "  " +
            (derivationMode || "default") +
            ": " +
            getAccountPlaceholderName({
              currency,
              index: 0,
              derivationMode,
            }) +
            ": " +
            path
          );
        });
      })
    ),
};
