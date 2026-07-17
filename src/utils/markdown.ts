/**
 * Markdown utility functions for text manipulation and statistics.
 *
 * All text-modification helpers accept an HTMLTextAreaElement and return a
 * TextModification describing the new content and the desired selection range
 * after the edit is applied.
 */

import type { EditorStats } from '../types';

/** Describes the result of a text modification operation. */
export interface TextModification {
  /** The full new text content after modification. */
  content: string;
  /** Where the selection should start after the modification. */
  selectionStart: number;
  /** Where the selection should end after the modification. */
  selectionEnd: number;
}

/**
 * Wrap the currently selected text with `before` and `after` strings.
 * If nothing is selected, the cursor is placed between the wrappers.
 */
export function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string
): TextModification {
  const { selectionStart, selectionEnd, value } = textarea;
  const selectedText = value.substring(selectionStart, selectionEnd);
  const newText = before + selectedText + after;
  const newContent =
    value.substring(0, selectionStart) + newText + value.substring(selectionEnd);

  let newStart: number;
  let newEnd: number;
  if (selectedText.length > 0) {
    newStart = selectionStart + before.length;
    newEnd = selectionEnd + before.length;
  } else {
    newStart = newEnd = selectionStart + before.length;
  }

  return { content: newContent, selectionStart: newStart, selectionEnd: newEnd };
}

/**
 * Toggle a line-prefix on every line that intersects the current selection.
 * If all selected lines already start with `prefix`, the prefix is removed.
 * Otherwise, `prefix` is added to each line.
 */
export function toggleLinePrefix(
  textarea: HTMLTextAreaElement,
  prefix: string
): TextModification {
  const { selectionStart, selectionEnd, value } = textarea;

  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  let lineEnd = value.indexOf('\n', selectionEnd);
  if (lineEnd === -1) lineEnd = value.length;

  const selectedBlock = value.substring(lineStart, lineEnd);
  const lines = selectedBlock.split('\n');

  const allHavePrefix = lines.every((line) => line.startsWith(prefix));

  const newLines = lines.map((line) => {
    if (allHavePrefix) {
      return line.substring(prefix.length);
    }
    return prefix + line;
  });

  const newText = newLines.join('\n');
  const newContent =
    value.substring(0, lineStart) + newText + value.substring(lineEnd);

  return {
    content: newContent,
    selectionStart: lineStart,
    selectionEnd: lineStart + newText.length,
  };
}

/**
 * Toggle an ordered-list prefix ("1. ") on every selected line.
 * If lines already have a numbered prefix, it is removed.
 */
export function toggleOrderedList(
  textarea: HTMLTextAreaElement
): TextModification {
  const { selectionStart, selectionEnd, value } = textarea;

  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  let lineEnd = value.indexOf('\n', selectionEnd);
  if (lineEnd === -1) lineEnd = value.length;

  const selectedBlock = value.substring(lineStart, lineEnd);
  const lines = selectedBlock.split('\n');

  const allHavePrefix = lines.every((line) => /^\d+\.\s/.test(line));

  const newLines = lines.map((line, index) => {
    if (allHavePrefix) {
      return line.replace(/^\d+\.\s/, '');
    }
    return `${index + 1}. ${line}`;
  });

  const newText = newLines.join('\n');
  const newContent =
    value.substring(0, lineStart) + newText + value.substring(lineEnd);

  return {
    content: newContent,
    selectionStart: lineStart,
    selectionEnd: lineStart + newText.length,
  };
}

/**
 * Insert or toggle a heading at the current line.
 *
 * - If the line already has the same heading level, the heading is removed.
 * - If the line has a different heading level, it is replaced.
 * - Otherwise, the heading prefix is added.
 */
export function insertHeading(
  textarea: HTMLTextAreaElement,
  level: number
): TextModification {
  const { selectionStart, value } = textarea;

  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  let lineEnd = value.indexOf('\n', selectionStart);
  if (lineEnd === -1) lineEnd = value.length;

  const currentLine = value.substring(lineStart, lineEnd);
  const prefix = '#'.repeat(level) + ' ';

  const headingMatch = currentLine.match(/^#{1,6}\s+/);
  let newLine: string;

  if (headingMatch && headingMatch[0] === prefix) {
    // Same level — remove heading
    newLine = currentLine.substring(prefix.length);
  } else if (headingMatch) {
    // Different level — replace
    newLine = prefix + currentLine.substring(headingMatch[0].length);
  } else {
    // No heading — add
    newLine = prefix + currentLine;
  }

  const newContent =
    value.substring(0, lineStart) + newLine + value.substring(lineEnd);

  return {
    content: newContent,
    selectionStart: lineStart,
    selectionEnd: lineStart + newLine.length,
  };
}

/**
 * Insert arbitrary text at the cursor position, replacing any selection.
 */
export function insertAtCursor(
  textarea: HTMLTextAreaElement,
  text: string
): TextModification {
  const { selectionStart, selectionEnd, value } = textarea;
  const newContent =
    value.substring(0, selectionStart) + text + value.substring(selectionEnd);
  const newPos = selectionStart + text.length;
  return { content: newContent, selectionStart: newPos, selectionEnd: newPos };
}

/**
 * Insert a Markdown link `[text](url)` at the cursor.
 * If text is selected, it becomes the link text; otherwise a placeholder is used.
 * The URL portion is selected for immediate editing.
 */
export function insertLink(
  textarea: HTMLTextAreaElement
): TextModification {
  const { selectionStart, selectionEnd, value } = textarea;
  const selectedText = value.substring(selectionStart, selectionEnd);
  const linkText = selectedText || '链接文本';
  const url = 'https://';
  const insertion = `[${linkText}](${url})`;
  const newContent =
    value.substring(0, selectionStart) + insertion + value.substring(selectionEnd);

  const urlStart = selectionStart + linkText.length + 3; // +3 for "]("
  const urlEnd = urlStart + url.length;

  return { content: newContent, selectionStart: urlStart, selectionEnd: urlEnd };
}

/**
 * Insert a Markdown image `![alt](url)` at the cursor.
 * If text is selected, it becomes the alt text.
 * The URL portion is selected for immediate editing.
 */
export function insertImage(
  textarea: HTMLTextAreaElement
): TextModification {
  const { selectionStart, selectionEnd, value } = textarea;
  const selectedText = value.substring(selectionStart, selectionEnd);
  const altText = selectedText || '图片描述';
  const url = 'https://';
  const insertion = `![${altText}](${url})`;
  const newContent =
    value.substring(0, selectionStart) + insertion + value.substring(selectionEnd);

  const urlStart = selectionStart + altText.length + 4; // +4 for "]("
  const urlEnd = urlStart + url.length;

  return { content: newContent, selectionStart: urlStart, selectionEnd: urlEnd };
}

/**
 * Wrap the selection in a fenced code block.
 * If nothing is selected, a placeholder is inserted.
 */
export function insertCodeBlock(
  textarea: HTMLTextAreaElement
): TextModification {
  const { selectionStart, selectionEnd, value } = textarea;
  const selectedText = value.substring(selectionStart, selectionEnd);
  const before = '```\n';
  const after = '\n```';
  const inner = selectedText || '';
  const insertion = before + inner + after;
  const newContent =
    value.substring(0, selectionStart) + insertion + value.substring(selectionEnd);

  if (selectedText.length > 0) {
    return {
      content: newContent,
      selectionStart: selectionStart + before.length,
      selectionEnd: selectionEnd + before.length,
    };
  }
  const pos = selectionStart + before.length;
  return { content: newContent, selectionStart: pos, selectionEnd: pos };
}

/**
 * Insert a basic 3-column, 2-row Markdown table at the cursor.
 */
export function insertTable(
  textarea: HTMLTextAreaElement
): TextModification {
  const table =
    '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n| 内容 | 内容 | 内容 |\n';
  return insertAtCursor(textarea, table);
}

/**
 * Compute text statistics: character count, word count, and line count.
 *
 * CJK characters (Chinese, Japanese Hiragana/Katakana) are counted
 * individually; Latin/numeric words are split by whitespace.
 */
export function countStats(text: string): EditorStats {
  const characters = text.length;
  const lines = text === '' ? 0 : text.split('\n').length;

  const cjkMatches = text.match(
    /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g
  );
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  const withoutCJK = text.replace(
    /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g,
    ' '
  );
  const englishWords = withoutCJK
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  return { characters, words: cjkCount + englishWords, lines };
}

/** Default welcome content shown when the app first loads. */
export const WELCOME_CONTENT = `# 欢迎使用 Markdown 编辑器

这是一个轻量级的 **Markdown 编辑器**，支持实时预览和所见即所得的编辑体验。无需登录、无需联网，所有数据都在本地处理。

## 功能特性

- 完整的 Markdown 语法支持
- GitHub Flavored Markdown (GFM)
- 实时分屏预览
- 代码语法高亮
- 文件打开与保存（File System Access API）
- Word 风格工具栏

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| \`Ctrl + S\` | 保存 |
| \`Ctrl + Shift + S\` | 另存为 |
| \`Ctrl + N\` | 新建文件 |
| \`Ctrl + O\` | 打开文件 |
| \`Tab\` | 插入缩进 |

## 代码示例

\`\`\`javascript
function greet(name) {
  return 'Hello, ' + name + '!';
}

console.log(greet('World'));
\`\`\`

\`\`\`python
def greet(name):
    return f"Hello, {name}!"

print(greet("World"))
\`\`\`

## 引用

> 好的工具应该让人专注于内容本身，而不是工具的使用方式。

## 任务列表

- [x] 基础 Markdown 编辑
- [x] 实时预览
- [x] 工具栏快捷操作
- [ ] 自定义主题
- [ ] 导出 PDF

---

**开始编辑吧！** 点击左侧编辑区即可开始输入内容，右侧将实时显示渲染效果。也可以点击顶部按钮打开或新建文件。
`;
