/**
 * StatusBar — bottom bar showing file name, save status, and text statistics.
 */

import { Check, Loader2, AlertCircle } from 'lucide-react';
import type { EditorStats, EditorMode } from '../types';

export interface StatusBarProps {
  fileName: string;
  isDirty: boolean;
  isSaving: boolean;
  stats: EditorStats;
  mode: EditorMode;
}

const MODE_LABELS: Record<EditorMode, string> = {
  edit: '编辑模式',
  preview: '预览模式',
  split: '分屏模式',
};

export default function StatusBar({
  fileName,
  isDirty,
  isSaving,
  stats,
  mode,
}: StatusBarProps) {
  return (
    <footer className="flex items-center justify-between px-4 py-1.5 bg-gray-100 border-t border-gray-200 text-xs text-gray-500 select-none">
      {/* Left: file name + save status */}
      <div className="flex items-center gap-3">
        <span className="truncate max-w-xs">{fileName}</span>
        <span className="flex items-center gap-1">
          {isSaving ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>保存中...</span>
            </>
          ) : isDirty ? (
            <>
              <AlertCircle size={12} className="text-orange-500" />
              <span className="text-orange-500">未保存</span>
            </>
          ) : (
            <>
              <Check size={12} className="text-green-500" />
              <span className="text-green-600">已保存</span>
            </>
          )}
        </span>
      </div>

      {/* Right: stats + mode */}
      <div className="flex items-center gap-4">
        <span>字符: {stats.characters.toLocaleString()}</span>
        <span>字数: {stats.words.toLocaleString()}</span>
        <span>行数: {stats.lines.toLocaleString()}</span>
        <span className="text-gray-400">|</span>
        <span>{MODE_LABELS[mode]}</span>
      </div>
    </footer>
  );
}
