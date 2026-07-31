/**
 * QA tests — drag & drop open feature (useFileSystem layer).
 *
 * Runner: node --test (Node >= 18). No extra deps required.
 * The hook is bundled by esbuild into .build/useFileSystem.mjs first, then the
 * hook is executed inside a real React render pass via react-dom/server so that
 * useCallback / useMemo have a live dispatcher.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ACCEPTED_EXTENSIONS_RE,
  isAcceptedFileName,
  useFileSystem,
} from './.build/useFileSystem.mjs';

/* ---------- Helpers ---------- */

/** Minimal stand-in for a dropped File (only .name / .text() are used). */
function fakeFile(name, content = '# hello', opts = {}) {
  return {
    name,
    async text() {
      if (opts.throws) throw new Error('read failed');
      return content;
    },
  };
}

/** Build a FileList-like array-like object (what dataTransfer.files really is). */
function fakeFileList(files) {
  const list = { length: files.length, item: (i) => files[i] ?? null };
  files.forEach((f, i) => {
    list[i] = f;
  });
  return list;
}

/** Run useFileSystem() inside a real render pass and return its API object. */
function getFileSystemApi() {
  let api = null;
  function Probe() {
    api = useFileSystem();
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  assert.ok(api, 'useFileSystem() should return an API object');
  return api;
}

/* ---------- 1. Extension matching ---------- */

test('isAcceptedFileName accepts .md / .markdown / .txt (case-insensitive)', () => {
  const accepted = [
    'readme.md',
    'README.MD',
    'notes.Markdown',
    'notes.markdown',
    'plain.txt',
    'PLAIN.TXT',
    'my.notes.v2.md',
    '中文 文档 - 副本.md',
    '.md',
  ];
  for (const name of accepted) {
    assert.equal(isAcceptedFileName(name), true, `should accept: ${name}`);
  }
});

test('isAcceptedFileName rejects look-alike / unsupported extensions', () => {
  const rejected = [
    'a.mdxxx',
    'a.mdx',
    'a.markdownx',
    'a.txtx',
    'a.md.pdf',
    'a.txt.exe',
    'README',
    'md',
    'txt',
    'archive.zip',
    'image.png',
    'script.js',
    'a.md ', // trailing space is part of the name -> not an accepted extension
    '',
  ];
  for (const name of rejected) {
    assert.equal(isAcceptedFileName(name), false, `should reject: ${name}`);
  }
});

test('ACCEPTED_EXTENSIONS_RE is stateless (no /g flag) and anchored to the end', () => {
  assert.equal(ACCEPTED_EXTENSIONS_RE.global, false, 'must not use the /g flag');
  assert.equal(ACCEPTED_EXTENSIONS_RE.sticky, false, 'must not use the /y flag');
  assert.equal(ACCEPTED_EXTENSIONS_RE.ignoreCase, true);
  assert.equal(ACCEPTED_EXTENSIONS_RE.source.endsWith('$'), true);
  // Repeated calls must be stable (lastIndex must not drift).
  for (let i = 0; i < 5; i += 1) {
    assert.equal(ACCEPTED_EXTENSIONS_RE.test('a.md'), true, `run #${i}`);
  }
});

/* ---------- 2. openFileFromDrop ---------- */

test('openFileFromDrop is exported by the hook', () => {
  const api = getFileSystemApi();
  assert.equal(typeof api.openFileFromDrop, 'function');
  // Existing API must remain intact (no regression).
  for (const key of ['isSupported', 'openFile', 'saveFile', 'saveFileAs']) {
    assert.ok(key in api, `missing existing API: ${key}`);
  }
});

test('openFileFromDrop reads the first accepted file from an array', async () => {
  const api = getFileSystemApi();
  const result = await api.openFileFromDrop([fakeFile('doc.md', '# Title')]);
  assert.deepEqual(result, { name: 'doc.md', content: '# Title', handle: null });
});

test('openFileFromDrop reads from a FileList-like object', async () => {
  const api = getFileSystemApi();
  const list = fakeFileList([fakeFile('from-list.markdown', 'body')]);
  const result = await api.openFileFromDrop(list);
  assert.equal(result?.name, 'from-list.markdown');
  assert.equal(result?.content, 'body');
});

test('openFileFromDrop skips unsupported files and picks the first accepted one', async () => {
  const api = getFileSystemApi();
  const result = await api.openFileFromDrop([
    fakeFile('image.png', 'binary'),
    fakeFile('archive.zip', 'binary'),
    fakeFile('second.md', 'chosen'),
    fakeFile('third.md', 'not chosen'),
  ]);
  assert.equal(result?.name, 'second.md');
  assert.equal(result?.content, 'chosen');
});

test('openFileFromDrop returns null when nothing matches', async () => {
  const api = getFileSystemApi();
  assert.equal(await api.openFileFromDrop([fakeFile('a.png')]), null);
});

test('openFileFromDrop returns null for empty / nullish payloads without throwing', async () => {
  const api = getFileSystemApi();
  assert.equal(await api.openFileFromDrop([]), null);
  assert.equal(await api.openFileFromDrop(fakeFileList([])), null);
  assert.equal(await api.openFileFromDrop(null), null);
  assert.equal(await api.openFileFromDrop(undefined), null);
});

test('openFileFromDrop swallows read errors and returns null', async () => {
  const api = getFileSystemApi();
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    const result = await api.openFileFromDrop([fakeFile('boom.md', '', { throws: true })]);
    assert.equal(result, null, 'must not reject — the UI relies on null');
    assert.equal(logged.length, 1, 'failure should be logged once');
  } finally {
    console.error = originalError;
  }
});

test('openFileFromDrop always returns handle=null (drop cannot yield a FS handle)', async () => {
  const api = getFileSystemApi();
  const result = await api.openFileFromDrop([fakeFile('x.txt', 'plain')]);
  assert.equal(result?.handle, null);
});

test('openFileFromDrop preserves content verbatim (CRLF / unicode / empty)', async () => {
  const api = getFileSystemApi();
  const payload = '# 标题\r\n\r\n- [x] 任务\r\n\ttab\t\n😀 emoji';
  assert.equal((await api.openFileFromDrop([fakeFile('a.md', payload)]))?.content, payload);
  assert.equal((await api.openFileFromDrop([fakeFile('empty.md', '')]))?.content, '');
});
