/**
 * File system hook for opening, saving, and creating Markdown files.
 *
 * Uses the File System Access API when available (Chrome / Edge) and falls
 * back to traditional upload/download for other browsers.
 */

import { useCallback, useMemo } from 'react';
import type { OpenFileResult } from '../types';

/** Markdown file type filter for the File System Access API. */
const MD_FILE_TYPES = [
  {
    description: 'Markdown 文件',
    accept: { 'text/markdown': ['.md', '.markdown', '.txt'] },
  },
];

export interface UseFileSystemReturn {
  /** Whether the File System Access API is available in this browser. */
  isSupported: boolean;
  /** Open a file picker and read the selected file. Returns null if cancelled. */
  openFile: () => Promise<OpenFileResult | null>;
  /**
   * Save content to disk.
   * - If a file handle exists, write directly to it.
   * - Otherwise, show a save-file picker (when supported) or trigger a download.
   * Returns the file handle (if one was obtained) or null.
   */
  saveFile: (content: string, name: string, handle: any | null) => Promise<any | null>;
  /**
   * Always show a save-file picker (or trigger a download) to save as a new file.
   * Returns the new file handle (if one was obtained) or null.
   */
  saveFileAs: (content: string, name: string) => Promise<any | null>;
}

/** Check if running inside Electron */
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
}

export function useFileSystem(): UseFileSystemReturn {
  const isSupported = useMemo(
    () =>
      isElectron() ||
      (typeof window !== 'undefined' &&
        'showOpenFilePicker' in window &&
        'showSaveFilePicker' in window),
    []
  );

  const openFile = useCallback(async (): Promise<OpenFileResult | null> => {
    // Electron native dialog
    if (isElectron()) {
      const result = await (window as any).electronAPI.openFile();
      if (result) {
        return { name: result.name, content: result.content, handle: result.path };
      }
      return null;
    }

    // File System Access API (Chrome / Edge)
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: MD_FILE_TYPES,
          multiple: false,
        });
        const file = await handle.getFile();
        const content = await file.text();
        return { name: file.name, content, handle };
      } catch (err) {
        // User cancelled the picker
        return null;
      }
    }

    // Fallback: hidden file input
    return new Promise<OpenFileResult | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.markdown,.txt';
      input.style.display = 'none';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          const content = await file.text();
          resolve({ name: file.name, content, handle: null });
        } else {
          resolve(null);
        }
        input.remove();
      };
      document.body.appendChild(input);
      input.click();
    });
  }, []);

  const _downloadFile = (content: string, name: string): void => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.endsWith('.md') ? name : name + '.md';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const saveFileAs = useCallback(
    async (content: string, name: string): Promise<any | null> => {
      // Electron native dialog
      if (isElectron()) {
        const result = await (window as any).electronAPI.saveFile({
          content,
          defaultName: name.endsWith('.md') ? name : name + '.md',
        });
        if (result) {
          return result.path; // store file path as "handle"
        }
        return null;
      }

      // File System Access API (Chrome / Edge)
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const newHandle = await (window as any).showSaveFilePicker({
            suggestedName: name.endsWith('.md') ? name : name + '.md',
            types: MD_FILE_TYPES,
          });
          const writable = await newHandle.createWritable();
          await writable.write(content);
          await writable.close();
          return newHandle;
        } catch (err) {
          // User cancelled
          return null;
        }
      }

      // Fallback: download
      _downloadFile(content, name);
      return null;
    },
    []
  );

  const saveFile = useCallback(
    async (content: string, name: string, handle: any | null): Promise<any | null> => {
      // Electron: if we have a file path, write directly to it
      if (isElectron()) {
        if (handle && typeof handle === 'string') {
          const result = await (window as any).electronAPI.saveFileToPath({
            content,
            filePath: handle,
          });
          if (result?.success) {
            return handle;
          }
          console.error('Failed to save to path:', result?.error);
          return null;
        }
        // No path yet — show save-as dialog
        return saveFileAs(content, name);
      }

      // File System Access API: write to existing handle
      if (handle && typeof handle === 'object' && handle.createWritable) {
        try {
          const writable = await handle.createWritable();
          await writable.write(content);
          await writable.close();
          return handle;
        } catch (err) {
          console.error('Failed to write to file handle:', err);
          return null;
        }
      }
      return saveFileAs(content, name);
    },
    [saveFileAs]
  );

  return { isSupported, openFile, saveFile, saveFileAs };
}
