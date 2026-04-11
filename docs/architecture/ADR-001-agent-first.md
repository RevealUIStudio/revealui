# ADR-001: Agent-First, Human-Readable

**Date:** 2026-03-11
**Status:** Accepted

## Context

The codebase audit revealed a strong API layer (A-) alongside a skeletal admin UI. No explicit decision existed about which interface is primary.

## Decision

Every system in RevealUI has two interfaces:

1. **Programmatic surface:** Structured data (YAML, JSON, OpenAPI, Zod schemas) that agents and automated tools parse deterministically. This is the primary interface.

2. **Human surface:** Rendered views produced on demand when a human requests information. Browser-based UIs, dashboards, and documentation sites are renderers  -  projections of the programmatic surface.

The programmatic surface is built first. The human surface is built on top of it.

### Two distinct programmatic surfaces

- **Product programmatic surface:** End-user agents and integrations consume the REST API via OpenAPI.
- **Development programmatic surface:** Development agents consume roadmap/reality/gap YAML files to manage feature lifecycle.

### Priority implication

When triaging work, programmatic surface gaps outrank human surface gaps at the same severity level.

## Consequences

- Admin UI work is deprioritized relative to API completeness
- All new features must have an API/structured interface before any UI
- Feature flags only exist for implemented features; aspirational features live in roadmap YAML
- Absence of a reality doc signals a feature is not implemented  -  no placeholder files for planned features
