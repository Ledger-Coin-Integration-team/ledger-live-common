// export { getOperations } from "./subscan";

export { getOperations } from "./bisontrails";

// export {
// isElectionClosed,
// isNewAccount,
// isControllerAddress,
// verifyValidatorAddresses,
// getAccount,
// getTransactionParams,
// submitExtrinsic,
// paymentInfo,
// getValidators,
// getStakingProgress,
// disconnect,
// } from "./websocket";

// commented until we got a sidecar public url
export {
  isElectionClosed,
  isNewAccount,
  isControllerAddress,
  verifyValidatorAddresses,
  getAccount,
  getTransactionParams,
  submitExtrinsic,
  paymentInfo,
  getValidators,
  getStakingProgress,
  disconnect,
} from "./sidecar";
