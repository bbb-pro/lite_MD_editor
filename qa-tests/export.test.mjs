/**
 * QA 测试套件 —— 「导出 Word / HTML」增量功能
 * 负责人：严过关 (Yan) / QA
 *
 * 被测对象：src/utils/export.ts（经 esbuild 打包为 .build/export.bundle.mjs）
 *
 * 运行方式：
 *   npx esbuild src/utils/export.ts --bundle --format=esm --platform=neutral \
 *       --outfile=qa-tests/.build/export.bundle.mjs
 *   node qa-tests/export.test.mjs
 *
 * 覆盖范围：
 *   B1  buildStandaloneHtml   —— 结构 / 样式内联 / 排除项
 *   B2  buildWordDocument     —— Word 命名空间 / mso 条件注释 / 排除项
 *   B3  adaptHtmlForWord      —— 复选框转字形、代码语言角标剔除
 *   B4  stripMarkdownExtension—— 扩展名剥离与回落
 *   B5  escapeHtml            —— HTML 实体转义
 *   B6  exportHtml/exportWord —— Web Blob 下载路径
 *   B7  exportHtml/exportWord —— Electron IPC 路径（含取消 / 失败 / 异常）
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE = path.join(HERE, '.build', 'export.bundle.mjs');

const mod = await import('file://' + BUNDLE.replace(/\\/g, '/'));

/* ------------------------------------------------------------------ */
/* 迷你断言框架                                                         */
/* ------------------------------------------------------------------ */

const results = [];
let currentGroup = '';

function group(name) {
  currentGroup = name;
  results.push({ type: 'group', name });
}

function check(name, fn) {
  try {
    const r = fn();
    if (r === false) throw new Error('断言返回 false');
    results.push({ type: 'test', group: currentGroup, name, ok: true });
  } catch (err) {
    results.push({
      type: 'test',
      group: currentGroup,
      name,
      ok: false,
      err: err && err.message ? err.message : String(err),
    });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || '断言失败');
}
function contains(haystack, needle, label) {
  assert(
    String(haystack).includes(needle),
    `${label || '输出'} 应包含 ${JSON.stringify(needle)}，实际未找到`
  );
}
function notContains(haystack, needle, label) {
  assert(
    !String(haystack).includes(needle),
    `${label || '输出'} 不应包含 ${JSON.stringify(needle)}，但实际出现了`
  );
}
function eq(actual, expected, label) {
  assert(
    actual === expected,
    `${label || '值'} 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`
  );
}

/* ------------------------------------------------------------------ */
/* 测试夹具                                                             */
/* ------------------------------------------------------------------ */

const SAMPLE_HTML = '<h1>标题</h1><p>正文 <strong>粗体</strong></p>';

/**
 * adaptHtmlForWord 未从模块导出（见 B3-0）。
 * 为仍能验证其行为，通过 buildWordDocument 的产物反解出 <article> 内容。
 */
function adaptViaWordDocument(html) {
  const doc = mod.buildWordDocument(html, 'probe');
  const m = doc.match(/<article[^>]*>\n([\s\S]*?)\n<\/article>/);
  if (!m) throw new Error('无法从 buildWordDocument 产物中提取 <article> 正文');
  return m[1];
}

const adaptDirect = typeof mod.adaptHtmlForWord === 'function';
const adapt = adaptDirect ? mod.adaptHtmlForWord : adaptViaWordDocument;

/* ------------------------------------------------------------------ */
/* B1  buildStandaloneHtml                                             */
/* ------------------------------------------------------------------ */

group('B1 buildStandaloneHtml(previewHtml, title)');

const stdHtml = mod.buildStandaloneHtml(SAMPLE_HTML, 't');

check('以 <!DOCTYPE html 开头', () => {
  assert(
    stdHtml.startsWith('<!DOCTYPE html'),
    `应以 "<!DOCTYPE html" 开头，实际开头为 ${JSON.stringify(stdHtml.slice(0, 30))}`
  );
});
check('包含 <title>t</title>', () => contains(stdHtml, '<title>t</title>'));
check('包含 <article class="markdown-preview"', () =>
  contains(stdHtml, '<article class="markdown-preview"')
);
check('包含内联 <style> 块', () => {
  contains(stdHtml, '<style>');
  contains(stdHtml, '</style>');
  contains(stdHtml, '.markdown-preview h1', '内联样式');
});
check('不包含 @media print', () => notContains(stdHtml, '@media print'));
check('不包含 ::-webkit-scrollbar', () => notContains(stdHtml, '::-webkit-scrollbar'));
check('包含传入的 previewHtml 原文', () => contains(stdHtml, SAMPLE_HTML));
check('包含 charset=utf-8 声明', () => contains(stdHtml, 'charset="utf-8"') || contains(stdHtml, 'charset='));
check('[加测] title 做了 HTML 转义（防注入）', () => {
  const evil = mod.buildStandaloneHtml('<p>x</p>', '<script>alert(1)</script>');
  notContains(evil, '<title><script>', 'title');
  contains(evil, '&lt;script&gt;', 'title');
});
check('[加测] 空 title 回落为 Document', () =>
  contains(mod.buildStandaloneHtml('<p>x</p>', ''), '<title>Document</title>')
);
check('[加测] 文档结构闭合完整', () => {
  contains(stdHtml, '</article>');
  contains(stdHtml, '</body>');
  assert(stdHtml.trimEnd().endsWith('</html>'), '应以 </html> 结尾');
});

/* ------------------------------------------------------------------ */
/* B2  buildWordDocument                                               */
/* ------------------------------------------------------------------ */

group('B2 buildWordDocument(previewHtml, title)');

const wordDoc = mod.buildWordDocument(SAMPLE_HTML, 't');

check('包含 Word 命名空间 (urn:...:office:word 或 xmlns:w=)', () => {
  assert(
    wordDoc.includes('urn:schemas-microsoft-com:office:word') || wordDoc.includes('xmlns:w='),
    'Word 命名空间声明缺失'
  );
});
check('包含 <!--[if gte mso 9] 条件注释', () => contains(wordDoc, '<!--[if gte mso 9]'));
check('包含内联 <style> 块', () => {
  contains(wordDoc, '<style>');
  contains(wordDoc, '.markdown-preview h1', '内联样式');
});
check('不包含 @media print', () => notContains(wordDoc, '@media print'));
check('不包含 ::-webkit-scrollbar', () => notContains(wordDoc, '::-webkit-scrollbar'));
check('包含传入的 previewHtml 原文', () => contains(wordDoc, SAMPLE_HTML));
check('包含 <title>t</title>', () => contains(wordDoc, '<title>t</title>'));
check('[加测] 含 Word 专属补充样式 @page', () => contains(wordDoc, '@page'));
check('[加测] title 做了 HTML 转义', () =>
  contains(mod.buildWordDocument('<p>x</p>', 'a&b'), 'a&amp;b')
);

/* ------------------------------------------------------------------ */
/* B3  adaptHtmlForWord                                                */
/* ------------------------------------------------------------------ */

group('B3 adaptHtmlForWord(html)');

check('B3-0 adaptHtmlForWord 已从模块导出（可直接单测）', () => {
  assert(
    adaptDirect,
    'src/utils/export.ts 中 adaptHtmlForWord 声明为模块私有函数（第373行 `function adaptHtmlForWord`），' +
      '未加 export，无法按验收要求直接单测；本套件已改为经 buildWordDocument 间接验证其行为'
  );
});

const adapted = adapt('<input type="checkbox" checked> <input type="checkbox">');

check('已勾选复选框 -> ☑（或实体 &#9745;）', () => {
  assert(
    adapted.includes('☑') || adapted.includes('&#9745;') || adapted.includes('&#x2611;'),
    `未找到 ☑ 字形/实体，实际输出：${adapted}`
  );
});
check('未勾选复选框 -> ☐（或实体 &#9744;）', () => {
  assert(
    adapted.includes('☐') || adapted.includes('&#9744;') || adapted.includes('&#x2610;'),
    `未找到 ☐ 字形/实体，实际输出：${adapted}`
  );
});
check('输出不再含 <input 标签', () => notContains(adapted, '<input', '转换结果'));
check('[加测] 非 checkbox 的 input 保持原样', () => {
  const out = adapt('<input type="text" value="x">');
  contains(out, '<input', '非 checkbox input');
});
check('[加测] 剔除代码块语言角标 md-code-lang', () => {
  const out = adapt('<div class="md-code-block"><span class="md-code-lang">js</span><code>a</code></div>');
  notContains(out, 'md-code-lang', '转换结果');
  contains(out, '<code>a</code>', '转换结果');
});
check('[加测] 普通 HTML 不被破坏', () => eq(adapt('<p>hello</p>'), '<p>hello</p>', 'adapt 输出'));

/* ------------------------------------------------------------------ */
/* B4  stripMarkdownExtension                                          */
/* ------------------------------------------------------------------ */

group('B4 stripMarkdownExtension(name)');

check("'a.MD' -> 'a'（大小写不敏感）", () => eq(mod.stripMarkdownExtension('a.MD'), 'a'));
check("'b.markdown' -> 'b'", () => eq(mod.stripMarkdownExtension('b.markdown'), 'b'));
check("'c.txt' -> 'c'", () => eq(mod.stripMarkdownExtension('c.txt'), 'c'));
check("'' -> 'export'（空串回落）", () => eq(mod.stripMarkdownExtension(''), 'export'));
check("'readme' -> 'readme'（无扩展名保持原样）", () =>
  eq(mod.stripMarkdownExtension('readme'), 'readme')
);
check("'   ' -> 'export'（纯空白回落）", () => eq(mod.stripMarkdownExtension('   '), 'export'));
check("'.md' -> 'export'（仅扩展名回落）", () => eq(mod.stripMarkdownExtension('.md'), 'export'));
check("[加测] 'my.notes.md' -> 'my.notes'（只剥最后一段）", () =>
  eq(mod.stripMarkdownExtension('my.notes.md'), 'my.notes')
);
check("[加测] 'report.pdf' -> 'report.pdf'（非 md 扩展名不剥离）", () =>
  eq(mod.stripMarkdownExtension('report.pdf'), 'report.pdf')
);

/* ------------------------------------------------------------------ */
/* B5  escapeHtml                                                      */
/* ------------------------------------------------------------------ */

group('B5 escapeHtml(text)');

const esc = mod.escapeHtml('<a>&"');

check('转义 < 为 &lt;', () => contains(esc, '&lt;'));
check('转义 > 为 &gt;', () => contains(esc, '&gt;'));
check('转义 & 为 &amp;', () => contains(esc, '&amp;'));
check('转义 " 为 &quot;', () => contains(esc, '&quot;'));
check("[加测] 转义 ' 为 &#39;", () => contains(mod.escapeHtml("it's"), '&#39;'));
check('[加测] & 先于其他字符转义（无双重转义）', () =>
  eq(mod.escapeHtml('<'), '&lt;', 'escapeHtml("<")')
);
check('[加测] 纯文本不被改动', () => eq(mod.escapeHtml('hello 世界'), 'hello 世界'));

/* ------------------------------------------------------------------ */
/* B6  Web 导出路径（Blob 下载）                                        */
/* ------------------------------------------------------------------ */

group('B6 exportHtml / exportWord —— Web Blob 下载路径');

/** 安装一套最小 DOM 桩，捕获 Blob 下载行为。 */
function installWebStubs() {
  const captured = { blobParts: null, blobType: null, download: null, clicked: 0, revoked: 0 };

  class FakeBlob {
    constructor(parts, opts) {
      captured.blobParts = parts;
      captured.blobType = opts && opts.type;
      this.parts = parts;
    }
  }

  const anchor = {
    href: '',
    download: '',
    style: {},
    click() {
      captured.clicked += 1;
      captured.download = anchor.download;
    },
    remove() {},
  };

  globalThis.Blob = FakeBlob;
  globalThis.URL = {
    createObjectURL: () => 'blob:fake-url',
    revokeObjectURL: () => {
      captured.revoked += 1;
    },
  };
  globalThis.document = {
    createElement: () => anchor,
    body: { appendChild() {} },
  };
  // 关键：非 Electron 环境
  globalThis.window = { electronAPI: undefined };

  return captured;
}

function clearStubs() {
  delete globalThis.Blob;
  delete globalThis.URL;
  delete globalThis.document;
  delete globalThis.window;
}

{
  const cap = installWebStubs();
  const res = await mod.exportHtml(SAMPLE_HTML, 'readme.md');

  check('exportHtml 返回 success:true', () => eq(res.success, true, 'res.success'));
  check('exportHtml 下载文件名为 readme.html（已剥离 .md）', () =>
    eq(cap.download, 'readme.html', '下载文件名')
  );
  check('exportHtml Blob MIME 为 text/html;charset=utf-8', () =>
    eq(cap.blobType, 'text/html;charset=utf-8', 'Blob type')
  );
  check('exportHtml 触发了一次 a.click()', () => eq(cap.clicked, 1, 'click 次数'));
  check('exportHtml Blob 内容为完整 HTML 文档', () => {
    const content = cap.blobParts[0];
    assert(content.startsWith('<!DOCTYPE html'), 'Blob 内容非完整 HTML 文档');
    contains(content, SAMPLE_HTML, 'Blob 内容');
  });
  clearStubs();
}

{
  const cap = installWebStubs();
  const res = await mod.exportWord(SAMPLE_HTML, 'notes.markdown');

  check('exportWord 返回 success:true', () => eq(res.success, true, 'res.success'));
  check('exportWord 下载文件名为 notes.doc', () => eq(cap.download, 'notes.doc', '下载文件名'));
  check('exportWord Blob MIME 为 application/msword;charset=utf-8', () =>
    eq(cap.blobType, 'application/msword;charset=utf-8', 'Blob type')
  );
  check('exportWord Blob 内容为 Word 文档', () => {
    const content = cap.blobParts[0];
    contains(content, 'xmlns:w=', 'Blob 内容');
    contains(content, '<!--[if gte mso 9]', 'Blob 内容');
  });
  clearStubs();
}

/* ------------------------------------------------------------------ */
/* B7  Electron 导出路径（IPC）                                         */
/* ------------------------------------------------------------------ */

group('B7 exportHtml / exportWord —— Electron IPC 路径');

/** 安装 Electron 桩，exportDocument 返回 `reply`（或抛出 throwErr）。 */
function installElectronStubs(reply, throwErr) {
  const calls = [];
  globalThis.window = {
    electronAPI: {
      isElectron: true,
      exportDocument: async (data) => {
        calls.push(data);
        if (throwErr) throw throwErr;
        return reply;
      },
    },
  };
  globalThis.document = {
    createElement: () => {
      throw new Error('Electron 路径下不应触发 Web 下载');
    },
    body: { appendChild() {} },
  };
  return calls;
}

{
  const calls = installElectronStubs({ success: true, path: 'D:\\out\\readme.html' });
  const res = await mod.exportHtml(SAMPLE_HTML, 'readme.md');

  check('Electron: 调用了 electronAPI.exportDocument 一次', () => eq(calls.length, 1, '调用次数'));
  check('Electron: 透传 content / defaultName', () => {
    eq(calls[0].defaultName, 'readme.html', 'defaultName');
    assert(calls[0].content.startsWith('<!DOCTYPE html'), 'content 非完整 HTML');
  });
  check('Electron: 透传 filters（HTML 过滤器 + 所有文件）', () => {
    const f = calls[0].filters;
    assert(Array.isArray(f) && f.length >= 1, 'filters 应为非空数组');
    assert(
      f.some((x) => x.extensions.includes('html')),
      'filters 应含 html 扩展名'
    );
    assert(
      f.some((x) => x.extensions.includes('*')),
      'filters 应含「所有文件」兜底'
    );
  });
  check('Electron: 成功时返回 success:true 且带 path', () => {
    eq(res.success, true, 'res.success');
    eq(res.path, 'D:\\out\\readme.html', 'res.path');
  });
  clearStubs();
}

{
  const calls = installElectronStubs({ success: true, path: 'D:\\out\\notes.doc' });
  await mod.exportWord(SAMPLE_HTML, 'notes.md');
  check('Electron: exportWord 使用 .doc 默认名与 doc 过滤器', () => {
    eq(calls[0].defaultName, 'notes.doc', 'defaultName');
    assert(
      calls[0].filters.some((x) => x.extensions.includes('doc')),
      'filters 应含 doc 扩展名'
    );
  });
  clearStubs();
}

{
  installElectronStubs({ success: false, cancelled: true });
  const res = await mod.exportHtml(SAMPLE_HTML, 'a.md');
  check('Electron: 用户取消 -> success:false, cancelled:true', () => {
    eq(res.success, false, 'res.success');
    eq(res.cancelled, true, 'res.cancelled');
  });
  clearStubs();
}

{
  installElectronStubs(null);
  const res = await mod.exportHtml(SAMPLE_HTML, 'a.md');
  check('Electron: 返回 null -> 视为取消', () => {
    eq(res.success, false, 'res.success');
    eq(res.cancelled, true, 'res.cancelled');
  });
  clearStubs();
}

{
  installElectronStubs({ success: false, error: '磁盘只读' });
  const res = await mod.exportHtml(SAMPLE_HTML, 'a.md');
  check('Electron: 主进程写入失败 -> 透传 error', () => {
    eq(res.success, false, 'res.success');
    eq(res.error, '磁盘只读', 'res.error');
  });
  clearStubs();
}

{
  installElectronStubs(undefined, new Error('IPC 通道断开'));
  const res = await mod.exportHtml(SAMPLE_HTML, 'a.md');
  check('Electron: IPC 抛异常 -> 被捕获并返回 error（不外抛）', () => {
    eq(res.success, false, 'res.success');
    contains(res.error, 'IPC 通道断开', 'res.error');
  });
  clearStubs();
}

/* ------------------------------------------------------------------ */
/* 汇总输出                                                             */
/* ------------------------------------------------------------------ */

let pass = 0;
let fail = 0;
const failures = [];

console.log('\n================ B. 纯函数 / 导出路径单元测试 ================\n');

for (const r of results) {
  if (r.type === 'group') {
    console.log(`\n--- ${r.name} ---`);
    continue;
  }
  if (r.ok) {
    pass += 1;
    console.log(`  PASS  ${r.name}`);
  } else {
    fail += 1;
    failures.push(r);
    console.log(`  FAIL  ${r.name}`);
    console.log(`        └─ ${r.err}`);
  }
}

console.log('\n==============================================================');
console.log(`总计 ${pass + fail} 项：PASS ${pass} / FAIL ${fail}`);
if (fail > 0) {
  console.log('\n失败明细：');
  for (const f of failures) {
    console.log(`  [${f.group}] ${f.name}\n      ${f.err}`);
  }
}
console.log('==============================================================\n');

process.exit(fail > 0 ? 1 : 0);
