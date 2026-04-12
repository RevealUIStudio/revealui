/**
 * Vitest setup file
 * Configures testing environment for React component tests
 */

import '@testing-library/jest-dom';

// jsdom does not implement navigator.clipboard  -  install a global stub
// so components that call navigator.clipboard.writeText don't throw
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: () => Promise.resolve(),
      readText: () => Promise.resolve(''),
    },
    writable: true,
    configurable: true,
  });
}
