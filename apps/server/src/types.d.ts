/**
 * Binary asset imports.
 *
 * tsup's `binary` loader inlines `.ttf` imports as `Uint8Array` literals at
 * build time (see tsup.config.ts). At dev time (tsx), Node's import-attribute
 * machinery handles the same paths via the loader entry.
 *
 * `.wasm` is intentionally NOT declared — the resvg WASM is read at runtime
 * via `readFileSync` + `createRequire.resolve` rather than imported directly,
 * because Node's WASM ESM loader can't resolve the wasm-bindgen `wbg` glue.
 * See apps/server/src/routes/og.ts for the load pattern.
 */

declare module '*.ttf' {
  const data: Uint8Array;
  export default data;
}
