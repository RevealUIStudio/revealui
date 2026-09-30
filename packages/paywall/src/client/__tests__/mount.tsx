import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { expect, vi } from 'vitest';

interface ReactActGlobal {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
}

(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  host: HTMLDivElement;
  rerender: (node: ReactElement) => Promise<void>;
  unmount: () => Promise<void>;
}

export async function mount(node: ReactElement): Promise<Mounted> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  return {
    host,
    async rerender(next: ReactElement) {
      await act(async () => {
        root.render(next);
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

export async function waitForText(host: ParentNode, text: string): Promise<void> {
  await vi.waitFor(() => {
    expect(host.textContent ?? '').toContain(text);
  });
}
