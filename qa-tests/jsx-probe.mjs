/**
 * Test shim for `react/jsx-runtime`.
 *
 * esbuild aliases `react/jsx-runtime` to this module when bundling App.tsx for
 * tests, so every JSX element created during a render pass is recorded. This
 * lets the tests grab the *real* handler closures off the root <div> instead of
 * re-implementing them.
 */

import { createElement, Fragment as ReactFragment } from 'react';

// Shared through globalThis: this module is inlined into the test bundle, so
// the test file cannot import the array directly.
globalThis.__JSX_RECORDS__ = globalThis.__JSX_RECORDS__ || [];
export const records = globalThis.__JSX_RECORDS__;

export function resetRecords() {
  records.length = 0;
}

function record(type, props, key) {
  records.push({ type, props: props ?? {} });
  const { children, ...rest } = props ?? {};
  return createElement(type, key === undefined ? rest : { ...rest, key }, children);
}

export function jsx(type, props, key) {
  return record(type, props, key);
}

export function jsxs(type, props, key) {
  return record(type, props, key);
}

export function jsxDEV(type, props, key) {
  return record(type, props, key);
}

export const Fragment = ReactFragment;
