/**
 * Stub for `.ttf` binary asset imports at test time.
 *
 * tsup's `binary` loader inlines `.ttf` files into the production bundle,
 * but vitest can't evaluate the binary as a JS module. The vitest config
 * aliases `*.ttf` to this stub so any module that transitively imports a
 * font doesn't crash test collection.
 *
 * Tests that exercise the consuming code (e.g. og.test.ts) mock satori +
 * resvg directly to assert against real bytes-shaped payloads, so this
 * stub never reaches the renderers.
 */
export default new Uint8Array([0x00]);
