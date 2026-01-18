/**
 * Basic tests for @revealui/sync package
 */

import { describe, it, expect } from 'vitest'
import { createElectricClient } from './client/index.js'

describe('@revealui/sync', () => {
  describe('createElectricClient', () => {
    it('should create ElectricSQL client', () => {
      const config = {
        serviceUrl: 'http://localhost:5133',
        debug: false,
      }

      const client = createElectricClient(config)
      expect(client).toBeDefined()
      expect(typeof client.connect).toBe('function')
      expect(typeof client.disconnect).toBe('function')
      expect(client.isConnected()).toBe(false)
    })
  })

  describe('ElectricClient', () => {
    it('should have required methods', () => {
      const config = {
        serviceUrl: 'http://localhost:5133',
        debug: false,
      }

      const client = createElectricClient(config)

      expect(client.memory).toBeDefined()
      expect(client.collaboration).toBeDefined()
      expect(typeof client.subscribe).toBe('function')
    })
  })
})