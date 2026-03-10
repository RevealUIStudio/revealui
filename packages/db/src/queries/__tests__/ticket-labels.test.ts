import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assignLabel,
  createLabel,
  deleteLabel,
  getAllLabels,
  getLabelById,
  getLabelsForTicket,
  removeLabel,
  updateLabel,
} from '../ticket-labels.js'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createSelectChain(result: unknown[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(result),
    limit: vi.fn().mockResolvedValue(result),
    innerJoin: vi.fn().mockReturnThis(),
  }
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  return chain
}

function createInsertChain(result: unknown[] = []) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  }
}

function createUpdateChain(result: unknown[] = []) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  }
}

function createDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  }
}

function createMockDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

type MockDb = ReturnType<typeof createMockDb>

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ticket-label queries', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  // ---- getLabelById -------------------------------------------------------

  describe('getLabelById', () => {
    it('returns a label when found', async () => {
      const label = { id: 'l1', name: 'Bug', color: '#ff0000' }
      const chain = createSelectChain([label])
      db.select.mockReturnValue(chain)

      const result = await getLabelById(db as never, 'l1')

      expect(result).toEqual(label)
      expect(chain.limit).toHaveBeenCalledWith(1)
    })

    it('returns null when not found', async () => {
      const chain = createSelectChain([])
      db.select.mockReturnValue(chain)

      const result = await getLabelById(db as never, 'nonexistent')

      expect(result).toBeNull()
    })
  })

  // ---- getAllLabels --------------------------------------------------------

  describe('getAllLabels', () => {
    it('returns all labels without tenant filter', async () => {
      const labels = [
        { id: 'l1', name: 'Bug' },
        { id: 'l2', name: 'Feature' },
      ]
      const chain = createSelectChain(labels)
      db.select.mockReturnValue(chain)

      const result = await getAllLabels(db as never)

      expect(result).toEqual(labels)
    })

    it('filters by tenantId when provided', async () => {
      const labels = [{ id: 'l1', name: 'Bug', tenantId: 't1' }]
      const chain = createSelectChain(labels)
      db.select.mockReturnValue(chain)
      // When tenantId provided, where() is called
      chain.where.mockReturnValue(chain)

      const result = await getAllLabels(db as never, 't1')

      expect(result).toEqual(labels)
      expect(chain.where).toHaveBeenCalled()
    })

    it('returns empty array when no labels', async () => {
      const chain = createSelectChain([])
      db.select.mockReturnValue(chain)

      const result = await getAllLabels(db as never)

      expect(result).toEqual([])
    })
  })

  // ---- createLabel --------------------------------------------------------

  describe('createLabel', () => {
    it('creates and returns a label', async () => {
      const data = { id: 'l1', name: 'Enhancement', slug: 'enhancement' }
      const chain = createInsertChain([data])
      db.insert.mockReturnValue(chain)

      const result = await createLabel(db as never, data)

      expect(result).toEqual(data)
      expect(chain.values).toHaveBeenCalledWith(data)
    })

    it('passes optional color and description', async () => {
      const data = {
        id: 'l1',
        name: 'Bug',
        slug: 'bug',
        color: '#ff0000',
        description: 'Something is broken',
        tenantId: 't1',
      }
      const chain = createInsertChain([data])
      db.insert.mockReturnValue(chain)

      const result = await createLabel(db as never, data)

      expect(result).toEqual(data)
    })
  })

  // ---- updateLabel --------------------------------------------------------

  describe('updateLabel', () => {
    it('updates and returns the label', async () => {
      const updated = { id: 'l1', name: 'Critical Bug', color: '#cc0000' }
      const chain = createUpdateChain([updated])
      db.update.mockReturnValue(chain)

      const result = await updateLabel(db as never, 'l1', {
        name: 'Critical Bug',
        color: '#cc0000',
      })

      expect(result).toEqual(updated)
      expect(chain.set).toHaveBeenCalled()
    })

    it('returns null when label does not exist', async () => {
      const chain = createUpdateChain([])
      db.update.mockReturnValue(chain)

      const result = await updateLabel(db as never, 'nonexistent', { name: 'X' })

      expect(result).toBeNull()
    })

    it('sets updatedAt timestamp', async () => {
      const chain = createUpdateChain([{ id: 'l1' }])
      db.update.mockReturnValue(chain)

      await updateLabel(db as never, 'l1', { name: 'Renamed' })

      const setCall = chain.set.mock.calls[0]?.[0] as Record<string, unknown> | undefined
      expect(setCall?.updatedAt).toBeInstanceOf(Date)
    })
  })

  // ---- deleteLabel --------------------------------------------------------

  describe('deleteLabel', () => {
    it('deletes a label by id', async () => {
      const chain = createDeleteChain()
      db.delete.mockReturnValue(chain)

      await deleteLabel(db as never, 'l1')

      expect(db.delete).toHaveBeenCalled()
      expect(chain.where).toHaveBeenCalled()
    })
  })

  // ---- assignLabel --------------------------------------------------------

  describe('assignLabel', () => {
    it('creates a label assignment and returns it', async () => {
      const data = { id: 'a1', ticketId: 't1', labelId: 'l1' }
      const chain = createInsertChain([data])
      db.insert.mockReturnValue(chain)

      const result = await assignLabel(db as never, data)

      expect(result).toEqual(data)
      expect(chain.values).toHaveBeenCalledWith(data)
    })
  })

  // ---- removeLabel --------------------------------------------------------

  describe('removeLabel', () => {
    it('removes label assignment by ticket and label', async () => {
      const chain = createDeleteChain()
      db.delete.mockReturnValue(chain)

      await removeLabel(db as never, 't1', 'l1')

      expect(db.delete).toHaveBeenCalled()
      expect(chain.where).toHaveBeenCalled()
    })
  })

  // ---- getLabelsForTicket -------------------------------------------------

  describe('getLabelsForTicket', () => {
    it('returns labels for a ticket via join', async () => {
      const assignments = [
        { label: { id: 'l1', name: 'Bug' } },
        { label: { id: 'l2', name: 'Priority' } },
      ]
      const chain = createSelectChain(assignments)
      db.select.mockReturnValue(chain)

      const result = await getLabelsForTicket(db as never, 't1')

      expect(result).toEqual([
        { id: 'l1', name: 'Bug' },
        { id: 'l2', name: 'Priority' },
      ])
      expect(chain.innerJoin).toHaveBeenCalled()
    })

    it('returns empty array when ticket has no labels', async () => {
      const chain = createSelectChain([])
      db.select.mockReturnValue(chain)

      const result = await getLabelsForTicket(db as never, 't1')

      expect(result).toEqual([])
    })
  })

  // ---- error handling -----------------------------------------------------

  describe('error handling', () => {
    it('propagates select errors', async () => {
      const chain = createSelectChain()
      chain.orderBy.mockRejectedValue(new Error('network error'))
      db.select.mockReturnValue(chain)

      await expect(getAllLabels(db as never)).rejects.toThrow('network error')
    })

    it('propagates insert errors on createLabel', async () => {
      const chain = createInsertChain()
      chain.returning.mockRejectedValue(new Error('duplicate slug'))
      db.insert.mockReturnValue(chain)

      await expect(createLabel(db as never, { id: 'l1', name: 'X', slug: 'x' })).rejects.toThrow(
        'duplicate slug',
      )
    })

    it('propagates insert errors on assignLabel', async () => {
      const chain = createInsertChain()
      chain.returning.mockRejectedValue(new Error('already assigned'))
      db.insert.mockReturnValue(chain)

      await expect(
        assignLabel(db as never, { id: 'a1', ticketId: 't1', labelId: 'l1' }),
      ).rejects.toThrow('already assigned')
    })

    it('propagates update errors', async () => {
      const chain = createUpdateChain()
      chain.returning.mockRejectedValue(new Error('write conflict'))
      db.update.mockReturnValue(chain)

      await expect(updateLabel(db as never, 'l1', { name: 'X' })).rejects.toThrow('write conflict')
    })

    it('propagates delete errors on deleteLabel', async () => {
      const chain = createDeleteChain()
      chain.where.mockRejectedValue(new Error('in use'))
      db.delete.mockReturnValue(chain)

      await expect(deleteLabel(db as never, 'l1')).rejects.toThrow('in use')
    })

    it('propagates delete errors on removeLabel', async () => {
      const chain = createDeleteChain()
      chain.where.mockRejectedValue(new Error('permission denied'))
      db.delete.mockReturnValue(chain)

      await expect(removeLabel(db as never, 't1', 'l1')).rejects.toThrow('permission denied')
    })
  })
})
