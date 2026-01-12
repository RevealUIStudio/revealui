/**
 * Client Configuration Integration Tests
 *
 * Tests for ElectricSQL client configuration and URL building.
 */

import { describe, expect, it } from 'vitest'
import {
  buildHeaders,
  buildShapeUrl,
  createElectricClientConfig,
  validateServiceUrl,
} from '../../client'

describe('ElectricSQL Client Configuration', () => {
  describe('createElectricClientConfig', () => {
    it('should create config with valid URL', () => {
      const config = createElectricClientConfig({
        serviceUrl: 'http://localhost:5133',
        authToken: 'test-token',
      })

      expect(config.serviceUrl).toBe('http://localhost:5133')
      expect(config.authToken).toBe('test-token')
      expect(config.debug).toBe(false)
    })

    it('should create config with debug enabled', () => {
      const config = createElectricClientConfig({
        serviceUrl: 'http://localhost:5133',
        debug: true,
      })

      expect(config.debug).toBe(true)
    })

    it('should throw error with empty URL', () => {
      expect(() => {
        createElectricClientConfig({
          serviceUrl: '',
        })
      }).toThrow('ElectricSQL service URL is required')
    })

    it('should throw error with invalid URL format', () => {
      expect(() => {
        createElectricClientConfig({
          serviceUrl: 'not-a-valid-url',
        })
      }).toThrow('Invalid ElectricSQL service URL')
    })
  })

  describe('buildShapeUrl', () => {
    it('should build shape URL correctly', () => {
      const url = buildShapeUrl('http://localhost:5133')
      expect(url).toBe('http://localhost:5133/v1/shape')
    })

    it('should handle URL with trailing slash', () => {
      const url = buildShapeUrl('http://localhost:5133/')
      expect(url).toBe('http://localhost:5133/v1/shape')
    })
  })

  describe('buildHeaders', () => {
    it('should build headers without auth token', () => {
      const headers = buildHeaders()
      expect(headers).toEqual({
        'Content-Type': 'application/json',
      })
    })

    it('should build headers with auth token', () => {
      const headers = buildHeaders('test-token')
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      })
    })
  })

  describe('validateServiceUrl', () => {
    it('should validate valid HTTP URL', () => {
      const url = validateServiceUrl('http://localhost:5133')
      expect(url.href).toBe('http://localhost:5133/')
    })

    it('should validate valid HTTPS URL', () => {
      const url = validateServiceUrl('https://electric.example.com')
      expect(url.href).toBe('https://electric.example.com/')
    })

    it('should throw error with invalid URL', () => {
      expect(() => {
        validateServiceUrl('not-a-valid-url')
      }).toThrow('Invalid ElectricSQL service URL')
    })
  })
})
