// @flow

import type { AccountLike, Account, TransactionStatus } from "../../types";
import type { Transaction } from "./types";
import type { DeviceTransactionField } from "../../transaction";
import { getMainAccount } from "../../account";
import { getAccountUnit } from "../../account";
import { formatCurrencyUnit } from "../../currencies";

const getSendFields = (transaction, status, account, source) => {
  const { amount } = transaction;
  const fields = [];

  fields.push({
    type: "text",
    label: "Type",
    value: "Send",
  });

  if (amount) {
    fields.push({
      type: "text",
      label: "Amount",
      value: formatCurrencyUnit(getAccountUnit(account), amount, {
        showCode: true,
        disableRounding: true,
      }),
    });
  }

  fields.push({
    type: "address",
    label: "From",
    address: source,
  });

  return fields;
};

function getDeviceTransactionConfig({
  account,
  parentAccount,
  transaction,
  status,
}: {
  account: AccountLike,
  parentAccount: ?Account,
  transaction: Transaction,
  status: TransactionStatus,
}): Array<DeviceTransactionField> {
  const { mode, memo, assetId } = transaction;
  const { estimatedFees } = status;
  const mainAccount = getMainAccount(account, parentAccount);
  const source = mainAccount.freshAddress;

  let fields = [];

  switch (mode) {
    case "send":
      fields = getSendFields(transaction, status, account, source);
      break;

    case "optIn":
      fields.push({
        type: "text",
        label: "Type",
        value: "Opt in",
      });

      if (assetId)
        fields.push({
          type: "text",
          label: "Asset id",
          value: assetId,
        });
      break;

    case "optOut":
      fields.push({
        type: "text",
        label: "Type",
        value: "Opt out",
      });
      if (assetId)
        fields.push({
          type: "text",
          label: "Asset id",
          value: assetId,
        });
      break;

    default:
      break;
  }

  if (memo) {
    fields.push({
      type: "text",
      label: "Memo",
      value: memo,
    });
  }

  if (estimatedFees && !estimatedFees.isZero()) {
    fields.push({
      type: "fees",
      label: "Fee",
    });
  }

  return fields;
}

export default getDeviceTransactionConfig;
