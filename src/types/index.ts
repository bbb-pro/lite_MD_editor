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
