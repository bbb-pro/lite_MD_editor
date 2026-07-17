/**
 * Preview — renders Markdown content with GFM support and syntax highlighting.
 */

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// @ts-ignore — style file has no bundled type definitions
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
            // Render <pre> as a fragment so SyntaxHighlighter's own wrapper
            // becomes the block-level container (avoids nested <pre>).
            pre: ({ children }) => <>{children}</>,
            code: ({ className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || '');
              const text = String(children);
              const isBlock = !!match || text.includes('\n');

              if (isBlock) {
                return (
                  <SyntaxHighlighter
                    language={match ? match[1] : 'text'}
                    style={oneDark}
                    PreTag="div"
                    customStyle={{
                      margin: '0.5rem 0',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      padding: '1rem',
                    }}
                    {...props}
                  >
                    {text.replace(/\n$/, '')}
                  </SyntaxHighlighter>
                );
              }

              return (
                <code className={className} {...props}>
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
            // Strip the disabled attribute from task list checkboxes so they
            // are at least visually interactive (read-only though — we don't
            // sync clicks back to the editor).
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
