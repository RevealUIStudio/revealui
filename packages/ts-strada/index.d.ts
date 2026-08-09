/**
 * Strada TypeScript Compiler API surface (typescript@6.x).
 *
 * TypeScript 7 (Corsa) does not ship the classic Compiler API as a drop-in,
 * and Next.js still requires `typescript/lib/typescript.js`. The monorepo
 * catalog therefore stays on 6.x until Next supports Corsa. Import this
 * package for createSourceFile / forEachChild / is* helpers — do not import
 * `typescript` for Compiler API work.
 */
import ts = require('typescript');
export = ts;
