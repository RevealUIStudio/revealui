'use client';

import Markdown from 'react-markdown';

interface WhitepaperRendererProps {
  content: string;
}

export function WhitepaperRenderer({ content }: WhitepaperRendererProps) {
  return (
    <article className="prose prose-gray max-w-none prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-2xl prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2 prose-a:text-violet-600 prose-code:text-sm prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-table:text-sm prose-th:text-left prose-pre:bg-gray-950 prose-pre:text-gray-100">
      <Markdown>{content}</Markdown>
    </article>
  );
}
