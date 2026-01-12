import { describe, expect, it } from 'vitest'
import { type Block, createHeadingBlock, createTextBlock } from '../blocks/index.js'
import {
  CreatePageInputSchema,
  CreateSiteInputSchema,
  CreateUserInputSchema,
  canAgentEditSite,
  canUserPerformAction,
  computePagePath,
  createPage,
  createPageLock,
  createSession,
  createSite,
  createUser,
  estimateWordCount,
  getPageBreadcrumbs,
  isLockedByUser,
  isPageLocked,
  PAGE_SCHEMA_VERSION,
  // Page
  PageSchema,
  PageSeoSchema,
  PageStatusSchema,
  SessionSchema,
  SITE_SCHEMA_VERSION,
  // Site
  SiteSchema,
  SiteSettingsSchema,
  SiteStatusSchema,
  SiteThemeSchema,
  USER_SCHEMA_VERSION,
  UserRoleSchema,
  // User
  UserSchema,
  UserStatusSchema,
  UserTypeSchema,
} from '../core/index.js'

describe('Core Schemas', () => {
  describe('User', () => {
    describe('UserTypeSchema', () => {
      it('should accept valid types', () => {
        expect(UserTypeSchema.parse('human')).toBe('human')
        expect(UserTypeSchema.parse('agent')).toBe('agent')
        expect(UserTypeSchema.parse('system')).toBe('system')
      })

      it('should reject invalid types', () => {
        expect(() => UserTypeSchema.parse('invalid')).toThrow()
      })
    })

    describe('UserRoleSchema', () => {
      it('should accept valid roles', () => {
        const roles = ['owner', 'admin', 'editor', 'viewer', 'agent', 'contributor']
        for (const role of roles) {
          expect(UserRoleSchema.parse(role)).toBe(role)
        }
      })
    })

    describe('UserStatusSchema', () => {
      it('should accept valid statuses', () => {
        const statuses = ['active', 'suspended', 'deleted', 'pending']
        for (const status of statuses) {
          expect(UserStatusSchema.parse(status)).toBe(status)
        }
      })
    })

    describe('CreateUserInputSchema', () => {
      it('should validate minimal input', () => {
        const input = { type: 'human', name: 'Test User', role: 'editor' }
        const result = CreateUserInputSchema.safeParse(input)
        expect(result.success).toBe(true)
      })

      it('should validate full input', () => {
        const input = {
          type: 'human',
          name: 'Test User',
          email: 'test@example.com',
          role: 'admin',
          avatarUrl: 'https://example.com/avatar.jpg',
        }
        const result = CreateUserInputSchema.safeParse(input)
        expect(result.success).toBe(true)
      })
    })

    describe('createUser', () => {
      it('should create human user', () => {
        const user = createUser('user-123', {
          type: 'human',
          email: 'test@example.com',
          name: 'Test User',
          role: 'editor',
        })

        expect(user.id).toBe('user-123')
        expect(user.type).toBe('human')
        expect(user.email).toBe('test@example.com')
        expect(user.name).toBe('Test User')
        expect(user.role).toBe('editor')
        expect(user.status).toBe('active')
        expect(user.schemaVersion).toBe(USER_SCHEMA_VERSION)
        expect(user.human.label).toBe('Test User')
        expect(user.agent.semanticType).toBe('user')
      })

      it('should create agent user', () => {
        const user = createUser('agent-123', {
          type: 'agent',
          name: 'AI Assistant',
          role: 'agent',
          agentModel: 'gpt-4',
          agentCapabilities: ['edit', 'suggest'],
        })

        expect(user.type).toBe('agent')
        expect(user.agentModel).toBe('gpt-4')
        expect(user.agentCapabilities).toEqual(['edit', 'suggest'])
        expect(user.human.icon).toBe('robot')
      })

      it('should validate created user', () => {
        const user = createUser('user-1', {
          type: 'human',
          name: 'Test',
          role: 'viewer',
        })

        const result = UserSchema.safeParse(user)
        expect(result.success).toBe(true)
      })
    })

    describe('createSession', () => {
      it('should create session', () => {
        const expires = new Date(Date.now() + 86400000) // +1 day
        const session = createSession('sess-1', 'user-1', 'hash123', expires, {
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
          persistent: true,
        })

        expect(session.id).toBe('sess-1')
        expect(session.userId).toBe('user-1')
        expect(session.tokenHash).toBe('hash123')
        expect(session.persistent).toBe(true)
        expect(session.userAgent).toBe('Mozilla/5.0')
      })

      it('should validate created session', () => {
        const session = createSession('s-1', 'u-1', 'hash', new Date())
        const result = SessionSchema.safeParse(session)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Site', () => {
    describe('SiteThemeSchema', () => {
      it('should validate hex colors', () => {
        const theme = {
          primaryColor: '#ff0000',
          secondaryColor: '#00ff00',
        }
        const result = SiteThemeSchema.safeParse(theme)
        expect(result.success).toBe(true)
      })

      it('should reject invalid hex colors', () => {
        const theme = { primaryColor: 'red' }
        const result = SiteThemeSchema.safeParse(theme)
        expect(result.success).toBe(false)
      })

      it('should have default border radius', () => {
        const theme = SiteThemeSchema.parse({})
        expect(theme.borderRadius).toBe('md')
      })
    })

    describe('SiteSettingsSchema', () => {
      it('should have sensible defaults', () => {
        const settings = SiteSettingsSchema.parse({})
        expect(settings.language).toBe('en')
        expect(settings.timezone).toBe('UTC')
        expect(settings.allowAgentEdits).toBe(true)
      })

      it('should validate subdomain format', () => {
        const valid = { subdomain: 'my-site-123' }
        const invalid = { subdomain: 'My Site!' }

        expect(SiteSettingsSchema.safeParse(valid).success).toBe(true)
        expect(SiteSettingsSchema.safeParse(invalid).success).toBe(false)
      })
    })

    describe('SiteStatusSchema', () => {
      it('should accept valid statuses', () => {
        const statuses = ['draft', 'published', 'archived']
        for (const status of statuses) {
          expect(SiteStatusSchema.parse(status)).toBe(status)
        }
      })
    })

    describe('CreateSiteInputSchema', () => {
      it('should validate minimal input', () => {
        const input = { name: 'My Site', slug: 'my-site', ownerId: 'user-1' }
        const result = CreateSiteInputSchema.safeParse(input)
        expect(result.success).toBe(true)
      })

      it('should validate full input', () => {
        const input = {
          name: 'My Site',
          slug: 'my-site',
          ownerId: 'user-1',
          description: 'A test site',
          theme: { primaryColor: '#ff0000' },
          settings: { language: 'fr' },
        }
        const result = CreateSiteInputSchema.safeParse(input)
        expect(result.success).toBe(true)
      })
    })

    describe('createSite', () => {
      it('should create site with defaults', () => {
        const site = createSite('site-1', {
          name: 'My Site',
          slug: 'my-site',
          ownerId: 'user-1',
        })

        expect(site.id).toBe('site-1')
        expect(site.name).toBe('My Site')
        expect(site.slug).toBe('my-site')
        expect(site.ownerId).toBe('user-1')
        expect(site.status).toBe('draft')
        expect(site.settings.language).toBe('en')
        expect(site.collaborators).toEqual([])
        expect(site.pageCount).toBe(0)
        expect(site.schemaVersion).toBe(SITE_SCHEMA_VERSION)
      })

      it('should include agent actions', () => {
        const site = createSite('site-1', {
          name: 'Test',
          slug: 'test',
          ownerId: 'user-1',
        })

        const actions = site.agent.actions || []
        const actionNames = actions.map((a) => a.name)

        expect(actionNames).toContain('addPage')
        expect(actionNames).toContain('updateSettings')
        expect(actionNames).toContain('publish')
      })

      it('should validate created site', () => {
        const site = createSite('s-1', {
          name: 'Test',
          slug: 'test',
          ownerId: 'u-1',
        })

        const result = SiteSchema.safeParse(site)
        expect(result.success).toBe(true)
      })
    })

    describe('canUserPerformAction', () => {
      const site = createSite('site-1', {
        name: 'Test',
        slug: 'test',
        ownerId: 'owner-1',
      })
      site.collaborators = [
        { userId: 'admin-1', role: 'admin', addedAt: new Date().toISOString(), addedBy: 'owner-1' },
        {
          userId: 'editor-1',
          role: 'editor',
          addedAt: new Date().toISOString(),
          addedBy: 'owner-1',
        },
        {
          userId: 'viewer-1',
          role: 'viewer',
          addedAt: new Date().toISOString(),
          addedBy: 'owner-1',
        },
      ]

      it('owner can do everything', () => {
        expect(canUserPerformAction(site, 'owner-1', 'view')).toBe(true)
        expect(canUserPerformAction(site, 'owner-1', 'edit')).toBe(true)
        expect(canUserPerformAction(site, 'owner-1', 'admin')).toBe(true)
        expect(canUserPerformAction(site, 'owner-1', 'delete')).toBe(true)
      })

      it('admin can admin but not delete', () => {
        expect(canUserPerformAction(site, 'admin-1', 'view')).toBe(true)
        expect(canUserPerformAction(site, 'admin-1', 'edit')).toBe(true)
        expect(canUserPerformAction(site, 'admin-1', 'admin')).toBe(true)
      })

      it('editor can edit but not admin', () => {
        expect(canUserPerformAction(site, 'editor-1', 'view')).toBe(true)
        expect(canUserPerformAction(site, 'editor-1', 'edit')).toBe(true)
        expect(canUserPerformAction(site, 'editor-1', 'admin')).toBe(false)
      })

      it('viewer can only view', () => {
        expect(canUserPerformAction(site, 'viewer-1', 'view')).toBe(true)
        expect(canUserPerformAction(site, 'viewer-1', 'edit')).toBe(false)
        expect(canUserPerformAction(site, 'viewer-1', 'admin')).toBe(false)
      })

      it('non-collaborator cannot do anything', () => {
        expect(canUserPerformAction(site, 'stranger', 'view')).toBe(false)
      })
    })

    describe('canAgentEditSite', () => {
      it('should return true when agent edits allowed', () => {
        const site = createSite('s-1', {
          name: 'Test',
          slug: 'test',
          ownerId: 'u-1',
        })
        expect(canAgentEditSite(site)).toBe(true)
      })

      it('should return false when agent edits disabled', () => {
        const site = createSite('s-1', {
          name: 'Test',
          slug: 'test',
          ownerId: 'u-1',
          settings: { allowAgentEdits: false },
        })
        expect(canAgentEditSite(site)).toBe(false)
      })
    })
  })

  describe('Page', () => {
    describe('PageStatusSchema', () => {
      it('should accept valid statuses', () => {
        const statuses = ['draft', 'published', 'archived', 'scheduled']
        for (const status of statuses) {
          expect(PageStatusSchema.parse(status)).toBe(status)
        }
      })
    })

    describe('CreatePageInputSchema', () => {
      it('should validate minimal input', () => {
        const input = { siteId: 'site-1', title: 'My Page', slug: 'my-page' }
        const result = CreatePageInputSchema.safeParse(input)
        expect(result.success).toBe(true)
      })

      it('should validate full input', () => {
        const input = {
          siteId: 'site-1',
          title: 'My Page',
          slug: 'my-page',
          parentId: 'parent-1',
          templateId: 'template-1',
          seo: { title: 'SEO Title' },
          blocks: [createTextBlock('1', 'Hello')],
        }
        const result = CreatePageInputSchema.safeParse(input)
        expect(result.success).toBe(true)
      })
    })

    describe('PageSeoSchema', () => {
      it('should validate SEO with constraints', () => {
        const seo = {
          title: 'A'.repeat(60), // Max 60
          description: 'B'.repeat(160), // Max 160
        }
        const result = PageSeoSchema.safeParse(seo)
        expect(result.success).toBe(true)
      })

      it('should reject title over 60 chars', () => {
        const seo = { title: 'A'.repeat(61) }
        const result = PageSeoSchema.safeParse(seo)
        expect(result.success).toBe(false)
      })
    })

    describe('computePagePath', () => {
      it('should compute root path', () => {
        expect(computePagePath('about')).toBe('/about')
      })

      it('should compute nested path', () => {
        expect(computePagePath('contact', '/about')).toBe('/about/contact')
      })

      it('should normalize slashes', () => {
        expect(computePagePath('page', '/parent/')).toBe('/parent/page')
      })
    })

    describe('estimateWordCount', () => {
      it('should count words in text blocks', () => {
        const blocks: Block[] = [createTextBlock('1', 'Hello world this is a test')]
        expect(estimateWordCount(blocks)).toBe(6)
      })

      it('should count words in headings', () => {
        const blocks: Block[] = [createHeadingBlock('1', 'My Page Title')]
        expect(estimateWordCount(blocks)).toBe(3)
      })

      it('should count nested blocks', () => {
        const blocks: Block[] = [
          {
            id: 'columns-1',
            type: 'columns',
            data: {
              columns: [
                {
                  id: 'col-1',
                  blocks: [createTextBlock('1', 'Left column text')],
                },
                {
                  id: 'col-2',
                  blocks: [createTextBlock('2', 'Right column text')],
                },
              ],
            },
          },
        ]
        expect(estimateWordCount(blocks)).toBe(6)
      })
    })

    describe('createPage', () => {
      it('should create page with defaults', () => {
        const page = createPage('page-1', {
          siteId: 'site-1',
          title: 'My Page',
          slug: 'my-page',
        })

        expect(page.id).toBe('page-1')
        expect(page.siteId).toBe('site-1')
        expect(page.title).toBe('My Page')
        expect(page.slug).toBe('my-page')
        expect(page.path).toBe('/my-page')
        expect(page.status).toBe('draft')
        expect(page.blocks).toEqual([])
        expect(page.blockCount).toBe(0)
        expect(page.wordCount).toBe(0)
        expect(page.schemaVersion).toBe(PAGE_SCHEMA_VERSION)
      })

      it('should compute path with parent', () => {
        const page = createPage(
          'page-1',
          {
            siteId: 'site-1',
            title: 'Child Page',
            slug: 'child',
            parentId: 'parent-1',
          },
          '/parent',
        )

        expect(page.path).toBe('/parent/child')
      })

      it('should count blocks', () => {
        const page = createPage('page-1', {
          siteId: 'site-1',
          title: 'Test',
          slug: 'test',
          blocks: [createTextBlock('1', 'Hello'), createTextBlock('2', 'World')],
        })

        expect(page.blockCount).toBe(2)
      })

      it('should include agent actions', () => {
        const page = createPage('p-1', {
          siteId: 's-1',
          title: 'Test',
          slug: 'test',
        })

        const actions = page.agent.actions || []
        const actionNames = actions.map((a) => a.name)

        expect(actionNames).toContain('addBlock')
        expect(actionNames).toContain('updateBlock')
        expect(actionNames).toContain('removeBlock')
        expect(actionNames).toContain('publish')
      })

      it('should validate created page', () => {
        const page = createPage('p-1', {
          siteId: 's-1',
          title: 'Test',
          slug: 'test',
        })

        const result = PageSchema.safeParse(page)
        expect(result.success).toBe(true)
      })
    })

    describe('Page Lock', () => {
      describe('createPageLock', () => {
        it('should create lock with expiration', () => {
          const lock = createPageLock('user-1', 60000, 'Editing')

          expect(lock.userId).toBe('user-1')
          expect(lock.reason).toBe('Editing')
          expect(new Date(lock.expiresAt).getTime()).toBeGreaterThan(Date.now())
        })
      })

      describe('isPageLocked', () => {
        it('should return false for unlocked page', () => {
          const page = createPage('p-1', {
            siteId: 's-1',
            title: 'Test',
            slug: 'test',
          })
          expect(isPageLocked(page)).toBe(false)
        })

        it('should return true for locked page', () => {
          const page = createPage('p-1', {
            siteId: 's-1',
            title: 'Test',
            slug: 'test',
          })
          page.lock = createPageLock('user-1', 60000)
          expect(isPageLocked(page)).toBe(true)
        })

        it('should return false for expired lock', () => {
          const page = createPage('p-1', {
            siteId: 's-1',
            title: 'Test',
            slug: 'test',
          })
          page.lock = {
            userId: 'user-1',
            lockedAt: new Date(Date.now() - 120000).toISOString(),
            expiresAt: new Date(Date.now() - 60000).toISOString(), // Expired
          }
          expect(isPageLocked(page)).toBe(false)
        })
      })

      describe('isLockedByUser', () => {
        it('should return true for lock owner', () => {
          const page = createPage('p-1', {
            siteId: 's-1',
            title: 'Test',
            slug: 'test',
          })
          page.lock = createPageLock('user-1', 60000)
          expect(isLockedByUser(page, 'user-1')).toBe(true)
        })

        it('should return false for different user', () => {
          const page = createPage('p-1', {
            siteId: 's-1',
            title: 'Test',
            slug: 'test',
          })
          page.lock = createPageLock('user-1', 60000)
          expect(isLockedByUser(page, 'user-2')).toBe(false)
        })
      })
    })

    describe('getPageBreadcrumbs', () => {
      it('should return breadcrumbs for nested page', () => {
        const pages = [
          createPage('root', { siteId: 's-1', title: 'Root', slug: 'root' }),
          createPage(
            'child',
            { siteId: 's-1', title: 'Child', slug: 'child', parentId: 'root' },
            '/root',
          ),
          createPage(
            'grandchild',
            { siteId: 's-1', title: 'Grandchild', slug: 'grandchild', parentId: 'child' },
            '/root/child',
          ),
        ]

        const breadcrumbs = getPageBreadcrumbs(pages[2], pages)

        expect(breadcrumbs).toHaveLength(3)
        expect(breadcrumbs[0].title).toBe('Root')
        expect(breadcrumbs[1].title).toBe('Child')
        expect(breadcrumbs[2].title).toBe('Grandchild')
      })

      it('should return single item for root page', () => {
        const page = createPage('root', { siteId: 's-1', title: 'Root', slug: 'root' })
        const breadcrumbs = getPageBreadcrumbs(page, [page])

        expect(breadcrumbs).toHaveLength(1)
        expect(breadcrumbs[0].title).toBe('Root')
      })
    })
  })
})
