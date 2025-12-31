/* eslint-disable @typescript-eslint/no-unused-vars */
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Button } from "@payloadcms/ui";
import { $getNodeByKey } from "lexical";
import React, { useCallback } from "react";
import { EmbedNodeData, OPEN_EMBED_DRAWER_COMMAND } from "../nodes/EmbedNode";

type Props = {
  data: EmbedNodeData;
  nodeKey: string;
};

export const EmbedNodeComponent: React.FC<Props> = (props) => {
  const { data, nodeKey } = props;
  const [editor] = useLexicalComposerContext();
  const videoSrc = `https://www.youtube.com/embed/${data.url.split("v=")[1]}`;

  const removeEmbed = useCallback(() => {
    editor.update(() => {
      const foundNode = $getNodeByKey(nodeKey);
      if (foundNode) {
        foundNode.remove();
      }
    });
  }, [editor, nodeKey]);

  return (
    <div className="embed-node shadow-sm p-3 pt-2 bg-gray-100 border border-gray-200 font-body mb-6 w-[560px]">
      <div className="embed-node__controls relative flex justify-between pb-1">
        <p className="embed-node__urlDisplay m-0 text-base">{data.url}</p>
        <div className="embed-node__buttons flex flex-row">
          <Button
            buttonStyle="icon-label"
            className="embed-node__swapButton"
            el="div"
            icon="swap"
            onClick={(e: React.MouseEvent) => {
              editor.dispatchCommand(OPEN_EMBED_DRAWER_COMMAND, {
                data,
                nodeKey,
              });
            }}
            round
            tooltip={"Swap Embed"}
          />
          <Button
            buttonStyle="icon-label"
            className="embed-node__removeButton"
            icon="x"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              removeEmbed();
            }}
            round
            tooltip="Remove Embed"
          />
        </div>
      </div>
      <iframe
        className="w-full h-80" // This sets the width to 100% and height to 315px (20rem)
        src={videoSrc}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      ></iframe>
    </div>
  );
};

// /* eslint-disable @typescript-eslint/no-unused-vars */
// import React, { useCallback } from "react";
// import { Button } from "@payloadcms/ui";
// import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext.js";
// import { $getNodeByKey } from "lexical";
// import { EmbedNodeData, OPEN_EMBED_DRAWER_COMMAND } from "../nodes/EmbedNode";

// type Props = {
//   data: EmbedNodeData;
//   nodeKey: string;
// };

// const baseClass = "embed-node";

// export const EmbedNodeComponent: React.FC<Props> = (props) => {
//   const { data, nodeKey } = props;
//   const [editor] = useLexicalComposerContext();
//   const videoSrc = `https://www.youtube.com/embed/${data.url.split("v=")[1]}`;

//   const removeEmbed = useCallback(() => {
//     editor.update(() => {
//       const foundNode = $getNodeByKey(nodeKey);
//       if (foundNode) {
//         foundNode.remove();
//       }
//     });
//   }, [editor, nodeKey]);

//   return (
//     <div className={baseClass}>
//       <div className={`${baseClass}__controls`}>
//         <p className={`${baseClass}__urlDisplay`}>{data.url}</p>
//         <div className={`${baseClass}__buttons`}>
//           <Button
//             buttonStyle="icon-label"
//             className={`${baseClass}__swapButton`}
//             el="div"
//             icon="swap"
//             onClick={(e) => {
//               editor.dispatchCommand(OPEN_EMBED_DRAWER_COMMAND, {
//                 data,
//                 nodeKey,
//               });
//             }}
//             round
//             tooltip={"Swap Embed"}
//           />
//           <Button
//             buttonStyle="icon-label"
//             className={`${baseClass}__removeButton`}
//             icon="x"
//             onClick={(e) => {
//               e.preventDefault();
//               removeEmbed();
//             }}
//             round
//             tooltip="Remove Embed"
//           />
//         </div>
//       </div>
//       <iframe
//         width="560"
//         height="315"
//         src={videoSrc}
//         title="YouTube video player"
//         frameBorder="0"
//         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
//         referrerPolicy="strict-origin-when-cross-origin"
//         allowFullScreen
//       ></iframe>
//     </div>
//   );
// };
