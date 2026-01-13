/**
 * @revealui/auth
 *
 * Authentication system for RevealUI.
 * Database-backed sessions with Better Auth patterns.
 */

// Server exports
export * from './server'

// Client exports (React hooks)
export * from './react'

// Types
export type { User, Session, AuthSession, SignInResult, SignUpResult } from './types'
