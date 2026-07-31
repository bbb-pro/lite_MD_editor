/**
 * Type definitions for the Markdown Editor application.
 */

/** Editor display mode. */
export type EditorMode = 'edit' | 'preview' | 'split';

/** Represents the current state of the file being edited. */
export interface FileState {
  /** File name including extension, e.g. "readme.md". */
  name: string;
  /** Full text content of the file. */
  content: string;
  /** Whether the content has unsaved changes. */
  isDirty: boolean;
  /** File System Access API handle (null when unsupported or file not yet saved). */
  fileHandle: any | null;
}

/** Text statistics for the status bar. */
export interface EditorStats {
  /** Total character count. */
  characters: number;
  /** Word count (CJK chars counted individually, English words split by whitespace). */
  words: number;
  /** Total line count. */
  lines: number;
}

/** Result returned from opening a file. */
export interface OpenFileResult {
  name: string;
  content: string;
  handle: any | null;
}

/* ---------- Electron API (injected by preload script) ---------- */

export interface ElectronFileResult {
  name?: string;
  path?: string;
  content?: string;
  success?: boolean;
  /** True when the user dismissed the native dialog. */
  cancelled?: boolean;
  error?: string;
}

/** Save-dialog file filter passed to Electron. */
export interface ElectronSaveFilter {
  name: string;
  extensions: string[];
}

export interface ElectronPDFResult {
  success?: boolean;
  cancelled?: boolean;
  path?: string;
  error?: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  openFile: () => Promise<ElectronFileResult | null>;
  saveFile: (data: { content: string; defaultName: string }) => Promise<ElectronFileResult | null>;
  saveFileToPath: (data: { content: string; filePath: string }) => Promise<ElectronFileResult | null>;
  exportPDF: (data: { defaultName: string }) => Promise<ElectronPDFResult>;
  /**
   * Write an arbitrary text document (HTML / Word) to disk through the native
   * save dialog. Added for the "导出 HTML" / "导出 Word" features.
   */
  exportDocument: (data: {
    content: string;
    defaultName: string;
    filters?: ElectronSaveFilter[];
  }) => Promise<ElectronFileResult | null>;
  onMenuNew: (callback: () => void) => void;
  onMenuOpen: (callback: () => void) => void;
  onMenuSave: (callback: () => void) => void;
  onMenuSaveAs: (callback: () => void) => void;
  onMenuExportPDF: (callback: () => void) => void;
  onMenuExportHtml: (callback: () => void) => void;
  onMenuExportWord: (callback: () => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
