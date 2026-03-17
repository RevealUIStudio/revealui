/**
 * React Hooks for Authentication
 *
 * Client-side React hooks for authentication.
 * Inspired by Better Auth and TanStack Start patterns.
 */

export type {
  MFASetupData,
  UseMFASetupResult,
  UseMFAVerifyResult,
} from './useMFA.js';
export { useMFASetup, useMFAVerify } from './useMFA.js';
export type {
  PasskeyRegisterOptions,
  PasskeyRegisterResult,
  UsePasskeyRegisterResult,
  UsePasskeySignInResult,
} from './usePasskey.js';
export { usePasskeyRegister, usePasskeySignIn } from './usePasskey.js';
export type { UseSessionResult } from './useSession.js';
export { useSession } from './useSession.js';
export type { SignInInput, UseSignInResult } from './useSignIn.js';
export { useSignIn } from './useSignIn.js';
export type { UseSignOutResult } from './useSignOut.js';
export { useSignOut } from './useSignOut.js';
export type { SignUpInput, UseSignUpResult } from './useSignUp.js';
export { useSignUp } from './useSignUp.js';
