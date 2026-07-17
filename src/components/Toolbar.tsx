/**
 * Toolbar — Word-style formatting toolbar.
 *
 * Each button applies a Markdown formatting operation to the textarea
 * referenced by `textareaRef`. After applying, focus is returned to the
 * textarea and the selection is restored.
 */

import type { RefObject } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Link,
  Image,
  Code2,
  Table,
  Minus,
} from 'lucide-react';
import {
  wrapSelection,
  toggleLinePrefix,
  toggleOrderedList,
  insertHeading,
  insertAtCursor,
  insertLink,
  insertImage,
  insertCodeBlock,
  insertTable,
  type TextModification,
} from '../utils/markdown';

export interface ToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  onContentChange: (content: string) => void;
}

/** Create a function that applies a text modifier to the textarea and dispatches the new content. */
function makeApplyFormat(
  textareaRef: RefObject<HTMLTextAreaElement>,
  onContentChange: (content: string) => void
) {
  return (modifier: (ta: HTMLTextAreaElement) => TextModification) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const result = modifier(ta);
    onContentChange(result.content);
    // Defer selection update to after React re-renders the textarea value
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          result.selectionStart,
          result.selectionEnd
        );
      }
    });
  };
}

/** A single toolbar button with icon + tooltip. */
function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-8 h-8 rounded-md text-gray-600 hover:bg-gray-200 hover:text-gray-900 active:bg-gray-300 transition-colors"
    >
      {children}
    </button>
  );
}

/** A vertical divider between toolbar button groups. */
function Divider() {
  return <div className="w-px h-6 bg-gray-200 mx-1" />;
}

export default function Toolbar({ textareaRef, onContentChange }: ToolbarProps) {
  const apply = makeApplyFormat(textareaRef, onContentChange);

  return (
    <div className="flex items-center flex-wrap gap-0.5 px-3 py-1.5 bg-gray-50 border-b border-gray-200 select-none">
      {/* Headings */}
      <ToolbarButton onClick={() => apply((ta) => insertHeading(ta, 1))} title="标题 1">
        <Heading1 size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => apply((ta) => insertHeading(ta, 2))} title="标题 2">
        <Heading2 size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => apply((ta) => insertHeading(ta, 3))} title="标题 3">
        <Heading3 size={18} />
      </ToolbarButton>

      <Divider />

      {/* Inline formatting */}
      <ToolbarButton onClick={() => apply((ta) => wrapSelection(ta, '**', '**'))} title="加粗 (Ctrl+B)">
        <Bold size={17} />
      </ToolbarButton>
      <ToolbarButton onClick={() => apply((ta) => wrapSelection(ta, '*', '*'))} title="斜体 (Ctrl+I)">
        <Italic size={17} />
      </ToolbarButton>
      <ToolbarButton onClick={() => apply((ta) => wrapSelection(ta, '~~', '~~'))} title="删除线">
        <Strikethrough size={17} />
      </ToolbarButton>
      <ToolbarButton onClick={() => apply((ta) => wrapSelection(ta, '`', '`'))} title="行内代码">
        <Code size={17} />
      </ToolbarButton>

      <Divider />

      {/* Block elements */}
      <ToolbarButton onClick={() => apply((ta) => toggleLinePrefix(ta, '- '))} title="无序列表">
        <List size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => apply((ta) => toggleOrderedList(ta))} title="有序列表">
        <ListOrdered size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => apply((ta) => toggleLinePrefix(ta, '- [ ] '))} title="任务列表">
        <ListChecks size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => apply((ta) => toggleLinePrefix(ta, '> '))} title="引用">
        <Quote size={18} />
      </ToolbarButton>

      <Divider />

      {/* Insert elements */}
      <ToolbarButton onClick={() => apply((ta) => insertLink(ta))} title="链接">
        <Link size={17} />
      </ToolbarButton>
      <ToolbarButton onClick={() => apply((ta) => insertImage(ta))} title="图片">
        <Image size={17} />
      </ToolbarButton>
      <ToolbarButton onClick={() => apply((ta) => insertCodeBlock(ta))} title="代码块">
        <Code2 size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => apply((ta) => insertTable(ta))} title="表格">
        <Table size={17} />
      </ToolbarButton>
      <ToolbarButton onClick={() => apply((ta) => insertAtCursor(ta, '\n---\n'))} title="分隔线">
        <Minus size={18} />
      </ToolbarButton>
    </div>
  );
}
