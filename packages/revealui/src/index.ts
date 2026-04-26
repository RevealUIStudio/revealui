// This package is a meta-installer. The actual implementation lives in
// bin/revealui.js — running `revealui` (or `npx revealui`) proxies to
// create-revealui's CLI. No library API is exported.
//
// This file exists so the project's structure validator
// (scripts/validate/structure.ts) recognises the package; it is intentionally
// NOT included in the published tarball (see `files` in package.json).

export {};
