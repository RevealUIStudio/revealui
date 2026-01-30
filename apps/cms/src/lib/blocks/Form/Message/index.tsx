import type React from 'react'
import RichText from '../../../components/RichText/index'
import type { RichTextContent } from '../Component'
import { Width } from '../Width/index'

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
