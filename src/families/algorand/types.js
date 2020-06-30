// @flow

import type { BigNumber } from "bignumber.js";
import type {
  TransactionCommon,
  TransactionCommonRaw,
} from "../../types/transaction";

import type { Operation, OperationRaw } from "../../types/operation";
import type { CoreAmount, CoreBigInt, Spec } from "../../libcore/types";

export type CoreStatics = {
  AlgorandPaymentInfo: Class<AlgorandPaymentInfo>,
  AlgorandAssetTransferInfo: Class<AlgorandAssetTransferInfo>,
};

export type CoreAccountSpecifics = {
  asAlgorandAccount(): Promise<CoreAlgorandAccount>,
};

export type CoreOperationSpecifics = {
  asAlgorandOperation(): Promise<CoreAlgorandOperation>,
};

declare class AlgorandPaymentInfo {
  static init(
    amount: string,
    recipientAddress: string
  ): Promise<AlgorandPaymentInfo>;
}

declare class AlgorandAssetTransferInfo {
  static init(
    assetId: string,
    amount: string,
    recipientAddress: string
  ): Promise<AlgorandAssetTransferInfo>;
}

declare class CoreAlgorandTransaction {
  getId(): Promise<string>;
  getType(): Promise<string>;
  getSender(): Promise<string>;
  getFee(): Promise<string>;
  getNote(): Promise<string>;
  getRound(): Promise<string>;

  setSender(sender: string): void;
  setFee(fee: string): void;
  setNote(note: string): void;

  setPaymentInfo(info: AlgorandPaymentInfo): void;
  setAssetTransferInfo(info: AlgorandAssetTransferInfo): void;
}

declare class CoreAlgorandAccount {
  createEmptyTransaction(): CoreAlgorandTransaction;
  getFeeEstimate(transaction: CoreAlgorandTransaction): Promise<CoreAmount>;
}

declare class CoreAlgorandOperation {
  getTransaction(): Promise<CoreAlgorandTransaction>;
}

export type CoreCurrencySpecifics = {};

export type AlgorandResources = {|
  rewards: BigNumber,
  rewardsAccumulated: BigNumber,
|};

export type AlgorandResourcesRaw = {|
  rewards: BigNumber,
  rewardsAccumulated: BigNumber,
|};

export type AlgorandOperationMode = "send" | "optIn" | "optOut";

export type {
  CoreAlgorandOperation,
  CoreAlgorandAccount,
  CoreAlgorandTransaction,
};

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
  mode: AlgorandOperationMode,
  networkInfo: ?NetworkInfo,
  fees: ?BigNumber,
  assetId?: string,
  memo: ?string,
|};

export type TransactionRaw = {|
  ...TransactionCommonRaw,
  family: "algorand",
  mode: AlgorandOperationMode,
  networkInfo: ?NetworkInfoRaw,
  fees: ?string,
  assetId?: string,
  memo: ?string,
|};

export type AlgorandOperation = {|
  ...Operation,
  extra: AlgorandExtraTxInfo,
|};

export type AlgorandOperationRaw = {|
  ...OperationRaw,
  extra: AlgorandExtraTxInfo,
|};

export type AlgorandExtraTxInfo = {
  rewards?: BigNumber,
  memo?: string,
  assetId?: string,
};

export const reflect = (declare: (string, Spec) => void) => {
  declare("AlgorandAccount", {
    methods: {
      createEmptyTransaction: {
        returns: "AlgorandTransaction",
      },
    },
  });

  declare("AlgorandOperation", {
    methods: {
      getTransaction: {
        returns: "AlgorandTransaction",
      },
    },
  });

  declare("AlgorandTransaction", {
    methods: {
      getId: {},
      setSender: {},
      setFee: {},
      setNote: {},
      setPaymentInfo: {
        params: ["AlgorandPaymentInfo"],
      },
      setAssetTransferInfo: {
        params: ["AlgorandAssetTransferInfo"],
      },
    },
  });

  declare("AlgorandPaymentInfo", {
    njsUsesPlainObject: true,
    statics: {
      init: {
        params: [null, null],
        returns: "AlgorandPaymentInfo",
        njsInstanciateClass: [
          {
            amount: 0,
            recipientAddress: 1,
          },
        ],
      },
    },
  });

  declare("AlgorandAssetTransferInfo", {
    njsUsesPlainObject: true,
    statics: {
      init: {
        params: [null, null, null],
        returns: "AlgorandAssetTransferInfo",
        njsInstanciateClass: [
          {
            assetId: 0,
            amount: 1,
            recipientAddress: 2,
          },
        ],
      },
    },
  });

  return {
    OperationMethods: {
      asAlgorandOperation: {
        returns: "AlgorandOperation",
      },
    },
    AccountMethods: {
      asAlgorandAccount: {
        returns: "AlgorandAccount",
      },
    },
  };
};
