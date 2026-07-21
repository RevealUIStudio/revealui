import { useLexicalComposerContext } from '@revealui/core/richtext/client';
import { Button } from '@revealui/presentation';
import { sanitizeUrl } from '@revealui/security/sanitize';
import { $getNodeByKey } from 'lexical';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { type EmbedNodeData, OPEN_EMBED_DRAWER_COMMAND } from '../nodes/EmbedNode';

type EmbedSource = { type: 'youtube'; embedUrl: string } | { type: 'generic'; url: string };

function parseEmbedSource(url: string): EmbedSource {
  try {
    const parsed = new URL(url);

    // YouTube: youtube.com/watch?v=ID or youtu.be/ID
    if (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') {
      const videoId = parsed.searchParams.get('v');
      if (videoId) {
        return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${videoId}` };
      }
    }
    if (parsed.hostname === 'youtu.be') {
      const videoId = parsed.pathname.slice(1);
      if (videoId) {
        return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${videoId}` };
      }
    }
  } catch {
    // Not a valid URL  -  fall through to generic
  }

  return { type: 'generic', url };
}

type Props = {
  data: EmbedNodeData;
  nodeKey: string;
};

export const EmbedNodeComponent = (props: Props) => {
  const { data, nodeKey } = props;
  const [editor] = useLexicalComposerContext();
  const source = useMemo(() => parseEmbedSource(data.url), [data.url]);

  const removeEmbed = useCallback(() => {
    editor.update(() => {
      const foundNode = $getNodeByKey(nodeKey);
      if (foundNode) {
        foundNode.remove();
      }
    });
  }, [editor, nodeKey]);

  // Route both URL sinks through the shared sanitizer (the same chokepoint
  // CMSLink uses on the render path). A generic embed URL is author-controlled
  // and `new URL()` accepts `javascript:`/`data:` schemes, so an unsanitized
  // href here is the same XSS vector as the render path — neutralized to '#'.
  const safeHref =
    source.type === 'youtube'
      ? sanitizeUrl(source.embedUrl, 'link')
      : sanitizeUrl(source.url, 'link');

  return (
    <div className="embed-node shadow-sm p-3 pt-2 bg-gray-100 border border-gray-200 font-body mb-6 w-[560px]">
      <div className="embed-node__controls relative flex justify-between pb-1">
        <p className="embed-node__urlDisplay m-0 text-base truncate">{data.url}</p>
        <div className="embed-node__buttons flex flex-row gap-1">
          <Button
            type="button"
            appearance="ghost"
            variant="neutral"
            size="sm"
            className="embed-node__swapButton h-auto rounded px-2 py-1 text-sm hover:bg-gray-200"
            onClick={() => {
              editor.dispatchCommand(OPEN_EMBED_DRAWER_COMMAND, {
                data,
                nodeKey,
              });
            }}
            title="Swap Embed"
          >
            Swap
          </Button>
          <Button
            type="button"
            appearance="ghost"
            variant="neutral"
            size="sm"
            className="embed-node__removeButton h-auto rounded px-2 py-1 text-sm hover:bg-gray-200"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              removeEmbed();
            }}
            title="Remove Embed"
          >
            Remove
          </Button>
        </div>
      </div>
      {source.type === 'youtube' ? (
        <iframe
          className="w-full h-80"
          src={safeHref}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-4 bg-white rounded border border-gray-300 text-blue-600 hover:underline break-all"
        >
          {source.url}
        </a>
      )}
    </div>
  );
};
