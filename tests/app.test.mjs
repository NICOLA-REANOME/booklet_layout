import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const refs=[...app.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]);
const missing=[...new Set(refs.filter(id=>!ids.has(id)))];

test('every literal UI element referenced by the app exists in index.html',()=>{
 assert.deepEqual(missing,[]);
});

test('new book storage uses IndexedDB and can read the old localStorage format',()=>{
 assert.match(app,/indexedDB\.open\(DB_NAME,DB_VERSION\)/);
 assert.match(app,/loadStoredProjects/);
 assert.match(app,/Array\.isArray\(legacy\.projects\)/);
 assert.match(app,/localStorage\.setItem\(KEY,JSON\.stringify\(index\)\)/);
});

test('project manager exposes search, duplicate and delete actions',()=>{
 assert.match(html,/id="projectSearch"/);
 assert.match(app,/Duplicate book/);
 assert.match(app,/Delete book/);
});

test('manuscript import and Word export are wired',()=>{
 assert.match(html,/accept="\.txt,\.md,\.markdown,\.docx,\.pdf"/);
 assert.match(app,/mammoth\.extractRawText/);
 assert.match(app,/pdfjs-dist/);
 assert.match(app,/async function exportDocx/);
 assert.match(html,/id="wordExport"/);
});

test('AI image input is not persisted in multi-turn chat history',()=>{
 assert.match(app,/const requestMessages=\[\.\.\.aiHistory,\{role:'user',content:userContent\}\]/);
 assert.match(app,/aiHistory\.push\(\{role:'user',content:prompt\}/);
 assert.doesNotMatch(app,/aiHistory\.push\(\{role:'user',content:userContent\}/);
});

test('image controls expose physical size and position and update selected images',()=>{
 assert.match(html,/id="imageWidthMm"/);assert.match(html,/id="imageHeightMm"/);assert.match(html,/id="imageXmm"/);assert.match(html,/id="imageYmm"/);assert.match(app,/function applySelectedImageSettings/);assert.match(app,/widthMm:/);assert.match(app,/imageOffsetXPt/);
});
test('book preview has two-page layout and animated page turns',()=>{
 assert.match(html,/data-view="book"/);assert.match(html,/id="bookViewport"/);assert.match(html,/id="bookTurn"/);assert.match(app,/function flipBook/);assert.match(app,/function renderBookPage/);assert.match(app,/rotateY\(-180deg\)/);
});
test('AI assistant presents verified before/after edits for explicit user application',()=>{
 assert.match(app,/run\.name==='suggest_text_edits'/);
 assert.match(app,/current\.indexOf\(needle\)/);
 assert.match(app,/Apply this edit/);
 assert.match(app,/undo\.push\(current\)/);
});
