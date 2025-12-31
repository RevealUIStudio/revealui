"use server";

import React from "react";
import { LabelNodeData } from "../nodes/LabelNode";
import LabelIcon from "../icons/LabelIcon";

interface LabelNodeComponentProps {
  nodeKey: string;
  data: LabelNodeData;
}

const LabelNodeComponent: React.FC<LabelNodeComponentProps> = ({
  nodeKey,
  data,
}) => {
  return (
    <div key={nodeKey}>
      <a href={data.url}>Label</a>
      <LabelIcon />
    </div>
  );
};

export default LabelNodeComponent;
