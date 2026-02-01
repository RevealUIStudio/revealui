/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useLexicalComposerContext } from '@revealui/core/richtext/client'
import { $getNodeByKey } from 'lexical'
import type React from 'react'
import { useCallback } from 'react'
import { type EmbedNodeData, OPEN_EMBED_DRAWER_COMMAND } from '../nodes/EmbedNode.js'

// Simple button component placeholder
const Button: React.FC<{
  buttonStyle?: string
  className?: string
  el?: string
  icon?: string
  onClick?: (e: React.MouseEvent) => void
  round?: boolean
  tooltip?: string
  children?: React.ReactNode
}> = ({ onClick, tooltip, children, className }) => (
  <button type="button" onClick={onClick} title={tooltip} className={className}>
    {children || tooltip}
  </button>
)

type Props = {
  data: EmbedNodeData
  nodeKey: string
}

export const EmbedNodeComponent: React.FC<Props> = (props) => {
  const { data, nodeKey } = props
  const [editor] = useLexicalComposerContext()
  const videoSrc = `https://www.youtube.com/embed/${data.url.split('v=')[1]}`

  const removeEmbed = useCallback(() => {
    editor.update(() => {
      const foundNode = $getNodeByKey(nodeKey)
      if (foundNode) {
        foundNode.remove()
      }
    })
  }, [editor, nodeKey])

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
            onClick={(_e: React.MouseEvent) => {
              editor.dispatchCommand(OPEN_EMBED_DRAWER_COMMAND, {
                data,
                nodeKey,
              })
            }}
            round
            tooltip="Swap Embed"
          />
          <Button
            buttonStyle="icon-label"
            className="embed-node__removeButton"
            icon="x"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault()
              removeEmbed()
            }}
            round
            tooltip="Remove Embed"
          />
        </div>
      </div>
      <iframe
        className="w-full h-80"
        src={videoSrc}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      ></iframe>
    </div>
  )
}

// /* eslint-disable @typescript-eslint/no-unused-vars */
// import React, { useCallback } from "react";
// // TODO: Implement local UI components
// TODO: Implement local alternative
// import // @revealui/core";
// import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
// import { $getNodeByKey } from "lexical";
// import { EmbedNodeData, OPEN_EMBED_DRAWER_COMMAND } from "../nodes/EmbedNode.js";

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
