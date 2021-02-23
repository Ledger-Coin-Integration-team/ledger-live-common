// @flow

import type {
  FiatCurrency,
  CryptoCurrency,
  CryptoCurrencyIds,
} from "@ledgerhq/cryptoassets/lib/types";
import {
  getFiatCurrencyByTicker,
  getCryptoCurrencyById,
  hasCryptoCurrencyId,
  registerCryptoCurrency,
} from "@ledgerhq/cryptoassets";
import { getEnv } from "../env";

registerCryptoCurrency("mycoin", {
  type: "CryptoCurrency",
  id: "mycoin",
  coinType: 8008, // The slip-0044 coin type if registered
  name: "MyCoin",
  managerAppName: "MyCoin", // name of the nano app in manager case-sensitive
  ticker: "MYC",
  countervalueTicker: "MYC", // depending on the counter value api
  scheme: "mycoin",
  color: "#6490F1", // color to be display on live-desktop and mobile
  family: "mycoin", // folder name in the live-common / desktop and mobile
  units: [
    {
      name: "MYC",
      code: "MYC",
      magnitude: 8,
    },
    {
      name: "SmallestUnit",
      code: "SMALLESTUNIT",
      magnitude: 0,
    },
  ],
  explorerViews: [
    {
      address: "https://mycoinexplorer.com/account/$address", // url for exploring an address
      tx: "https://mycoinexplorer.com/transaction/$hash", // url for exploring a transaction
      token: "https://mycoinexplorer.com/token/$contractAddress/?a=$address", // url for exploring a token address
    },
  ],
});

// set by user side effect to precise which currencies are considered supported (typically by live)
let userSupportedCurrencies: CryptoCurrency[] = [];

let userSupportedFiats = [];
// Current list was established with what our API really supports
// to update the list,
// 1. $ ledger-live countervalues --format supportedFiats --fiats
// 2. copy & paste the output
setSupportedFiats([
  "AED",
  "AUD",
  "BGN",
  "BHD",
  "BRL",
  "CAD",
  "CHF",
  "CLP",
  "CNY",
  "CRC",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "GHS",
  "HKD",
  "HRK",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "IRR",
  "JPY",
  "KES",
  "KHR",
  "KRW",
  "MUR",
  "MXN",
  "MYR",
  "NGN",
  "NOK",
  "NZD",
  "PHP",
  "PKR",
  "PLN",
  "RON",
  "RUB",
  "SEK",
  "SGD",
  "THB",
  "TRY",
  "TZS",
  "UAH",
  "UGX",
  "USD",
  "VES",
  "VND",
  "VUV",
  "ZAR",
]);

export function isFiatSupported(fiat: FiatCurrency) {
  return userSupportedFiats.includes(fiat);
}

export function setSupportedFiats(ids: string[]) {
  userSupportedFiats = ids.map(getFiatCurrencyByTicker);
}

export function listSupportedFiats(): FiatCurrency[] {
  return userSupportedFiats;
}

export function setSupportedCurrencies(ids: CryptoCurrencyIds[]) {
  userSupportedCurrencies = ids.map((id) => getCryptoCurrencyById(id));
}

function getExperimentalSupports() {
  return getEnv("EXPERIMENTAL_CURRENCIES")
    .split(",")
    .filter(
      (id) =>
        hasCryptoCurrencyId(id) &&
        !userSupportedCurrencies.find((c) => c.id === id)
    )
    .map(getCryptoCurrencyById);
}

export function listSupportedCurrencies(): CryptoCurrency[] {
  const experimentals = getExperimentalSupports();
  return experimentals.length === 0
    ? userSupportedCurrencies
    : userSupportedCurrencies.concat(experimentals);
}

export function isCurrencySupported(currency: CryptoCurrency) {
  return listSupportedCurrencies().includes(currency);
}
