/**
 * QA tests — drag & drop open feature (App.tsx layer).
 *
 * App.tsx is bundled with `react/jsx-runtime` aliased to ./jsx-probe.mjs, so a
 * single react-dom/server render pass exposes the real props of the root <div>
 * (the actual handler closures) and of the drag overlay.
 *
 * State updates (setIsDragging) are not observable in a server render, so the
 * overlay state machine is covered by:
 *   - behavioural assertions on the observable side effects, and
 *   - a source-contract check plus a faithful simulation of the counter logic.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './.build/App.mjs';

const APP_SRC = readFileSync(
  fileURLToPath(new URL('../src/App.tsx', import.meta.url)),
  'utf-8'
);

/* ---------- Render once, capture the recorded elements ---------- */

const records = globalThis.__JSX_RECORDS__;
records.length = 0;
const markup = renderToStaticMarkup(createElement(App));

const rootRecord = records.find((r) => r.props && typeof r.props.onDrop === 'function');
const overlayRecord = records.find(
  (r) => typeof r.props?.className === 'string' && r.props.className.includes('z-50')
);

/* ---------- Mock event factory ---------- */

function makeEvent({ files = [], types = ['Files'], relatedTarget = null, contains = () => false } = {}) {
  const calls = { preventDefault: 0, stopPropagation: 0 };
  const fileList = { length: files.length, item: (i) => files[i] ?? null };
  files.forEach((f, i) => {
    fileList[i] = f;
  });
  return {
    calls,
    preventDefault: () => {
      calls.preventDefault += 1;
    },
    stopPropagation: () => {
      calls.stopPropagation += 1;
    },
    dataTransfer: { types, files: fileList, dropEffect: 'none' },
    relatedTarget,
    currentTarget: { contains },
  };
}

function fakeFile(name, content = 'body') {
  return { name, async text() { return content; } };
}

/** Install a fake `window` for handlers that call alert/confirm. */
function withWindow(stubs, fn) {
  const had = 'window' in globalThis;
  const previous = globalThis.window;
  globalThis.window = { alert: () => {}, confirm: () => true, ...stubs };
  try {
    return fn();
  } finally {
    if (had) globalThis.window = previous;
    else delete globalThis.window;
  }
}

/* ---------- 1. Wiring ---------- */

test('root container binds all four drag handlers', () => {
  assert.ok(rootRecord, 'no element with onDrop was rendered');
  for (const key of ['onDragEnter', 'onDragOver', 'onDragLeave', 'onDrop']) {
    assert.equal(typeof rootRecord.props[key], 'function', `missing ${key}`);
  }
  assert.equal(rootRecord.type, 'div');
  assert.ok(
    String(rootRecord.props.className).includes('h-screen'),
    'handlers must sit on the full-height root container so the whole window is a drop zone'
  );
});

test('handlers are on the outermost JSX element of App', () => {
  // The root <div ...> must be the element that directly precedes <TitleBar />.
  const rootDivIndex = APP_SRC.indexOf('className="flex flex-col h-screen');
  const titleBarIndex = APP_SRC.indexOf('<TitleBar');
  assert.ok(rootDivIndex > -1 && titleBarIndex > rootDivIndex);
  const between = APP_SRC.slice(rootDivIndex, titleBarIndex);
  for (const key of ['onDragEnter', 'onDragOver', 'onDragLeave', 'onDrop']) {
    assert.ok(between.includes(key), `${key} is not bound on the outermost div`);
  }
});

/* ---------- 2. dragover ---------- */

test('dragover calls preventDefault and sets dropEffect=copy', () => {
  const e = makeEvent();
  rootRecord.props.onDragOver(e);
  assert.equal(e.calls.preventDefault, 1, 'without preventDefault the drop event never fires');
  assert.equal(e.dataTransfer.dropEffect, 'copy');
});

test('dragover tolerates a missing dataTransfer', () => {
  const e = makeEvent();
  e.dataTransfer = null;
  assert.doesNotThrow(() => rootRecord.props.onDragOver(e));
  assert.equal(e.calls.preventDefault, 1);
});

/* ---------- 3. dragenter / dragleave ---------- */

test('dragenter calls preventDefault for file drags', () => {
  const e = makeEvent({ types: ['Files'] });
  rootRecord.props.onDragEnter(e);
  assert.equal(e.calls.preventDefault, 1);
});

test('dragenter ignores non-file drags (e.g. selected text)', () => {
  const e = makeEvent({ types: ['text/plain'] });
  assert.doesNotThrow(() => rootRecord.props.onDragEnter(e));
});

test('dragleave tolerates a null relatedTarget (pointer left the window)', () => {
  const e = makeEvent({ relatedTarget: null });
  assert.doesNotThrow(() => rootRecord.props.onDragLeave(e));
  assert.equal(e.calls.preventDefault, 1);
});

/* ---------- 4. drop ---------- */

test('drop calls preventDefault (blocks Electron/Chromium navigating to the file)', () => {
  const e = makeEvent({ files: [fakeFile('a.md')] });
  withWindow({}, () => rootRecord.props.onDrop(e));
  assert.equal(e.calls.preventDefault, 1);
});

test('drop alerts and aborts when no supported file is present', () => {
  const alerts = [];
  const e = makeEvent({ files: [fakeFile('photo.png')] });
  withWindow({ alert: (m) => alerts.push(m) }, () => rootRecord.props.onDrop(e));
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /\.md/);
});

test('drop with an empty payload is a no-op (no alert)', () => {
  const alerts = [];
  const e = makeEvent({ files: [] });
  withWindow({ alert: (m) => alerts.push(m) }, () => rootRecord.props.onDrop(e));
  assert.equal(alerts.length, 0);
});

test('drop does not prompt for confirmation on a clean document', () => {
  let confirmCalls = 0;
  const e = makeEvent({ files: [fakeFile('clean.md')] });
  withWindow({ confirm: () => { confirmCalls += 1; return true; } }, () =>
    rootRecord.props.onDrop(e)
  );
  assert.equal(confirmCalls, 0, 'initial state is not dirty, so no confirm should appear');
});

test('drop snapshots dataTransfer.files synchronously before any await/confirm', () => {
  // Contract check: Array.from(...) must happen before the confirm() branch,
  // otherwise the payload is already detached when the user answers the dialog.
  const body = APP_SRC.slice(APP_SRC.indexOf('const handleDrop'), APP_SRC.indexOf('/* ---------- Save'));
  const snapshotAt = body.indexOf('Array.from(e.dataTransfer');
  const confirmAt = body.indexOf('window.confirm');
  const awaitAt = body.indexOf('await openFileFromDrop');
  assert.ok(snapshotAt > -1, 'files are not snapshotted with Array.from');
  assert.ok(confirmAt > snapshotAt, 'confirm() must come after the snapshot');
  assert.ok(awaitAt > snapshotAt, 'the async read must use the snapshot');
  assert.ok(
    !/openFileFromDrop\(\s*e\.dataTransfer/.test(body),
    'must not pass the live dataTransfer into the async read'
  );
});

test('drop survives a dataTransfer that is already detached', () => {
  const e = makeEvent();
  e.dataTransfer = null;
  assert.doesNotThrow(() => withWindow({}, () => rootRecord.props.onDrop(e)));
});

/* ---------- 5. Overlay ---------- */

test('overlay markup is hidden until a drag starts', () => {
  assert.ok(!markup.includes('松开以打开文件'), 'overlay must not render in the idle state');
});

test('overlay (when rendered) is non-interactive and full-screen', () => {
  // The overlay is inside `{isDragging && ...}` so it is absent from the idle
  // render — assert on the source contract instead.
  const overlay = APP_SRC.slice(
    APP_SRC.indexOf('{isDragging && ('),
    APP_SRC.indexOf('{!isSupported && (')
  );
  assert.ok(overlay.includes('pointer-events-none'), 'overlay must not swallow drag/drop events');
  assert.ok(overlay.includes('fixed inset-0'), 'overlay must cover the viewport');
  assert.ok(overlay.includes('z-50'));
  assert.ok(overlay.includes('松开以打开文件'));
  assert.equal(overlayRecord, undefined, 'no z-50 element should exist while idle');
});

/* ---------- 6. Drag-depth state machine ---------- */

/**
 * Faithful port of handleDragEnter / handleDragLeave / handleDrop from App.tsx.
 * `assertMirrorMatchesSource` below fails if the source logic drifts from it.
 */
function makeStateMachine() {
  let depth = 0;
  let dragging = false;
  return {
    get dragging() {
      return dragging;
    },
    get depth() {
      return depth;
    },
    enter({ hasFiles = true } = {}) {
      if (!hasFiles) return;
      depth += 1;
      dragging = true;
    },
    leave({ stillInside = false } = {}) {
      if (depth > 0) depth -= 1;
      if (depth === 0 || !stillInside) {
        depth = 0;
        dragging = false;
      }
    },
    drop() {
      depth = 0;
      dragging = false;
    },
  };
}

test('source contract: drag-depth logic matches the simulated state machine', () => {
  assert.ok(APP_SRC.includes('dragDepthRef.current += 1'));
  assert.ok(APP_SRC.includes('if (dragDepthRef.current > 0) {'));
  assert.ok(APP_SRC.includes('dragDepthRef.current -= 1'));
  assert.ok(APP_SRC.includes('if (dragDepthRef.current === 0 || !stillInside) {'));
  assert.ok(APP_SRC.includes('const stillInside = !!related && e.currentTarget.contains(related)'));
  assert.ok(/const \[isDragging, setIsDragging\] = useState\(false\)/.test(APP_SRC));
  assert.ok(/const dragDepthRef = useRef\(0\)/.test(APP_SRC));
});

test('overlay shows on enter and hides when the pointer leaves the window', () => {
  const sm = makeStateMachine();
  assert.equal(sm.dragging, false, 'initial state must be hidden');
  sm.enter();
  assert.equal(sm.dragging, true);
  sm.leave({ stillInside: false });
  assert.equal(sm.dragging, false);
  assert.equal(sm.depth, 0);
});

test('overlay does not flicker when crossing child elements', () => {
  const sm = makeStateMachine();
  sm.enter(); // enter root
  // enter child (bubbles) + leave root towards that child
  sm.enter();
  sm.leave({ stillInside: true });
  assert.equal(sm.dragging, true, 'overlay must stay visible while moving over children');
  // cross into a sibling child
  sm.enter();
  sm.leave({ stillInside: true });
  assert.equal(sm.dragging, true);
  // finally leave the window
  sm.leave({ stillInside: false });
  assert.equal(sm.dragging, false);
});

test('drop resets the depth counter so the next drag starts clean', () => {
  const sm = makeStateMachine();
  sm.enter();
  sm.enter();
  sm.drop();
  assert.equal(sm.depth, 0);
  assert.equal(sm.dragging, false);
  sm.enter();
  assert.equal(sm.dragging, true);
});

test('unbalanced dragleave events never drive the counter negative', () => {
  const sm = makeStateMachine();
  sm.leave({ stillInside: false });
  sm.leave({ stillInside: false });
  assert.equal(sm.depth, 0);
  sm.enter();
  assert.equal(sm.dragging, true, 'overlay still works after stray dragleave events');
});

test('non-file drags never show the overlay', () => {
  const sm = makeStateMachine();
  sm.enter({ hasFiles: false });
  assert.equal(sm.dragging, false);
  assert.equal(sm.depth, 0);
});

/* ---------- 7. Regression: existing features untouched ---------- */

test('existing app chrome still renders', () => {
  assert.ok(markup.includes('untitled.md'), 'TitleBar/StatusBar file name missing');
  assert.ok(markup.includes('<textarea'), 'Editor missing');
  assert.ok(markup.includes('在此输入 Markdown 内容'), 'Editor placeholder missing');
});

test('existing handlers and effects are still wired', () => {
  for (const snippet of [
    'const result = await openFile();',
    'await saveFile(',
    'await saveFileAs(',
    "window.addEventListener('keydown', handler)",
    "window.addEventListener('beforeunload', handler)",
    'electronAPI.onMenuOpen',
    'onExportPDF={handleExportPDF}',
  ]) {
    assert.ok(APP_SRC.includes(snippet), `regression — missing: ${snippet}`);
  }
});

test('no unused React imports were introduced', () => {
  const importLine = APP_SRC.match(/import \{([^}]+)\} from 'react';/)[1];
  for (const name of importLine.split(',').map((s) => s.trim())) {
    const uses = APP_SRC.split(new RegExp(`\\b${name}\\b`)).length - 1;
    assert.ok(uses > 1, `React import '${name}' appears unused`);
  }
});
