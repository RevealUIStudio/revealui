/**
 * Binary asset imports.
 *
 * tsup's `binary` loader inlines `.ttf` and `.wasm` imports as `Uint8Array`
 * literals at build time (see tsup.config.ts). At dev time (tsx), Node's
 * import-attribute machinery handles the same paths via the loader entry.
 */

declare module '*.ttf' {
  const data: Uint8Array;
  export default data;
}

declare module '*.wasm' {
  const data: Uint8Array;
  export default data;
}
