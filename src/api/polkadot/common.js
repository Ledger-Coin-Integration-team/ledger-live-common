// @flow

// camelCase is for bisontrail
// snake_case for subscan

export const getOperationType = (pallet: string, palletMethod: string) => {
  switch (palletMethod) {
    case "transfer":
    case "transfer_keep_alive":
    case "transferKeepAlive":
      return "OUT";

    case "bond_extra":
    case "bondExtra":
    case "bond":
      return "FREEZE";

    case "unbond":
      return "UNFREEZE";

    case "nominate":
      return "DELEGATE";

    case "chill":
    case "payout_stakers":
    case "payoutStakers":
      return "FEES";

    default:
      console.warn(`Unhandled operation type ${pallet}.${palletMethod}`);
      return "FEES";
  }
};
