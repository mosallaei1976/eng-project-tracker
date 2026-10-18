'use strict';
// Dependency-free regression checks. Run from this directory: node --test tests.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const landing = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('first run does not insert fictional projects', () => {
  assert.match(app, /if\s*\(!raw\)\s*\{\s*customers\s*=\s*\[\]\s*;\s*return\s*;\s*\}/);
  assert.doesNotMatch(app, /const defaultProjects\s*=\s*\[/);
});

test('legacy storage key remains unchanged', () => {
  assert.match(app, /const STORAGE_KEY\s*=\s*'crm_offline_customers_v2'/);
});

test('import validates IDs and rebuilds a known schema', () => {
  assert.match(app, /!\/\^\[A-Za-z0-9_-\]\{1,100\}\$\//);
  assert.match(app, /const clean = \{ id:c\.id \}/);
  assert.doesNotMatch(app, /return\s*\{\s*\.\.\.c\s*,/);
});

test('rendered data IDs are attribute-escaped', () => {
  assert.doesNotMatch(app, /data-id="\$\{c\.id\}"/);
  assert.doesNotMatch(app, /data-id="\$\{n\.id\}"/);
  assert.match(app, /function escapeAttr\(/);
});

test('form success is conditional on persistence', () => {
  assert.match(app, /if\(!saveData\(\)\)\{ loadData\(\); renderList\(\); return; \}/);
});

test('landing page app links have valid href attributes', () => {
  assert.doesNotMatch(landing, /<a\s+https:\/\//i);
  assert.match(landing, /href="https:\/\/mosallaei1976\.github\.io\/eng-project-tracker\/app\.html"/);
  assert.doesNotMatch(landing, /user-scalable=no/i);
});

test('service worker precaches app and scopes cache cleanup', () => {
  assert.match(sw, /new URL\('app\.html', SCOPE_URL\)/);
  assert.match(sw, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.match(sw, /const CACHE_VERSION = 'crm-shell-v11'/);
});

test('service worker cache writes are awaited and font failures return a Response', () => {
  assert.doesNotMatch(sw, /\.then\(networkRes\s*=>\s*\{[\s\S]{0,250}?await caches\.open/);
  assert.match(sw, /\.catch\(\(\)\s*=>\s*Response\.error\(\)\)/);
});
