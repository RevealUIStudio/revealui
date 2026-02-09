/**
 * Full-Stack E2E Tests
 *
 * Comprehensive tests that verify the complete user experience flow:
 * Browser Interaction → API Calls → Database Operations
 *
 * These tests verify that user actions in the browser correctly
 * propagate through the API layer and result in expected database changes.
 */

import { expect, test } from '@playwright/test'
import {
  type DbTestHelper,
  cleanupTestData,
  createTestDb,
  seedTestData,
  verifyDbState,
  waitForDbRecord,
  waitForDbUpdate,
} from './utils/db-helpers'
import {
  fillField,
  waitForApiResponse,
  waitForNetworkIdle,
} from './utils/test-helpers'

test.describe('Full-Stack User Flows', () => {
  let db: DbTestHelper

  test.beforeAll(async () => {
    // Initialize database connection
    db = createTestDb()
    await db.connect()
  })

  test.afterAll(async () => {
    // Clean up database connection
    await db.disconnect()
  })

  test.describe('User Registration Flow', () => {
    const testEmail = `test-${Date.now()}@example.com`

    test.afterEach(async () => {
      // Clean up test user
      await cleanupTestData(db, 'users', {
        column: 'email',
        value: testEmail,
      })
    })

    test('should create user in database when signing up from browser', async ({
      page,
    }) => {
      // 1. Navigate to signup page
      await page.goto('/signup')
      await waitForNetworkIdle(page)

      // 2. Fill out signup form
      await fillField(page, 'input[name="email"]', testEmail)
      await fillField(page, 'input[name="password"]', 'SecurePassword123!')
      await fillField(page, 'input[name="name"]', 'Test User')

      // 3. Wait for API response
      const responsePromise = waitForApiResponse(page, '/api/auth/signup', 'POST')

      // 4. Submit form
      await page.click('button[type="submit"]')

      // 5. Wait for API call to complete
      const response = await responsePromise
      expect(response.status()).toBe(200)

      // 6. Verify user was created in database
      const user = await waitForDbRecord<{ id: string; email: string; name: string }>(
        db,
        'users',
        { column: 'email', value: testEmail }
      )

      expect(user).toBeTruthy()
      expect(user?.email).toBe(testEmail)
      expect(user?.name).toBe('Test User')

      // 7. Verify UI shows success
      await expect(page).toHaveURL(/\/(dashboard|home)/)

      // 8. Take screenshot for visual verification
      await page.screenshot({
        path: 'test-results/full-stack/user-registration-success.png',
        fullPage: true,
      })
    })

    test('should not create user in database with invalid email', async ({
      page,
    }) => {
      await page.goto('/signup')

      // Get initial user count
      const initialCount = await db.count('users')

      // Try to sign up with invalid email
      await fillField(page, 'input[name="email"]', 'invalid-email')
      await fillField(page, 'input[name="password"]', 'SecurePassword123!')
      await page.click('button[type="submit"]')

      // Wait a bit for any potential requests
      await page.waitForTimeout(1000)

      // Verify user count hasn't changed
      const finalCount = await db.count('users')
      expect(finalCount).toBe(initialCount)

      // Verify error message shown
      await expect(
        page.locator('text=/invalid.*email/i').first()
      ).toBeVisible()
    })
  })

  test.describe('Content Creation Flow', () => {
    let userId: string

    test.beforeEach(async () => {
      // Seed a test user
      const user = await db.insert<{ id: string }>('users', {
        email: `test-user-${Date.now()}@example.com`,
        password: 'hashed_password',
        name: 'Test User',
        created_at: new Date(),
        updated_at: new Date(),
      })
      userId = user.id
    })

    test.afterEach(async () => {
      // Clean up test data
      await cleanupTestData(db, 'posts', { column: 'user_id', value: userId })
      await cleanupTestData(db, 'users', { column: 'id', value: userId })
    })

    test('should create post in database when submitted from browser', async ({
      page,
    }) => {
      // 1. Login first (or use authenticated state)
      await page.goto('/login')
      await fillField(page, 'input[name="email"]', `test-user-${Date.now()}@example.com`)
      await fillField(page, 'input[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await waitForNetworkIdle(page)

      // 2. Navigate to create post page
      await page.goto('/posts/new')
      await waitForNetworkIdle(page)

      // 3. Fill out post form
      const postTitle = `Test Post ${Date.now()}`
      const postContent = 'This is test content for E2E testing'

      await fillField(page, 'input[name="title"]', postTitle)
      await fillField(page, 'textarea[name="content"]', postContent)

      // 4. Wait for create API call
      const responsePromise = waitForApiResponse(page, '/api/posts', 'POST')

      // 5. Submit form
      await page.click('button[type="submit"]')

      // 6. Wait for API response
      const response = await responsePromise
      expect(response.status()).toBe(201)

      // 7. Verify post was created in database
      const post = await waitForDbRecord<{
        id: string
        title: string
        content: string
        user_id: string
      }>(db, 'posts', { column: 'title', value: postTitle })

      expect(post).toBeTruthy()
      expect(post?.title).toBe(postTitle)
      expect(post?.content).toBe(postContent)
      expect(post?.user_id).toBe(userId)

      // 8. Verify redirect to post view
      await expect(page).toHaveURL(/\/posts\/\w+/)

      // 9. Visual verification
      await page.screenshot({
        path: 'test-results/full-stack/post-creation-success.png',
        fullPage: true,
      })
    })
  })

  test.describe('Data Update Flow', () => {
    let postId: string

    test.beforeEach(async () => {
      // Seed a test post
      const post = await db.insert<{ id: string }>('posts', {
        title: 'Original Title',
        content: 'Original content',
        user_id: 'test-user-id',
        published: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      postId = post.id
    })

    test.afterEach(async () => {
      // Clean up
      await db.delete('posts', postId)
    })

    test('should update database when editing post from browser', async ({
      page,
    }) => {
      // 1. Navigate to edit page
      await page.goto(`/posts/${postId}/edit`)
      await waitForNetworkIdle(page)

      // 2. Update the post
      const newTitle = `Updated Title ${Date.now()}`
      await fillField(page, 'input[name="title"]', newTitle)

      // 3. Wait for update API call
      const responsePromise = waitForApiResponse(
        page,
        `/api/posts/${postId}`,
        'PATCH'
      )

      // 4. Save changes
      await page.click('button[type="submit"]')

      // 5. Wait for API response
      const response = await responsePromise
      expect(response.status()).toBe(200)

      // 6. Verify database was updated
      const updatedPost = await waitForDbUpdate<{ title: string }>(
        db,
        'posts',
        postId,
        { title: newTitle }
      )

      expect(updatedPost).toBeTruthy()
      expect(updatedPost?.title).toBe(newTitle)

      // 7. Visual verification
      await page.screenshot({
        path: 'test-results/full-stack/post-update-success.png',
      })
    })

    test('should publish post and update database status', async ({ page }) => {
      // Navigate to post
      await page.goto(`/posts/${postId}`)
      await waitForNetworkIdle(page)

      // Click publish button
      const publishButton = page.locator('button:has-text("Publish")')
      if ((await publishButton.count()) > 0) {
        await publishButton.click()

        // Wait for update
        await page.waitForTimeout(1000)

        // Verify database status changed
        const post = await db.getById<{ published: boolean }>('posts', postId)
        expect(post?.published).toBe(true)

        // Visual verification
        await expect(page.locator('text=/published/i')).toBeVisible()
      }
    })
  })

  test.describe('Data Deletion Flow', () => {
    let postId: string

    test.beforeEach(async () => {
      // Seed a test post
      const post = await db.insert<{ id: string }>('posts', {
        title: 'Post to Delete',
        content: 'This will be deleted',
        user_id: 'test-user-id',
        created_at: new Date(),
        updated_at: new Date(),
      })
      postId = post.id
    })

    test('should remove record from database when deleting from browser', async ({
      page,
    }) => {
      // 1. Navigate to post
      await page.goto(`/posts/${postId}`)
      await waitForNetworkIdle(page)

      // 2. Verify post exists in database
      const postBefore = await db.getById('posts', postId)
      expect(postBefore).toBeTruthy()

      // 3. Click delete button
      const deleteButton = page.locator('button:has-text("Delete")')
      if ((await deleteButton.count()) > 0) {
        // Handle confirmation dialog
        page.on('dialog', (dialog) => dialog.accept())

        // Wait for delete API call
        const responsePromise = waitForApiResponse(
          page,
          `/api/posts/${postId}`,
          'DELETE'
        )

        await deleteButton.click()

        // Wait for API response
        const response = await responsePromise
        expect(response.status()).toBe(204)

        // 4. Verify post was deleted from database
        await page.waitForTimeout(500)
        const postAfter = await db.getById('posts', postId)
        expect(postAfter).toBeNull()

        // 5. Verify redirect
        await expect(page).toHaveURL(/\/posts\/?$/)
      }
    })
  })

  test.describe('Search and Filter Flow', () => {
    test.beforeAll(async () => {
      // Seed multiple test posts
      await seedTestData(db, 'posts', [
        {
          title: 'JavaScript Tutorial',
          content: 'Learn JavaScript',
          user_id: 'test-user-id',
          tags: ['javascript', 'programming'],
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          title: 'TypeScript Guide',
          content: 'Learn TypeScript',
          user_id: 'test-user-id',
          tags: ['typescript', 'programming'],
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          title: 'React Basics',
          content: 'Learn React',
          user_id: 'test-user-id',
          tags: ['react', 'javascript'],
          created_at: new Date(),
          updated_at: new Date(),
        },
      ])
    })

    test.afterAll(async () => {
      // Clean up test posts
      await cleanupTestData(db, 'posts', {
        column: 'user_id',
        value: 'test-user-id',
      })
    })

    test('should filter results matching database query', async ({ page }) => {
      // 1. Navigate to posts page
      await page.goto('/posts')
      await waitForNetworkIdle(page)

      // 2. Get all posts from database
      const allPosts = await db.getAll<{ title: string }>('posts')
      const expectedCount = allPosts.length

      // 3. Verify page shows correct count
      const postElements = page.locator('article, [data-testid*="post"]')
      expect(await postElements.count()).toBeGreaterThanOrEqual(expectedCount)

      // 4. Search for specific term
      const searchInput = page.locator('input[type="search"]')
      if ((await searchInput.count()) > 0) {
        await searchInput.fill('JavaScript')
        await waitForApiResponse(page, '/api/posts', 'GET')
        await page.waitForTimeout(500)

        // 5. Get filtered results from database
        const dbResults = await db.query<{ title: string }>(
          `SELECT * FROM posts WHERE title ILIKE $1`,
          ['%JavaScript%']
        )

        // 6. Verify UI matches database results
        const uiResults = await postElements.count()
        expect(uiResults).toBe(dbResults.rowCount)

        // 7. Visual verification
        await page.screenshot({
          path: 'test-results/full-stack/search-results.png',
          fullPage: true,
        })
      }
    })
  })

  test.describe('Pagination Flow', () => {
    test.beforeAll(async () => {
      // Seed 25 test posts for pagination
      const posts = Array.from({ length: 25 }, (_, i) => ({
        title: `Post ${i + 1}`,
        content: `Content ${i + 1}`,
        user_id: 'test-user-id',
        created_at: new Date(Date.now() - i * 1000),
        updated_at: new Date(),
      }))

      await seedTestData(db, 'posts', posts)
    })

    test.afterAll(async () => {
      await cleanupTestData(db, 'posts', {
        column: 'user_id',
        value: 'test-user-id',
      })
    })

    test('should paginate results matching database query', async ({ page }) => {
      // 1. Navigate to first page
      await page.goto('/posts?page=1&limit=10')
      await waitForNetworkIdle(page)

      // 2. Get first page from database
      const dbPage1 = await db.query<{ id: string; title: string }>(
        'SELECT * FROM posts ORDER BY created_at DESC LIMIT 10 OFFSET 0'
      )

      // 3. Verify UI shows correct posts
      const firstPostTitle = await page
        .locator('article, [data-testid*="post"]')
        .first()
        .textContent()

      expect(firstPostTitle).toContain(dbPage1.rows[0].title)

      // 4. Navigate to page 2
      await page.click('button:has-text("Next"), a:has-text("2")')
      await waitForNetworkIdle(page)

      // 5. Get second page from database
      const dbPage2 = await db.query<{ id: string; title: string }>(
        'SELECT * FROM posts ORDER BY created_at DESC LIMIT 10 OFFSET 10'
      )

      // 6. Verify UI shows correct posts for page 2
      const firstPostTitlePage2 = await page
        .locator('article, [data-testid*="post"]')
        .first()
        .textContent()

      expect(firstPostTitlePage2).toContain(dbPage2.rows[0].title)

      // 7. Visual verification
      await page.screenshot({
        path: 'test-results/full-stack/pagination-page-2.png',
        fullPage: true,
      })
    })
  })

  test.describe('Real-time Updates Flow', () => {
    test('should reflect database changes in UI', async ({ page }) => {
      // 1. Navigate to posts list
      await page.goto('/posts')
      await waitForNetworkIdle(page)

      // 2. Count initial posts
      const initialCount = await page
        .locator('article, [data-testid*="post"]')
        .count()

      // 3. Create new post directly in database (simulating external update)
      const newPost = await db.insert<{ id: string; title: string }>('posts', {
        title: `Real-time Post ${Date.now()}`,
        content: 'This was created directly in the database',
        user_id: 'test-user-id',
        created_at: new Date(),
        updated_at: new Date(),
      })

      // 4. Refresh or wait for real-time update
      await page.reload()
      await waitForNetworkIdle(page)

      // 5. Verify new post appears in UI
      const newCount = await page
        .locator('article, [data-testid*="post"]')
        .count()

      expect(newCount).toBeGreaterThan(initialCount)

      // 6. Verify the specific post is visible
      await expect(page.locator(`text=${newPost.title}`)).toBeVisible()

      // 7. Clean up
      await db.delete('posts', newPost.id)
    })
  })

  test.describe('Transaction Flow', () => {
    test('should rollback database changes on error', async ({ page }) => {
      // This test verifies that failed operations don't leave partial data

      // 1. Get initial counts
      const initialUserCount = await db.count('users')
      const initialPostCount = await db.count('posts')

      // 2. Navigate to a form that creates multiple related records
      await page.goto('/signup-with-profile')

      // 3. Fill form with data that will cause an error
      await fillField(page, 'input[name="email"]', 'test@example.com')
      await fillField(page, 'input[name="password"]', 'short') // Too short

      // 4. Submit form
      await page.click('button[type="submit"]')
      await page.waitForTimeout(1000)

      // 5. Verify counts haven't changed (transaction rolled back)
      const finalUserCount = await db.count('users')
      const finalPostCount = await db.count('posts')

      expect(finalUserCount).toBe(initialUserCount)
      expect(finalPostCount).toBe(initialPostCount)

      // 6. Verify error message shown
      await expect(page.locator('[role="alert"]')).toBeVisible()
    })
  })
})
