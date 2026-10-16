/** Pure book-layout math, independent of browser/PDF libraries for testability. */
export const PAPER_MM = Object.freeze({
  A3:[297,420],A4:[210,297],A5:[148,210],A6:[105,148],B4:[250,353],B5:[176,250],B6:[125,176],
  Letter:[215.9,279.4],Legal:[215.9,355.6],HalfLetter:[139.7,215.9]
});
export function getPageDimensions(s){
  const preset=PAPER_MM[s.pageSize];let width=Number(s.pageW??preset?.[0]??148),height=Number(s.pageH??preset?.[1]??210);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new RangeError('Finished page width and height must be positive.');
  if(s.orientation==='landscape'&&height>width)[width,height]=[height,width];
  if(s.orientation!=='landscape'&&width>height)[width,height]=[height,width];
  return {width,height};
}
export function getSheetDimensions(s){
  let width=Number(s.sheetW??297),height=Number(s.sheetH??210);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new RangeError('Physical sheet width and height must be positive.');
  if(s.sheetOrientation==='portrait'&&width>height)[width,height]=[height,width];
  if(s.sheetOrientation!=='portrait'&&height>width)[width,height]=[height,width];
  return {width,height};
}
export function calculateImpositionGeometry(s){
  const page=getPageDimensions(s),sheet=getSheetDimensions(s),mode=s.fitMode??'fit',percent=Number(s.customScalePercent??100);
  if(mode==='custom'&&(!Number.isFinite(percent)||percent<=0||percent>200))throw new RangeError('Custom scale must be between 0% and 200%.');
  const requiredWidth=page.width*2,requiredHeight=page.height;
  let scale=1;if(mode==='fit')scale=Math.min(1,sheet.width/requiredWidth,sheet.height/requiredHeight);if(mode==='custom')scale=percent/100;
  const scaledWidth=requiredWidth*scale,scaledHeight=requiredHeight*scale,fits=scaledWidth<=sheet.width+1e-6&&scaledHeight<=sheet.height+1e-6;
  if(mode==='actual'&&!fits)throw new RangeError(`Actual-size spread ${requiredWidth.toFixed(2)} × ${requiredHeight.toFixed(2)} mm does not fit ${sheet.width.toFixed(2)} × ${sheet.height.toFixed(2)} mm paper. Choose fit-to-sheet or larger paper.`);
  if(mode==='custom'&&!fits)throw new RangeError('Custom scale is larger than the physical sheet.');
  return {pageWidthMm:page.width,pageHeightMm:page.height,sheetWidthMm:sheet.width,sheetHeightMm:sheet.height,requiredWidthMm:requiredWidth,requiredHeightMm:requiredHeight,scale,scaledWidthMm:scaledWidth,scaledHeightMm:scaledHeight,offsetXmm:(sheet.width-scaledWidth)/2,offsetYmm:(sheet.height-scaledHeight)/2,fits,needsScaling:scale<1-1e-9,geometricClearanceMm:Math.min((sheet.width-scaledWidth)/2,(sheet.height-scaledHeight)/2)};
}
function validateSignatureSize(n){if(!Number.isInteger(n)||n<4||n%4)throw new RangeError('Signature size must be a multiple of four, at least 4 pages.');}
export function buildSignatures(count,size=32){
  if(!Number.isInteger(count)||count<1)throw new RangeError('Reader page count must be a positive integer.');validateSignatureSize(size);
  const result=[];let start=1;
  while(start<=count){const real=Math.min(size,count-start+1),padded=real===size?size:Math.ceil(real/4)*4;
    result.push({index:result.length,readerStart:start,realCount:real,pageCount:padded,pages:Array.from({length:padded},(_,i)=>i<real?start+i:null)});start+=real;}
  return result;
}
/** Saddle-stitch: front [N-2i,1+2i], back [2+2i,N-1-2i] within each signature. */
export function createImposition(count,size=32){
  const signatures=buildSignatures(count,size),spreads=[];
  for(const sig of signatures){const n=sig.pageCount;for(let i=0;i<n/4;i++){
    const frontLocal=[n-2*i,1+2*i],backLocal=[2+2*i,n-1-2*i],map=arr=>arr.map(x=>sig.pages[x-1]??null);
    spreads.push({signatureIndex:sig.index,signatureSheetIndex:i,sheetIndex:spreads.length,front:map(frontLocal),back:map(backLocal),frontLocal,backLocal});
  }}
  const used=spreads.flatMap(s=>[...s.front,...s.back]).filter(n=>n!==null);
  if(used.length!==count||new Set(used).size!==count||Array.from({length:count},(_,i)=>i+1).some(n=>!used.includes(n)))throw new Error('Imposition validation failed: a reader page is missing or duplicated.');
  return {signatures,spreads,readerPageCount:count,imposedPageCount:signatures.reduce((n,s)=>n+s.pageCount,0),blankPageCount:signatures.reduce((n,s)=>n+s.pageCount-s.realCount,0),physicalSheetsDuplex:spreads.length,physicalSheetsSingleSided:spreads.length*2};
}
function wrapParagraph(text,maxWidth,measure){
 const words=text.split(/\s+/).filter(Boolean);if(!words.length)return [''];const out=[];let line='';
 for(const word of words){if(measure(word)>maxWidth){if(line){out.push(line);line='';}let part='';for(const c of word){if(part&&measure(part+c)>maxWidth){out.push(part);part=c;}else part+=c;}line=part;continue;}
 const candidate=line?`${line} ${word}`:word;if(line&&measure(candidate)>maxWidth){out.push(line);line=word;}else line=candidate;}
 if(line)out.push(line);return out;
}
export function paginateManuscript(text,options={}){
 const W=Number(options.pageWidthPt??419.53),H=Number(options.pageHeightPt??595.28),fs=Number(options.fontSize??11),spacing=Number(options.lineSpacing??1.4);
 const top=Number(options.topMarginPt??51),bottom=Number(options.bottomMarginPt??51),left=Number(options.leftMarginPt??51),right=Number(options.rightMarginPt??40);
 const cols=Number(options.columns??1),gap=Number(options.columnGapPt??18),chapterNewPage=options.chapterNewPage!==false;
 const measure=typeof options.measureText==='function'?options.measureText:(t,k='body')=>t.length*fs*(k==='heading'?.56:.49);
 if([W,H,fs,spacing,top,bottom,left,right,cols,gap].some(n=>!Number.isFinite(n))||W<=0||H<=0||fs<=0||spacing<.8||top<0||bottom<0||left<0||right<0||!Number.isInteger(cols)||cols<1||cols>4||gap<0)throw new RangeError('Invalid pagination settings.');
 const usableW=W-left-right-gap*(cols-1),usableH=H-top-bottom;if(usableW<=0||usableH<=fs)throw new RangeError('Margins leave no usable text area.');
 const colW=usableW/cols,lineH=fs*spacing,pages=[];let page,col=0,y=0;
 const newPage=()=>{page={columns:Array.from({length:cols},()=>[])};pages.push(page);col=0;y=0;};
 const hasText=p=>p.columns.some(c=>c.some(l=>l.kind!=='blank'&&l.text));
 const nextCol=()=>{if(col+1<cols){col++;y=0;}else newPage();};
 const add=(line,kind,height=lineH)=>{if(y+height>usableH+1e-6)nextCol();page.columns[col].push({text:line,kind,yTopPt:y,heightPt:height});y+=height;};
 newPage();const paragraphs=String(text??'').replace(/\r\n?/g,'\n').split('\n');while(paragraphs.length>1&&!paragraphs.at(-1).trim())paragraphs.pop();
 for(const raw of paragraphs){
  if(raw.trim()==='[PAGE BREAK]'){if(hasText(pages.at(-1)))newPage();continue;}
  if(!raw.trim()){if(y+lineH*.55<=usableH+1e-6)add('','blank',lineH*.55);continue;}
  const heading=/^#\s+/.test(raw),body=heading?raw.replace(/^#\s+/,'').trim():raw.trim(),kind=heading?'heading':'body';
  if(heading&&chapterNewPage&&hasText(pages.at(-1)))newPage();
  if(heading&&y+lineH*2>usableH+1e-6)nextCol();
  for(const line of wrapParagraph(body,colW,t=>measure(t,kind)))add(line,kind);
  const paragraphGap=lineH*(heading?.25:.45);if(y+paragraphGap<=usableH+1e-6)add('','blank',paragraphGap);
 }
 while(pages.length>1&&!hasText(pages.at(-1)))pages.pop();
 return pages.length?pages:[{columns:Array.from({length:cols},()=>[])}];
}
