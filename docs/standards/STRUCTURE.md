# Documentation Structure Guide

This document describes the standardized structure for RevealUI Framework documentation.

## Directory Structure

```
docs/
├── api/                  # Auto-generated API documentation
│   ├── README.md         # API documentation index
│   └── [package-name]/   # Package-specific API docs
├── guides/              # User-facing guides and tutorials
│   ├── getting-started/ # Getting started guides
│   ├── deployment/      # Deployment guides
│   └── usage/          # Usage guides
├── reference/          # Reference documentation
│   ├── configuration/  # Configuration reference
│   ├── api/           # API reference (links to api/)
│   └── types/         # Type definitions
├── development/        # Developer documentation
│   ├── contributing/  # Contribution guides
│   ├── architecture/  # Architecture docs
│   └── testing/       # Testing documentation
├── archive/           # Archived documentation (existing)
├── content/          # Processed content for website
└── [root files]      # Main documentation index files
```

## Directory Purposes

### `api/`
Auto-generated API documentation from TypeScript source files. This directory contains:
- Package-level API documentation
- Function, class, and interface documentation
- Type definitions
- Usage examples extracted from JSDoc

**Note**: Files in this directory are auto-generated. Do not edit manually.

### `guides/`
User-facing guides and tutorials. This includes:
- Getting started guides
- Step-by-step tutorials
- How-to guides
- Best practices
- Common use cases

### `reference/`
Reference documentation for developers. This includes:
- Configuration options
- API reference (links to `api/`)
- Type definitions
- Schema references
- Technical specifications

### `development/`
Documentation for contributors and maintainers. This includes:
- Contributing guidelines
- Architecture documentation
- Development setup
- Testing strategies
- Internal processes

### `archive/`
Historical documentation that is no longer actively maintained but kept for reference.

### `content/`
Processed content files used by the documentation website. This directory is auto-generated.

## File Naming Conventions

- Use kebab-case for file names: `getting-started.md`
- Use descriptive names: `deployment-vercel.md` not `deploy.md`
- Group related files in subdirectories
- Use `README.md` for directory indexes

## Documentation Types

### Guides
- Written for end users
- Step-by-step instructions
- Practical examples
- Clear, beginner-friendly language

### Reference
- Written for developers
- Complete API documentation
- Technical specifications
- Type definitions

### Development
- Written for contributors
- Internal processes
- Architecture decisions
- Development workflows

## Maintenance

- Keep documentation up to date with code changes
- Run `pnpm docs:manage` regularly to detect stale content
- Use `pnpm docs:manage` to reorganize documentation
- Archive outdated documentation to `docs/archive/`

## See Also

- [Documentation Tools](./DOCUMENTATION-TOOLS.md) - Tools for managing documentation
- [Contributing Docs](./CONTRIBUTING-DOCS.md) - How to contribute documentation
- [API Docs Guide](./API_DOCS_GUIDE.md) - How to write API documentation
