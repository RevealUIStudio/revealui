'use server';

import LabelIcon from '../icons/LabelIcon';
import type { LabelNodeData } from '../nodes/LabelNode';

interface LabelNodeComponentProps {
  nodeKey: string;
  data: LabelNodeData;
}

function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, 'https://placeholder.test');
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const LabelNodeComponent = ({ nodeKey, data }: LabelNodeComponentProps) => {
  const safeUrl = isValidUrl(data.url) ? data.url : undefined;
  return (
    <div key={nodeKey}>
      {safeUrl ? <a href={safeUrl}>Label</a> : <span>Label</span>}
      <LabelIcon />
    </div>
  );
};

export default LabelNodeComponent;
