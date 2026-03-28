/**
 * @revealui/core/types - Frontend Types
 *
 * Types used by the frontend web application.
 * These types define the interface between the framework and the web app.
 */

/**
 * Configuration type for RevealUI frontend applications.
 * This is the base config that web apps extend.
 */
export interface Config {
  Layout?: React.ComponentType<unknown>;
  [key: string]: unknown;
}

/**
 * Page context provided to page components.
 */
export interface PageContext {
  url: string;
  urlOriginal: string;
  urlPathname: string;
  urlParsed: {
    pathname: string;
    search: Record<string, string>;
    hash: string;
  };
  routeParams: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Initial page context data.
 */
export interface PageContextInit {
  url: string;
  urlOriginal: string;
  urlPathname: string;
  urlParsed: {
    pathname: string;
    search: Record<string, string>;
    hash: string;
  };
  routeParams: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Async function called when a page transition starts.
 */
export type OnPageTransitionStartAsync = () => void | Promise<void>;

/**
 * Async function called when a page transition ends.
 */
export type OnPageTransitionEndAsync = () => void | Promise<void>;
