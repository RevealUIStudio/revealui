'use client'

// Test: import only @revealui/auth/react
import { useSignIn } from '@revealui/auth/react'

export default function AuthTestPage() {
  const { signIn, isLoading } = useSignIn()

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Auth Import Test</h1>
      <p>useSignIn loaded: {typeof signIn === 'function' ? 'yes' : 'no'}</p>
      <p>isLoading: {String(isLoading)}</p>
    </div>
  )
}
