/**
 * Document export utilities — standalone HTML and Microsoft Word (.doc).
 *
 * Design goals:
 * - ZERO extra npm dependencies. Uses native Blob + `<a download>` on the web
 *   and Electron's native save dialog (`electronAPI.exportDocument`) on desktop.
 * - Self-contained output: all `.markdown-preview` styles are inlined into the
 *   generated document so the file renders correctly when opened standalone.
 *
 * The caller is responsible for grabbing the rendered preview HTML
 * (`document.querySelector('.markdown-preview')?.innerHTML`) — this module only
 * wraps it into a full document and writes it to disk.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Result of an export operation. */
export interface ExportResult {
  /** True when the file was written / the download was triggered. */
  success: boolean;
  /** True when the user dismissed the native save dialog. */
  cancelled?: boolean;
  /** Absolute path of the written file (Electron only). */
  path?: string;
  /** Human-readable error message when `success` is false. */
  error?: string;
}

/** A save-dialog file filter (Electron `dialog.showSaveDialog` shape). */
export interface ExportFilter {
  name: string;
  extensions: string[];
}

/* ------------------------------------------------------------------ */
/* Inlined preview styles                                              */
/* ------------------------------------------------------------------ */

/**
 * Standalone copy of the `.markdown-preview` rules from `src/index.css`.
 *
 * Deliberately excludes `@media print` and scrollbar rules — those are
 * app-shell concerns and would break exported documents (the print rules hide
 * `body *`, which Word/standalone viewers would apply incorrectly).
 *
 * Keep this in sync with `src/index.css` (lines ~67-303) when the preview
 * styling changes.
 */
export const PREVIEW_STYLES = `
* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei',
    sans-serif;
  -webkit-font-smoothing: antialiased;
}

article.markdown-preview {
  font-size: 16px;
  line-height: 1.8;
  color: #1f2937;
  word-wrap: break-word;
}

.markdown-preview > *:first-child { margin-top: 0; }
.markdown-preview > *:last-child { margin-bottom: 0; }

.markdown-preview h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 1.5rem 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.markdown-preview h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 1.25rem 0 0.75rem;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid #f3f4f6;
}

.markdown-preview h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
}

.markdown-preview h4 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0.875rem 0 0.5rem;
}

.markdown-preview h5 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.75rem 0 0.5rem;
}

.markdown-preview h6 {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0.75rem 0 0.5rem;
  color: #6b7280;
}

.markdown-preview p { margin: 0.6rem 0; }

.markdown-preview a {
  color: #2563eb;
  text-decoration: none;
}

.markdown-preview a:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.markdown-preview ul,
.markdown-preview ol {
  margin: 0.6rem 0;
  padding-left: 1.75rem;
}

.markdown-preview ul { list-style-type: disc; }
.markdown-preview ol { list-style-type: decimal; }
.markdown-preview li { margin: 0.25rem 0; }

.markdown-preview li > ul,
.markdown-preview li > ol { margin: 0.25rem 0; }

.markdown-preview blockquote {
  border-left: 4px solid #d1d5db;
  padding: 0.25rem 0 0.25rem 1rem;
  margin: 0.75rem 0;
  color: #6b7280;
  background: #f9fafb;
  border-radius: 0 0.375rem 0.375rem 0;
}

.markdown-preview blockquote p { margin: 0.25rem 0; }

.markdown-preview code {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace;
  font-size: 0.875em;
  background: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  color: #db2777;
}

.markdown-preview pre { margin: 0; }

.markdown-preview table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75rem 0;
  font-size: 0.95em;
}

.markdown-preview th,
.markdown-preview td {
  border: 1px solid #e5e7eb;
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.markdown-preview th {
  background: #f9fafb;
  font-weight: 600;
}

.markdown-preview tr:nth-child(even) { background: #fafafa; }

.markdown-preview img {
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 0.5rem 0;
}

.markdown-preview hr {
  border: none;
  border-top: 2px solid #e5e7eb;
  margin: 1.5rem 0;
}

.markdown-preview input[type='checkbox'] {
  margin-right: 0.5rem;
}

.markdown-preview strong {
  font-weight: 700;
  color: #111827;
}

.markdown-preview em { font-style: italic; }

.markdown-preview del {
  text-decoration: line-through;
  color: #9ca3af;
}

.markdown-preview kbd {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  font-size: 0.8em;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1;
  color: #374151;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
}

.md-code-block {
  position: relative;
  margin: 0.5rem 0;
  padding: 1rem 1.25rem;
  background: #1e293b;
  border-radius: 0.5rem;
  overflow-x: auto;
  font-size: 0.875rem;
  line-height: 1.6;
}

.md-code-block code {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  color: #e2e8f0;
  background: none;
  padding: 0;
  white-space: pre;
}

.md-code-lang {
  position: absolute;
  top: 0;
  right: 0;
  padding: 0.2rem 0.6rem;
  font-size: 0.7rem;
  font-family: 'JetBrains Mono', monospace;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.08);
  border-bottom-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.md-code-inline {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.85em;
  padding: 0.15rem 0.4rem;
  background: #f1f5f9;
  border-radius: 0.25rem;
  color: #db2777;
}
`.trim();

/**
 * Extra rules appended only to the Word document.
 *
 * Word's HTML renderer ignores `position: absolute`, flexbox and most modern
 * layout features, so we neutralise them and fall back to plain block flow.
 */
const WORD_EXTRA_STYLES = `
@page { size: A4; margin: 2cm; }

.markdown-preview pre,
.markdown-preview .md-code-block {
  white-space: pre-wrap;
  word-break: break-word;
  page-break-inside: avoid;
}

.markdown-preview .md-code-block code {
  white-space: pre-wrap;
}

.markdown-preview table {
  mso-table-lspace: 0pt;
  mso-table-rspace: 0pt;
}

.markdown-preview h1,
.markdown-preview h2,
.markdown-preview h3 {
  page-break-after: avoid;
}

.md-task-marker {
  font-family: 'Segoe UI Symbol', 'Apple Symbols', sans-serif;
  margin-right: 0.35rem;
}
`.trim();

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Extensions treated as "source markdown" when deriving an export base name. */
const MARKDOWN_EXT_RE = /\.(md|markdown|txt)$/i;

/**
 * Strip a Markdown/text extension from a file name.
 *
 * @param name Source file name, e.g. `"readme.md"`.
 * @returns The base name without extension, e.g. `"readme"`. Falls back to
 *          `"export"` when the input is empty.
 */
export function stripMarkdownExtension(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'export';
  const base = trimmed.replace(MARKDOWN_EXT_RE, '');
  return base || 'export';
}

/** Escape the five XML/HTML-significant characters for safe text interpolation. */
export function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Whether the app is currently running inside the Electron shell. */
function isElectronRuntime(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
}

/**
 * Trigger a browser download for the given text content.
 *
 * @param content   Full file content.
 * @param fileName  File name including extension.
 * @param mimeType  MIME type, e.g. `"text/html"` or `"application/msword"`.
 */
function webDownload(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Make preview HTML friendly to Microsoft Word.
 *
 * - Replaces GFM task-list checkboxes (`<input type="checkbox">`) with the
 *   ☑ / ☐ glyphs, since Word drops form controls.
 * - Removes the absolutely-positioned language badge of code blocks, which
 *   Word would otherwise render as a stray overlapping line.
 *
 * @param html Rendered preview inner HTML.
 * @returns Word-compatible HTML fragment.
 */
export function adaptHtmlForWord(html: string): string {
  let out = html;

  // Drop the code-block language badge (absolute positioning is unsupported).
  out = out.replace(/<span[^>]*class=["'][^"']*md-code-lang[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '');

  // Convert checkboxes into printable glyphs.
  out = out.replace(/<input\b[^>]*>/gi, (tag) => {
    if (!/type\s*=\s*["']?checkbox/i.test(tag)) return tag;
    const checked = /\bchecked\b/i.test(tag);
    return `<span class="md-task-marker">${checked ? '&#9745;' : '&#9744;'}</span>`;
  });

  return out;
}

/* ------------------------------------------------------------------ */
/* Document builders                                                   */
/* ------------------------------------------------------------------ */

/** Inline layout applied to the exported `<article>` wrapper. */
const ARTICLE_INLINE_STYLE = 'max-width:48rem;margin:0 auto;padding:2rem 3rem;';

/**
 * Build a complete, standalone HTML document from rendered preview HTML.
 *
 * @param previewHtml Inner HTML of the `.markdown-preview` container.
 * @param title       Document title (used for `<title>`).
 * @returns A full HTML document string.
 */
export function buildStandaloneHtml(previewHtml: string, title: string): string {
  const safeTitle = escapeHtml(title || 'Document');
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Lite MD Editor">
<title>${safeTitle}</title>
<style>
${PREVIEW_STYLES}
</style>
</head>
<body>
<article class="markdown-preview" style="${ARTICLE_INLINE_STYLE}">
${previewHtml}
</article>
</body>
</html>`;
}

/**
 * Build a Microsoft Word compatible HTML document (`.doc`).
 *
 * Word opens HTML files that declare the Office/Word XML namespaces and can be
 * re-saved as `.docx` from within Word. This keeps the exporter dependency-free.
 *
 * @param previewHtml Inner HTML of the `.markdown-preview` container.
 * @param title       Document title.
 * @returns A full Word-compatible HTML document string.
 */
export function buildWordDocument(previewHtml: string, title: string): string {
  const safeTitle = escapeHtml(title || 'Document');
  const body = adaptHtmlForWord(previewHtml);
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<meta name=ProgId content=Word.Document>
<meta name=Generator content="Lite MD Editor">
<title>${safeTitle}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
${PREVIEW_STYLES}
${WORD_EXTRA_STYLES}
</style>
</head>
<body>
<article class="markdown-preview" style="${ARTICLE_INLINE_STYLE}">
${body}
</article>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Unified save entry points                                           */
/* ------------------------------------------------------------------ */

/**
 * Persist generated document content, choosing the platform-appropriate path.
 *
 * @param content     Full document text.
 * @param fileName    Suggested file name with extension.
 * @param mimeType    MIME type used for the browser download.
 * @param filters     Save-dialog filters used by Electron.
 * @returns The outcome of the save operation.
 */
async function saveDocument(
  content: string,
  fileName: string,
  mimeType: string,
  filters: ExportFilter[]
): Promise<ExportResult> {
  try {
    if (isElectronRuntime() && typeof window.electronAPI?.exportDocument === 'function') {
      const result = await window.electronAPI.exportDocument({
        content,
        defaultName: fileName,
        filters,
      });
      if (!result) {
        return { success: false, cancelled: true };
      }
      if (result.cancelled) {
        return { success: false, cancelled: true };
      }
      if (result.success === false) {
        return { success: false, error: result.error || '写入文件失败' };
      }
      return { success: true, path: result.path };
    }

    webDownload(content, fileName, mimeType);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Export the rendered preview as a standalone `.html` file.
 *
 * @param previewHtml Inner HTML of the `.markdown-preview` container.
 * @param baseName    File name without extension, e.g. `"readme"`.
 */
export async function exportHtml(
  previewHtml: string,
  baseName: string
): Promise<ExportResult> {
  const safeBase = stripMarkdownExtension(baseName);
  const htmlDocument = buildStandaloneHtml(previewHtml, safeBase);
  return saveDocument(htmlDocument, `${safeBase}.html`, 'text/html', [
    { name: 'HTML 文件', extensions: ['html', 'htm'] },
    { name: '所有文件', extensions: ['*'] },
  ]);
}

/**
 * Export the rendered preview as a Word-readable `.doc` file.
 *
 * @param previewHtml Inner HTML of the `.markdown-preview` container.
 * @param baseName    File name without extension, e.g. `"readme"`.
 */
export async function exportWord(
  previewHtml: string,
  baseName: string
): Promise<ExportResult> {
  const safeBase = stripMarkdownExtension(baseName);
  const wordDocument = buildWordDocument(previewHtml, safeBase);
  return saveDocument(wordDocument, `${safeBase}.doc`, 'application/msword', [
    { name: 'Word 文档', extensions: ['doc'] },
    { name: '所有文件', extensions: ['*'] },
  ]);
}
