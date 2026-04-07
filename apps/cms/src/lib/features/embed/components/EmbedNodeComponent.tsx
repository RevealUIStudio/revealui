import { useLexicalComposerContext } from '@revealui/core/richtext/client';
import { $getNodeByKey } from 'lexical';
import type React from 'react';
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
    // Not a valid URL — fall through to generic
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
  const source = parseEmbedSource(data.url);

  const removeEmbed = () => {
    editor.update(() => {
      const foundNode = $getNodeByKey(nodeKey);
      if (foundNode) {
        foundNode.remove();
      }
    });
  };

  return (
    <div className="embed-node shadow-sm p-3 pt-2 bg-gray-100 border border-gray-200 font-body mb-6 w-[560px]">
      <div className="embed-node__controls relative flex justify-between pb-1">
        <p className="embed-node__urlDisplay m-0 text-base truncate">{data.url}</p>
        <div className="embed-node__buttons flex flex-row gap-1">
          <button
            type="button"
            className="embed-node__swapButton px-2 py-1 text-sm rounded hover:bg-gray-200"
            onClick={() => {
              editor.dispatchCommand(OPEN_EMBED_DRAWER_COMMAND, {
                data,
                nodeKey,
              });
            }}
            title="Swap Embed"
          >
            Swap
          </button>
          <button
            type="button"
            className="embed-node__removeButton px-2 py-1 text-sm rounded hover:bg-gray-200"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              removeEmbed();
            }}
            title="Remove Embed"
          >
            Remove
          </button>
        </div>
      </div>
      {source.type === 'youtube' ? (
        <iframe
          className="w-full h-80"
          src={source.embedUrl}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <a
          href={source.url}
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
