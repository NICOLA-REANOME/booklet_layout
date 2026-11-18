import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');\nconst api=readFileSync(new URL('../api/ai.mjs',import.meta.url),'utf8');
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

test('book images can be inserted and embedded into PDF and Word output',()=>{\n assert.ok(html.includes('id="insertImage"'));assert.ok(html.includes('id="imageWidth"'));assert.ok(app.includes('async function addBookImage'));assert.ok(app.includes('page.drawImage(image'));assert.ok(app.includes('wp:inline'));\n});\n\ntest('Word export includes headers, footers, footnotes and an updateable contents field',()=>{\n assert.ok(html.includes('id="wordHeader"'));assert.ok(html.includes('id="wordFooter"'));assert.ok(html.includes('id="wordToc"'));assert.ok(app.includes('w:footnoteReference'));assert.ok(app.includes('TOC '));assert.ok(app.includes('header1.xml'));assert.ok(app.includes('footer1.xml'));\n});\n\ntest('Book Assistant has optional OpenRouter semantic retrieval',()=>{\n assert.ok(html.includes('id="semanticRetrieval"'));assert.ok(app.includes('semanticSearch:'));assert.ok(api.includes('semanticSearchBook'));\n});\n\ntest('AI assistant presents verified before/after edits for explicit user application',()=>{
 assert.match(app,/run\.name==='suggest_text_edits'/);
 assert.match(app,/current\.indexOf\(needle\)/);
 assert.match(app,/Apply this edit/);
 assert.match(app,/undo\.push\(current\)/);
});
