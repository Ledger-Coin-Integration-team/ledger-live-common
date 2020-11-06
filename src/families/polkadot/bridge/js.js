// @flow
import { BigNumber } from "bignumber.js";
import { Observable } from "rxjs";
// import invariant from "invariant";
import { createSignedTx } from "@substrate/txwrapper";
import type { Account, Operation, SignedOperation } from "../../../types";
import type { Transaction } from "../types";
import { open, close } from "../../../hw";
import type { AccountBridge, CurrencyBridge } from "../../../types";
// import { isInvalidRecipient } from "../../../bridge/mockHelpers";
import { getMainAccount } from "../../../account";
import {
  makeSync,
  makeScanAccounts,
  makeAccountBridgeReceive,
} from "../../../bridge/jsHelpers";
import { submitExtrinsic } from "../../../api/polkadot";
import { getAccountShape } from "../synchronisation";
import getTxInfo from "../js-getTransactionInfo";
import { getEstimatedFeesFromUnsignedTx } from "../js-getFeesForTransaction";
import buildTransaction from "../js-buildTransaction";
import getTransactionStatus from "../js-getTransactionStatus";
import { getValidators } from "../validators";
import {
  setPolkadotPreloadData,
  asSafePolkadotPreloadData,
} from "../preloadedData";
import { Polkadot } from "../ledger-app/Polkadot";
import { patchOperationWithHash } from "../../../operation";
import { ESTIMATED_FEES } from "../logic";

const receive = makeAccountBridgeReceive();

const estimateMaxSpendable = async ({
  account,
  parentAccount /*,transaction ,*/,
}) => {
  const mainAccount = getMainAccount(account, parentAccount);
  const estimatedFees = ESTIMATED_FEES; // Around 0.0154 DOT
  return BigNumber.max(0, mainAccount.spendableBalance.minus(estimatedFees));
};

const postSync = (initial: Account, parent: Account) => {
  return parent;
};

const scanAccounts = makeScanAccounts(getAccountShape);

const sync = makeSync(getAccountShape, postSync);

const createTransaction = (): Transaction => ({
  family: "polkadot",
  mode: "send",
  amount: BigNumber(0),
  recipient: "",
  useAllAmount: false,
  fees: null,
  validators: [],
  era: null,
  rewardDestination: null,
});

const updateTransaction = (t, patch) => ({ ...t, ...patch });

const prepareTransaction = async (a, t) => {
  return t;
};

// TODO : Need to fix when we got indexer
const signOperation = ({ account, transaction, deviceId }) =>
  Observable.create((o) => {
    async function main() {
      const transport = await open(deviceId);
      try {
        o.next({ type: "device-signature-requested" });

        // Sign by device

        const txInfo = await getTxInfo(account);
        console.log("buildTR");
        const unsignedTransaction = await buildTransaction(
          account,
          transaction,
          txInfo
        );

        const payload = txInfo.txOptions.registry.createType(
          "ExtrinsicPayload",
          unsignedTransaction,
          {
            version: unsignedTransaction.version,
          }
        );
        console.log("about to sign");
        const polkadot = new Polkadot(transport);
        const r = await polkadot.sign(
          account.freshAddressPath,
          payload.toU8a({ method: true })
        );

        const signature = createSignedTx(
          unsignedTransaction,
          r.signature,
          txInfo.txOptions
        );

        o.next({ type: "device-signature-granted" });

        const getValue = (): BigNumber => {
          return BigNumber(transaction.amount);
        };

        const fee = await getEstimatedFeesFromUnsignedTx(
          account,
          unsignedTransaction,
          txInfo
        );

        const value = getValue();
        const extra = {};

        const operationType = "OUT";

        const operation: $Exact<Operation> = {
          id: `${account.id}--${operationType}`,
          hash: "",
          // if it's a token op and there is no fee, this operation does not exist and is a "NONE"
          type: value.eq(0) ? "NONE" : operationType,
          value,
          fee,
          blockHash: null,
          blockHeight: null,
          senders: [account.freshAddress],
          recipients: [transaction.recipient],
          accountId: account.id,
          date: new Date(),
          extra,
        };

        o.next({
          type: "signed",
          signedOperation: {
            operation,
            signature,
            expirationDate: null,
          },
        });
      } finally {
        close(transport, deviceId);
      }
    }
    main().then(
      () => o.complete(),
      (e) => o.error(e)
    );
  });

const broadcast = async ({
  signedOperation: { signature, operation },
}: {
  signedOperation: SignedOperation,
}): Promise<Operation> => {
  const hash = await submitExtrinsic(signature);

  return patchOperationWithHash(operation, hash);
};

const accountBridge: AccountBridge<Transaction> = {
  estimateMaxSpendable,
  createTransaction,
  updateTransaction,
  getTransactionStatus,
  prepareTransaction,
  sync,
  receive,
  signOperation,
  broadcast,
};

const currencyBridge: CurrencyBridge = {
  preload: async () => {
    const validators = await getValidators("all");
    console.log("DOUBI");
    setPolkadotPreloadData({ validators });
    return Promise.resolve({ validators });
  },
  hydrate: (data: mixed) => {
    if (!data || typeof data !== "object") return;
    const { validators } = data;
    if (
      !validators ||
      typeof validators !== "object" ||
      !Array.isArray(validators)
    )
      return;
    setPolkadotPreloadData(asSafePolkadotPreloadData(data));
  },
  scanAccounts,
};

export default { currencyBridge, accountBridge };
