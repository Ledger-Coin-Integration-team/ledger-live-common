// export { getOperations } from "./subscan";

export { getOperations } from "./bisontrails";

export {
  isElectionClosed,
  verifyValidatorAddresses,
  isNewAccount,
  isControllerAddress,
  getAccount,
  getTransactionParams,
  submitExtrinsic,
  paymentInfo,
  getValidators,
  getStakingProgress,
  disconnect,
} from "./websocket";

// commented until we got a sidecar public url
// export {
//   getAccount,
//   paymentInfo,
//   isElectionClosed,
//   submitExtrinsic,
//   getTransactionParams,
//   isNewAccount,
//   isControllerAddress,
// } from "./sidecar";
