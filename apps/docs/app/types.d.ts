// Side-effect font imports have no runtime API; declare the @fontsource-variable
// CSS-only modules so TS doesn't complain about missing type declarations.
// Self-hosted fonts imported in app/entry.client.tsx (GAP-324, mirrors marketing).
declare module '@fontsource-variable/inter';
declare module '@fontsource-variable/inter-tight';
declare module '@fontsource-variable/jetbrains-mono';
