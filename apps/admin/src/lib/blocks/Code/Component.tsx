import { Code } from './Component.client';

export type CodeBlockProps = {
  code: string;
  language?: string;
  blockType: 'code';
  className?: string;
};

export const CodeBlock = ({ className, code, language }: CodeBlockProps) => {
  return (
    <div className={[className, 'not-prose'].filter(Boolean).join(' ')}>
      <Code code={code} language={language} />
    </div>
  );
};
