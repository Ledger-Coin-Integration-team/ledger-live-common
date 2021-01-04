/**
 * They are alternative in case of we need a fallback
 */

// export { getOperations } from "./subscan";

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
// getRegistry,
// disconnect,
// } from "./websocket";

export { getOperations } from "./bisontrails";

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
  getRegistry,
  disconnect,
} from "./sidecar";
