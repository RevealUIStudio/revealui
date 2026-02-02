/**
 * Post Fixtures
 *
 * Pre-defined post test data and factory functions
 */

/**
 * Post fixture type
 */
export interface PostFixture {
  title: string
  slug: string
  content: string
  excerpt?: string
  authorId: string
  publishedAt?: Date
  status: 'draft' | 'published' | 'archived'
  tags?: string[]
  featuredImage?: string
}

/**
 * Pre-defined post fixtures for common test scenarios
 */
export const postFixtures = {
  published: {
    title: 'Published Post',
    slug: 'published-post',
    content: 'This is a published post with full content.',
    excerpt: 'This is a published post',
    authorId: 'user-1',
    publishedAt: new Date('2024-01-15'),
    status: 'published' as const,
    tags: ['test', 'published'],
  },

  draft: {
    title: 'Draft Post',
    slug: 'draft-post',
    content: 'This is a draft post that is not yet published.',
    excerpt: 'This is a draft post',
    authorId: 'user-1',
    publishedAt: null,
    status: 'draft' as const,
    tags: ['test', 'draft'],
  },

  archived: {
    title: 'Archived Post',
    slug: 'archived-post',
    content: 'This is an archived post that was previously published.',
    excerpt: 'This is an archived post',
    authorId: 'user-1',
    publishedAt: new Date('2023-01-01'),
    status: 'archived' as const,
    tags: ['test', 'archived'],
  },

  featured: {
    title: 'Featured Post',
    slug: 'featured-post',
    content: 'This is a featured post with an image.',
    excerpt: 'This is a featured post',
    authorId: 'user-1',
    publishedAt: new Date('2024-02-01'),
    status: 'published' as const,
    tags: ['featured', 'important'],
    featuredImage: 'https://example.com/featured.jpg',
  },

  longContent: {
    title: 'Post with Long Content',
    slug: 'long-content-post',
    content: 'Lorem ipsum dolor sit amet, '.repeat(100),
    excerpt: 'A post with very long content',
    authorId: 'user-1',
    publishedAt: new Date('2024-01-20'),
    status: 'published' as const,
    tags: ['long', 'content'],
  },
} as const

/**
 * Post factory - creates a post with default values + overrides
 */
let postCounter = 0

export function createPostFixture(overrides: Partial<PostFixture> = {}): PostFixture {
  postCounter++

  return {
    title: `Test Post ${postCounter}`,
    slug: `test-post-${postCounter}`,
    content: `This is test post ${postCounter} content.`,
    excerpt: `Test post ${postCounter} excerpt`,
    authorId: 'user-1',
    publishedAt: new Date(),
    status: 'published',
    tags: ['test'],
    ...overrides,
  }
}

/**
 * Create multiple posts
 */
export function createPostsFixture(
  count: number,
  overrides: Partial<PostFixture> = {},
): PostFixture[] {
  return Array.from({ length: count }, () => createPostFixture(overrides))
}

/**
 * Create posts for a specific author
 */
export function createPostsForAuthor(
  authorId: string,
  count: number,
  overrides: Partial<PostFixture> = {},
): PostFixture[] {
  return createPostsFixture(count, { authorId, ...overrides })
}

/**
 * Reset the post counter (for test isolation)
 */
export function resetPostCounter(): void {
  postCounter = 0
}
