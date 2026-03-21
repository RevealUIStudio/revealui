-- Migration: page-count-trigger
--
-- Maintains sites.page_count automatically via a PostgreSQL trigger so that
-- application code does not need to call incrementPageCount / decrementPageCount
-- manually after every page INSERT or soft-delete UPDATE.
--
-- Handles:
--   INSERT ON pages       → increment when deleted_at IS NULL (new active page)
--   UPDATE ON pages       → decrement when active → soft-deleted
--                         → increment when soft-deleted → restored
--
-- Hard DELETE is intentionally omitted: pages use soft-delete (setting
-- deleted_at).  Hard deletes only happen via the ON DELETE CASCADE on the
-- sites FK, at which point the site row is gone anyway.

CREATE OR REPLACE FUNCTION page_count_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NULL THEN
      UPDATE sites
        SET page_count = GREATEST(COALESCE(page_count, 0) + 1, 0)
        WHERE id = NEW.site_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- active → soft-deleted
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE sites
        SET page_count = GREATEST(COALESCE(page_count, 0) - 1, 0)
        WHERE id = NEW.site_id;
    -- soft-deleted → restored
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE sites
        SET page_count = GREATEST(COALESCE(page_count, 0) + 1, 0)
        WHERE id = NEW.site_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS page_count_trigger ON pages;

CREATE TRIGGER page_count_trigger
  AFTER INSERT OR UPDATE ON pages
  FOR EACH ROW
  EXECUTE FUNCTION page_count_trigger_fn();
