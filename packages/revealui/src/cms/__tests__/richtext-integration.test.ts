/**
 * RichText + CMS API Integration Test
 * 
 * Tests the full cycle:
 * 1. Create content with richtext
 * 2. Save to database via API
 * 3. Retrieve from database
 * 4. Serialize for rendering
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RevealUI } from '../api'
import { lexicalEditor, BoldFeature, ItalicFeature, HeadingFeature, FixedToolbarFeature } from '../richtext/lexical'
import { serializeLexicalState } from '../richtext-lexical/exports/server/rsc'
import { sqliteAdapter } from '../database/sqlite'
import type { SerializedEditorState } from 'lexical'
import path from 'path'
import fs from 'fs'

// ============================================
// TEST SETUP
// ============================================

const TEST_DB_PATH = path.join(__dirname, '.test-richtext.db')

// Sample Lexical editor state
const sampleEditorState: SerializedEditorState = {
  root: {
    children: [
      {
        type: 'heading',
        tag: 'h1',
        children: [
          {
            type: 'text',
            text: 'Hello World',
            format: 1, // bold
          }
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text: 'This is a ',
            format: 0,
          },
          {
            type: 'text',
            text: 'bold',
            format: 1, // bold
          },
          {
            type: 'text',
            text: ' and ',
            format: 0,
          },
          {
            type: 'text',
            text: 'italic',
            format: 2, // italic
          },
          {
            type: 'text',
            text: ' test.',
            format: 0,
          }
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      }
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  }
}

describe('RichText + CMS Integration', () => {
  let cms: RevealUI

  beforeAll(async () => {
    // Clean up any existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }

    // Create CMS instance with test database
    cms = new RevealUI({
      serverURL: 'http://localhost:3000',
      secret: 'test-secret',
      db: sqliteAdapter({
        client: {
          url: TEST_DB_PATH,
        },
      }),
      collections: [
        {
          slug: 'posts',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'content', type: 'json' }, // Store richtext as JSON
            { name: 'status', type: 'text' },
          ],
        },
      ],
      globals: [],
      editor: lexicalEditor({
        features: () => [
          BoldFeature(),
          ItalicFeature(),
          HeadingFeature(),
          FixedToolbarFeature(),
        ],
      }),
    })

    await cms.init()
  })

  afterAll(async () => {
    await cms.close()
    
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
  })

  // ============================================
  // FEATURE CONFIGURATION TESTS
  // ============================================

  describe('lexicalEditor Configuration', () => {
    it('should create editor config with features', () => {
      const editor = lexicalEditor({
        features: () => [
          BoldFeature(),
          ItalicFeature(),
          HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3'] }),
        ],
      })

      expect(editor.editorType).toBe('lexical')
      expect(editor.features).toHaveLength(3)
      expect(editor.features.map(f => f.key)).toEqual(['bold', 'italic', 'heading'])
    })

    it('should support feature options', () => {
      const editor = lexicalEditor({
        features: () => [
          HeadingFeature({ enabledHeadingSizes: ['h1', 'h2'] }),
        ],
      })

      const headingFeature = editor.features.find(f => f.key === 'heading')
      expect(headingFeature?.options?.enabledHeadingSizes).toEqual(['h1', 'h2'])
    })
  })

  // ============================================
  // CMS CRUD TESTS
  // ============================================

  describe('CMS CRUD Operations', () => {
    let createdPostId: string

    it('should create a post with richtext content', async () => {
      const post = await cms.create('posts', {
        title: 'Test Post',
        content: sampleEditorState,
        status: 'draft',
      })

      expect(post.id).toBeDefined()
      expect(post.title).toBe('Test Post')
      expect(post.createdAt).toBeDefined()
      
      createdPostId = post.id as string
    })

    it('should find the created post', async () => {
      const result = await cms.find('posts', {
        where: { title: { equals: 'Test Post' } },
      })

      expect(result.docs).toHaveLength(1)
      expect(result.docs[0].title).toBe('Test Post')
    })

    it('should find post by ID', async () => {
      const post = await cms.findById('posts', createdPostId)

      expect(post).not.toBeNull()
      expect(post?.title).toBe('Test Post')
    })

    it('should update the post', async () => {
      const updated = await cms.update('posts', createdPostId, {
        title: 'Updated Post',
        status: 'published',
      })

      expect(updated?.title).toBe('Updated Post')
      expect(updated?.status).toBe('published')
    })

    it('should delete the post', async () => {
      const deleted = await cms.delete('posts', createdPostId)
      expect(deleted).toBe(true)

      const notFound = await cms.findById('posts', createdPostId)
      expect(notFound).toBeNull()
    })
  })

  // ============================================
  // SERIALIZATION TESTS
  // ============================================

  describe('RichText Serialization', () => {
    it('should serialize Lexical state to React elements', () => {
      const result = serializeLexicalState(sampleEditorState)
      
      // Result should be a valid React element
      expect(result).not.toBeNull()
    })

    it('should handle empty state gracefully', () => {
      const result = serializeLexicalState(null)
      expect(result).toBeNull()
    })

    it('should handle undefined state gracefully', () => {
      const result = serializeLexicalState(undefined)
      expect(result).toBeNull()
    })

    it('should serialize text formatting correctly', () => {
      const boldState: SerializedEditorState = {
        root: {
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Bold text',
                  format: 1, // bold
                }
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            }
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        }
      }

      const result = serializeLexicalState(boldState)
      expect(result).not.toBeNull()
    })
  })

  // ============================================
  // PAGINATION TESTS
  // ============================================

  describe('Pagination', () => {
    beforeAll(async () => {
      // Create multiple posts for pagination testing
      for (let i = 1; i <= 15; i++) {
        await cms.create('posts', {
          title: `Pagination Test ${i}`,
          content: sampleEditorState,
          status: 'published',
        })
      }
    })

    it('should return paginated results', async () => {
      const result = await cms.find('posts', {
        limit: 5,
        page: 1,
      })

      expect(result.docs.length).toBeLessThanOrEqual(5)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(5)
      expect(result.hasNextPage).toBeDefined()
    })

    it('should return correct page metadata', async () => {
      const result = await cms.find('posts', {
        limit: 5,
        page: 2,
      })

      expect(result.page).toBe(2)
      expect(result.hasPrevPage).toBe(true)
    })
  })
})
