/**
 * Stub for binary asset imports (.ttf, .wasm) at test time.
 *
 * tsup's `binary` loader inlines these into the production bundle, but
 * vitest can't evaluate the binaries as JS modules. The vitest config
 * aliases `*.ttf` and `*.wasm` to this stub so any module that
 * transitively imports a binary doesn't crash test collection.
 *
 * Tests that exercise the consuming code (e.g. og.test.ts) replace this
 * stub with their own vi.mock to assert against real bytes-shaped payloads.
 */
export default new Uint8Array([0x00]);
