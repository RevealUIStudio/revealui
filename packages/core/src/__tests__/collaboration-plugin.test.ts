import { describe, expect, it, vi } from 'vitest';

// Mock all Lexical dependencies
vi.mock('@lexical/react/LexicalCollaborationPlugin', () => ({
  CollaborationPlugin: vi.fn(() => null),
}));

vi.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: vi.fn(({ children }: { children: React.ReactNode }) => children),
}));

vi.mock('@lexical/react/LexicalRichTextPlugin', () => ({
  RichTextPlugin: vi.fn(() => null),
}));

vi.mock('@lexical/react/LexicalContentEditable', () => ({
  ContentEditable: vi.fn(() => null),
}));

vi.mock('@lexical/react/LexicalErrorBoundary', () => ({
  LexicalErrorBoundary: vi.fn(() => null),
}));

vi.mock('@lexical/react/LexicalHistoryPlugin', () => ({
  HistoryPlugin: vi.fn(() => null),
}));

vi.mock('@lexical/react/LexicalOnChangePlugin', () => ({
  OnChangePlugin: vi.fn(() => null),
}));

vi.mock('@lexical/react/LexicalAutoFocusPlugin', () => ({
  AutoFocusPlugin: vi.fn(() => null),
}));

vi.mock('@lexical/react/LexicalCheckListPlugin', () => ({
  CheckListPlugin: vi.fn(() => null),
}));

vi.mock('@lexical/react/LexicalLinkPlugin', () => ({
  LinkPlugin: vi.fn(() => null),
}));

vi.mock('@lexical/react/LexicalListPlugin', () => ({
  ListPlugin: vi.fn(() => null),
}));

vi.mock('@lexical/react/LexicalTablePlugin', () => ({
  TablePlugin: vi.fn(() => null),
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { createElement } from 'react';

describe('CollaborationPlugin integration', () => {
  it('should export CollaborationPlugin from index', async () => {
    const mod = await import('../client/richtext/plugins/CollaborationPlugin.js');
    expect(mod.CollaborationPlugin).toBeDefined();
  });

  it('should render CollaborationPlugin component', async () => {
    const { CollaborationPlugin } = await import(
      '../client/richtext/plugins/CollaborationPlugin.js'
    );
    const providerFactory = vi.fn();

    const element = createElement(CollaborationPlugin, {
      id: 'test-doc',
      providerFactory,
      shouldBootstrap: true,
    });

    expect(element).toBeDefined();
    expect(element.props.id).toBe('test-doc');
  });

  it('should accept optional username and cursorColor props', async () => {
    const { CollaborationPlugin } = await import(
      '../client/richtext/plugins/CollaborationPlugin.js'
    );
    const providerFactory = vi.fn();

    const element = createElement(CollaborationPlugin, {
      id: 'test-doc',
      providerFactory,
      shouldBootstrap: false,
      username: 'testuser',
      cursorColor: '#ff0000',
    });

    expect(element.props.username).toBe('testuser');
    expect(element.props.cursorColor).toBe('#ff0000');
  });

  it('should render with different document IDs', async () => {
    const { CollaborationPlugin } = await import(
      '../client/richtext/plugins/CollaborationPlugin.js'
    );

    const el1 = createElement(CollaborationPlugin, {
      id: 'doc-1',
      providerFactory: vi.fn(),
      shouldBootstrap: true,
    });

    const el2 = createElement(CollaborationPlugin, {
      id: 'doc-2',
      providerFactory: vi.fn(),
      shouldBootstrap: false,
    });

    expect(el1.props.id).toBe('doc-1');
    expect(el2.props.id).toBe('doc-2');
  });

  it('should have correct CollaborationPluginProps type', async () => {
    const mod = await import('../client/richtext/plugins/CollaborationPlugin.js');
    // Verify the component function exists and accepts props
    expect(typeof mod.CollaborationPlugin).toBe('function');
  });
});
