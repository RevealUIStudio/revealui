// Vercel Hono entry point — uses pre-compiled output to avoid
// TypeScript cross-compilation issues in the monorepo.
import { Hono } from 'hono'

export { default } from './dist/index.js'

// Prevent dead-code elimination of the Hono import (Vercel detection)
void Hono
