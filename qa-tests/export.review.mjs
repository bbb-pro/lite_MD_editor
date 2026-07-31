/**
 * QA 静态审查脚本 —— 「导出 Word / HTML」增量功能 C/D 类验收
 * 负责人：严过关 (Yan) / QA
 *
 * 直接读取实际源文件做正则/结构断言，不依赖交付摘要的描述。
 *
 * 运行：node qa-tests/export.review.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

const APP = read('src/App.tsx');
const TITLEBAR = read('src/components/TitleBar.tsx');
const PRELOAD = read('electron/preload.cjs');
const MAIN = read('electron/main.cjs');
const TYPES = read('src/types/index.ts');
const EXPORT_TS = read('src/utils/export.ts');
const INDEX_CSS = read('src/index.css');
const PKG = JSON.parse(read('package.json'));

const results = [];
let currentGroup = '';
const group = (n) => {
  currentGroup = n;
  results.push({ type: 'group', name: n });
};
function check(name, fn) {
  try {
    const r = fn();
    if (r === false) throw new Error('断言返回 false');
    results.push({ type: 'test', group: currentGroup, name, ok: true });
  } catch (e) {
    results.push({ type: 'test', group: currentGroup, name, ok: false, err: e.message });
  }
}
const assert = (c, m) => {
  if (!c) throw new Error(m || '断言失败');
};
const has = (src, re, label) =>
  assert(re.test(src), `${label} 未匹配到模式 ${re}`);

/* ================= A. 依赖零改动 ================= */

group('A 类型与构建回归');

check('package.json dependencies 未新增（仅 5 个运行时依赖）', () => {
  const deps = Object.keys(PKG.dependencies).sort();
  const expected = ['lucide-react', 'react', 'react-dom', 'react-markdown', 'remark-gfm'];
  assert(
    JSON.stringify(deps) === JSON.stringify(expected),
    `dependencies 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(deps)}`
  );
});
check('package.json devDependencies 未新增（无测试框架等新包）', () => {
  const deps = Object.keys(PKG.devDependencies);
  const expected = [
    '@types/react', '@types/react-dom', '@vitejs/plugin-react', 'autoprefixer',
    'concurrently', 'cross-env', 'electron', 'electron-builder', 'postcss',
    'tailwindcss', 'typescript', 'vite', 'wait-on',
  ];
  assert(
    JSON.stringify(deps.sort()) === JSON.stringify(expected.sort()),
    `devDependencies 有变化，实际 ${JSON.stringify(deps)}`
  );
});
check('export.ts 不 import 任何项目内模块（自包含）', () => {
  const imports = EXPORT_TS.match(/^\s*import\s.+$/gm) || [];
  assert(imports.length === 0, `发现 import 语句：${imports.join(' | ')}`);
});

/* ================= C. 代码审查闭环 ================= */

group('C1 src/App.tsx');

check('从 ./utils/export 引入 exportHtml / exportWord / stripMarkdownExtension', () =>
  has(APP, /import\s*\{[^}]*exportHtml[^}]*exportWord[^}]*\}\s*from\s*'\.\/utils\/export'/, 'App.tsx import')
);
check('handleExportHtml 委托 runDocumentExport(\'html\')', () =>
  has(APP, /const handleExportHtml\s*=\s*useCallback\(\s*\(\)\s*=>\s*runDocumentExport\('html'\)/, 'handleExportHtml')
);
check('handleExportWord 委托 runDocumentExport(\'word\')', () =>
  has(APP, /const handleExportWord\s*=\s*useCallback\(\s*\(\)\s*=>\s*runDocumentExport\('word'\)/, 'handleExportWord')
);
check('runDocumentExport 内实际调用 exportHtml / exportWord', () => {
  has(APP, /await exportHtml\(previewHtml, baseName\)/, 'exportHtml 调用');
  has(APP, /await exportWord\(previewHtml, baseName\)/, 'exportWord 调用');
});
check('导出前切换到 preview 模式', () => has(APP, /setMode\('preview'\)/, 'setMode preview'));
check('等待 React 提交后再抓取（250ms）', () =>
  has(APP, /setTimeout\(r,\s*250\)/, '250ms 等待')
);
check('抓取 .markdown-preview 的 innerHTML', () => {
  has(APP, /document\.querySelector\('\.markdown-preview'\)/, 'querySelector');
  has(APP, /container\.innerHTML/, 'innerHTML');
});
check('finally 中复原 mode + 释放 busy 标志', () => {
  const m = APP.match(/runDocumentExport[\s\S]*?finally\s*\{([\s\S]*?)\}/);
  assert(m, '未找到 runDocumentExport 的 finally 块');
  assert(/setMode\(prevMode\)/.test(m[1]), 'finally 未复原 mode');
  assert(/setBusy\(false\)/.test(m[1]), 'finally 未复位 setBusy');
  assert(/exportBusyRef\.current = false/.test(m[1]), 'finally 未复位 exportBusyRef');
});
check('exportBusyRef 防重入（入口早退）', () => {
  has(APP, /const exportBusyRef = useRef\(false\)/, 'exportBusyRef 声明');
  has(APP, /if \(exportBusyRef\.current\) return;\s*\n\s*exportBusyRef\.current = true;/, '防重入早退');
});
check('空预览内容有兜底提示', () =>
  has(APP, /if \(!previewHtml\.trim\(\)\)/, '空内容判断')
);
check('isExportingHtml / isExportingWord state 存在', () => {
  has(APP, /const \[isExportingHtml, setIsExportingHtml\] = useState\(false\)/, 'isExportingHtml');
  has(APP, /const \[isExportingWord, setIsExportingWord\] = useState\(false\)/, 'isExportingWord');
});
check('两个新回调与 busy 标志已传入 TitleBar', () => {
  has(APP, /onExportHtml=\{handleExportHtml\}/, 'onExportHtml prop');
  has(APP, /onExportWord=\{handleExportWord\}/, 'onExportWord prop');
  has(APP, /isExportingHtml=\{isExportingHtml\}/, 'isExportingHtml prop');
  has(APP, /isExportingWord=\{isExportingWord\}/, 'isExportingWord prop');
});
check('Electron 菜单监听已注册 onMenuExportHtml / onMenuExportWord', () => {
  has(APP, /electronAPI\.onMenuExportHtml\?\.\(\(\) => handleExportHtml\(\)\)/, 'onMenuExportHtml');
  has(APP, /electronAPI\.onMenuExportWord\?\.\(\(\) => handleExportWord\(\)\)/, 'onMenuExportWord');
});

group('C2 src/components/TitleBar.tsx');

check('props 新增 onExportHtml / onExportWord', () => {
  has(TITLEBAR, /onExportHtml:\s*\(\)\s*=>\s*void/, 'onExportHtml 类型');
  has(TITLEBAR, /onExportWord:\s*\(\)\s*=>\s*void/, 'onExportWord 类型');
});
check('props 新增可选 isExportingHtml? / isExportingWord?', () => {
  has(TITLEBAR, /isExportingHtml\?:\s*boolean/, 'isExportingHtml?');
  has(TITLEBAR, /isExportingWord\?:\s*boolean/, 'isExportingWord?');
});
check('FileCode / FileType2 图标来自 lucide-react', () => {
  const m = TITLEBAR.match(/import\s*\{([\s\S]*?)\}\s*from\s*'lucide-react'/);
  assert(m, '未找到 lucide-react import');
  assert(/\bFileCode\b/.test(m[1]), 'FileCode 未从 lucide-react 引入');
  assert(/\bFileType2\b/.test(m[1]), 'FileType2 未从 lucide-react 引入');
});
check('HTML 按钮绑定 onExportHtml + FileCode + disabled', () => {
  const m = TITLEBAR.match(/<button\s+onClick=\{onExportHtml\}[\s\S]*?<\/button>/);
  assert(m, '未找到绑定 onExportHtml 的按钮');
  assert(/disabled=\{isExportingHtml\}/.test(m[0]), 'HTML 按钮未按 isExportingHtml 禁用');
  assert(/<FileCode\b/.test(m[0]), 'HTML 按钮未使用 FileCode 图标');
  assert(/Ctrl\+Shift\+H/.test(m[0]), 'HTML 按钮 title 未标注快捷键');
});
check('Word 按钮绑定 onExportWord + FileType2 + disabled', () => {
  const m = TITLEBAR.match(/<button\s+onClick=\{onExportWord\}[\s\S]*?<\/button>/);
  assert(m, '未找到绑定 onExportWord 的按钮');
  assert(/disabled=\{isExportingWord\}/.test(m[0]), 'Word 按钮未按 isExportingWord 禁用');
  assert(/<FileType2\b/.test(m[0]), 'Word 按钮未使用 FileType2 图标');
  assert(/Ctrl\+Shift\+E/.test(m[0]), 'Word 按钮 title 未标注快捷键');
});
check('新按钮位于导出 PDF 按钮之后', () => {
  const pdf = TITLEBAR.indexOf('onClick={onExportPDF}');
  const html = TITLEBAR.indexOf('onClick={onExportHtml}');
  const word = TITLEBAR.indexOf('onClick={onExportWord}');
  assert(pdf > -1 && html > pdf && word > html, `顺序异常 pdf=${pdf} html=${html} word=${word}`);
});

group('C3 electron/preload.cjs');

check('暴露 exportDocument -> invoke(export:document)', () =>
  has(PRELOAD, /exportDocument:\s*\(data\)\s*=>\s*ipcRenderer\.invoke\('export:document',\s*data\)/, 'exportDocument')
);
check('暴露 onMenuExportHtml -> on(menu:exportHtml)', () =>
  has(PRELOAD, /onMenuExportHtml:\s*\(callback\)\s*=>\s*ipcRenderer\.on\('menu:exportHtml',\s*callback\)/, 'onMenuExportHtml')
);
check('暴露 onMenuExportWord -> on(menu:exportWord)', () =>
  has(PRELOAD, /onMenuExportWord:\s*\(callback\)\s*=>\s*ipcRenderer\.on\('menu:exportWord',\s*callback\)/, 'onMenuExportWord')
);
check('三个新 API 仅在 isElectron 分支暴露（web 分支不含）', () => {
  const parts = PRELOAD.split('} else {');
  assert(parts.length === 2, 'preload 结构非预期的 if/else 双分支');
  const [electronBranch, webBranch] = parts;
  for (const api of ['exportDocument', 'onMenuExportHtml', 'onMenuExportWord']) {
    assert(electronBranch.includes(api), `Electron 分支缺少 ${api}`);
    assert(!webBranch.includes(api), `Web 回退分支不应暴露 ${api}`);
  }
});
check('contextIsolation 安全模型未被破坏（仍用 contextBridge）', () => {
  has(PRELOAD, /contextBridge\.exposeInMainWorld/, 'contextBridge');
  assert(!/nodeIntegration:\s*true/.test(MAIN), 'main.cjs 不应开启 nodeIntegration');
  has(MAIN, /contextIsolation:\s*true/, 'contextIsolation');
});

group('C4 electron/main.cjs');

const DOC_HANDLER = (MAIN.match(
  /ipcMain\.handle\('export:document'[\s\S]*?\n\}\);/
) || [''])[0];

check('存在 ipcMain.handle(\'export:document\') handler', () =>
  assert(DOC_HANDLER.length > 0, '未找到 export:document handler')
);
check('handler 使用 dialog.showSaveDialog', () =>
  has(DOC_HANDLER, /dialog\.showSaveDialog\(mainWindow/, 'showSaveDialog')
);
check('handler 使用 fs.writeFileSync 写入（utf-8）', () =>
  has(DOC_HANDLER, /fs\.writeFileSync\(result\.filePath,\s*content,\s*'utf-8'\)/, 'writeFileSync')
);
check('filters 由渲染进程传入，缺省回落为 *', () => {
  has(DOC_HANDLER, /Array\.isArray\(filters\)\s*&&\s*filters\.length\s*>\s*0/, 'filters 校验');
  has(DOC_HANDLER, /\{\s*name:\s*'所有文件',\s*extensions:\s*\['\*'\]\s*\}/, '缺省 * 过滤器');
});
check('handler 处理取消 -> { success:false, cancelled:true }', () =>
  has(DOC_HANDLER, /result\.canceled[\s\S]*?cancelled:\s*true/, '取消分支')
);
check('handler 有 try/catch 错误兜底', () =>
  has(DOC_HANDLER, /catch \(err\)[\s\S]*?success:\s*false,\s*error:\s*err\.message/, 'catch 分支')
);
check('handler 无窗口时安全早退', () =>
  has(DOC_HANDLER, /if \(!mainWindow\) return \{ success: false, error: 'No window' \}/, '空窗口early return')
);
check('「文件」菜单新增 导出 HTML... / 导出 Word...', () => {
  has(MAIN, /label:\s*'导出 HTML\.\.\.'[\s\S]{0,120}?send\('menu:exportHtml'\)/, '导出 HTML 菜单项');
  has(MAIN, /label:\s*'导出 Word\.\.\.'[\s\S]{0,120}?send\('menu:exportWord'\)/, '导出 Word 菜单项');
});
check('菜单快捷键与渲染层一致（Shift+H / Shift+E）', () => {
  has(MAIN, /label:\s*'导出 HTML\.\.\.',\s*\n\s*accelerator:\s*'CmdOrCtrl\+Shift\+H'/, 'HTML accelerator');
  has(MAIN, /label:\s*'导出 Word\.\.\.',\s*\n\s*accelerator:\s*'CmdOrCtrl\+Shift\+E'/, 'Word accelerator');
});

group('C5 src/types/index.ts');

check('ElectronFileResult 新增可选 cancelled?', () =>
  has(TYPES, /interface ElectronFileResult\s*\{[\s\S]*?cancelled\?:\s*boolean;[\s\S]*?\}/, 'cancelled?')
);
check('新增类型 ElectronSaveFilter { name, extensions }', () =>
  has(TYPES, /interface ElectronSaveFilter\s*\{\s*name:\s*string;\s*extensions:\s*string\[\];\s*\}/, 'ElectronSaveFilter')
);
check('ElectronAPI.exportDocument 签名含 filters?: ElectronSaveFilter[]', () =>
  has(TYPES, /exportDocument:\s*\(data:\s*\{[\s\S]*?filters\?:\s*ElectronSaveFilter\[\];[\s\S]*?\}\)/, 'exportDocument 签名')
);
check('ElectronAPI 含 onMenuExportHtml / onMenuExportWord', () => {
  has(TYPES, /onMenuExportHtml:\s*\(callback:\s*\(\)\s*=>\s*void\)\s*=>\s*void/, 'onMenuExportHtml');
  has(TYPES, /onMenuExportWord:\s*\(callback:\s*\(\)\s*=>\s*void\)\s*=>\s*void/, 'onMenuExportWord');
});

group('C6 双路径闭环 + 样式剔除');

check('export.ts 内 Electron 分支调用 electronAPI.exportDocument', () =>
  has(EXPORT_TS, /window\.electronAPI\.exportDocument\(\{[\s\S]*?content,[\s\S]*?defaultName:\s*fileName,[\s\S]*?filters,/, 'Electron 分支')
);
check('export.ts 内 Web 分支走 Blob + <a download>', () => {
  has(EXPORT_TS, /new Blob\(\[content\],\s*\{\s*type:\s*`\$\{mimeType\};charset=utf-8`\s*\}\)/, 'Blob 构造');
  has(EXPORT_TS, /a\.download = fileName/, 'a.download');
  has(EXPORT_TS, /URL\.revokeObjectURL\(url\)/, 'revokeObjectURL 释放');
});
check('运行时判定优先 Electron，且做了函数存在性检查', () =>
  has(EXPORT_TS, /isElectronRuntime\(\)\s*&&\s*typeof window\.electronAPI\?\.exportDocument === 'function'/, '双重判定')
);
check('index.css 中确实存在 @media print（说明剔除动作有意义）', () =>
  has(INDEX_CSS, /@media print/, 'index.css @media print')
);
check('index.css 中确实存在 ::-webkit-scrollbar', () =>
  has(INDEX_CSS, /::-webkit-scrollbar/, 'index.css scrollbar')
);
check('PREVIEW_STYLES 已剔除 @media print 与 ::-webkit-scrollbar', () => {
  const m = EXPORT_TS.match(/export const PREVIEW_STYLES = `([\s\S]*?)`\.trim\(\)/);
  assert(m, '未找到 PREVIEW_STYLES');
  assert(!/@media print/.test(m[1]), 'PREVIEW_STYLES 仍含 @media print');
  assert(!/::-webkit-scrollbar/.test(m[1]), 'PREVIEW_STYLES 仍含 ::-webkit-scrollbar');
});

/* ================= D. 回归 ================= */

group('D 回归：PDF 导出与既有快捷键');

const KEY_HANDLER = (APP.match(
  /const handler = \(e: KeyboardEvent\) => \{[\s\S]*?\n {4}\};/
) || [''])[0];

check('handleExportPDF 函数体保持原逻辑（printToPDF / window.print）', () => {
  const m = APP.match(/const handleExportPDF = useCallback\([\s\S]*?\n {2}\}, \[mode, fileState\.name\]\);/);
  assert(m, '未找到 handleExportPDF');
  assert(/electronAPI\.exportPDF\(\{ defaultName: fileState\.name \}\)/.test(m[0]), 'Electron printToPDF 分支被改动');
  assert(/window\.print\(\)/.test(m[0]), 'Web window.print 分支被改动');
  assert(/setMode\(prevMode\)/.test(m[0]), 'PDF 导出未复原 mode');
});
check('Ctrl+E（无 Shift）仍走 handleExportPDF', () => {
  const m = KEY_HANDLER.match(/isMod && \(e\.key === 'e' \|\| e\.key === 'E'\)\)\s*\{([\s\S]*?)\n {6}\}/);
  assert(m, '未找到 Ctrl+E 分支');
  assert(/if \(e\.shiftKey\) \{\s*\n\s*handleExportWord\(\);\s*\n\s*\} else \{\s*\n\s*handleExportPDF\(\);/.test(m[1]),
    `Ctrl+E 分流逻辑异常：${m[1].trim()}`);
});
check('Ctrl+Shift+E 走 handleExportWord', () =>
  assert(/e\.shiftKey\) \{\s*\n\s*handleExportWord\(\);/.test(KEY_HANDLER), 'Shift+E 未分流到 Word')
);
check('Ctrl+Shift+H 走 handleExportHtml', () =>
  has(KEY_HANDLER, /isMod && e\.shiftKey && \(e\.key === 'h' \|\| e\.key === 'H'\)\)\s*\{[\s\S]*?handleExportHtml\(\)/, 'Shift+H 分支')
);
check('Ctrl+S / Ctrl+Shift+S 保存逻辑未被破坏', () =>
  has(KEY_HANDLER, /e\.key === 's' \|\| e\.key === 'S'[\s\S]*?if \(e\.shiftKey\) \{\s*\n\s*handleSaveAs\(\);\s*\n\s*\} else \{\s*\n\s*handleSave\(\);/, 'Ctrl+S 分支')
);
check('Ctrl+N / Ctrl+O 未被破坏', () => {
  has(KEY_HANDLER, /e\.key === 'n' \|\| e\.key === 'N'[\s\S]{0,80}handleNew\(\)/, 'Ctrl+N');
  has(KEY_HANDLER, /e\.key === 'o' \|\| e\.key === 'O'[\s\S]{0,80}handleOpen\(\)/, 'Ctrl+O');
});
check('快捷键分支互斥：Shift+H/Shift+W 早于裸 e/E 分支求值', () => {
  const hIdx = KEY_HANDLER.indexOf("e.key === 'h'");
  const eIdx = KEY_HANDLER.indexOf("e.key === 'e'");
  assert(hIdx > -1 && eIdx > hIdx, `分支顺序会导致 Shift+H 被吞：h=${hIdx} e=${eIdx}`);
});
check('原有 isExporting（PDF）state 与 onExportPDF prop 未被移除', () => {
  has(APP, /const \[isExporting, setIsExporting\] = useState\(false\)/, 'isExporting state');
  has(APP, /onExportPDF=\{handleExportPDF\}/, 'onExportPDF prop');
  has(APP, /isExporting=\{isExporting\}/, 'isExporting prop');
});
check('menu:exportPDF 通道与 CmdOrCtrl+E 加速器未变', () =>
  has(MAIN, /label:\s*'导出 PDF\.\.\.',\s*\n\s*accelerator:\s*'CmdOrCtrl\+E',\s*\n\s*click:[\s\S]{0,80}?send\('menu:exportPDF'\)/, 'PDF 菜单项')
);
check('export:pdf handler 未被改动', () =>
  has(MAIN, /ipcMain\.handle\('export:pdf'[\s\S]*?printToPDF/, 'export:pdf handler')
);
check('useFileSystem.ts 未改动（git 工作区无该文件修改）', () => {
  // 由 git status 佐证；此处静态校验其未引入 export 相关代码
  const fsHook = read('src/hooks/useFileSystem.ts');
  assert(!/exportDocument|exportHtml|exportWord/.test(fsHook), 'useFileSystem 意外引入导出逻辑');
});

/* ================= 汇总 ================= */

let pass = 0, fail = 0;
const failures = [];
console.log('\n========== A/C/D 静态审查（读实际源文件） ==========\n');
for (const r of results) {
  if (r.type === 'group') {
    console.log(`\n--- ${r.name} ---`);
    continue;
  }
  if (r.ok) {
    pass++;
    console.log(`  PASS  ${r.name}`);
  } else {
    fail++;
    failures.push(r);
    console.log(`  FAIL  ${r.name}`);
    console.log(`        └─ ${r.err}`);
  }
}
console.log('\n===================================================');
console.log(`总计 ${pass + fail} 项：PASS ${pass} / FAIL ${fail}`);
if (fail) {
  console.log('\n失败明细：');
  failures.forEach((f) => console.log(`  [${f.group}] ${f.name}\n      ${f.err}`));
}
console.log('===================================================\n');
process.exit(fail > 0 ? 1 : 0);
