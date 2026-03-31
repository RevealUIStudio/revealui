---
title: "Third-Party Licenses"
description: "License attributions for all third-party dependencies"
category: legal
audience: legal
---

# Third-Party Licenses

This document lists all third-party dependencies used in the RevealUI Framework and their respective licenses.

## License Summary

**Total Dependencies**: 50+ packages

**License Distribution**:
- MIT: 45+ packages (90%+)
- Apache-2.0: 3+ packages
- BSD-3-Clause: 2+ packages
- ISC: 1+ packages
- 0BSD: 1+ packages

## Key Dependencies

### MIT Licensed (Primary)
- **@apidevtools/json-schema-ref-parser** v11.9.3 - Parse, Resolve, and Dereference JSON Schema $ref pointers
- **@babel/code-frame** v7.27.1 - Generate errors that contain a code frame that point to source locations
- **@babel/core** v7.28.4 - Babel compiler core
- **@babel/preset-env** v7.28.4 - A Babel preset for each environment
- **@babel/preset-react** v7.28.4 - Babel preset for all React plugins
- **@babel/preset-typescript** v7.28.4 - Babel preset for TypeScript
- **@neondatabase/serverless** v0.10.1 - Neon serverless Postgres driver
- **drizzle-orm** v0.35.2 - TypeScript ORM for SQL databases
- **lexical** v0.38.2 - Extensible text editor framework
- **@lexical/react** v0.38.2 - React bindings for Lexical
- **@tailwindcss/typography** v0.5.15 - Typography plugin for Tailwind CSS
- **@types/node** v22.10.2 - TypeScript definitions for Node.js
- **@types/react** v18.3.12 - TypeScript definitions for React
- **@types/react-dom** v18.3.1 - TypeScript definitions for React DOM
- **@vercel/blob** v0.25.0 - Vercel Blob storage client
- **@vercel/postgres** v0.12.0 - Vercel Postgres client
- **class-variance-authority** v0.7.1 - Utility for creating variant-based component APIs
- **clsx** v2.1.1 - Utility for constructing className strings conditionally
- **lucide-react** v0.468.0 - Beautiful & consistent icon toolkit
- **next** v15.5.5 - The React Framework for Production
- **bcryptjs** v2.4.3 - Password hashing library
- **react** v19.0.0 - A JavaScript library for building user interfaces
- **react-dom** v19.0.0 - React package for working with the DOM
- **tailwind-merge** v2.5.4 - Merge Tailwind CSS classes without style conflicts
- **tailwindcss** v4.1.14 - A utility-first CSS framework
- **typescript** v5.7.3 - TypeScript is a language for application scale JavaScript development
- **revealui** v1.0.0 - Like Next.js / Nuxt but as do-one-thing-do-it-well Vite plugin
- **vite** v6.4.0 - Next generation frontend tooling
- **zod** v3.24.1 - TypeScript-first schema validation

### Apache-2.0 Licensed
- **@vercel/analytics** v1.3.1 - Vercel Analytics
- **@vercel/speed-insights** v1.1.0 - Vercel Speed Insights
- **@vercel/web-vitals** v1.0.0 - Vercel Web Vitals

### BSD-3-Clause Licensed
- **@types/jest** v29.5.14 - TypeScript definitions for Jest
- **@types/testing-library__jest-dom** v6.0.0 - TypeScript definitions for jest-dom

### 0BSD Licensed
- **tsx** v4.19.2 - TypeScript execution and REPL for node.js

## License Compliance

✅ **All dependencies are compatible with MIT license**

- No GPL, AGPL, or copyleft licenses found
- All dependencies allow commercial use
- All dependencies allow modification and distribution
- All dependencies allow private use

## Full License Audit

For a complete list of all dependencies and their licenses, run:

```bash
cd packages/reveal
pnpm licenses list --prod --json > licenses.json
```

This will generate a comprehensive JSON file with all dependency information.

## License Text

The full text of each license can be found in the respective package's `node_modules` directory or on their official websites:

- [MIT License](https://opensource.org/licenses/MIT)
- [Apache License 2.0](https://opensource.org/licenses/Apache-2.0)
- [BSD 3-Clause License](https://opensource.org/licenses/BSD-3-Clause)
- [ISC License](https://opensource.org/licenses/ISC)
- [0BSD License](https://opensource.org/licenses/0BSD)

---

**Last Updated**: 2026-03-05
**Audit Command**: `pnpm licenses list --prod --json`
