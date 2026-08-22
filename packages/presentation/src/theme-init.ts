/**
 * Pre-hydration theme bootstrap.
 *
 * `useTheme` applies `data-theme` in an effect, which is after first paint.
 * Admin `(frontend)` also hides `<html>` until `data-theme` is `light` or
 * `dark`, so this IIFE must always set the attribute (stored preference or
 * OS scheme). Same key and resolution as `useTheme`. Do not fork a second
 * storage path.
 */

export const THEME_STORAGE_KEY = 'rvui-theme';
export const THEME_DATA_ATTR = 'data-theme';

/**
 * Embed a string as a JS literal that is also safe inside an HTML `<script>`
 * tag. `JSON.stringify` alone is not enough: a value containing `</script>`
 * still terminates the enclosing tag (CodeQL `js/bad-code-sanitization`).
 * `replaceAll` after stringify is the sanitizer that query models.
 */
export function toHtmlSafeJsString(value: string): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

/**
 * Inline this in `<head>` (or Next `beforeInteractive`) before CSS-dependent
 * paint. Keep the body a single IIFE with no imports.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${toHtmlSafeJsString(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var t=(s==='light'||s==='dark'||s==='system')?s:'system';var r=t==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;document.documentElement.setAttribute(${toHtmlSafeJsString(THEME_DATA_ATTR)},r);}catch(e){document.documentElement.setAttribute(${toHtmlSafeJsString(THEME_DATA_ATTR)},window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');}})();`;
