/**
 * Redirect / notFound throw-sentinels (ADR D6 / T5).
 * Caught by `renderRequest` — do not catch these in user loaders without rethrowing.
 */

export class RouterRedirect extends Error {
  readonly path: string;
  readonly permanent: boolean;

  constructor(path: string, options?: { permanent?: boolean }) {
    super(`RouterRedirect: ${path}`);
    this.name = 'RouterRedirect';
    this.path = path;
    this.permanent = options?.permanent ?? false;
  }
}

export class RouterNotFound extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'RouterNotFound';
  }
}

/** Throw a redirect sentinel. Initial HTML → 307/308; RSC navigation → JSON body. */
export function redirect(path: string, options?: { permanent?: boolean }): never {
  throw new RouterRedirect(path, options);
}

/** Throw a not-found sentinel → 404 + RouterOptions.notFound when available. */
export function notFound(): never {
  throw new RouterNotFound();
}

export function isRouterRedirect(error: unknown): error is RouterRedirect {
  // Name check survives duplicate module copies under plugin-rsc bundling.
  return (
    error instanceof RouterRedirect ||
    (typeof error === 'object' && error !== null && (error as Error).name === 'RouterRedirect')
  );
}

export function isRouterNotFound(error: unknown): error is RouterNotFound {
  return (
    error instanceof RouterNotFound ||
    (typeof error === 'object' && error !== null && (error as Error).name === 'RouterNotFound')
  );
}
