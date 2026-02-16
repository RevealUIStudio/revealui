import { describe, expect, it } from 'vitest'
import {
  getConfigurableEditors,
  getLocalConfigPath,
  getSsdConfigPath,
} from '../config/editor-config-paths.js'

describe('Editor Config Paths', () => {
  describe('getConfigurableEditors', () => {
    it('returns known editor IDs', () => {
      const editors = getConfigurableEditors()
      expect(editors).toContain('zed')
      expect(editors).toContain('vscode')
      expect(editors).toContain('neovim')
    })
  })

  describe('getLocalConfigPath', () => {
    it('returns a path for known editors', () => {
      expect(getLocalConfigPath('zed')).toContain('zed')
      expect(getLocalConfigPath('vscode')).toContain('Code')
      expect(getLocalConfigPath('neovim')).toContain('nvim')
    })

    it('returns undefined for unknown editors', () => {
      expect(getLocalConfigPath('unknown-editor')).toBeUndefined()
    })
  })

  describe('getSsdConfigPath', () => {
    it('returns a path for known editors with custom base', () => {
      const path = getSsdConfigPath('zed', '/mnt/ssd')
      expect(path).toContain('/mnt/ssd')
      expect(path).toContain('zed')
      expect(path).toContain('settings.json')
    })

    it('returns correct config file per editor', () => {
      expect(getSsdConfigPath('neovim', '/base')).toContain('init.lua')
      expect(getSsdConfigPath('vscode', '/base')).toContain('settings.json')
    })

    it('returns undefined for unknown editors', () => {
      expect(getSsdConfigPath('unknown', '/base')).toBeUndefined()
    })
  })
})
