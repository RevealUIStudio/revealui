/**
 * Fixtures Tests
 *
 * Tests for the test fixture factories
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  createPostFixture,
  createPostsFixture,
  createPostsForAuthor,
  createUserFixture,
  createUsersFixture,
  postFixtures,
  resetAllCounters,
  resetPostCounter,
  resetUserCounter,
  userFixtures,
} from './fixtures/index.js'

describe('User Fixtures', () => {
  beforeEach(() => {
    resetUserCounter()
  })

  describe('userFixtures', () => {
    it('should have predefined admin user', () => {
      expect(userFixtures.admin.email).toBe('admin@test.com')
      expect(userFixtures.admin.role).toBe('admin')
      expect(userFixtures.admin.emailVerified).toBeInstanceOf(Date)
    })

    it('should have predefined regular user', () => {
      expect(userFixtures.user.email).toBe('user@test.com')
      expect(userFixtures.user.role).toBe('user')
    })

    it('should have predefined guest user', () => {
      expect(userFixtures.guest.email).toBe('guest@test.com')
      expect(userFixtures.guest.role).toBe('guest')
      expect(userFixtures.guest.emailVerified).toBeNull()
    })

    it('should have unverified user', () => {
      expect(userFixtures.unverified.emailVerified).toBeNull()
    })

    it('should have premium user with image', () => {
      expect(userFixtures.premium.image).toBeDefined()
      expect(userFixtures.premium.image).toContain('https://')
    })
  })

  describe('createUserFixture', () => {
    it('should create user with defaults', () => {
      const user = createUserFixture()

      expect(user.email).toContain('@test.com')
      expect(user.name).toContain('Test User')
      expect(user.role).toBe('user')
      expect(user.password).toBeDefined()
      expect(user.emailVerified).toBeInstanceOf(Date)
    })

    it('should create unique users', () => {
      const user1 = createUserFixture()
      const user2 = createUserFixture()

      expect(user1.email).not.toBe(user2.email)
      expect(user1.name).not.toBe(user2.name)
    })

    it('should accept overrides', () => {
      const user = createUserFixture({
        email: 'custom@test.com',
        role: 'admin',
        name: 'Custom User',
      })

      expect(user.email).toBe('custom@test.com')
      expect(user.role).toBe('admin')
      expect(user.name).toBe('Custom User')
    })

    it('should create admin user', () => {
      const admin = createUserFixture({ role: 'admin' })
      expect(admin.role).toBe('admin')
    })
  })

  describe('createUsersFixture', () => {
    it('should create multiple users', () => {
      const users = createUsersFixture(5)

      expect(users).toHaveLength(5)
      expect(users[0]?.email).not.toBe(users[1]?.email)
    })

    it('should apply overrides to all users', () => {
      const users = createUsersFixture(3, { role: 'admin' })

      expect(users.every((user) => user.role === 'admin')).toBe(true)
    })
  })

  describe('resetUserCounter', () => {
    it('should reset counter', () => {
      const user1 = createUserFixture()
      resetUserCounter()
      const user2 = createUserFixture()

      // Both should be "user1" after reset
      expect(user2.email).toBe('user1@test.com')
    })
  })
})

describe('Post Fixtures', () => {
  beforeEach(() => {
    resetPostCounter()
  })

  describe('postFixtures', () => {
    it('should have predefined published post', () => {
      expect(postFixtures.published.status).toBe('published')
      expect(postFixtures.published.publishedAt).toBeInstanceOf(Date)
      expect(postFixtures.published.slug).toBe('published-post')
    })

    it('should have predefined draft post', () => {
      expect(postFixtures.draft.status).toBe('draft')
      expect(postFixtures.draft.publishedAt).toBeNull()
    })

    it('should have predefined archived post', () => {
      expect(postFixtures.archived.status).toBe('archived')
      expect(postFixtures.archived.publishedAt).toBeInstanceOf(Date)
    })

    it('should have featured post with image', () => {
      expect(postFixtures.featured.featuredImage).toBeDefined()
      expect(postFixtures.featured.tags).toContain('featured')
    })

    it('should have long content post', () => {
      expect(postFixtures.longContent.content.length).toBeGreaterThan(1000)
    })
  })

  describe('createPostFixture', () => {
    it('should create post with defaults', () => {
      const post = createPostFixture()

      expect(post.title).toContain('Test Post')
      expect(post.slug).toContain('test-post')
      expect(post.content).toBeDefined()
      expect(post.authorId).toBeDefined()
      expect(post.status).toBe('published')
      expect(post.tags).toEqual(['test'])
    })

    it('should create unique posts', () => {
      const post1 = createPostFixture()
      const post2 = createPostFixture()

      expect(post1.slug).not.toBe(post2.slug)
      expect(post1.title).not.toBe(post2.title)
    })

    it('should accept overrides', () => {
      const post = createPostFixture({
        title: 'Custom Post',
        slug: 'custom-post',
        status: 'draft',
        authorId: 'author-123',
      })

      expect(post.title).toBe('Custom Post')
      expect(post.slug).toBe('custom-post')
      expect(post.status).toBe('draft')
      expect(post.authorId).toBe('author-123')
    })
  })

  describe('createPostsFixture', () => {
    it('should create multiple posts', () => {
      const posts = createPostsFixture(5)

      expect(posts).toHaveLength(5)
      expect(posts[0]?.slug).not.toBe(posts[1]?.slug)
    })

    it('should apply overrides to all posts', () => {
      const posts = createPostsFixture(3, { status: 'draft' })

      expect(posts.every((post) => post.status === 'draft')).toBe(true)
    })
  })

  describe('createPostsForAuthor', () => {
    it('should create posts for specific author', () => {
      const posts = createPostsForAuthor('author-123', 5)

      expect(posts).toHaveLength(5)
      expect(posts.every((post) => post.authorId === 'author-123')).toBe(true)
    })

    it('should accept additional overrides', () => {
      const posts = createPostsForAuthor('author-123', 3, { status: 'draft' })

      expect(posts.every((post) => post.authorId === 'author-123')).toBe(true)
      expect(posts.every((post) => post.status === 'draft')).toBe(true)
    })
  })

  describe('resetPostCounter', () => {
    it('should reset counter', () => {
      const post1 = createPostFixture()
      resetPostCounter()
      const post2 = createPostFixture()

      // Both should be "test-post-1" after reset
      expect(post2.slug).toBe('test-post-1')
    })
  })
})

describe('resetAllCounters', () => {
  it('should reset all fixture counters', () => {
    // Create some fixtures
    createUserFixture()
    createUserFixture()
    createPostFixture()
    createPostFixture()

    // Reset all
    resetAllCounters()

    // Next fixtures should start from 1
    const user = createUserFixture()
    const post = createPostFixture()

    expect(user.email).toBe('user1@test.com')
    expect(post.slug).toBe('test-post-1')
  })
})
