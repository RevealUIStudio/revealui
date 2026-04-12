'use server';

import LabelIcon from '../icons/LabelIcon';
import type { LabelNodeData } from '../nodes/LabelNode';

interface LabelNodeComponentProps {
  nodeKey: string;
  data: LabelNodeData;
}

function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, 'https://placeholder.test');
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
    // Return the fully parsed and re-serialized URL to prevent XSS
    return parsed.href;
  } catch {
    return undefined;
  }
}

const LabelNodeComponent = ({ nodeKey, data }: LabelNodeComponentProps) => {
  const safeUrl = sanitizeUrl(data.url);
  return (
    <div key={nodeKey}>
      {safeUrl ? <a href={safeUrl}>Label</a> : <span>Label</span>}
      <LabelIcon />
    </div>
  );
};

export default LabelNodeComponent;
