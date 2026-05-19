/// <reference types="vite/client" />

// Side-effect font imports have no runtime API; declare them so TS doesn't
// complain about missing type declarations.
declare module '@fontsource-variable/inter';
declare module '@fontsource-variable/inter-tight';
declare module '@fontsource-variable/jetbrains-mono';
