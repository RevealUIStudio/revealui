-- Performance Indexes Migration
-- Adds strategic indexes to improve query performance

-- ============================================================================
-- USER INDEXES
-- ============================================================================

-- Email lookup (used in authentication)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
ON users(email);

-- Created at for sorting recent users
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at
ON users(created_at DESC);

-- Email verification status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_verified
ON users(email_verified_at)
WHERE email_verified_at IS NOT NULL;

-- ============================================================================
-- POST INDEXES
-- ============================================================================

-- Slug lookup (used in public URLs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_slug
ON posts(slug);

-- Published posts sorted by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_published_at
ON posts(published_at DESC)
WHERE published_at IS NOT NULL;

-- Author foreign key
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_author_id
ON posts(author_id);

-- Status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_status
ON posts(status);

-- Composite index for author's posts by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_author_status
ON posts(author_id, status);

-- Composite index for published posts list
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_published_status
ON posts(published_at DESC, status)
WHERE status = 'published';

-- Full text search on title and content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_search
ON posts USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));

-- ============================================================================
-- SESSION INDEXES
-- ============================================================================

-- Token lookup (used in authentication)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_token
ON sessions(token);

-- User sessions lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_id
ON sessions(user_id);

-- Expiration cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expires_at
ON sessions(expires_at);

-- Active sessions by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_active
ON sessions(user_id, expires_at)
WHERE expires_at > NOW();

-- ============================================================================
-- COMMENT INDEXES (if comments table exists)
-- ============================================================================

-- Post comments lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_post_id
ON comments(post_id)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments');

-- Author comments lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_author_id
ON comments(author_id)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments');

-- Approved comments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_approved
ON comments(approved_at, created_at DESC)
WHERE approved_at IS NOT NULL
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments');

-- ============================================================================
-- CATEGORY/TAG INDEXES (if exists)
-- ============================================================================

-- Category slug lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_slug
ON categories(slug)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories');

-- Tag slug lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_slug
ON tags(slug)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tags');

-- Post-Tag junction table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_tags_post_id
ON post_tags(post_id)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_tags');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_tags_tag_id
ON post_tags(tag_id)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_tags');

-- ============================================================================
-- MEDIA/ASSETS INDEXES (if exists)
-- ============================================================================

-- Media type lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_type
ON media(type)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media');

-- Media owner lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_user_id
ON media(user_id)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media');

-- ============================================================================
-- ANALYTICS/METRICS INDEXES (if exists)
-- ============================================================================

-- Page views by date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_created_at
ON analytics(created_at DESC)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics');

-- Page views by resource
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_resource
ON analytics(resource_type, resource_id)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- View all indexes
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;

-- Check index usage
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan DESC;

-- Find unused indexes
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan
-- FROM pg_stat_user_indexes
-- WHERE idx_scan = 0
-- AND indexname NOT LIKE 'pg_toast%'
-- ORDER BY tablename, indexname;

-- Check index sizes
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) as index_size
-- FROM pg_stat_user_indexes
-- ORDER BY pg_relation_size(indexrelid) DESC;
