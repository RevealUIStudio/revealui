import { cn } from '@/lib/styles/classnames';
import { serializeLexical } from './serialize';

// Rich text content type (Lexical format)
export interface RichTextContent {
  root: {
    type: string;
    children: Array<{
      type: string;
      version: number;
      [key: string]: unknown;
    }>;
    direction: ('ltr' | 'rtl') | null;
    format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
    indent: number;
    version: number;
  };
  [key: string]: unknown;
}

type Props = {
  className?: string;
  content: RichTextContent | null | undefined;
  enableGutter?: boolean;
  enableProse?: boolean;
};

// Main RichText component
const RichText = ({ className, content, enableGutter = true, enableProse = true }: Props) => {
  if (!content?.root) {
    return null;
  }

  return (
    <div
      className={cn(
        {
          container: enableGutter,
          'max-w-none': !enableGutter,
          'mx-auto prose dark:prose-invert': enableProse,
        },
        className,
      )}
    >
      {serializeLexical({
        nodes: content.root.children,
      })}
    </div>
  );
};

export default RichText;
