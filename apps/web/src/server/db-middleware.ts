import type { Get, UniversalMiddleware } from '@universal-middleware/core'
import { dbSqlite } from '../database/drizzle/db.js'

// Use interface augmentation instead of namespace
interface UniversalContext {
  db: ReturnType<typeof dbSqlite>
}

declare module '@universal-middleware/core' {
  // Module augmentation: extend Context with db property
  // The interface appears empty but is augmenting the external module's Context type
  interface Context extends UniversalContext {
    db: ReturnType<typeof dbSqlite>
  }
}

// Add `db` to the Context
export const dbMiddleware: Get<[], UniversalMiddleware> = () => (_request, context) => {
  const db = dbSqlite()

  return {
    ...context,
    db: db,
  }
}
