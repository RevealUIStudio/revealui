'use client';
import { Highlight, themes } from 'prism-react-renderer';

type Props = {
  code: string;
  language?: string;
};

export const Code = ({ code, language = '' }: Props) => {
  if (!code) return null;

  return (
    <Highlight code={code} language={language} theme={themes.vsDark}>
      {({ getLineProps, getTokenProps, tokens }) => {
        let lineOffset = 0;

        return (
          <pre className="bg-black p-4 border text-xs border-border rounded overflow-x-auto">
            {tokens.map((line, i) => {
              const lineText = line.map((token) => token.content).join('');
              const lineLength = lineText.length || 1;
              const lineKey = `${lineOffset}-${lineText}`;
              lineOffset += lineLength + 1;

              let tokenOffset = 0;

              return (
                <div key={lineKey} {...getLineProps({ className: 'table-row', line })}>
                  <span className="table-cell select-none text-right text-white/25">{i + 1}</span>
                  <span className="table-cell pl-4">
                    {line.map((token) => {
                      const tokenLength = token.content.length || 1;
                      const tokenKey = `${tokenOffset}-${token.types.join('.')}-${token.content}`;
                      tokenOffset += tokenLength;

                      return <span key={tokenKey} {...getTokenProps({ token })} />;
                    })}
                  </span>
                </div>
              );
            })}
          </pre>
        );
      }}
    </Highlight>
  );
};
