import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = "" }) => {
  return (
    <div className={`prose-sm max-w-none text-ink-900 leading-7 font-vazirmatn text-right ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base sm:text-lg font-black text-ink-950 mt-3 mb-2 pb-1 border-b border-ink-100">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm sm:text-base font-extrabold text-ink-900 mt-3 mb-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs sm:text-sm font-bold text-brand-700 mt-2.5 mb-1 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2 leading-7 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc pr-5 my-2 space-y-1 text-ink-800 marker:text-brand-500">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pr-5 my-2 space-y-1 text-ink-800 marker:text-brand-600 font-medium">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-6">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-bold text-ink-950 bg-brand-50/70 px-1 py-0.5 rounded text-[13.5px]">
              {children}
            </strong>
          ),
          em: ({ children }) => <em className="italic text-ink-700">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-r-3 border-brand-500 bg-brand-50/40 pr-3 py-1.5 my-2 rounded-l-xl text-ink-700 text-xs sm:text-sm leading-6">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className="bg-ink-100/80 text-brand-700 px-1.5 py-0.5 rounded text-xs font-mono font-medium">
                {children}
              </code>
            ) : (
              <pre className="bg-ink-900 text-ink-100 p-3 rounded-xl text-xs overflow-x-auto my-2 font-mono direction-ltr text-left">
                <code>{children}</code>
              </pre>
            );
          },
          hr: () => <hr className="my-3 border-ink-100" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
