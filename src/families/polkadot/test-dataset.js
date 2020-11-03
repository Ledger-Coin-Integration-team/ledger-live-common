// @flow

import { BigNumber } from "bignumber.js";
import {
  NotEnoughBalance,
  RecipientRequired,
  InvalidAddress,
  InvalidAddressBecauseDestinationIsAlsoSource,
  AmountRequired,
  NotEnoughBalanceBecauseDestinationNotCreated,
} from "@ledgerhq/errors";

import type { DatasetTest } from "../../types";
import { fromTransactionRaw } from "./transaction";
import type { Transaction } from "./types";

const dataset: DatasetTest<Transaction> = {
  implementations: ["js"],
  currencies: {
    polkadot: {
      scanAccounts: [
        {
          name: "polkadot seed 1",
          apdus: `
          => 90010000142c00008062010080000000000000000000000000
          <= 7001f89e1fccbbd92e6c5fc9b6ae4f442d791450eb8d03c1e42392dda5f1d40831335872783245775644554b4a566551695833755878576b3677504d4171557641576d38315a466b48357632436a6b799000
          => 90010000142c00008062010080000000800000008000000080
          <= 396b4b24c10b595938876d4a804106803fa2c08b7943e37b001376da0c40009931324a48627731766e587871734436553579413375394b7176703941375a6933714d3272684172655a7150357a556d539000
          => 90010000142c00008062010080010000800000008000000080
          <= 72783c94f6640b13ba5ce47f7eae3c9b5a06baca681bb169720c48773cb13e7c3133623642463634434e3770343263553479394e3571574b7036474b477377667a7a6841385233656d694e66674159369000
          => 90010000142c00008062010080020000800000008000000080
          <= 6bbf0d00e55aa723fe219927787040d7126e5ad7c55659890bad6787092ba7713133534773754736533153654c66656e75536175514d437a637472337a39534e4b723867626e587345747959696a6b549000
          => 90010000142c00008062010080030000800000008000000080
          <= bc54dd82d1a0a63e2290bb8d24b106a6d32208ec6444027264e3ba4ab0d6024c31354677444c37546b524a4679474b396f36695969716a464d314d727136565858766446513961376d355451617955599000
          => 90010000142c00008062010080040000800000008000000080
          <= b89a1a114ff8d16a9cb1da919a74a728b02c75f4f7a47641b280df2b0a816942313542336239317a6e70783452734273337374714636436d734d756341377a7859374b334c425237346d78676b3976459000
          `
        },
      ],
      accounts: [
        {
          // Account which is stash and controller
        raw: {
          id: 'js:2:polkadot:12JHbw1vnXxqsD6U5yA3u9Kqvp9A7Zi3qM2rhAreZqP5zUmS:polkadotbip44',
          seedIdentifier: '12JHbw1vnXxqsD6U5yA3u9Kqvp9A7Zi3qM2rhAreZqP5zUmS',
          name: "Polkadot 1",
          derivationMode: "polkadotbip44",
          index: 0,
          freshAddress: '12JHbw1vnXxqsD6U5yA3u9Kqvp9A7Zi3qM2rhAreZqP5zUmS',
          freshAddressPath: "44'/354'/0'/0'/0'",
          freshAddresses: [],
          blockHeight: 0,
          operations: [],
          pendingOperations: [],
          currencyId: "polkadot",
          unitMagnitude: 10,
          lastSyncDate: "",
          balance: "21000310",
        },
        transactions: [
          {
              name: "recipient and sender must not be the same",
              transaction: fromTransactionRaw({
                family: "polkadot",
                recipient: "12JHbw1vnXxqsD6U5yA3u9Kqvp9A7Zi3qM2rhAreZqP5zUmS",
                amount: "100000000",
                mode: "send",
                era: null,
                validators: [],
                fees: null,
                rewardDestination: null
              }),
              expectedStatus: {
                amount: BigNumber("10000000"),
                estimatedFees: BigNumber("1"),
                errors: {
                  recipient: new InvalidAddressBecauseDestinationIsAlsoSource(),
                },
                warnings: {},
                totalSpent: BigNumber("10000001"),
              },
            },
        ]
        }
      ]
    }
  }
};

export default dataset;