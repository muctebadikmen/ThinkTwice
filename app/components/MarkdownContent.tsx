'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMemo } from 'react';
import { processCitations, Citation } from '@/lib/citation-processor';

interface MarkdownContentProps {
  content: string;
  className?: string;
  enableCitations?: boolean;
}

function CitationFooter({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700/50">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
        Sources
      </p>
      <ol className="space-y-1">
        {citations.map((c) => (
          <li key={c.index} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-baseline gap-1.5">
            <span className="text-blue-400 font-mono text-[10px] shrink-0">[{c.index}]</span>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 truncate"
            >
              {c.domain}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function MarkdownContent({
  content,
  className = '',
  enableCitations = false,
}: MarkdownContentProps) {
  const { processedText, citations } = useMemo(() => {
    if (!enableCitations) return { processedText: content, citations: [] };
    return processCitations(content);
  }, [content, enableCitations]);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-2 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-3 mb-2 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-3 mb-1.5 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-2 mb-1 first:mt-0">{children}</h4>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed mb-3 last:mb-0">{children}</p>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
            >
              {children}
            </a>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-4 mb-3 last:mb-0 space-y-1 text-sm text-zinc-800 dark:text-zinc-200">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-4 mb-3 last:mb-0 space-y-1 text-sm text-zinc-800 dark:text-zinc-200">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),

          // Strong & emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-zinc-700 dark:text-zinc-300">{children}</em>
          ),

          // Code
          code: ({ children, className: codeClassName }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className={codeClassName}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3 mb-3 last:mb-0 overflow-x-auto text-xs">
              {children}
            </pre>
          ),

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3 last:mb-0">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-zinc-200 dark:border-zinc-700">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800">{children}</td>
          ),

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 mb-3 last:mb-0 text-zinc-600 dark:text-zinc-400 italic">
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: () => <hr className="border-zinc-200 dark:border-zinc-700 my-4" />,

          // Footnote-style citation references [^1]
          sup: ({ children }) => {
            const text = String(children);
            const citationMatch = text.match(/\[\^(\d+)\]/);
            if (citationMatch) {
              const idx = parseInt(citationMatch[1], 10);
              const citation = citations.find((c) => c.index === idx);
              if (citation) {
                return (
                  <sup>
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-[10px] font-mono ml-0.5 no-underline hover:underline"
                      title={citation.domain}
                    >
                      [{idx}]
                    </a>
                  </sup>
                );
              }
            }
            return <sup>{children}</sup>;
          },
        }}
      >
        {processedText}
      </ReactMarkdown>

      {enableCitations && <CitationFooter citations={citations} />}
    </div>
  );
}
