// @flow

// camelCase is for BisonTrails
// snake_case for Subscan

export const getOperationType = (pallet: string, palletMethod: string) => {
  switch (palletMethod) {
    case "transfer":
    case "transfer_keep_alive":
    case "transferKeepAlive":
      return "OUT";

    case "bond":
    case "bond_extra":
    case "bondExtra":
    case "rebond":
        return "BOND";

    case "unbond":
      return "UNBOND";

    case "nominate":
      return "DELEGATE";

    case "chill":
      return "UNDELEGATE";
  
    case "withdraw_unbonded":
    case "withdrawUnbonded":
      return "WITHDRAW_UNBONDED";

    case "payout_stakers":
    case "payoutStakers":
      return "FEES";

    default:
      console.warn(`Unhandled operation type ${pallet}.${palletMethod}`);
      return "FEES";
  }
};
