/**
 * Preview — renders Markdown content with GFM support.
 *
 * Uses CSS-styled code blocks instead of react-syntax-highlighter to keep
 * the bundle lightweight and avoid build OOM issues.
 */

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface PreviewProps {
  content: string;
}

function PreviewInner({ content }: PreviewProps) {
  return (
    <div className="h-full overflow-auto bg-white">
      <div className="markdown-preview max-w-3xl mx-auto px-8 py-6">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Code blocks: dark themed <pre> with language label
            code: ({ className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || '');
              const text = String(children);
              const isBlock = !!match || text.includes('\n');

              if (isBlock) {
                const lang = match ? match[1] : 'text';
                return (
                  <pre className="md-code-block" data-lang={lang}>
                    {match && (
                      <span className="md-code-lang">{lang}</span>
                    )}
                    <code className={className} {...props}>
                      {text.replace(/\n$/, '')}
                    </code>
                  </pre>
                );
              }

              return (
                <code className="md-code-inline" {...props}>
                  {children}
                </code>
              );
            },
            // Open links in a new tab
            a: ({ children, href, ...props }: any) => (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            ),
            // Task list checkboxes
            input: ({ type, ...props }: any) => {
              if (type === 'checkbox') {
                return <input type="checkbox" {...props} />;
              }
              return <input type={type} {...props} />;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

const Preview = memo(PreviewInner);
export default Preview;
