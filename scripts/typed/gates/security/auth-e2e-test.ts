#!/usr/bin/env tsx

/**
 * End-to-End Authentication Flow Test
 *
 * Tests the complete user journey:
 * 1. Sign up → 2. Sign in → 3. Access protected route → 4. Use shape proxy route → 5. Sign out
 *
 * Usage:
 *   pnpm test:auth-e2e
 */

import {config} from 'dotenv'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createLogger} from '../../../packages/core/src/scripts/utils.ts'

const logger = createLogger()

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
config({ path: path.resolve(__dirname, '../../apps/cms/.env.local') })
config({
  path: path.resolve(__dirname, '../../apps/cms/.env.development.local'),
})
config({ path: path.resolve(__dirname, '../../apps/cms/.env') })
config({ path: path.resolve(__dirname, '../../.env.local') })
config({ path: path.resolve(__dirname, '../../.env') })

const BASE_URL =
  process.env.BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || process.env.PORT
    ? `http://localhost:${process.env.PORT}`
    : 'http://localhost:3000'

interface TestResult {
  step: string
  success: boolean
  error?: string
  details?: unknown
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const getErrorStack = (error: unknown): string | undefined =>
  error instanceof Error ? error.stack : undefined

async function testAuthFlow(): Promise<TestResult[]> {
  const results: TestResult[] = []
  let sessionCookie: string | null = null

  try {
    // Step 1: Sign Up
    logger.info('\n📋 Step 1: Testing user sign up...')
    const testEmail = `test-${Date.now()}@example.com`
    const testPassword = 'TestPassword123!'
    const testName = 'Test User'

    try {
      const signUpResponse = await fetch(`${BASE_URL}/api/auth/sign-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: testName,
        }),
      })

      const signUpData = await signUpResponse.json()

      if (!signUpResponse.ok) {
        throw new Error(signUpData.error || 'Sign up failed')
      }

      // Extract session cookie
      const setCookieHeader = signUpResponse.headers.get('set-cookie')
      if (setCookieHeader) {
        const cookieMatch = setCookieHeader.match(/revealui-session=([^;]+)/)
        if (cookieMatch) {
          sessionCookie = cookieMatch[1]
        }
      }

      results.push({
        step: 'Sign Up',
        success: true,
        details: { userId: signUpData.user?.id, email: testEmail },
      })
      logger.success('✅ Sign up successful')
    } catch (error) {
      const message = getErrorMessage(error)
      results.push({
        step: 'Sign Up',
        success: false,
        error: message,
      })
      logger.error(`❌ Sign up failed: ${message}`)
      return results // Can't continue without sign up
    }

    // Step 2: Sign In (with new credentials)
    logger.info('\n📋 Step 2: Testing user sign in...')
    try {
      const signInResponse = await fetch(`${BASE_URL}/api/auth/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      })

      const signInData = await signInResponse.json()

      if (!signInResponse.ok) {
        throw new Error(signInData.error || 'Sign in failed')
      }

      // Update session cookie
      const setCookieHeader = signInResponse.headers.get('set-cookie')
      if (setCookieHeader) {
        const cookieMatch = setCookieHeader.match(/revealui-session=([^;]+)/)
        if (cookieMatch) {
          sessionCookie = cookieMatch[1]
        }
      }

      results.push({
        step: 'Sign In',
        success: true,
        details: { userId: signInData.user?.id },
      })
      logger.success('✅ Sign in successful')
    } catch (error) {
      const message = getErrorMessage(error)
      results.push({
        step: 'Sign In',
        success: false,
        error: message,
      })
      logger.error(`❌ Sign in failed: ${message}`)
      return results // Can't continue without sign in
    }

    // Step 3: Get Session (verify authentication)
    logger.info('\n📋 Step 3: Testing session retrieval...')
    try {
      const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
        method: 'GET',
        headers: {
          // biome-ignore lint/style/useNamingConvention: HTTP header name.
          Cookie: `revealui-session=${sessionCookie}`,
        },
      })

      const sessionData = await sessionResponse.json()

      if (!(sessionResponse.ok && sessionData.session)) {
        throw new Error(sessionData.error || 'Session retrieval failed')
      }

      results.push({
        step: 'Get Session',
        success: true,
        details: {
          sessionId: sessionData.session.id,
          userId: sessionData.user?.id,
        },
      })
      logger.success('✅ Session retrieval successful')
    } catch (error) {
      const message = getErrorMessage(error)
      results.push({
        step: 'Get Session',
        success: false,
        error: message,
      })
      logger.error(`❌ Session retrieval failed: ${message}`)
      return results
    }

    // Step 4: Access Protected Route (shape proxy)
    logger.info('\n📋 Step 4: Testing protected shape proxy route...')
    try {
      const shapeResponse = await fetch(`${BASE_URL}/api/shapes/conversations`, {
        method: 'GET',
        headers: {
          // biome-ignore lint/style/useNamingConvention: HTTP header name.
          Cookie: `revealui-session=${sessionCookie}`,
        },
      })

      if (shapeResponse.status === 401) {
        throw new Error('Unauthorized - authentication failed')
      }

      if (!shapeResponse.ok) {
        const errorData = await shapeResponse.json().catch(() => ({}))
        throw new Error(errorData.error || `Shape proxy failed with status ${shapeResponse.status}`)
      }

      results.push({
        step: 'Access Protected Route',
        success: true,
        details: { status: shapeResponse.status },
      })
      logger.success('✅ Protected route access successful')
    } catch (error) {
      const message = getErrorMessage(error)
      results.push({
        step: 'Access Protected Route',
        success: false,
        error: message,
      })
      logger.error(`❌ Protected route access failed: ${message}`)
    }

    // Step 5: Sign Out
    logger.info('\n📋 Step 5: Testing user sign out...')
    try {
      const signOutResponse = await fetch(`${BASE_URL}/api/auth/sign-out`, {
        method: 'POST',
        headers: {
          // biome-ignore lint/style/useNamingConvention: HTTP header name.
          Cookie: `revealui-session=${sessionCookie}`,
        },
      })

      if (!signOutResponse.ok) {
        const errorData = await signOutResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Sign out failed')
      }

      results.push({
        step: 'Sign Out',
        success: true,
      })
      logger.success('✅ Sign out successful')
    } catch (error) {
      const message = getErrorMessage(error)
      results.push({
        step: 'Sign Out',
        success: false,
        error: message,
      })
      logger.error(`❌ Sign out failed: ${message}`)
    }

    // Step 6: Verify Session is Invalidated
    logger.info('\n📋 Step 6: Verifying session is invalidated...')
    try {
      const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
        method: 'GET',
        headers: {
          // biome-ignore lint/style/useNamingConvention: HTTP header name.
          Cookie: `revealui-session=${sessionCookie}`,
        },
      })

      const sessionData = await sessionResponse.json()

      if (sessionResponse.ok && sessionData.session) {
        throw new Error('Session should be invalidated but is still valid')
      }

      results.push({
        step: 'Verify Session Invalidated',
        success: true,
      })
      logger.success('✅ Session invalidation verified')
    } catch (error) {
      const message = getErrorMessage(error)
      results.push({
        step: 'Verify Session Invalidated',
        success: false,
        error: message,
      })
      logger.error(`❌ Session invalidation verification failed: ${message}`)
    }
  } catch (error) {
    const message = getErrorMessage(error)
    logger.error(`\n❌ Test flow failed: ${message}`)
    const stack = getErrorStack(error)
    if (stack) {
      logger.error(`Stack trace: ${stack}`)
    }
  }

  return results
}

async function main() {
  try {
    logger.header('End-to-End Authentication Flow Test')

    if (!BASE_URL) {
      logger.error('BASE_URL or NEXT_PUBLIC_SERVER_URL must be set')
      process.exit(1)
    }

    logger.info(`Testing against: ${BASE_URL}`)
    logger.info('Make sure the development server is running!')
    logger.info('')

    const results = await testAuthFlow()

    // Summary
    logger.header('Test Results Summary')
    const successCount = results.filter((r) => r.success).length
    const totalCount = results.length

    for (const result of results) {
      if (result.success) {
        logger.success(`✅ ${result.step}`)
        if (result.details) {
          logger.info(`   ${JSON.stringify(result.details)}`)
        }
      } else {
        logger.error(`❌ ${result.step}: ${result.error}`)
      }
    }

    logger.info('')
    logger.info(`Success: ${successCount}/${totalCount} tests passed`)

    if (successCount === totalCount) {
      logger.success('\n✅ All tests passed!')
      process.exit(0)
    } else {
      logger.error(`\n❌ ${totalCount - successCount} test(s) failed`)
      process.exit(1)
    }
  } catch (error) {
    const message = getErrorMessage(error)
    logger.error(`Script failed: ${message}`)
    const stack = getErrorStack(error)
    if (stack) {
      logger.error(`Stack trace: ${stack}`)
    }
    process.exit(1)
  }
}

main()
