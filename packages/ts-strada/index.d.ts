/**
 * Strada TypeScript Compiler API surface (typescript@6.x).
 *
 * TypeScript 7 (Corsa) does not ship the classic Compiler API as a drop-in.
 * Import this package for createSourceFile / forEachChild / is* helpers.
 * Use catalog typescript@7 for the tsc CLI only.
 */
import ts = require('typescript');
export = ts;
