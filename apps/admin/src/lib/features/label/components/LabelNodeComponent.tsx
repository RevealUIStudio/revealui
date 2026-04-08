'use server';

import LabelIcon from '../icons/LabelIcon';
import type { LabelNodeData } from '../nodes/LabelNode';

interface LabelNodeComponentProps {
  nodeKey: string;
  data: LabelNodeData;
}

const LabelNodeComponent = ({ nodeKey, data }: LabelNodeComponentProps) => {
  return (
    <div key={nodeKey}>
      <a href={data.url}>Label</a>
      <LabelIcon />
    </div>
  );
};

export default LabelNodeComponent;
