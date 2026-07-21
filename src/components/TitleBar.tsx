/**
 * TitleBar — top bar showing file name, file operations, and mode switcher.
 */

import {
  FilePlus,
  FolderOpen,
  Save,
  Download,
  Pencil,
  Eye,
  Columns2,
  FileText,
  FileType,
} from 'lucide-react';
import type { EditorMode } from '../types';

export interface TitleBarProps {
  fileName: string;
  isDirty: boolean;
  isSaving: boolean;
  isExporting: boolean;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportPDF: () => void;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}

const MODE_OPTIONS: { value: EditorMode; label: string; icon: typeof Pencil }[] = [
  { value: 'edit', label: '编辑', icon: Pencil },
  { value: 'split', label: '分屏', icon: Columns2 },
  { value: 'preview', label: '预览', icon: Eye },
];

export default function TitleBar({
  fileName,
  isDirty,
  isSaving,
  isExporting,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExportPDF,
  mode,
  onModeChange,
}: TitleBarProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 select-none">
      {/* Left: file name */}
      <div className="flex items-center gap-2 min-w-0">
        <FileText size={18} className="text-blue-600 shrink-0" />
        <span className="font-medium text-gray-800 truncate">
          {fileName}
          {isDirty && <span className="text-orange-500 ml-1" title="未保存的更改">●</span>}
        </span>
      </div>

      {/* Right: file operations + mode switcher */}
      <div className="flex items-center gap-1">
        {/* File operations */}
        <button
          onClick={onNew}
          title="新建文件 (Ctrl+N)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <FilePlus size={17} />
        </button>
        <button
          onClick={onOpen}
          title="打开文件 (Ctrl+O)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <FolderOpen size={17} />
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          title="保存 (Ctrl+S)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={17} className={isSaving ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={onSaveAs}
          disabled={isSaving}
          title="另存为 (Ctrl+Shift+S)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={17} />
        </button>
        <button
          onClick={onExportPDF}
          disabled={isExporting}
          title="导出 PDF (Ctrl+E)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileType size={17} className={isExporting ? 'animate-pulse' : ''} />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Mode switcher (segmented control) */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = mode === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onModeChange(opt.value)}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={15} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
