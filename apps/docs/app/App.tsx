import { Route, Routes } from 'react-router-dom'
import { DocLayout } from './components/DocLayout'
import { ApiPage } from './routes/ApiPage'
import { GuidesPage } from './routes/GuidesPage'
import { HomePage } from './routes/HomePage'
import { ProPage } from './routes/ProPage'
import { SectionPage } from './routes/SectionPage'

export function App() {
  return (
    <DocLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/docs/*" element={<SectionPage section="docs" title="Documentation" />} />
        <Route path="/guides/*" element={<GuidesPage />} />
        <Route path="/api/*" element={<ApiPage />} />
        <Route
          path="/architecture/*"
          element={
            <SectionPage
              section="architecture"
              title="Architecture"
              fallbackIndex={`# Architecture

- [Architecture Overview](/docs/ARCHITECTURE)
- [Database Optimization](/architecture/DATABASE_OPTIMIZATION)
- [ElectricSQL API Verification](/architecture/ELECTRICSQL_API_VERIFICATION)
`}
            />
          }
        />
        <Route
          path="/deployment/*"
          element={
            <SectionPage
              section="deployment"
              title="Deployment"
              fallbackIndex={`# Deployment

- [Deployment Guide](/deployment/DEPLOYMENT)
- [Staging Deployment](/deployment/STAGING_DEPLOYMENT_GUIDE)
- [Deployment Readiness Report](/deployment/DEPLOYMENT_READINESS_REPORT)
- [Security Scan Report](/deployment/SECURITY_SCAN_REPORT)
`}
            />
          }
        />
        <Route
          path="/development/*"
          element={
            <SectionPage
              section="development"
              title="Development"
              fallbackIndex={`# Development

- [API Optimization](/development/API_OPTIMIZATION)
- [Bundle Optimization](/development/BUNDLE_OPTIMIZATION)
- [Caching Strategy](/development/CACHING_STRATEGY)
- [Code Validation](/development/CODE_VALIDATION)
- [Scripts](/development/SCRIPTS)
- [Turbo Optimization](/development/TURBO_OPTIMIZATION)
`}
            />
          }
        />
        <Route
          path="/testing/*"
          element={
            <SectionPage
              section="testing"
              title="Testing"
              fallbackIndex={`# Testing

- [Testing Overview](/testing/TESTING)
- [Component Testing](/testing/COMPONENT_TESTING)
- [Integration Testing](/testing/INTEGRATION_TESTING)
- [End-to-End Testing](/testing/E2E_TESTING)
`}
            />
          }
        />
        <Route
          path="/security/*"
          element={
            <SectionPage
              section="security"
              title="Security"
              fallbackIndex={`# Security

- [Security Audit](/security/SECURITY_AUDIT)
`}
            />
          }
        />
        <Route
          path="/ai/*"
          element={
            <SectionPage
              section="ai"
              title="AI"
              fallbackIndex={`# AI

- [Prompt Caching](/ai/PROMPT_CACHING)
- [Response Caching](/ai/RESPONSE_CACHING)
- [Semantic Caching](/ai/SEMANTIC_CACHING)
`}
            />
          }
        />
        <Route
          path="/reference/*"
          element={
            <SectionPage
              section="reference"
              title="Reference"
              fallbackIndex={`# Package Reference

Technical reference for all RevealUI packages.

## OSS Packages (MIT)

- [Core](/reference/core) — CMS engine, collections, access control, REST handlers, license, plugins
- [Auth](/reference/auth) — Session auth, sign in/up, password reset, OAuth, rate limiting
- [Database](/reference/db) — Drizzle ORM schema, client factory, migrations, AES-256 encryption
- [Contracts](/reference/contracts) — Zod schemas and TypeScript types (single source of truth)
- [Presentation](/reference/presentation) — 50+ native UI components (Tailwind v4, no external UI deps)
- [Config](/reference/config) — Type-safe env config with Zod validation and lazy Proxy
- [Utils](/reference/utils) — Logger, validation helpers, shared utilities
- [Router](/reference/router) — Lightweight file-based router with SSR support
- [CLI](/reference/cli) — \`create-revealui\` scaffolding tool

## Pro Packages

See the [Pro documentation](/pro) for AI agents, MCP servers, BYOK, and more.
`}
            />
          }
        />
        <Route path="/pro/*" element={<ProPage />} />
      </Routes>
    </DocLayout>
  )
}
