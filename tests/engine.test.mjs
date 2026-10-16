import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSignatures, createImposition, calculateImpositionGeometry, getPageDimensions, paginateManuscript } from '../src/engine.mjs';

const flatten = result => result.spreads.flatMap(s => [...s.front, ...s.back]).filter(p => p !== null).sort((a,b)=>a-b);

test('8-page saddle-stitched booklet has canonical spreads', () => {
  const r = createImposition(8, 8);
  assert.deepEqual(r.spreads.map(s => s.front), [[8,1],[6,3]]);
  assert.deepEqual(r.spreads.map(s => s.back), [[2,7],[4,5]]);
  assert.equal(r.physicalSheetsDuplex, 2);
});

test('page counts 4, 8, 12, 16, 20, 24 preserve every reader page exactly once', () => {
  for (const count of [4,8,12,16,20,24]) {
    const r = createImposition(count, Math.max(4, Math.min(32, Math.ceil(count/4)*4)));
    assert.deepEqual(flatten(r), Array.from({length:count},(_,i)=>i+1));
    assert.equal(r.imposedPageCount % 4, 0);
    assert.equal(r.blankPageCount, 0);
  }
});

test('non-multiple-of-four page counts get blank padding without losing content', () => {
  for (const [count, expectedImposed] of [[1,4],[2,4],[3,4],[5,8],[10,12],[17,20],[19,20],[21,24]]) {
    const r = createImposition(count, 32);
    assert.equal(r.imposedPageCount, expectedImposed);
    assert.equal(r.blankPageCount, expectedImposed-count);
    assert.deepEqual(flatten(r), Array.from({length:count},(_,i)=>i+1));
  }
});

test('multiple signatures pair local pages and map back to global reading order', () => {
  const r = createImposition(20, 16);
  assert.equal(r.signatures.length, 2);
  assert.equal(r.spreads.length, 5);
  assert.deepEqual(r.spreads[0].front, [16,1]);
  assert.deepEqual(r.spreads[4].front, [20,17]);
  assert.deepEqual(flatten(r), Array.from({length:20},(_,i)=>i+1));
});

test('final incomplete signature pads to a multiple of four', () => {
  const signatures = buildSignatures(17,16);
  assert.deepEqual(signatures.map(s=>s.pageCount), [16,4]);
  assert.deepEqual(signatures[1].pages, [17,null,null,null]);
});

test('signature size rejects invalid values', () => {
  for (const invalid of [0,1,6,10,15,17,NaN]) assert.throws(() => createImposition(8,invalid), /multiple of four/);
});

test('A5 on A4 landscape fits with no distortion; centered geometry is positive', () => {
  const g = calculateImpositionGeometry({pageW:148,pageH:210,orientation:'portrait',sheetW:297,sheetH:210,sheetOrientation:'landscape',fitMode:'fit'});
  assert.equal(g.scale, 1);
  assert.equal(g.requiredWidthMm, 296);
  assert.equal(g.fits, true);
  assert.ok(g.offsetXmm > 0);
});

test('A5 booklet on smaller paper is proportionally scaled, not stretched', () => {
  const g = calculateImpositionGeometry({pageW:148,pageH:210,orientation:'portrait',sheetW:210,sheetH:148,sheetOrientation:'landscape',fitMode:'fit'});
  assert.ok(g.scale < 1);
  assert.ok(Math.abs(g.scaledWidthMm/g.scaledHeightMm - 296/210) < 1e-9);
  assert.equal(g.fits,true);
});

test('actual-size output fails safely when physical paper is too small', () => {
  assert.throws(() => calculateImpositionGeometry({pageW:148,pageH:210,orientation:'portrait',sheetW:210,sheetH:148,sheetOrientation:'landscape',fitMode:'actual'}), /does not fit/);
});

test('custom scale above available sheet area is rejected', () => {
  assert.throws(() => calculateImpositionGeometry({pageW:148,pageH:210,orientation:'portrait',sheetW:297,sheetH:210,sheetOrientation:'landscape',fitMode:'custom',customScalePercent:120}), /larger than the physical sheet/);
});

test('orientation switches page dimensions without distorting trim size', () => {
  assert.deepEqual(getPageDimensions({pageW:148,pageH:210,orientation:'portrait'}),{width:148,height:210});
  assert.deepEqual(getPageDimensions({pageW:148,pageH:210,orientation:'landscape'}),{width:210,height:148});
});

test('pagination keeps text, page breaks, columns and headings', () => {
  const text = 'A heading\n\n' + 'word '.repeat(120) + '\n[PAGE BREAK]\n# Chapter 2\nEnd of test.';
  const pages = paginateManuscript(text,{pageWidthPt:180,pageHeightPt:200,fontSize:10,topMarginPt:15,bottomMarginPt:15,leftMarginPt:15,rightMarginPt:15,columns:2,measureText:t=>t.length*4});
  assert.ok(pages.length >= 2);
  const all = pages.flatMap(p=>p.columns.flat()).map(line=>line.text).join(' ');
  assert.match(all,/Chapter 2/);
  assert.match(all,/End of test\./);
  assert.equal((all.match(/word/g)||[]).length,120);
});

test('invalid page/margin geometry rejects rather than silently overflowing', () => {
  assert.throws(() => paginateManuscript('hello',{pageWidthPt:100,pageHeightPt:100,leftMarginPt:60,rightMarginPt:60}),/no usable text area/);
});

test('booklet mappings preserve pages across many counts and signature sizes', () => {
  for (const signatureSize of [4,8,12,16,24,32,64]) {
    for (let count=1;count<=130;count++) {
      const result=createImposition(count,signatureSize);
      assert.deepEqual(flatten(result),Array.from({length:count},(_,i)=>i+1),`count ${count}, signature ${signatureSize}`);
      assert.equal(result.imposedPageCount%4,0);
    }
  }
});

test('text ending in newlines does not create an extra blank reader page', () => {
  const input='Opening paragraph.\n\nSecond paragraph.\n\n';
  const pages=paginateManuscript(input,{pageWidthPt:400,pageHeightPt:600,topMarginPt:50,bottomMarginPt:50,leftMarginPt:50,rightMarginPt:50});
  assert.equal(pages.length,1);
  const all=pages.flatMap(p=>p.columns.flat()).filter(l=>l.text).map(l=>l.text).join(' ');
  assert.match(all,/Opening paragraph/);assert.match(all,/Second paragraph/);
});
