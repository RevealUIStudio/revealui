/**
 * Tests for Database Type Structure
 *
 * Verifies that the generated Database type has the correct structure
 * and matches Supabase's Database type format.
 */

import { describe, expect, it } from 'vitest'
import type { Database } from '../database.js'

describe('Database Type Structure', () => {
  it('should have public.Tables structure', () => {
    // Type-level test - verify structure exists
    // If Database type is wrong, TypeScript will error
    const _: Database['public']['Tables'] = {} as Database['public']['Tables']
    expect(_).toBeDefined()
  })

  it('should have users table with correct structure', () => {
    // Type-level test - verify table structure
    // If structure is wrong, TypeScript will error
    const _: Database['public']['Tables']['users'] = {} as Database['public']['Tables']['users']
    expect(_).toBeDefined()
  })

  it('should have Enums structure', () => {
    // Type-level test
    const _: Database['public']['Enums'] = {} as Database['public']['Enums']
    expect(_).toBeDefined()
  })

  it('should allow extracting Row types', () => {
    // Type-level test
    const _: Database['public']['Tables']['users']['Row'] =
      {} as Database['public']['Tables']['users']['Row']
    expect(_).toBeDefined()
  })

  it('should allow extracting Insert types', () => {
    // Type-level test
    const _: Database['public']['Tables']['users']['Insert'] =
      {} as Database['public']['Tables']['users']['Insert']
    expect(_).toBeDefined()
  })

  it('should allow extracting Update types', () => {
    // Type-level test
    const _: Database['public']['Tables']['users']['Update'] =
      {} as Database['public']['Tables']['users']['Update']
    expect(_).toBeDefined()
  })

  it('should have relationships for tables with foreign keys', () => {
    // Type-level test - Relationships is an object, not an array
    const _: Database['public']['Tables']['users']['Relationships'] =
      {} as Database['public']['Tables']['users']['Relationships']
    expect(_).toBeDefined()
  })
})
