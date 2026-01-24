import { describe, expect, it } from 'vitest'
import {
  AgentRepresentationSchema,
  createEmbedding,
  createTimestamps,
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DualEntitySchema,
  EMBEDDING_DIMENSIONS,
  EmbeddingSchema,
  HumanRepresentationSchema,
  incrementVersion,
  REPRESENTATION_SCHEMA_VERSION,
  toAgentRepresentation,
  toHumanRepresentation,
  updateTimestamp,
} from '../representation/index.js'

describe('Representation Layer', () => {
  describe('Constants', () => {
    it('should export correct schema version', () => {
      expect(REPRESENTATION_SCHEMA_VERSION).toBe(1)
    })

    it('should export correct default embedding model', () => {
      expect(DEFAULT_EMBEDDING_MODEL).toBe('openai-text-embedding-3-small')
    })

    it('should export correct default embedding dimension', () => {
      expect(DEFAULT_EMBEDDING_DIMENSION).toBe(1536)
    })

    it('should have known embedding dimensions', () => {
      expect(EMBEDDING_DIMENSIONS['openai-text-embedding-3-small']).toBe(1536)
      expect(EMBEDDING_DIMENSIONS['openai-text-embedding-3-large']).toBe(3072)
      expect(EMBEDDING_DIMENSIONS['cohere-embed-english-v3']).toBe(1024)
    })
  })

  describe('EmbeddingSchema', () => {
    it('should validate correct embedding', () => {
      const embedding = {
        model: 'openai-text-embedding-3-small',
        vector: new Array(1536).fill(0.1),
        dimension: 1536,
        generatedAt: new Date().toISOString(),
      }

      const result = EmbeddingSchema.safeParse(embedding)
      expect(result.success).toBe(true)
    })

    it('should reject embedding with mismatched dimension', () => {
      const embedding = {
        model: 'test-model',
        vector: new Array(100).fill(0.1),
        dimension: 200, // Mismatch!
        generatedAt: new Date().toISOString(),
      }

      const result = EmbeddingSchema.safeParse(embedding)
      expect(result.success).toBe(false)
    })

    it('should reject embedding with missing fields', () => {
      const embedding = {
        model: 'test-model',
        vector: [0.1, 0.2],
        // missing dimension and generatedAt
      }

      const result = EmbeddingSchema.safeParse(embedding)
      expect(result.success).toBe(false)
    })
  })

  describe('createEmbedding', () => {
    it('should create embedding with default model', () => {
      const vector = new Array(1536).fill(0.5)
      const embedding = createEmbedding(vector)

      expect(embedding.model).toBe(DEFAULT_EMBEDDING_MODEL)
      expect(embedding.vector).toEqual(vector)
      expect(embedding.dimension).toBe(1536)
      expect(embedding.generatedAt).toBeDefined()
    })

    it('should create embedding with custom model', () => {
      const vector = new Array(1024).fill(0.5)
      const embedding = createEmbedding(vector, 'cohere-embed-english-v3')

      expect(embedding.model).toBe('cohere-embed-english-v3')
      expect(embedding.dimension).toBe(1024)
    })

    it('should throw for dimension mismatch with known model', () => {
      const vector = new Array(100).fill(0.5) // Wrong dimension for OpenAI

      expect(() => createEmbedding(vector, 'openai-text-embedding-3-small')).toThrow(
        'Embedding dimension mismatch',
      )
    })

    it('should allow custom model with any dimension', () => {
      const vector = new Array(256).fill(0.5)
      const embedding = createEmbedding(vector, 'my-custom-model')

      expect(embedding.model).toBe('my-custom-model')
      expect(embedding.dimension).toBe(256)
    })
  })

  describe('HumanRepresentationSchema', () => {
    it('should validate minimal representation', () => {
      const repr = { label: 'Test' }
      const result = HumanRepresentationSchema.safeParse(repr)
      expect(result.success).toBe(true)
    })

    it('should validate full representation', () => {
      const repr = {
        label: 'Test Label',
        description: 'A description',
        icon: 'star',
        color: '#ff0000',
        preview: 'Preview text',
        suggestions: ['Do this', 'Do that'],
        helpText: 'Help text here',
      }
      const result = HumanRepresentationSchema.safeParse(repr)
      expect(result.success).toBe(true)
    })

    it('should reject missing label', () => {
      const repr = { description: 'No label' }
      const result = HumanRepresentationSchema.safeParse(repr)
      expect(result.success).toBe(false)
    })
  })

  describe('AgentRepresentationSchema', () => {
    it('should validate minimal representation', () => {
      const repr = { semanticType: 'test-type' }
      const result = AgentRepresentationSchema.safeParse(repr)
      expect(result.success).toBe(true)
    })

    it('should validate representation with constraints', () => {
      const repr = {
        semanticType: 'page',
        constraints: [
          {
            type: 'readonly',
            params: {},
            message: 'Cannot modify',
          },
        ],
      }
      const result = AgentRepresentationSchema.safeParse(repr)
      expect(result.success).toBe(true)
    })

    it('should validate representation with actions', () => {
      const repr = {
        semanticType: 'page',
        actions: [
          {
            name: 'addBlock',
            description: 'Add a block',
            params: {
              type: { type: 'string', required: true },
            },
          },
        ],
      }
      const result = AgentRepresentationSchema.safeParse(repr)
      expect(result.success).toBe(true)
    })
  })

  describe('DualEntitySchema', () => {
    it('should validate complete dual entity', () => {
      const entity = {
        id: 'test-123',
        version: 1,
        human: { label: 'Test Entity' },
        agent: { semanticType: 'test' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const result = DualEntitySchema.safeParse(entity)
      expect(result.success).toBe(true)
    })

    it('should reject entity without id', () => {
      const entity = {
        version: 1,
        human: { label: 'Test' },
        agent: { semanticType: 'test' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const result = DualEntitySchema.safeParse(entity)
      expect(result.success).toBe(false)
    })
  })

  describe('Utility Functions', () => {
    describe('toHumanRepresentation', () => {
      it('should create from name', () => {
        const repr = toHumanRepresentation({ name: 'Test Name' })
        expect(repr.label).toBe('Test Name')
      })

      it('should create from title', () => {
        const repr = toHumanRepresentation({ title: 'Test Title' })
        expect(repr.label).toBe('Test Title')
      })

      it('should prefer name over title', () => {
        const repr = toHumanRepresentation({ name: 'Name', title: 'Title' })
        expect(repr.label).toBe('Name')
      })

      it('should truncate preview', () => {
        const longDesc = 'A'.repeat(200)
        const repr = toHumanRepresentation({
          name: 'Test',
          description: longDesc,
        })
        expect(repr.preview?.length).toBe(100)
      })

      it('should default to Untitled', () => {
        const repr = toHumanRepresentation({})
        expect(repr.label).toBe('Untitled')
      })
    })

    describe('toAgentRepresentation', () => {
      it('should create with semantic type', () => {
        const repr = toAgentRepresentation('page')
        expect(repr.semanticType).toBe('page')
      })

      it('should merge options', () => {
        const repr = toAgentRepresentation('page', {
          keywords: ['test'],
          priority: 0.8,
        })
        expect(repr.semanticType).toBe('page')
        expect(repr.keywords).toEqual(['test'])
        expect(repr.priority).toBe(0.8)
      })
    })

    describe('createTimestamps', () => {
      it('should create both timestamps', () => {
        const ts = createTimestamps()
        expect(ts.createdAt).toBeDefined()
        expect(ts.updatedAt).toBeDefined()
        expect(ts.createdAt).toBe(ts.updatedAt)
      })

      it('should create valid ISO timestamps', () => {
        const ts = createTimestamps()
        expect(() => new Date(ts.createdAt)).not.toThrow()
        expect(() => new Date(ts.updatedAt)).not.toThrow()
      })
    })

    describe('updateTimestamp', () => {
      it('should create updatedAt only', () => {
        const ts = updateTimestamp()
        expect(ts.updatedAt).toBeDefined()
        expect((ts as Record<string, unknown>).createdAt).toBeUndefined()
      })
    })

    describe('incrementVersion', () => {
      it('should increment version', () => {
        expect(incrementVersion(1)).toBe(2)
        expect(incrementVersion(5)).toBe(6)
      })
    })
  })
})
