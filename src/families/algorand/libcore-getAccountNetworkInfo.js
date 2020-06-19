// @flow
import { BigNumber } from "bignumber.js";
import type { Account } from "../../types";
import type { NetworkInfo } from "./types";
import type { CoreAccount } from "../../libcore/types";
import { libcoreAmountToBigNumber } from "../../libcore/buildBigNumber";

type Input = {
  coreAccount: CoreAccount,
  account: Account,
};

type Output = Promise<NetworkInfo>;

async function stellar({ coreAccount }: Input): Output {
  // const algorandLikeAccount = await coreAccount.asAlgorandAccount();
  const fees = "1000";

  return {
    family: "algorand",
    fees: BigNumber(fees),
  };
}

export default stellar;
