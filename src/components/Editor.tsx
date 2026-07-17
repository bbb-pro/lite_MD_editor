/**
 * Editor — Markdown editing textarea.
 *
 * A controlled textarea with monospace font, Tab key support (inserts two
 * spaces), and auto-focus. The textarea element is exposed to the parent
 * via `textareaRef` so the Toolbar can manipulate selection.
 */

import type { RefObject } from 'react';

export interface EditorProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
}

export default function Editor({ textareaRef, value, onChange }: EditorProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key: insert two spaces instead of moving focus
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const { selectionStart, selectionEnd, value: val } = ta;
      const newVal =
        val.substring(0, selectionStart) + '  ' + val.substring(selectionEnd);
      onChange(newVal);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const pos = selectionStart + 2;
          textareaRef.current.setSelectionRange(pos, pos);
        }
      });
      return;
    }

    // Ctrl+B / Ctrl+I — inline formatting shortcuts
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      const ta = e.currentTarget;
      const { selectionStart, selectionEnd, value: val } = ta;
      const selected = val.substring(selectionStart, selectionEnd);
      const before = '**';
      const after = '**';
      const newVal =
        val.substring(0, selectionStart) +
        before +
        selected +
        after +
        val.substring(selectionEnd);
      onChange(newVal);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          if (selected.length > 0) {
            textareaRef.current.setSelectionRange(
              selectionStart + before.length,
              selectionEnd + before.length
            );
          } else {
            const pos = selectionStart + before.length;
            textareaRef.current.setSelectionRange(pos, pos);
          }
        }
      });
      return;
    }

    if (isMod && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault();
      const ta = e.currentTarget;
      const { selectionStart, selectionEnd, value: val } = ta;
      const selected = val.substring(selectionStart, selectionEnd);
      const before = '*';
      const after = '*';
      const newVal =
        val.substring(0, selectionStart) +
        before +
        selected +
        after +
        val.substring(selectionEnd);
      onChange(newVal);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          if (selected.length > 0) {
            textareaRef.current.setSelectionRange(
              selectionStart + before.length,
              selectionEnd + before.length
            );
          } else {
            const pos = selectionStart + before.length;
            textareaRef.current.setSelectionRange(pos, pos);
          }
        }
      });
      return;
    }

    // Enter key: auto-continue list items
    if (e.key === 'Enter' && !e.shiftKey) {
      const ta = e.currentTarget;
      const { selectionStart, value: val } = ta;
      const lineStart = val.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = val.substring(lineStart, selectionStart);

      // Unordered list: "- " or "* "
      const ulMatch = currentLine.match(/^(\s*)([-*])\s+/);
      if (ulMatch) {
        // If the list item is empty, remove the bullet (exit list)
        if (currentLine.trim() === '-' || currentLine.trim() === '*') {
          e.preventDefault();
          const newVal =
            val.substring(0, lineStart) + '\n' + val.substring(selectionStart);
          onChange(newVal);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              textareaRef.current.setSelectionRange(lineStart, lineStart);
            }
          });
          return;
        }
        e.preventDefault();
        const indent = ulMatch[1];
        const bullet = ulMatch[2];
        const insertion = `\n${indent}${bullet} `;
        const newVal =
          val.substring(0, selectionStart) +
          insertion +
          val.substring(selectionStart);
        onChange(newVal);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const pos = selectionStart + insertion.length;
            textareaRef.current.setSelectionRange(pos, pos);
          }
        });
        return;
      }

      // Ordered list: "1. "
      const olMatch = currentLine.match(/^(\s*)(\d+)\.\s+/);
      if (olMatch) {
        // If the list item is empty, remove the bullet
        if (/^\s*\d+\.\s*$/.test(currentLine)) {
          e.preventDefault();
          const newVal =
            val.substring(0, lineStart) + '\n' + val.substring(selectionStart);
          onChange(newVal);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              textareaRef.current.setSelectionRange(lineStart, lineStart);
            }
          });
          return;
        }
        e.preventDefault();
        const indent = olMatch[1];
        const nextNum = parseInt(olMatch[2], 10) + 1;
        const insertion = `\n${indent}${nextNum}. `;
        const newVal =
          val.substring(0, selectionStart) +
          insertion +
          val.substring(selectionStart);
        onChange(newVal);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const pos = selectionStart + insertion.length;
            textareaRef.current.setSelectionRange(pos, pos);
          }
        });
        return;
      }

      // Task list: "- [ ] " or "- [x] "
      const taskMatch = currentLine.match(/^(\s*)([-*])\s\[[ xX]\]\s+/);
      if (taskMatch) {
        if (/^\s*[-*]\s\[[ xX]\]\s*$/.test(currentLine)) {
          e.preventDefault();
          const newVal =
            val.substring(0, lineStart) + '\n' + val.substring(selectionStart);
          onChange(newVal);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              textareaRef.current.setSelectionRange(lineStart, lineStart);
            }
          });
          return;
        }
        e.preventDefault();
        const indent = taskMatch[1];
        const bullet = taskMatch[2];
        const insertion = `\n${indent}${bullet} [ ] `;
        const newVal =
          val.substring(0, selectionStart) +
          insertion +
          val.substring(selectionStart);
        onChange(newVal);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const pos = selectionStart + insertion.length;
            textareaRef.current.setSelectionRange(pos, pos);
          }
        });
        return;
      }
    }
  };

  return (
    <div className="h-full overflow-hidden bg-white">
      <textarea
        ref={textareaRef}
        className="editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="在此输入 Markdown 内容..."
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}
