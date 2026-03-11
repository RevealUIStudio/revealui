'use client';

// Label feature client — not yet implemented.
// Server-side feature exists in feature.server.ts with LabelNode + schema.
// Client integration (toolbar, slash menu, plugin) requires:
//   - LabelPlugin component
//   - LabelIcon component
//   - createClientFeature() wiring
// When implementing, import from '@revealui/core/richtext/client' and wire
// LabelNode, LabelPlugin, LabelIcon into toolbarFixed + slashMenu.

export const LabelFeatureClient: {
  path: string;
  clientProps: Record<string, unknown>;
  exportName: string;
  serverProps: Record<string, unknown>;
} = {
  path: 'label-feature-client',
  clientProps: {},
  exportName: '',
  serverProps: {},
};
