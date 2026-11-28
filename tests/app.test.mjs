import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { buildShareableReaderHTML } from '../src/share-reader.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const refs=[...app.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]);
const missing=[...new Set(refs.filter(id=>!ids.has(id)))];

test('the browser app imports its engine from a file that exists relative to src/app.mjs',()=>{
 const spec=app.split("from ")[1]?.split(";")[0]?.trim().replace(/^['"]|['"]$/g,'');
 assert.ok(spec,'app.mjs should declare its engine module import');
 assert.ok(existsSync(new URL(spec,new URL('../src/app.mjs',import.meta.url))),`missing module ${spec} relative to src/app.mjs`);
});

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
test('book preview has two-page layout and transition-safe animated page turns',()=>{
 assert.match(html,/data-view="book"/);assert.match(html,/id="bookViewport"/);assert.match(html,/id="bookTurn"/);assert.match(app,/function flipBook/);assert.match(app,/function renderBookPage/);assert.match(app,/rotateY\(-180deg\)/);assert.match(app,/turn.style.transition='none'/);assert.match(app,/clearTimeout\(timer\)/);
});
test('AI assistant presents verified before/after edits for explicit user application',()=>{
 assert.match(app,/run\.name==='suggest_text_edits'/);
 assert.match(app,/current\.indexOf\(needle\)/);
 assert.match(app,/Apply this edit/);
 assert.match(app,/undo\.push\(current\)/);
});

test('cover editor, open/closed book studio, flat/3D modes and share export are wired',()=>{
 for(const id of ['coverTemplate','coverKicker','coverSubtitle','coverAccent','coverBackText','coverImageFile','removeCoverImage','exportShareableReader','closedBook','closedCoverTitle'])assert.ok(ids.has(id),'missing '+id);
 assert.match(app,/function renderClosedCover/);assert.match(app,/function exportShareableReader/);assert.match(app,/buildShareableReaderHTML/);
 assert.match(html,/data-book-presentation="cover"/);assert.match(html,/data-book-style="2d"/);
});
test('shareable reader is self-contained, embeds images and escapes script-closing title text',()=>{
 const output=buildShareableReaderHTML({title:'Test </script>',author:'A',cover:{template:'classic',artwork:'data:image/png;base64,AA=='},pageWidth:340,pageHeight:480,pages:['<div class="book-page">Page 1</div>']});
 assert.match(output,/<!doctype html>/i);assert.match(output,/data:image\/png;base64,AA==/);assert.match(output,/class='turn'/);assert.match(output,/Page 1/);const start=output.indexOf('<script>')+8,end=output.indexOf('</script>',start);assert.ok(start>=8&&end>start,'inline reader controller is present');assert.doesNotThrow(()=>new Function(output.slice(start,end)));
 assert.doesNotMatch(output,/<script>.*Test <\/script>/s);
 assert.doesNotMatch(output,/src=['"]https?:\/\//);
});

test('booklet sheets show imposed pages on a physical sheet with front/back controls',()=>{
 for(const id of ['sheetPhysical','sheetPreviewLeft','sheetPreviewRight','sheetPreviewIndex','sheetPrev','sheetNext'])assert.ok(ids.has(id),'missing '+id);
 assert.match(app,/function renderSheetPreview/);assert.match(app,/calculateImpositionGeometry\(readSettings\(\)\)/);
 assert.match(app,/renderBookPage\(slot,number===null\?-1:number-1,pageW\)/);
 assert.match(html,/data-sheet-side="front"/);assert.match(html,/data-sheet-side="back"/);
});
test('full cover wrap includes back, spine, front, bleed, safe guides and SVG export',()=>{
 for(const id of ['coverBinding','coverCaliper','coverBleed','coverSafe','bookCoverView','coverSpreadBackText','coverSpreadSpineTitle','coverSpreadFrontTitle','exportCoverSVG'])assert.ok(ids.has(id),'missing '+id);
 assert.match(app,/function getCoverMetrics/);assert.match(app,/function renderCoverSpread/);assert.match(app,/function exportCoverSpreadSVG/);
 assert.match(html,/Full cover wrap/);assert.match(html,/CorelDRAW/);
});
test('marketing studio exports campaign PNG and landing page without requiring AI',()=>{
 for(const id of ['marketingStudio','marketingTagline','marketingBlurb','marketingCTA','marketingURL','marketingTheme','marketingFormat','marketingHashtags','marketingCanvas','marketingExportPNG','marketingCopyCaption','marketingExportLanding'])assert.ok(ids.has(id),'missing '+id);
 assert.match(app,/function drawMarketingPoster/);assert.match(app,/function marketingCaptionText/);assert.match(app,/function exportMarketingLanding/);assert.match(app,/function exportMarketingPNG/);
 assert.match(html,/No AI key required/);assert.match(html,/1080 × 1350/);
});

test('marketing poster refreshes when the active book, cover artwork or book identity changes',()=>{
 assert.match(app,/renderProjects\(\);refresh\(\);void drawMarketingPoster\(\)/);
 assert.match(app,/\['title','author'\]\.forEach/);
 assert.match(app,/void drawMarketingPoster\(\);\}catch/);
});
test('cover artwork and removal refresh both open production wrap and marketing artwork',()=>{
 assert.match(app,/renderCoverSpread\(\);\}void drawMarketingPoster\(\)/);
 assert.match(app,/exportCoverSVG2/);
});


test('PDF export embeds the valid Times Roman bold standard font and offers a fallback download link',()=>{
 assert.match(app,/StandardFonts\.TimesRomanBold/);
 assert.doesNotMatch(app,/StandardFonts\.TimesBold/);
 assert.match(app,/downloadFallbackLink/);
 assert.match(app,/function readerPDFRasterized/);
});
test('Urdu PDF path loads Lateef and preserves mixed text direction for page rendering',()=>{
 assert.match(html,/font-family:Lateef/);
 assert.match(html,/url\("\/api\/font\?weight=400"\)/);
 assert.match(app,/ensureLateefFonts/);
 assert.match(app,/containsUrduScript\(\$\('manuscript'\)\.value\)/);
 assert.match(app,/ctx\.direction=dir/);
 assert.match(app,/rasterDpi/);
});
test('Heading 1–3 quick tags and image wrapping/drop plus grayscale workflow are available',()=>{
 for(const [id,value] of [['textStyle','h1'],['imageFlow','wrap-left'],['imageMode','bw']])assert.ok(html.includes('id="'+id+'"')&&html.includes('value="'+value+'"'),id+' control missing');
 assert.match(app,/Heading '\+level\+' tagged/);
 assert.match(app,/addImageDropTarget/);
 assert.match(app,/flow:im\.flow/);
 assert.match(app,/function grayscaleCanvas/);
 assert.match(app,/imageMode==='bw'/);
 assert.match(app,/w:bidi/);
 assert.match(app,/w:rtl/);
});
test('Lateef Urdu fonts are proxied through a same-origin endpoint with an OFL license file',()=>{
 assert.ok(existsSync(new URL('../api/font.mjs',import.meta.url)));
 assert.ok(existsSync(new URL('../assets/fonts/OFL-Lateef.txt',import.meta.url)));
 assert.match(html,/\/api\/font\?weight=700/);
});


test('3D book cover supports drag rotation, wheel zoom, and named camera presets',()=>{
 assert.match(app,/pointerdown/);assert.match(app,/pointermove/);assert.match(app,/addEventListener\('wheel'/);
 assert.match(app,/bookZoom/);assert.match(app,/angleDefaults/);
 assert.match(html,/Drag the book to rotate it and use the mouse wheel to zoom/);
});
test('image drag and drop does not bubble to duplicate drop targets',()=>{
 assert.match(app,/e\.stopPropagation\(\);insertDroppedImages/);
 assert.match(app,/addImageDropTarget/);
});
