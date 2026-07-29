export {
  type EndOptions,
  type RegisterOptions,
  type SessionBoundaryResult,
  sessionEnd,
  sessionRegister,
} from './boundary.js';
export { runSessionCli } from './cli.js';
export {
  clearDaemonSessionCache,
  clearHookIdentity,
  daemonSessionCachePath,
  defaultIdentityDir,
  type HookIdentity,
  loadHookIdentity,
  parseFingerprint,
  readDaemonSessionCache,
  resolveAfterRegister,
  saveHookIdentity,
  writeDaemonSessionCache,
} from './identity-cache.js';
export { defaultSocketPath, isDaemonSocketPresent, rpcCall } from './rpc.js';
export { hashParams, signRpc } from './sign.js';
