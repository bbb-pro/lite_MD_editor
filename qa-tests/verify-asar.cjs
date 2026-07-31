/**
 * Verifies that the packaged Electron app.asar actually contains the
 * drag-and-drop implementation (guards against a stale dist being packaged).
 */
const path = require('path');
const asar = require('@electron/asar');

const archive = process.argv[2];
const entry = path.join('dist', 'assets', 'index-CmGpeUJH.js');
const bundle = asar.extractFile(archive, entry).toString('utf8');

const checks = {
  'overlay text': '松开以打开文件',
  'unsupported-file alert': '只支持打开',
  'read-failure alert': '读取文件失败',
  'dirty-state confirm': '确定要打开拖入的文件吗',
  onDragEnter: 'onDragEnter',
  onDragOver: 'onDragOver',
  onDragLeave: 'onDragLeave',
  onDrop: 'onDrop',
};

let failed = 0;
console.log('bundle bytes:', bundle.length);
for (const [label, needle] of Object.entries(checks)) {
  const ok = bundle.includes(needle);
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
}
process.exit(failed === 0 ? 0 : 1);
