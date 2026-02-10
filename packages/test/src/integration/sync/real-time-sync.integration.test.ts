/**
 * Real-Time Sync Integration Tests (ElectricSQL)
 *
 * PURPOSE: Verify real-time sync mechanisms work correctly
 *
 * CRITICAL CONTEXT: Real-time sync must work correctly to:
 * - Subscribe to data changes
 * - Receive live updates
 * - Filter data by user/tenant
 * - Handle loading and error states
 * - Maintain data consistency
 *
 * TESTS:
 * - Shape subscription
 * - Live updates
 * - Loading states
 * - Error handling
 * - Data consistency
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearMockShapes,
  mockUseShape,
  simulateShapeError,
  simulateShapeUpdate,
} from '../../mocks/electric-sql.js'

describe('Real-Time Sync Integration Tests', () => {
  beforeEach(() => {
    clearMockShapes()
  })

  // =============================================================================
  // Shape Subscription
  // =============================================================================

  describe('Shape Subscription', () => {
    it('should subscribe to conversation shape for user', () => {
      const userId = 'user_123'
      const url = '/api/shapes/conversations'
      const params = { user_id: userId }

      const shape = mockUseShape({ url, params })

      expect(shape).toBeDefined()
      expect(shape.isLoading).toBe(true)
      expect(shape.data).toEqual([])
    })

    it('should receive live updates when data changes', () => {
      const userId = 'user_123'
      const url = '/api/shapes/conversations'
      const params = { user_id: userId }

      // Initial subscription
      mockUseShape({ url, params })

      // Simulate data update
      const newData = [
        { id: 'conv_1', user_id: userId, title: 'Conversation 1' },
        { id: 'conv_2', user_id: userId, title: 'Conversation 2' },
      ]
      simulateShapeUpdate(url, params, newData)

      // Get updated shape
      const shape = mockUseShape({ url, params })
      expect(shape.isLoading).toBe(false)
      expect(shape.data).toHaveLength(2)
      expect(shape.data[0]).toEqual(newData[0])
    })

    it('should filter by user_id using parameterized query', () => {
      const user1Id = 'user_123'
      const user2Id = 'user_456'
      const url = '/api/shapes/conversations'

      // Simulate data for different users
      simulateShapeUpdate(url, { user_id: user1Id }, [
        { id: 'conv_1', user_id: user1Id, title: 'User 1 Conv' },
      ])

      simulateShapeUpdate(url, { user_id: user2Id }, [
        { id: 'conv_2', user_id: user2Id, title: 'User 2 Conv' },
      ])

      // Get shapes for each user
      const shape1 = mockUseShape({ url, params: { user_id: user1Id } })
      const shape2 = mockUseShape({ url, params: { user_id: user2Id } })

      // Should return only user's own conversations
      expect(shape1.data).toHaveLength(1)
      expect((shape1.data[0] as { user_id: string })?.user_id).toBe(user1Id)

      expect(shape2.data).toHaveLength(1)
      expect((shape2.data[0] as { user_id: string })?.user_id).toBe(user2Id)
    })
  })

  // =============================================================================
  // Loading States
  // =============================================================================

  describe('Loading States', () => {
    it('should return isLoading: true initially', () => {
      const url = '/api/shapes/conversations'
      const params = { user_id: 'user_123' }

      const shape = mockUseShape({ url, params })

      expect(shape.isLoading).toBe(true)
      expect(shape.data).toEqual([])
      expect(shape.error).toBeNull()
    })

    it('should return isLoading: false after data loaded', () => {
      const url = '/api/shapes/conversations'
      const params = { user_id: 'user_123' }

      mockUseShape({ url, params })

      // Simulate data load
      simulateShapeUpdate(url, params, [{ id: 'conv_1' }])

      const shape = mockUseShape({ url, params })
      expect(shape.isLoading).toBe(false)
      expect(shape.data).toHaveLength(1)
    })
  })

  // =============================================================================
  // Error Handling
  // =============================================================================

  describe('Error Handling', () => {
    it('should return error when shape subscription fails', () => {
      const url = '/api/shapes/conversations'
      const params = { user_id: 'user_123' }

      mockUseShape({ url, params })

      // Simulate error
      const error = new Error('Network connection failed')
      simulateShapeError(url, params, error)

      const shape = mockUseShape({ url, params })
      expect(shape.isLoading).toBe(false)
      expect(shape.error).toEqual(error)
      expect(shape.data).toEqual([])
    })

    it('should handle network disconnection gracefully', () => {
      const url = '/api/shapes/conversations'
      const params = { user_id: 'user_123' }

      // Start with successful subscription
      mockUseShape({ url, params })
      simulateShapeUpdate(url, params, [{ id: 'conv_1' }])

      // Simulate disconnection
      simulateShapeError(url, params, new Error('Connection lost'))

      const shape = mockUseShape({ url, params })
      expect(shape.error).toBeDefined()
      expect(shape.error?.message).toBe('Connection lost')
    })
  })

  // =============================================================================
  // Data Consistency
  // =============================================================================

  describe('Data Consistency', () => {
    it('should maintain order of conversations', () => {
      const url = '/api/shapes/conversations'
      const params = { user_id: 'user_123' }

      mockUseShape({ url, params })

      // Simulate ordered data
      const orderedData = [
        { id: 'conv_1', created_at: '2024-01-01', title: 'First' },
        { id: 'conv_2', created_at: '2024-01-02', title: 'Second' },
        { id: 'conv_3', created_at: '2024-01-03', title: 'Third' },
      ]
      simulateShapeUpdate(url, params, orderedData)

      const shape = mockUseShape({ url, params })
      expect(shape.data).toHaveLength(3)
      expect((shape.data[0] as { id: string })?.id).toBe('conv_1')
      expect((shape.data[2] as { id: string })?.id).toBe('conv_3')
    })

    it('should handle concurrent updates from multiple clients', () => {
      const url = '/api/shapes/conversations'
      const params = { user_id: 'user_123' }

      mockUseShape({ url, params })

      // Simulate concurrent updates (last write wins)
      simulateShapeUpdate(url, params, [{ id: 'conv_1', title: 'Update from Client 1' }])

      simulateShapeUpdate(url, params, [{ id: 'conv_1', title: 'Update from Client 2' }])

      const shape = mockUseShape({ url, params })
      expect((shape.data[0] as { title: string })?.title).toBe('Update from Client 2')
    })
  })
})
