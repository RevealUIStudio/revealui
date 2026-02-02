import type React from 'react'
import RichText from '@/lib/components/RichText/index'
import type { RichTextContent } from '@/lib/blocks/Form/Component'
import { Width } from '@/lib/blocks/Form/Width'

export const Message: React.FC<{
  message?: RichTextContent | null
}> = ({ message }) => {
  if (!message) {
    return null
  }

  return (
    <Width className="my-12" width="100">
      <RichText content={message} />
    </Width>
  )
}
