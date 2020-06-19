// @flow

import type { BigNumber } from "bignumber.js";
import type {
  TransactionCommon,
  TransactionCommonRaw,
} from "../../types/transaction";

import type { Operation, OperationRaw } from "../../types/operation";
import type { CoreAmount, CoreBigInt, Spec } from "../../libcore/types";

export type CoreStatics = {
};

export type CoreAccountSpecifics = {
};

export type CoreOperationSpecifics = {
  asAlgorandOperation(): Promise<CoreAlgorandLikeOperation>
};

declare class CoreAlgorandLikeTransaction {
  getId(): Promise<string>
}

declare class CoreAlgorandLikeOperation {
  getTransaction(): Promise<CoreAlgorandLikeTransaction>;
}

export type CoreCurrencySpecifics = {};

export type {
  CoreAlgorandLikeOperation,
}

export type NetworkInfo = {|
  family: "algorand",
  fees: BigNumber,
|};

export type NetworkInfoRaw = {|
  family: "algorand",
  fees: string,
|};

export type Transaction = {|
  ...TransactionCommon,
  family: "algorand",
  networkInfo: ?NetworkInfo,
  fees: ?BigNumber,
|};

export type TransactionRaw = {|
  ...TransactionCommonRaw,
  family: "algorand",
  networkInfo: ?NetworkInfoRaw,
  fees: ?string,
|};


export const reflect = (declare: (string, Spec) => void) => {
  declare("AlgorandOperation", {
    methods: {
      getTransaction: {
        returns: "AlgorandTransaction"
      }
    }
  });

  declare("AlgorandTransaction", {
    methods: {
      getId: {}
    }
  });

  return {
    OperationMethods: {
      asAlgorandOperation: {
        returns: "AlgorandOperation"
      }
    },
    AccountMethods: {
    },
  };
};
