/**
 * Codemod types — shared contract for all RevealUI migration transforms.
 *
 * A codemod describes a single breaking change across a version boundary
 * and knows how to rewrite user source files to match the new API. Codemods
 * are discovered from a central registry and applied in semver order by
 * `revealui migrate`.
 */

/**
 * API passed to a codemod transform. Kept minimal on purpose — a codemod
 * that needs a full AST is free to `import { Project } from 'ts-morph'`
 * (or similar) inside its own implementation. Most public-API renames can
 * be expressed as straightforward string/regex rewrites over the source.
 */
export interface CodemodApi {
  /** Absolute path of the file currently being transformed. */
  filePath: string;
  /** Logger bound to the active `revealui migrate` run. */
  logger: CodemodLogger;
}

/** Structured logger surfaced to codemod authors. */
export interface CodemodLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * A single codemod. One codemod addresses one breaking change, across one
 * semver boundary. Author as many as the migration requires — ordering is
 * controlled by `fromVersion`/`toVersion`, not file name.
 */
export interface Codemod {
  /** Stable id, e.g. `password-hasher-to-auth`. Used as the CLI selector. */
  name: string;
  /** One-line summary printed by `revealui migrate --list`. */
  description: string;
  /**
   * Semver range (as accepted by `semver.satisfies`) of the *previous*
   * package version this codemod migrates *from*. Example: `"<0.3.0"`.
   */
  fromVersion: string;
  /**
   * Semver range the project lands on after this codemod runs. Used to
   * skip codemods that have already been applied.
   */
  toVersion: string;
  /**
   * Package the versions refer to. `"@revealui/security"`, `"@revealui/core"`,
   * etc. — looked up in the user's package.json to decide applicability.
   */
  package: string;
  /**
   * Optional filter — return false to skip a file without invoking `transform`.
   * Useful for confining a codemod to `.ts` / `.tsx` only, or to a subtree.
   */
  match?(filePath: string): boolean;
  /**
   * Transform one file's source. Return the new source string, or `null`
   * to indicate this file needs no change. Throw for a hard failure — the
   * runner will catch and report, leaving the file untouched.
   */
  transform(source: string, api: CodemodApi): string | null;
}

/** Outcome per file, reported by the runner. */
export interface CodemodFileResult {
  filePath: string;
  codemod: string;
  status: 'changed' | 'unchanged' | 'error';
  error?: string;
}

/** Aggregate summary returned by `runCodemods`. */
export interface CodemodRunResult {
  applied: string[];
  skipped: string[];
  changedFiles: number;
  errored: number;
  results: CodemodFileResult[];
}
