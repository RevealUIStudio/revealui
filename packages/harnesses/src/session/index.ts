export {
  sessionEnd,
  sessionRegister,
  type EndOptions,
  type RegisterOptions,
  type SessionBoundaryResult,
} from './boundary.js';
export { runSessionCli } from './cli.js';
export {
  clearDaemonSessionCache,
  clearHookIdentity,
  daemonSessionCachePath,
  defaultIdentityDir,
  loadHookIdentity,
  parseFingerprint,
  readDaemonSessionCache,
  resolveAfterRegister,
  saveHookIdentity,
  writeDaemonSessionCache,
  type HookIdentity,
} from './identity-cache.js';
export { defaultSocketPath, isDaemonSocketPresent, rpcCall } from './rpc.js';
export { hashParams, signRpc } from './sign.js';
