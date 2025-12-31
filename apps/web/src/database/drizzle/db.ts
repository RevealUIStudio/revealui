import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";

export function dbSqlite() {
  const sqlite = new Database(process.env.DATABASE_URL);
  return drizzleSqlite(sqlite);
}
