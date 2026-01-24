'use server'

import type React from 'react'
import LabelIcon from '../icons/LabelIcon'
import type { LabelNodeData } from '../nodes/LabelNode'

interface LabelNodeComponentProps {
  nodeKey: string
  data: LabelNodeData
}

const LabelNodeComponent: React.FC<LabelNodeComponentProps> = ({ nodeKey, data }) => {
  return (
    <div key={nodeKey}>
      <a href={data.url}>Label</a>
      <LabelIcon />
    </div>
  )
}

export default LabelNodeComponent
