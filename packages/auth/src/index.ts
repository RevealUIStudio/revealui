/**
 * @revealui/auth
 *
 * Authentication system for RevealUI.
 * Database-backed sessions with Better Auth patterns.
 */

// Client exports (React hooks)
export * from './react'
// Server exports
export * from './server'

// Types
export type { AuthSession, Session, SignInResult, SignUpResult, User } from './types'
