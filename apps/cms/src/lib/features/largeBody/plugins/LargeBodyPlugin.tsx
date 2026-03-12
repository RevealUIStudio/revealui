import type { LexicalEditor } from 'lexical';
import { useEffect } from 'react';

type BreakOutElement = {
  type?: string;
};

type BaseEditor = LexicalEditor & {
  shouldBreakOutOnEnter?: (element: BreakOutElement) => boolean;
};

interface LargeBodyPluginProps {
  editor: BaseEditor;
}

const LargeBodyPlugin = ({ editor }: LargeBodyPluginProps) => {
  useEffect(() => {
    const originalShouldBreakOutOnEnter = editor.shouldBreakOutOnEnter;

    editor.shouldBreakOutOnEnter = (element: BreakOutElement) =>
      element.type === 'large-body'
        ? true
        : originalShouldBreakOutOnEnter
          ? originalShouldBreakOutOnEnter(element)
          : false;

    // Cleanup function to revert to the original function
    return () => {
      editor.shouldBreakOutOnEnter = originalShouldBreakOutOnEnter;
    };
  }, [editor]);

  return null; // This component doesn't render anything, it just modifies the editor behavior
};

export default LargeBodyPlugin;
