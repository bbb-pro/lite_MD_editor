/**
 * App — root component of the Markdown editor.
 *
 * Manages global state (file state, editor mode, saving) and wires together
 * the TitleBar, Toolbar, Editor, Preview, and StatusBar.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import Toolbar from './components/Toolbar';
import Editor from './components/Editor';
import Preview from './components/Preview';
import StatusBar from './components/StatusBar';
import { useFileSystem, isAcceptedFileName } from './hooks/useFileSystem';
import type { EditorMode, FileState } from './types';
import { countStats, WELCOME_CONTENT } from './utils/markdown';

function App() {
  const [fileState, setFileState] = useState<FileState>({
    name: 'untitled.md',
    content: WELCOME_CONTENT,
    isDirty: false,
    fileHandle: null,
  });
  const [mode, setMode] = useState<EditorMode>('split');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /**
   * Depth counter for drag enter/leave events. `dragleave` fires whenever the
   * pointer crosses into a child element, so a plain boolean would flicker.
   */
  const dragDepthRef = useRef(0);
  const { openFile, openFileFromDrop, saveFile, saveFileAs, isSupported } =
    useFileSystem();

  const stats = countStats(fileState.content);

  /* ---------- Content change ---------- */
  const handleContentChange = useCallback((content: string) => {
    setFileState((prev) => ({ ...prev, content, isDirty: true }));
  }, []);

  /* ---------- New file ---------- */
  const handleNew = useCallback(() => {
    setFileState((prev) => {
      if (prev.isDirty) {
        const confirmed = window.confirm(
          '当前文件有未保存的更改，确定要新建文件吗？'
        );
        if (!confirmed) return prev;
      }
      return { name: 'untitled.md', content: '', isDirty: false, fileHandle: null };
    });
  }, []);

  /* ---------- Open file ---------- */
  const handleOpen = useCallback(async () => {
    if (fileState.isDirty) {
      const confirmed = window.confirm(
        '当前文件有未保存的更改，确定要打开新文件吗？'
      );
      if (!confirmed) return;
    }
    const result = await openFile();
    if (result) {
      setFileState({
        name: result.name,
        content: result.content,
        isDirty: false,
        fileHandle: result.handle,
      });
    }
  }, [fileState.isDirty, openFile]);

  /* ---------- Drag & drop to open ---------- */

  /**
   * Must call preventDefault on dragover, otherwise the drop event never
   * fires and Electron falls back to opening the file with an external app.
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const types = e.dataTransfer?.types;
    const hasFiles = !!types && Array.from(types).includes('Files');
    if (!hasFiles) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragDepthRef.current > 0) {
      dragDepthRef.current -= 1;
    }
    // Only hide the overlay once the pointer has truly left the app container.
    const related = e.relatedTarget as Node | null;
    const stillInside = !!related && e.currentTarget.contains(related);
    if (dragDepthRef.current === 0 || !stillInside) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDragging(false);

      // Snapshot the files synchronously — `dataTransfer` is not reliable
      // after the handler returns / awaits.
      const dropped: File[] = Array.from(e.dataTransfer?.files ?? []);
      if (dropped.length === 0) return;

      const target = dropped.find((file) => isAcceptedFileName(file.name));
      if (!target) {
        window.alert('只支持打开 .md / .markdown / .txt 文件');
        return;
      }

      if (fileState.isDirty) {
        const confirmed = window.confirm(
          '当前文件有未保存的更改，确定要打开拖入的文件吗？'
        );
        if (!confirmed) return;
      }

      void (async () => {
        const result = await openFileFromDrop(dropped);
        if (!result) {
          window.alert('读取文件失败，请重试。');
          return;
        }
        setFileState({
          name: result.name,
          content: result.content,
          isDirty: false,
          fileHandle: result.handle,
        });
      })();
    },
    [fileState.isDirty, openFileFromDrop]
  );

  /* ---------- Save ---------- */
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const handle = await saveFile(
        fileState.content,
        fileState.name,
        fileState.fileHandle
      );
      setFileState((prev) => ({
        ...prev,
        isDirty: false,
        fileHandle: handle || prev.fileHandle,
      }));
    } catch (err) {
      console.error('保存失败:', err);
      window.alert('保存失败，请重试。');
    } finally {
      setIsSaving(false);
    }
  }, [fileState.content, fileState.name, fileState.fileHandle, saveFile]);

  /* ---------- Save As ---------- */
  const handleSaveAs = useCallback(async () => {
    setIsSaving(true);
    try {
      const handle = await saveFileAs(fileState.content, fileState.name);
      if (handle) {
        const newName = handle.name || fileState.name;
        setFileState((prev) => ({
          ...prev,
          name: newName,
          isDirty: false,
          fileHandle: handle,
        }));
      }
    } catch (err) {
      console.error('另存为失败:', err);
      window.alert('另存为失败，请重试。');
    } finally {
      setIsSaving(false);
    }
  }, [fileState.content, fileState.name, saveFileAs]);

  /* ---------- Export PDF ---------- */
  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    const prevMode = mode;
    // Switch to preview mode so the full rendered content is visible
    setMode('preview');

    try {
      // Wait for React to re-render the preview at full width
      await new Promise((r) => setTimeout(r, 200));

      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.isElectron) {
        // Electron: use native printToPDF
        const result = await electronAPI.exportPDF({ defaultName: fileState.name });
        if (result?.success) {
          // Success — no alert needed, user sees the save dialog
        } else if (result?.error) {
          window.alert('导出 PDF 失败: ' + result.error);
        }
      } else {
        // Web: use browser's print dialog (user can "Save as PDF")
        window.print();
      }
    } catch (err) {
      console.error('导出 PDF 失败:', err);
      window.alert('导出 PDF 失败，请重试。');
    } finally {
      setMode(prevMode);
      setIsExporting(false);
    }
  }, [mode, fileState.name]);

  /* ---------- Keyboard shortcuts ---------- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveAs();
        } else {
          handleSave();
        }
      } else if (isMod && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handleNew();
      } else if (isMod && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        handleOpen();
      } else if (isMod && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        handleExportPDF();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, handleSaveAs, handleNew, handleOpen, handleExportPDF]);

  /* ---------- Warn before closing with unsaved changes ---------- */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (fileState.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [fileState.isDirty]);

  /* ---------- Electron menu event listeners ---------- */
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.isElectron) return;

    const offNew = electronAPI.onMenuNew(() => handleNew());
    const offOpen = electronAPI.onMenuOpen(() => handleOpen());
    const offSave = electronAPI.onMenuSave(() => handleSave());
    const offSaveAs = electronAPI.onMenuSaveAs(() => handleSaveAs());
    const offExportPDF = electronAPI.onMenuExportPDF(() => handleExportPDF());

    return () => {
      // ipcRenderer.on returns a cleanup function in newer Electron,
      // but our preload doesn't return disposers — just leave listeners.
      // They'll be cleaned up when the window is destroyed.
    };
  }, [handleNew, handleOpen, handleSave, handleSaveAs, handleExportPDF]);

  /* ---------- Render ---------- */
  const showEditor = mode === 'edit' || mode === 'split';
  const showPreview = mode === 'preview' || mode === 'split';

  return (
    <div
      className="flex flex-col h-screen bg-gray-50"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <TitleBar
        fileName={fileState.name}
        isDirty={fileState.isDirty}
        isSaving={isSaving}
        isExporting={isExporting}
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExportPDF={handleExportPDF}
        mode={mode}
        onModeChange={setMode}
      />
      <Toolbar
        textareaRef={textareaRef}
        onContentChange={handleContentChange}
      />
      <main className="flex-1 flex overflow-hidden">
        {showEditor && (
          <div
            className={
              mode === 'split'
                ? 'w-1/2 border-r border-gray-200 overflow-hidden'
                : 'w-full overflow-hidden'
            }
          >
            <Editor
              textareaRef={textareaRef}
              value={fileState.content}
              onChange={handleContentChange}
            />
          </div>
        )}
        {showPreview && (
          <div
            className={
              mode === 'split' ? 'w-1/2 overflow-hidden' : 'w-full overflow-hidden'
            }
          >
            <Preview content={fileState.content} />
          </div>
        )}
      </main>
      <StatusBar
        fileName={fileState.name}
        isDirty={fileState.isDirty}
        isSaving={isSaving}
        stats={stats}
        mode={mode}
      />
      {isDragging && (
        // pointer-events-none lets the drag events keep bubbling to the root
        // container, so the overlay never swallows dragleave / drop.
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center border-4 border-dashed border-blue-400 bg-blue-500/10">
          <div className="rounded-lg bg-white/90 px-6 py-4 text-lg font-medium text-blue-600 shadow-lg">
            松开以打开文件（.md / .markdown / .txt）
          </div>
        </div>
      )}
      {!isSupported && (
        <div className="px-4 py-1 bg-yellow-50 border-t border-yellow-200 text-xs text-yellow-700 text-center">
          当前浏览器不支持 File System Access API，文件操作将通过下载/上传方式进行。推荐使用 Chrome 或 Edge 浏览器。
        </div>
      )}
    </div>
  );
}

export default App;
