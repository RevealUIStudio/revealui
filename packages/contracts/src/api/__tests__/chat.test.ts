/**
 * Chat Contract Tests
 *
 * Tests for chat/AI API contracts
 */

import { describe, expect, it } from 'vitest'
import { ChatRequestContract } from '../chat.js'

describe('ChatRequestContract', () => {
  describe('valid data', () => {
    it('validates single user message', () => {
      const result = ChatRequestContract.validate({
        messages: [{ role: 'user', content: 'Hello, AI!' }],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.messages).toHaveLength(1)
        expect(result.data.messages[0]?.role).toBe('user')
        expect(result.data.messages[0]?.content).toBe('Hello, AI!')
      }
    })

    it('validates conversation with multiple messages', () => {
      const result = ChatRequestContract.validate({
        messages: [
          { role: 'user', content: 'What is TypeScript?' },
          { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript.' },
          { role: 'user', content: 'Tell me more about types.' },
        ],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.messages).toHaveLength(3)
      }
    })

    it('validates conversation with system message', () => {
      const result = ChatRequestContract.validate({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
      })

      expect(result.success).toBe(true)
    })

    it('validates long message (under 4000 chars)', () => {
      const longMessage = 'a'.repeat(3999)
      const result = ChatRequestContract.validate({
        messages: [{ role: 'user', content: longMessage }],
      })

      expect(result.success).toBe(true)
    })
  })

  describe('invalid data - array validation', () => {
    it('rejects empty messages array', () => {
      const result = ChatRequestContract.validate({
        messages: [],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('non-empty array')
      }
    })

    it('rejects missing messages field', () => {
      const result = ChatRequestContract.validate({})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.issues[0]?.path).toContain('messages')
      }
    })

    it('rejects non-array messages', () => {
      const result = ChatRequestContract.validate({
        messages: 'not an array',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('invalid data - message structure', () => {
    it('rejects message without role', () => {
      const result = ChatRequestContract.validate({
        messages: [{ content: 'Hello!' }],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.issues[0]?.path).toContain('role')
      }
    })

    it('rejects message without content', () => {
      const result = ChatRequestContract.validate({
        messages: [{ role: 'user' }],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.issues[0]?.path).toContain('content')
      }
    })

    it('rejects invalid role', () => {
      const result = ChatRequestContract.validate({
        messages: [{ role: 'invalid', content: 'Hello!' }],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('user')
      }
    })

    it('rejects empty content', () => {
      const result = ChatRequestContract.validate({
        messages: [{ role: 'user', content: '' }],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('cannot be empty')
      }
    })
  })

  describe('invalid data - last message rules', () => {
    it('rejects when last message is from assistant', () => {
      const result = ChatRequestContract.validate({
        messages: [
          { role: 'user', content: 'Hello!' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('Last message must be from user')
      }
    })

    it('rejects when last message is from system', () => {
      const result = ChatRequestContract.validate({
        messages: [
          { role: 'user', content: 'Hello!' },
          { role: 'system', content: 'System message' },
        ],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('Last message must be from user')
      }
    })

    it('rejects when last message content is only whitespace', () => {
      const result = ChatRequestContract.validate({
        messages: [{ role: 'user', content: '   ' }],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('non-empty')
      }
    })

    it('rejects when last message is too long (over 4000 chars)', () => {
      const tooLongMessage = 'a'.repeat(4001)
      const result = ChatRequestContract.validate({
        messages: [{ role: 'user', content: tooLongMessage }],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('too long')
      }
    })
  })

  describe('edge cases', () => {
    it('accepts message with exactly 4000 characters', () => {
      const maxMessage = 'a'.repeat(4000)
      const result = ChatRequestContract.validate({
        messages: [{ role: 'user', content: maxMessage }],
      })

      expect(result.success).toBe(true)
    })

    it('accepts conversation ending with user after multiple exchanges', () => {
      const result = ChatRequestContract.validate({
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'First answer' },
          { role: 'user', content: 'Second question' },
          { role: 'assistant', content: 'Second answer' },
          { role: 'user', content: 'Third question' },
        ],
      })

      expect(result.success).toBe(true)
    })

    it('accepts user message with special characters', () => {
      const result = ChatRequestContract.validate({
        messages: [{ role: 'user', content: '你好！🚀 <script>alert("test")</script>' }],
      })

      expect(result.success).toBe(true)
    })

    it('accepts user message with newlines and formatting', () => {
      const result = ChatRequestContract.validate({
        messages: [
          {
            role: 'user',
            content: 'Line 1\nLine 2\n\n  Indented line\n\nEnd',
          },
        ],
      })

      expect(result.success).toBe(true)
    })
  })

  describe('multipart content (vision)', () => {
    it('accepts user message with text + image parts', () => {
      const result = ChatRequestContract.validate({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/4AAQ==' } },
            ],
          },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('accepts user message with only an image part', () => {
      const result = ChatRequestContract.validate({
        messages: [
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: 'https://example.com/photo.jpg' } }],
          },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('accepts image part with detail hint', () => {
      const result = ChatRequestContract.validate({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this.' },
              {
                type: 'image_url',
                image_url: { url: 'data:image/png;base64,abc123', detail: 'high' },
              },
            ],
          },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty parts array', () => {
      const result = ChatRequestContract.validate({
        messages: [{ role: 'user', content: [] }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects text part with empty text', () => {
      const result = ChatRequestContract.validate({
        messages: [{ role: 'user', content: [{ type: 'text', text: '' }] }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid detail value', () => {
      const result = ChatRequestContract.validate({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: 'https://example.com/img.jpg', detail: 'ultra' },
              },
            ],
          },
        ],
      })
      expect(result.success).toBe(false)
    })

    it('allows prior assistant messages to have string content alongside vision user message', () => {
      const result = ChatRequestContract.validate({
        messages: [
          { role: 'assistant', content: 'Sure, send me the image.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Here it is.' },
              { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/4AAQ==' } },
            ],
          },
        ],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('role validation', () => {
    it('validates all valid roles', () => {
      const userResult = ChatRequestContract.validate({
        messages: [{ role: 'user', content: 'User message' }],
      })
      expect(userResult.success).toBe(true)

      const assistantResult = ChatRequestContract.validate({
        messages: [
          { role: 'assistant', content: 'Assistant message' },
          { role: 'user', content: 'User reply' },
        ],
      })
      expect(assistantResult.success).toBe(true)

      const systemResult = ChatRequestContract.validate({
        messages: [
          { role: 'system', content: 'System message' },
          { role: 'user', content: 'User message' },
        ],
      })
      expect(systemResult.success).toBe(true)
    })

    it('rejects case-sensitive invalid roles', () => {
      const result = ChatRequestContract.validate({
        messages: [{ role: 'USER', content: 'Hello!' }],
      })

      expect(result.success).toBe(false)
    })
  })
})
