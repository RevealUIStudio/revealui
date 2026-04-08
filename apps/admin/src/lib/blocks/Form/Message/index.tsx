import type { RichTextContent } from '@/lib/blocks/Form/Component';
import { Width } from '@/lib/blocks/Form/Width';
import RichText from '@/lib/components/RichText/index';

export const Message = ({ message }: { message?: RichTextContent | null }) => {
  if (!message) {
    return null;
  }

  return (
    <Width className="my-12" width="100">
      <RichText content={message} />
    </Width>
  );
};
