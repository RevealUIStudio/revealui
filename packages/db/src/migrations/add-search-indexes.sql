-- Full-text search support for posts and pages
-- Uses tsvector columns with GIN indexes and auto-update triggers

-- Posts: add tsvector column
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate from title + slug
UPDATE posts SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(slug, '')), 'B')
WHERE search_vector IS NULL;

-- GIN index for fast search
CREATE INDEX IF NOT EXISTS posts_search_idx ON posts USING gin(search_vector);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.slug, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_search_update ON posts;
CREATE TRIGGER posts_search_update
  BEFORE INSERT OR UPDATE OF title, slug ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();

-- Pages: add tsvector column
ALTER TABLE pages ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE pages SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(slug, '')), 'B')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS pages_search_idx ON pages USING gin(search_vector);

CREATE OR REPLACE FUNCTION pages_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.slug, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pages_search_update ON pages;
CREATE TRIGGER pages_search_update
  BEFORE INSERT OR UPDATE OF title, slug ON pages
  FOR EACH ROW EXECUTE FUNCTION pages_search_vector_update();
