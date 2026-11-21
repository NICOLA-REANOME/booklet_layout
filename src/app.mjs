import {PAPER_MM,getPageDimensions,getSheetDimensions,calculateImpositionGeometry,createImposition,paginateManuscript,getBookSpread,getBookSpreadForPage} from './engine.mjs';
import {buildShareableReaderHTML} from './share-reader.mjs';
const $=id=>document.getElementById(id),KEY='bookflow-projects-v2',MM=72/25.4;
let projects=[],activeId='',layouts=[],pageIndex=0,undo=[],redo=[],previousText='',imageAssets=[],activePreviewView='reader',bookSpreadIndex=0,bookFlipBusy=false,bookFlipToken=0,bookPresentation='open',bookVisualMode='3d',bookAngle='hero',coverArtworkData='',selectedSheetIndex=0,selectedSheetSide='front';
const DEFAULT_COVER={template:'classic',kicker:'A NOVEL',subtitle:'',backText:'',accent:'#d7b66e',artwork:'',binding:'perfect',caliper:0.10,bleed:3,safe:5};
const DEFAULT_MARKETING={tagline:'A story worth turning the page for',blurb:'',cta:'Discover the story',url:'',theme:'noir',format:'portrait',hashtags:'#BookLaunch #NewRelease #Readers'};
const def=()=>({id:'book-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),title:'Untitled book',author:'',text:'',images:[],cover:{...DEFAULT_COVER},marketing:{...DEFAULT_MARKETING},settings:{wordHeaderText:'',wordFooterText:'',wordHeaderAlign:'center',wordFooterAlign:'center',wordToc:true,pagePreset:'A5',pageW:148,pageH:210,orientation:'portrait',fontSize:11,columns:1,lineSpacing:1.4,align:'left',topMargin:18,bottomMargin:18,innerMargin:18,outerMargin:14,gutter:5,pageNumbers:true,chapterStart:true,sheetPreset:'A4',sheetW:297,sheetH:210,sheetOrientation:'landscape',printer:'et4850',hpModel:'unknown',mode:'auto',signature:32,fit:'fit',safeMargin:5,customScale:100,flip:'long',backOrder:'same',marks:false},updated:Date.now()});
const active=()=>projects.find(p=>p.id===activeId)||projects[0];
function readCoverSettings(){return {template:$('coverTemplate')?.value||DEFAULT_COVER.template,kicker:$('coverKicker')?.value.trim()||'',subtitle:$('coverSubtitle')?.value.trim()||'',backText:$('coverBackText')?.value.trim()||'',accent:$('coverAccent')?.value||DEFAULT_COVER.accent,artwork:coverArtworkData||'',binding:$('coverBinding')?.value||DEFAULT_COVER.binding,caliper:Number($('coverCaliper')?.value)||DEFAULT_COVER.caliper,bleed:Number($('coverBleed')?.value??DEFAULT_COVER.bleed),safe:Number($('coverSafe')?.value??DEFAULT_COVER.safe)};}
function readMarketingSettings(){return {tagline:$('marketingTagline')?.value.trim()||DEFAULT_MARKETING.tagline,blurb:$('marketingBlurb')?.value.trim()||'',cta:$('marketingCTA')?.value.trim()||DEFAULT_MARKETING.cta,url:$('marketingURL')?.value.trim()||'',theme:$('marketingTheme')?.value||DEFAULT_MARKETING.theme,format:$('marketingFormat')?.value||DEFAULT_MARKETING.format,hashtags:$('marketingHashtags')?.value.trim()||DEFAULT_MARKETING.hashtags};}
function readSettings(){return {wordHeaderText:$('wordHeader').value,wordFooterText:$('wordFooter').value,wordHeaderAlign:$('wordHeaderAlign').value,wordFooterAlign:$('wordFooterAlign').value,wordToc:$('wordToc').checked,pageSize:$('pagePreset').value,pageW:+$('pageW').value,pageH:+$('pageH').value,orientation:$('orientation').value,fontSize:+$('fontSize').value,columns:+$('columns').value,lineSpacing:+$('lineSpacing').value,textAlign:$('align').value,marginTop:+$('topMargin').value,marginBottom:+$('bottomMargin').value,marginInner:+$('innerMargin').value,marginOuter:+$('outerMargin').value,gutter:+$('gutter').value,pageNumbers:$('pageNumbers').checked,chapterNewPage:$('chapterStart').checked,sheetSize:$('sheetPreset').value,sheetW:+$('sheetW').value,sheetH:+$('sheetH').value,sheetOrientation:$('sheetOrientation').value,printerProfile:$('printer').value,hpModel:$('hpModel')?.value||'unknown',printMode:$('mode').value,signatureSize:+$('signature').value,fitMode:$('fit').value,safeEdgeMarginMm:+$('safeMargin').value,customScalePercent:+$('customScale').value,flipEdge:$('flip').value,backOrder:$('backOrder').value,cropMarks:$('marks').checked};}
function sync(){const p=active();if(!p)return;p.title=$('title').value.trim()||'Untitled book';p.author=$('author').value.trim();p.text=$('manuscript').value;p.images=Array.isArray(imageAssets)?imageAssets:[];p.cover=readCoverSettings();p.marketing=readMarketingSettings();p.settings={...p.settings,...fromUI()};p.updated=Date.now();}
function fromUI(){return {wordHeaderText:$('wordHeader').value,wordFooterText:$('wordFooter').value,wordHeaderAlign:$('wordHeaderAlign').value,wordFooterAlign:$('wordFooterAlign').value,wordToc:$('wordToc').checked,pagePreset:$('pagePreset').value,pageW:+$('pageW').value,pageH:+$('pageH').value,orientation:$('orientation').value,fontSize:+$('fontSize').value,columns:+$('columns').value,lineSpacing:+$('lineSpacing').value,align:$('align').value,topMargin:+$('topMargin').value,bottomMargin:+$('bottomMargin').value,innerMargin:+$('innerMargin').value,outerMargin:+$('outerMargin').value,gutter:+$('gutter').value,pageNumbers:$('pageNumbers').checked,chapterStart:$('chapterStart').checked,sheetPreset:$('sheetPreset').value,sheetW:+$('sheetW').value,sheetH:+$('sheetH').value,sheetOrientation:$('sheetOrientation').value,printer:$('printer').value,hpModel:$('hpModel')?.value||'unknown',mode:$('mode').value,signature:+$('signature').value,fit:$('fit').value,safeMargin:+$('safeMargin').value,customScale:+$('customScale').value,flip:$('flip').value,backOrder:$('backOrder').value,marks:$('marks').checked};}
const DB_NAME='BookFlowStudioDB',DB_VERSION=1;
let dbPromise=null,saveTimer=null,lastStorageError='',fullSaveNeeded=true;const deletedProjectIds=new Set();
function openBookDB(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(new Error('IndexedDB is not available in this browser.'));return;}
  const req=indexedDB.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'id'});if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta');};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Could not open local book storage.'));
 });
 return dbPromise;
}
async function persistProjects(){
 const db=await openBookDB(),saveAll=fullSaveNeeded,removed=[...deletedProjectIds],current=active();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction(['projects','meta'],'readwrite'),store=tx.objectStore('projects'),meta=tx.objectStore('meta');
  if(saveAll){store.clear();for(const p of projects)store.put(p);}
  else if(current)store.put(current);
  for(const id of removed)store.delete(id);
  meta.put(activeId,'activeId');
  tx.oncomplete=()=>{if(saveAll)fullSaveNeeded=false;for(const id of removed)deletedProjectIds.delete(id);resolve();};
  tx.onerror=()=>reject(tx.error||new Error('Could not save books.'));
  tx.onabort=()=>reject(tx.error||new Error('Book save was interrupted.'));
 });
}
function store(immediate=false,fullSave=false){
 if(fullSave)fullSaveNeeded=true;
 const index={activeId,projectIndex:projects.map(p=>({id:p.id,title:p.title||'Untitled book',updated:p.updated||Date.now(),words:wordCount(p.text)}))};
 try{localStorage.setItem(KEY,JSON.stringify(index));}catch(e){lastStorageError=e.message||'Browser index storage is full.';}
 if(saveTimer)clearTimeout(saveTimer);
 const save=async()=>{try{await persistProjects();$('saved').textContent='Saved on this device';lastStorageError='';}catch(e){
   lastStorageError=e.message||'Local database save failed.';
   try{localStorage.setItem(KEY,JSON.stringify({projects,activeId}));$('saved').textContent='Saved in browser storage (fallback)';}
   catch{$('saved').textContent='Save failed — export a backup';}
 }};
 if(immediate)void save();else saveTimer=setTimeout(save,500);
}
async function loadStoredProjects(){
 try{
  const db=await openBookDB();
  const saved=await new Promise((resolve,reject)=>{
   const tx=db.transaction(['projects','meta'],'readonly'),all=tx.objectStore('projects').getAll(),active=tx.objectStore('meta').get('activeId');
   tx.oncomplete=()=>resolve({projects:all.result||[],activeId:active.result||''});tx.onerror=()=>reject(tx.error);
  });
  if(saved.projects.length)return {...saved,fromDB:true};
 }catch(e){lastStorageError=e.message||'IndexedDB unavailable';}
 try{
  const legacy=JSON.parse(localStorage.getItem(KEY)||'{}');
  if(Array.isArray(legacy.projects))return {projects:legacy.projects,activeId:legacy.activeId||'',fromDB:false};
 }catch{}
 return {projects:[],activeId:'',fromDB:false};
}
function wordCount(s){return (String(s).trim().match(/\S+/g)||[]).length;}
function filename(suffix,ext='pdf'){let x=($('title').value||'book').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'book';return x+'-'+suffix+'.'+ext;}
function status(msg,kind='muted'){const e=$('status');e.textContent=msg;e.className='small '+(kind==='warn'?'note warn':kind==='good'?'note good':'muted');$('editStatus').textContent=kind==='good'?'Saved locally':'Autosaves locally';}
function renderProjects(){
 const box=$('projectList');box.replaceChildren();
 const query=String($('projectSearch')?.value||'').trim().toLowerCase();
 const shown=projects.filter(p=>!query||String(p.title||'').toLowerCase().includes(query)||String(p.author||'').toLowerCase().includes(query));
 if(!shown.length){const empty=document.createElement('p');empty.className='small muted';empty.textContent=projects.length?'No books match this search.':'No books yet. Create your first book.';box.append(empty);return;}
 for(const p of shown){
  const row=document.createElement('div');row.className='project-row'+(p.id===activeId?' active':'');
  const select=document.createElement('button');select.className='project';select.type='button';select.setAttribute('aria-current',p.id===activeId?'page':'false');
  const name=document.createElement('span');name.textContent=p.title||'Untitled book';
  const count=document.createElement('small');count.textContent=wordCount(p.text)+'w';
  select.append(name,count);select.onclick=()=>{if(p.id===activeId)return;sync();store();activeId=p.id;loadActive();};
  const tools=document.createElement('div');tools.className='project-actions';
  const duplicate=document.createElement('button');duplicate.type='button';duplicate.className='project-icon';duplicate.title='Duplicate book';duplicate.setAttribute('aria-label','Duplicate '+(p.title||'book'));duplicate.textContent='⧉';
  duplicate.onclick=()=>{sync();const copy=JSON.parse(JSON.stringify(p));copy.id='book-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);copy.title=(p.title||'Untitled book')+' — Copy';copy.updated=Date.now();projects.unshift(copy);activeId=copy.id;loadActive();store(true);void drawMarketingPoster();};
  const remove=document.createElement('button');remove.type='button';remove.className='project-icon danger';remove.title='Delete book';remove.setAttribute('aria-label','Delete '+(p.title||'book'));remove.textContent='×';
  remove.onclick=()=>{if(!confirm('Delete "'+(p.title||'Untitled book')+'"? This cannot be undone. Export a backup first if you need it.'))return;deletedProjectIds.add(p.id);projects=projects.filter(x=>x.id!==p.id);if(!projects.length){const fresh=def();fresh.title='My Book';projects=[fresh];}if(activeId===p.id)activeId=projects[0].id;loadActive();store(true);};
  tools.append(duplicate,remove);row.append(select,tools);box.append(row);
 }
}
function loadActive(){const p=active()||def();const s={...def().settings,...p.settings};$('title').value=p.title||'Untitled book';$('author').value=p.author||'';$('manuscript').value=p.text||'';for(const [k,v] of Object.entries(s)){let id=k==='wordHeaderText'?'wordHeader':k==='wordFooterText'?'wordFooter':k==='wordHeaderAlign'?'wordHeaderAlign':k==='wordFooterAlign'?'wordFooterAlign':k==='wordToc'?'wordToc':k==='pagePreset'?'pagePreset':k==='sheetPreset'?'sheetPreset':k==='signature'?'signature':k==='customScale'?'customScale':k;let el=$(id);if(!el)continue;if(el.type==='checkbox')el.checked=!!v;else el.value=String(v);}previousText=$('manuscript').value;imageAssets=Array.isArray(p.images)?p.images:[];const cover={...DEFAULT_COVER,...(p.cover||{})};$('coverTemplate').value=cover.template;$('coverKicker').value=cover.kicker;$('coverSubtitle').value=cover.subtitle;$('coverBackText').value=cover.backText;$('coverAccent').value=cover.accent;coverArtworkData=cover.artwork||'';$('coverImageStatus').textContent=coverArtworkData?'Cover artwork loaded.':'No cover artwork selected.';$('coverBinding').value=cover.binding||DEFAULT_COVER.binding;$('coverCaliper').value=String(cover.caliper??DEFAULT_COVER.caliper);$('coverBleed').value=String(cover.bleed??DEFAULT_COVER.bleed);$('coverSafe').value=String(cover.safe??DEFAULT_COVER.safe);const marketing={...DEFAULT_MARKETING,...(p.marketing||{})};$('marketingTagline').value=marketing.tagline;$('marketingBlurb').value=marketing.blurb||cover.backText||String(p.text||'').trim().slice(0,360);$('marketingCTA').value=marketing.cta;$('marketingURL').value=marketing.url;$('marketingTheme').value=marketing.theme;$('marketingFormat').value=marketing.format;$('marketingHashtags').value=marketing.hashtags;pageIndex=0;bookSpreadIndex=0;selectedSheetIndex=0;selectedSheetSide='front';bookPresentation='open';bookAngle='hero';undo=[];redo=[];renderProjects();refresh();void drawMarketingPoster();}
function newBook(){sync();store();let p=def();p.title='Untitled book '+(projects.length+1);projects.unshift(p);activeId=p.id;loadActive();}
function pdfReady(){if(!window.PDFLib?.PDFDocument)throw Error('PDF library did not load. Check internet access and refresh.');}
function pt(mm){return mm*MM;}
function roughMeasure(t,k='body'){return t.length*(+$('fontSize').value||11)*(k==='heading'?.54:.49);}
function opts(s,d,measure){return {pageWidthPt:pt(d.width),pageHeightPt:pt(d.height),fontSize:s.fontSize,lineSpacing:s.lineSpacing,columns:s.columns,topMarginPt:pt(s.marginTop),bottomMarginPt:pt(s.marginBottom),leftMarginPt:pt(s.marginInner+s.gutter),rightMarginPt:pt(s.marginOuter),columnGapPt:pt(5),chapterNewPage:s.chapterNewPage,measureText:measure,getImageInfo:id=>{const im=imageAssets.find(x=>x.id===id);return im?{aspectRatio:(Number(im.width)||4)/(Number(im.height)||3),widthPercent:im.widthPercent,widthPt:Number(im.widthMm)>0?pt(Number(im.widthMm)):0,heightPt:Number(im.heightMm)>0?pt(Number(im.heightMm)):0,offsetXPt:pt(Number(im.offsetXmm)||0),offsetYPt:pt(Number(im.offsetYmm)||0),align:im.align,caption:im.caption}:null;}};}
function compute(){let s=readSettings(),d=getPageDimensions(s);return paginateManuscript($('manuscript').value,opts(s,d,roughMeasure));}
function refresh(){try{sync();layouts=compute();pageIndex=Math.max(0,Math.min(pageIndex,layouts.length-1));$('words').textContent=wordCount($('manuscript').value).toLocaleString();$('chars').textContent=$('manuscript').value.length.toLocaleString();$('pages').textContent=layouts.length;$('pageIndex').textContent='Page '+(pageIndex+1)+' / '+layouts.length;$('pageLabel').textContent='Page '+(pageIndex+1)+' of '+layouts.length;renderReader();if(activePreviewView==='book')renderBookPreview();renderSheets();renderChecks();renderPrinter();renderProjects();showOutputOptions();if(typeof updateAIContext==='function')updateAIContext();store();}catch(e){status(e.message,'warn');}}
function readFileDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error||new Error('Could not read image file.'));reader.readAsDataURL(file);});}
async function normaliseBookImage(source,name){let dataURL=String(source||'');if(!dataURL.startsWith('data:image/')){const response=await fetch(dataURL,{mode:'cors'});if(!response.ok)throw new Error('Image URL could not be downloaded. Save it first, then upload the image file.');const blob=await response.blob();if(!/^image\/(png|jpeg|webp)$/i.test(blob.type))throw new Error('Only PNG, JPG and WebP images can be inserted.');dataURL=await readFileDataURL(new File([blob],name||'book-image',{type:blob.type}));}
 const image=new Image();image.src=dataURL;await image.decode();let width=image.naturalWidth,height=image.naturalHeight;if(!width||!height)throw new Error('Image dimensions could not be read.');const scale=Math.min(1,2200/Math.max(width,height));width=Math.max(1,Math.round(width*scale));height=Math.max(1,Math.round(height*scale));const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),originalMime=(dataURL.match(/^data:(image\/(?:png|jpeg|webp));/i)?.[1]||'image/png').toLowerCase();if(originalMime!=='image/png'){ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);}ctx.drawImage(image,0,0,width,height);let out=canvas.toDataURL(originalMime==='image/png'?'image/png':'image/jpeg',.88),mimeType=originalMime==='image/png'?'image/png':'image/jpeg';if(out.length>5_300_000&&mimeType==='image/png'){out=canvas.toDataURL('image/jpeg',.85);mimeType='image/jpeg';}if(out.length>5_600_000)throw new Error('Image is still too large after optimisation. Resize it before inserting.');return {data:out,mimeType,width,height,name:String(name||'Book image').slice(0,160)};}
function dataURLBytes(dataURL){const raw=String(dataURL||'').split(',')[1]||'',binary=atob(raw),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
async function addBookImage(source,name){const asset=await normaliseBookImage(source,name),id='img-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),keepRatio=$('imageKeepRatio')?.checked!==false;imageAssets.push({id,...asset,widthPercent:Number($('imageWidth')?.value)||80,widthMm:Number($('imageWidthMm')?.value)||0,heightMm:keepRatio?0:Number($('imageHeightMm')?.value)||0,offsetXmm:Number($('imageXmm')?.value)||0,offsetYmm:Number($('imageYmm')?.value)||0,align:$('imageAlign')?.value||'center',caption:String($('imageCaption')?.value||'').trim().slice(0,220)});const e=$('manuscript'),start=e.selectionStart??e.value.length,end=e.selectionEnd??start,prefix=start>0&&e.value[start-1]!=='\n'?'\n':'',suffix=end<e.value.length&&e.value[end]!=='\n'?'\n':'';undo.push(e.value);if(undo.length>80)undo.shift();redo=[];e.setRangeText(prefix+'[[IMAGE:'+id+']]'+suffix,start,end,'end');previousText=e.value;sync();pageIndex=0;refresh();e.focus();store(true);status('Image anchored at the cursor position in this book.','good');return id;}
function selectedImageAsset(){
 const e=$('manuscript'),value=e.value,start=e.selectionStart??0,end=e.selectionEnd??start;
 let id=value.slice(start,end).match(/\[\[IMAGE:([a-z0-9_-]+)\]\]/i)?.[1];
 if(!id){const left=value.lastIndexOf('[[IMAGE:',start),right=value.indexOf(']]',start);if(left>=0&&right>=start&&right-left<100)id=value.slice(left,right+2).match(/\[\[IMAGE:([a-z0-9_-]+)\]\]/i)?.[1];}
 return imageAssets.find(x=>x.id===id)||null;
}
function imageControlsFromAsset(im){
 if(!im){status('Select or place the cursor inside an [[IMAGE:...]] marker first.','warn');return;}
 const s=readSettings(),d=getPageDimensions(s),usable=d.width-s.marginInner-s.gutter-s.marginOuter-(s.columns-1)*5,width=Number(im.widthMm)>0?Number(im.widthMm):usable*(Number(im.widthPercent)||80)/100;
 $('imageWidthMm').value=width.toFixed(1);$('imageHeightMm').value=Number(im.heightMm)>0?Number(im.heightMm).toFixed(1):'';
 $('imageKeepRatio').checked=!(Number(im.heightMm)>0);$('imageHeightMm').disabled=$('imageKeepRatio').checked;
 $('imageXmm').value=Number(im.offsetXmm)||0;$('imageYmm').value=Number(im.offsetYmm)||0;
 $('imageAlign').value=im.align||'center';$('imageCaption').value=im.caption||'';
 $('selectedImageStatus').textContent='Selected: '+(im.name||'Book image')+' · '+width.toFixed(1)+' mm wide'+(im.heightMm?' × '+Number(im.heightMm).toFixed(1)+' mm':' · original proportions');
}
function loadSelectedImageSettings(){imageControlsFromAsset(selectedImageAsset());}
function applySelectedImageSettings(){
 const im=selectedImageAsset();if(!im){status('Select an image marker in the manuscript first.','warn');return;}
 const width=Number($('imageWidthMm').value),height=Number($('imageHeightMm').value),x=Number($('imageXmm').value||0),y=Number($('imageYmm').value||0);
 if(!Number.isFinite(width)||width<5||width>500)throw new Error('Image width must be between 5 and 500 mm.');
 if(!$('imageKeepRatio').checked&&(!Number.isFinite(height)||height<5||height>700))throw new Error('Image height must be between 5 and 700 mm when proportions are unlocked.');
 if(!Number.isFinite(x)||Math.abs(x)>200||!Number.isFinite(y)||Math.abs(y)>200)throw new Error('Image X/Y offsets must be between -200 and 200 mm.');
 im.widthMm=width;im.heightMm=$('imageKeepRatio').checked?0:height;im.widthPercent=80;im.offsetXmm=x;im.offsetYmm=y;im.align=$('imageAlign').value;im.caption=$('imageCaption').value.trim().slice(0,220);
 sync();refresh();store(true);imageControlsFromAsset(im);status('Image dimensions and position updated. Check the Book Preview before exporting.','good');
}
$('imageKeepRatio').addEventListener('change',()=>{$('imageHeightMm').disabled=$('imageKeepRatio').checked;if($('imageKeepRatio').checked)$('imageHeightMm').value='';});
$('loadImageSettings').addEventListener('click',loadSelectedImageSettings);
$('applyImageSettings').addEventListener('click',()=>{try{applySelectedImageSettings();}catch(e){status(e.message,'warn');alert(e.message);}});

$('insertImage')?.addEventListener('click',()=>$('bookImageFile').click());
$('bookImageFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>8_000_000){alert('Choose an image smaller than 8 MB.');e.target.value='';return;}try{await addBookImage(await readFileDataURL(file),file.name);}catch(err){alert('Image insert failed: '+err.message);}e.target.value='';});
$('insertFootnote')?.addEventListener('click',()=>{const e=$('manuscript'),ids=[...e.value.matchAll(/\[\^note-(\d+)\]/g)].map(m=>Number(m[1])).filter(Number.isFinite),id='note-'+(Math.max(0,...ids)+1),start=e.selectionStart??e.value.length,end=e.selectionEnd??start;undo.push(e.value);if(undo.length>80)undo.shift();redo=[];e.setRangeText('[^'+id+']',start,end,'end');e.value=e.value.replace(/\s*$/,'')+'\n\n[^'+id+']: Write the footnote text here.';previousText=e.value;pageIndex=0;refresh();e.focus();status('Footnote reference added. Replace the placeholder before Word export.','good');});
function renderReader(){const s=readSettings(),d=getPageDimensions(s),w=Math.min(430,Math.max(205,window.innerWidth-92)),scale=w/d.width,paper=$('paper');paper.style.width=w+'px';paper.style.height=d.height*scale+'px';const host=$('papertext');host.replaceChildren();const pg=layouts[pageIndex]||{columns:[[]]},usable=d.width-s.marginInner-s.gutter-s.marginOuter,gap=5,cw=(usable-(s.columns-1)*gap)/s.columns;
 for(let c=0;c<pg.columns.length;c++)for(const l of pg.columns[c]){const columnLeft=s.marginInner+s.gutter+c*(cw+gap),topPx=(s.marginTop+l.yTopPt*25.4/72)*scale;if(l.kind==='image'){const im=imageAssets.find(x=>x.id===l.imageId);if(!im)continue;const wm=l.imageWidthPt*25.4/72,hm=l.imageHeightPt*25.4/72,baseLeft=columnLeft+(l.imageAlign==='right'?cw-wm:l.imageAlign==='center'?(cw-wm)/2:0),lm=baseLeft+(l.imageOffsetXPt||0)*25.4/72,img=document.createElement('img');img.className='paperimage';img.alt=im.caption||im.name||'Book illustration';img.src=im.data;img.style.left=(lm*scale)+'px';img.style.top=((s.marginTop+(l.yTopPt+(l.imageOffsetYPt||0))*25.4/72)*scale)+'px';img.style.width=(wm*scale)+'px';img.style.height=(hm*scale)+'px';host.append(img);if(l.caption){const cap=document.createElement('div');cap.className='papercaption';cap.textContent=l.caption;cap.style.left=(lm*scale)+'px';cap.style.top=((s.marginTop+(l.yTopPt+(l.imageOffsetYPt||0)+l.imageHeightPt+3)*25.4/72)*scale)+'px';cap.style.width=(wm*scale)+'px';host.append(cap);}continue;}if(l.kind==='blank'||!l.text)continue;const el=document.createElement('div');el.className='paperline';el.textContent=l.text;el.style.left=(columnLeft*scale)+'px';el.style.top=topPx+'px';el.style.width=(cw*scale)+'px';el.style.fontSize=(s.fontSize*25.4/72*scale)+'px';if(l.kind==='heading')el.style.fontWeight='bold';el.style.textAlign=s.textAlign||'left';host.append(el);}
 $('pagenum').textContent=s.pageNumbers?pageIndex+1:'';$('pagenum').style.display=s.pageNumbers?'block':'none';$('prev').disabled=pageIndex===0;$('next').disabled=pageIndex>=layouts.length-1;}

function bookSpreadForPage(index){return getBookSpreadForPage(index,layouts.length);}
function bookLeftIndex(spread){return getBookSpread(layouts.length,spread).leftIndex;}
function bookRightIndex(spread){return getBookSpread(layouts.length,spread).rightIndex;}
function renderBookPage(slot,index,pageWidth){
 slot.replaceChildren();const s=readSettings(),d=getPageDimensions(s),scale=pageWidth/d.width,page=document.createElement('div');
 page.className='book-page'+(index<0?' blank-page':'');page.style.width=pageWidth+'px';page.style.height=(d.height*scale)+'px';
 if(index<0){slot.append(page);return;}
 const content=document.createElement('div');content.className='book-page-content';page.append(content);
 const pg=layouts[index]||{columns:[[]]},usable=d.width-s.marginInner-s.gutter-s.marginOuter,gap=5,cw=(usable-(s.columns-1)*gap)/s.columns;
 for(let c=0;c<pg.columns.length;c++)for(const l of pg.columns[c]){
  const columnLeft=s.marginInner+s.gutter+c*(cw+gap),top=(s.marginTop+l.yTopPt*25.4/72)*scale;
  if(l.kind==='image'){
   const im=imageAssets.find(x=>x.id===l.imageId);if(!im)continue;
   const wm=l.imageWidthPt*25.4/72,hm=l.imageHeightPt*25.4/72,baseLeft=columnLeft+(l.imageAlign==='right'?cw-wm:l.imageAlign==='center'?(cw-wm)/2:0),lm=baseLeft+(l.imageOffsetXPt||0)*25.4/72;
   const img=document.createElement('img');img.className='book-page-image';img.alt=im.caption||im.name||'Book image';img.src=im.data;img.style.left=(lm*scale)+'px';img.style.top=((s.marginTop+(l.yTopPt+(l.imageOffsetYPt||0))*25.4/72)*scale)+'px';img.style.width=(wm*scale)+'px';img.style.height=(hm*scale)+'px';content.append(img);
   if(l.caption){const cap=document.createElement('div');cap.className='book-page-caption';cap.textContent=l.caption;cap.style.left=(lm*scale)+'px';cap.style.top=((s.marginTop+(l.yTopPt+(l.imageOffsetYPt||0)+l.imageHeightPt+3)*25.4/72)*scale)+'px';cap.style.width=(wm*scale)+'px';content.append(cap);}continue;
  }
  if(l.kind==='blank'||!l.text)continue;
  const line=document.createElement('div');line.className='book-page-line'+(l.kind==='heading'?' book-page-heading':'');line.textContent=l.text;line.style.left=(columnLeft*scale)+'px';line.style.top=top+'px';line.style.width=(cw*scale)+'px';line.style.fontSize=(s.fontSize*25.4/72*scale)+'px';line.style.textAlign=s.textAlign||'left';content.append(line);
 }
 if(s.pageNumbers){const number=document.createElement('span');number.className='book-page-number';number.textContent=String(index+1);page.append(number);}
 slot.append(page);
}
function renderBookSpread(leftIndex,rightIndex,pageWidth){renderBookPage($('bookLeft'),leftIndex,pageWidth);renderBookPage($('bookRight'),rightIndex,pageWidth);}
function getCoverMetrics(){
 const d=getPageDimensions(readSettings()),cover=readCoverSettings(),pageCount=Math.max(1,layouts.length),caliper=Math.min(.3,Math.max(.04,Number(cover.caliper)||.1));
 let spine=cover.binding==='saddle'?Math.max(.35,caliper*2):pageCount/2*caliper;if(cover.binding==='hardcover')spine+=4;
 const bleed=Math.max(0,Math.min(10,Number(cover.bleed)||0)),safe=Math.max(0,Math.min(30,Number(cover.safe)||0));
 return {pageWidth:d.width,pageHeight:d.height,pageCount,caliper,spine,binding:cover.binding,bleed,safe,totalWidth:d.width*2+spine+bleed*2,totalHeight:d.height+bleed*2,cover};
}
function renderClosedCover(){
 const m=getCoverMetrics(),cover=m.cover,template=['classic','noir','modern','editorial','botanical','minimal'].includes(cover.template)?cover.template:'classic',book=$('closedBook'),stage=$('closedBookStage');
 book.className='closed-book cover-'+template;stage.className='closed-book-stage angle-'+bookAngle;
 book.style.setProperty('--cover-accent',cover.accent||DEFAULT_COVER.accent);book.style.setProperty('--book-depth',Math.max(8,Math.min(38,m.spine*1.8))+'px');
 book.style.width='270px';book.style.height=(270*m.pageHeight/m.pageWidth)+'px';
 $('closedCoverTitle').textContent=$('title').value.trim()||'Untitled book';$('closedCoverSubtitle').textContent=cover.subtitle;$('closedCoverKicker').textContent=cover.kicker;
 $('closedCoverAuthor').textContent=$('author').value.trim()?('By '+$('author').value.trim()):'';$('closedSpineTitle').textContent=$('title').value.trim()||'Untitled book';
 const excerpt=String($('manuscript').value||'').split(/\n\s*\n/).map(x=>x.replace(/^#+\s*/,'').trim()).find(x=>x&&!/^\[/.test(x))||'';
 $('closedBackText').textContent=cover.backText||excerpt.slice(0,520);
 const image=$('closedCoverImage');if(cover.artwork){image.src=cover.artwork;image.classList.remove('hidden');book.classList.add('cover-artwork-loaded');}else{image.removeAttribute('src');image.classList.add('hidden');book.classList.remove('cover-artwork-loaded');}
}
function renderCoverSpread(){
 const m=getCoverMetrics(),c=m.cover,template=['classic','noir','modern','editorial','botanical','minimal'].includes(c.template)?c.template:'classic',trimW=m.pageWidth*2+m.spine,root=$('coverSpreadBleed');
 root.style.setProperty('--cover-spread-ratio',m.totalWidth/m.totalHeight);
 root.style.setProperty('--bleed-x',(m.bleed/m.totalWidth*100)+'%');root.style.setProperty('--bleed-y',(m.bleed/m.totalHeight*100)+'%');
 root.style.setProperty('--cover-back-share',(m.pageWidth/trimW*100)+'%');root.style.setProperty('--cover-spine-share',(m.spine/trimW*100)+'%');root.style.setProperty('--cover-front-share',(m.pageWidth/trimW*100)+'%');
 root.style.setProperty('--cover-safe-x',(m.safe/m.pageWidth*100)+'%');root.style.setProperty('--cover-safe-y',(m.safe/m.pageHeight*100)+'%');root.style.setProperty('--cover-accent',c.accent||DEFAULT_COVER.accent);
 $('coverSpreadFrontPanel').className='cover-spread-panel cover-spread-front cover-'+template;
 $('coverSpreadDimensions').textContent='Outside size incl. bleed: '+m.totalWidth.toFixed(1)+' × '+m.totalHeight.toFixed(1)+' mm';
 $('coverSpineEstimate').textContent='Estimated spine '+m.spine.toFixed(2)+' mm · '+m.pageCount+' reader pages · '+m.binding+' · '+m.caliper.toFixed(3)+' mm leaf caliper';
 $('coverSpreadFrontTitle').textContent=$('title').value.trim()||'Untitled book';$('coverSpreadSubtitle').textContent=c.subtitle;$('coverSpreadKicker').textContent=c.kicker;
 $('coverSpreadAuthor').textContent=$('author').value.trim()?('By '+$('author').value.trim()):'';$('coverSpreadSpineTitle').textContent=$('title').value.trim()||'Untitled book';
 const excerpt=String($('manuscript').value||'').split(/\n\s*\n/).map(x=>x.replace(/^#+\s*/,'').trim()).find(x=>x&&!/^\[/.test(x))||'';
 $('coverSpreadBackText').textContent=c.backText||excerpt.slice(0,520);
 const image=$('coverSpreadArtwork');if(c.artwork){image.src=c.artwork;image.classList.remove('hidden');}else{image.removeAttribute('src');image.classList.add('hidden');}
}
function renderBookPreview(){
 if(activePreviewView!=='book')return;
 const wrap=$('bookPreviewWrap'),openView=$('bookOpenView'),closedView=$('bookClosedView'),coverView=$('bookCoverView'),isOpen=bookPresentation==='open',isCover=bookPresentation==='cover';
 openView.classList.toggle('hidden',!isOpen);closedView.classList.toggle('hidden',!(isCover&&bookVisualMode==='3d'));coverView.classList.toggle('hidden',!(isCover&&bookVisualMode==='2d'));
 wrap.classList.toggle('book-mode-flat',bookVisualMode==='2d');wrap.classList.toggle('book-mode-3d',bookVisualMode==='3d');
 document.querySelectorAll('[data-book-presentation]').forEach(b=>{const on=b.dataset.bookPresentation===bookPresentation;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 document.querySelectorAll('[data-book-style]').forEach(b=>{const on=b.dataset.bookStyle===bookVisualMode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 document.querySelectorAll('[data-book-angle]').forEach(b=>{const on=b.dataset.bookAngle===bookAngle;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 $('bookAngleControls').classList.toggle('visible',isCover&&bookVisualMode==='3d');
 if(isCover){renderClosedCover();renderCoverSpread();$('bookPageLabel').textContent=bookVisualMode==='2d'?'Full cover wrap · Back / Spine / Front':'3D book mockup · '+($('title').value.trim()||'Untitled book');return;}
 const viewport=$('bookViewport'),width=Math.max(320,viewport.clientWidth||viewport.getBoundingClientRect().width||640),pageWidth=Math.max(145,Math.min(340,(width-34)/2)),pageDims=getPageDimensions(readSettings()),spread=getBookSpread(layouts.length,bookSpreadIndex);
 $('bookOpen').style.setProperty('--book-page-width',pageWidth+'px');$('bookOpen').style.height=(pageDims.height*pageWidth/pageDims.width)+'px';
 renderBookSpread(spread.leftIndex,spread.rightIndex,pageWidth);
 $('bookPageLabel').textContent=spread.leftPage&&spread.rightPage?'Pages '+spread.leftPage+'–'+spread.rightPage:spread.leftPage?'Page '+spread.leftPage+' · final page':'Opening · Page 1 on the right';
 $('bookPrev').disabled=!spread.hasPrevious;$('bookNext').disabled=!spread.hasNext;
 $('bookHint').textContent='Page 1 starts on the right; page 2 turns to the left · '+layouts.length+' reader pages';
}
function flipBook(direction){
 if(bookFlipBusy||bookPresentation!=='open')return;
 const from=bookSpreadIndex,to=direction==='forward'?from+1:from-1,current=getBookSpread(layouts.length,bookSpreadIndex);
 if(to<0||to>current.maxSpread)return;
 if(bookVisualMode==='2d'){bookSpreadIndex=to;const target=getBookSpread(layouts.length,to);pageIndex=target.leftIndex>=0?target.leftIndex:0;renderBookPreview();renderReader();return;}
 bookFlipBusy=true;const token=++bookFlipToken,viewport=$('bookViewport'),width=Math.max(320,viewport.clientWidth||viewport.getBoundingClientRect().width||640),pageWidth=Math.max(145,Math.min(340,(width-34)/2)),turn=$('bookTurn'),front=$('bookTurnFront'),back=$('bookTurnBack'),pageDims=getPageDimensions(readSettings()),target=getBookSpread(layouts.length,to);
 $('bookOpen').style.setProperty('--book-page-width',pageWidth+'px');$('bookOpen').style.height=(pageDims.height*pageWidth/pageDims.width)+'px';
 if(direction==='forward'){
  renderBookSpread(current.leftIndex,target.rightIndex,pageWidth);renderBookPage(front,current.rightIndex,pageWidth);renderBookPage(back,target.leftIndex,pageWidth);
  turn.className='book-turn forward';turn.style.left='50%';turn.style.right='0';turn.style.transformOrigin='left center';
 }else{
  renderBookSpread(target.leftIndex,current.rightIndex,pageWidth);renderBookPage(front,current.leftIndex,pageWidth);renderBookPage(back,target.rightIndex,pageWidth);
  turn.className='book-turn backward';turn.style.left='0';turn.style.right='50%';turn.style.transformOrigin='right center';
 }
 turn.style.transition='';turn.style.transform='rotateY(0deg)';void turn.offsetWidth;
 let settled=false,timer=0;
 const settle=()=>{
  if(settled||token!==bookFlipToken)return;settled=true;clearTimeout(timer);turn.removeEventListener('transitionend',onEnd);bookFlipBusy=false;
  // Reset with transitions disabled; otherwise the completed leaf visibly flips back to zero.
  turn.style.transition='none';turn.className='book-turn';turn.style.left='50%';turn.style.right='0';turn.style.transformOrigin='left center';turn.style.transform='rotateY(0deg)';front.replaceChildren();back.replaceChildren();
  bookSpreadIndex=to;pageIndex=target.leftIndex>=0?target.leftIndex:0;renderBookPreview();renderReader();void turn.offsetHeight;requestAnimationFrame(()=>{turn.style.transition='';});
 };
 const onEnd=e=>{if(e.target===turn&&e.propertyName==='transform')settle();};
 turn.addEventListener('transitionend',onEnd);requestAnimationFrame(()=>requestAnimationFrame(()=>{turn.style.transform=direction==='forward'?'rotateY(-180deg)':'rotateY(180deg)';}));timer=setTimeout(settle,900);
}
function exportShareableReader(){
 sync();if(!layouts.length)throw new Error('Add some manuscript text before exporting a reader.');
 const renderWidth=340,d=getPageDimensions(readSettings()),pages=layouts.map((_,i)=>{const host=document.createElement('div');renderBookPage(host,i,renderWidth);return host.innerHTML;});
 const payload={title:$('title').value.trim()||'Untitled book',author:$('author').value.trim(),cover:readCoverSettings(),pageWidth:renderWidth,pageHeight:d.height*renderWidth/d.width,pages};
 const html=buildShareableReaderHTML(payload);download(html,filename('interactive-reader','html'),'text/html;charset=utf-8');
 status('Standalone interactive reader exported. Send the .html file as an attachment; it contains the formatted pages, cover and embedded images.','good');
}
function exportCoverSpreadSVG(){
 const m=getCoverMetrics(),c=m.cover,title=$('title').value.trim()||'Untitled book',author=$('author').value.trim(),W=m.totalWidth,H=m.totalHeight,B=m.bleed,S=m.safe,P=m.pageWidth,T=m.pageHeight,sp=m.spine,frontX=B+P+sp;
 const palettes={classic:['#1b2037','#20243a','#d7b66e','#f7f0e4'],noir:['#11151d','#111a25','#d7b66e','#f3eee4'],modern:['#1456a0','#152547','#d8e5ff','#ffffff'],editorial:['#f7f1e7','#e9e1cf','#887650','#263247'],botanical:['#142d28','#18352d','#c6d3a5','#f0f3e9'],minimal:['#f1eee6','#f1eee6','#9a8053','#202124']};
 const p=palettes[c.template]||palettes.classic,esc=xmlEscape;
 const words=String(c.backText||$('manuscript').value||'').trim().split(/\s+/),lines=[];let line='';
 for(const word of words){if((line+' '+word).trim().length>Math.max(18,Math.floor(P/1.7))&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}
 if(line)lines.push(line);
 const backNodes=lines.slice(0,12).map((x,i)=>'<tspan x="'+(B+12)+'" dy="'+(i?5:0)+'">'+esc(x)+'</tspan>').join('');
 const art=c.artwork?'<image href="'+esc(c.artwork)+'" x="'+frontX+'" y="'+B+'" width="'+P+'" height="'+T+'" preserveAspectRatio="xMidYMid slice"/>':'';
 const fontSize=Math.min(18,Math.max(10,Math.min(P,T)*.09));
 const svg=[
 '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+W+'mm" height="'+H+'mm" viewBox="0 0 '+W+' '+H+'">',
 '<defs><linearGradient id="front" x2="0" y2="1"><stop stop-color="'+p[0]+'"/><stop offset="1" stop-color="'+p[1]+'"/></linearGradient><linearGradient id="spine" x2="1"><stop stop-color="#101726"/><stop offset=".5" stop-color="'+p[0]+'"/><stop offset="1" stop-color="#101726"/></linearGradient></defs>',
 '<rect width="'+W+'" height="'+H+'" fill="#f5dede"/><rect x="'+B+'" y="'+B+'" width="'+(W-2*B)+'" height="'+(H-2*B)+'" fill="'+p[0]+'"/>',
 '<rect x="'+B+'" y="'+B+'" width="'+P+'" height="'+T+'" fill="'+p[1]+'"/><rect x="'+(B+P)+'" y="'+B+'" width="'+sp+'" height="'+T+'" fill="url(#spine)"/><rect x="'+frontX+'" y="'+B+'" width="'+P+'" height="'+T+'" fill="url(#front)"/>',
 art,
 '<rect x="'+(frontX+S)+'" y="'+(B+S)+'" width="'+(P-2*S)+'" height="'+(T-2*S)+'" fill="none" stroke="'+p[2]+'" stroke-width=".25" stroke-dasharray="2 1"/>',
 '<rect x="'+(B+S)+'" y="'+(B+S)+'" width="'+(P-2*S)+'" height="'+(T-2*S)+'" fill="none" stroke="'+p[2]+'" stroke-width=".25" stroke-dasharray="2 1"/>',
 '<rect x="'+(frontX+S+5)+'" y="'+(B+S+5)+'" width="'+(P-2*S-10)+'" height="'+(T-2*S-10)+'" fill="none" stroke="'+p[2]+'" stroke-width=".35"/>',
 '<text x="'+(frontX+P/2)+'" y="'+(B+T*.28)+'" fill="'+p[2]+'" font-family="Georgia,serif" font-size="'+Math.min(7,fontSize*.55)+'" text-anchor="middle" letter-spacing="1.1">'+esc(c.kicker)+'</text>',
 '<text x="'+(frontX+P/2)+'" y="'+(B+T*.48)+'" fill="'+p[3]+'" font-family="Georgia,serif" font-size="'+fontSize+'" font-weight="bold" text-anchor="middle">'+esc(title.slice(0,55))+'</text>',
 '<text x="'+(frontX+P/2)+'" y="'+(B+T*.58)+'" fill="'+p[3]+'" font-family="Georgia,serif" font-size="'+Math.min(5,fontSize*.35)+'" font-style="italic" text-anchor="middle">'+esc(c.subtitle.slice(0,80))+'</text>',
 '<text x="'+(frontX+P/2)+'" y="'+(B+T*.88)+'" fill="'+p[2]+'" font-family="Arial,sans-serif" font-size="'+Math.min(5,fontSize*.32)+'" text-anchor="middle" letter-spacing=".8">'+esc(author.toUpperCase().slice(0,55))+'</text>',
 '<text x="'+(B+12)+'" y="'+(B+18)+'" fill="'+p[2]+'" font-family="Arial,sans-serif" font-size="4" letter-spacing=".8">BACK COVER</text>',
 '<text x="'+(B+12)+'" y="'+(B+34)+'" fill="'+p[3]+'" font-family="Georgia,serif" font-size="4.5">'+backNodes+'</text>',
 '<rect x="'+(B+P-42)+'" y="'+(B+T-31)+'" width="32" height="21" fill="#fff"/><text x="'+(B+P-26)+'" y="'+(B+T-19)+'" fill="#333" text-anchor="middle" font-family="Arial,sans-serif" font-size="2.7">ISBN / BARCODE</text>',
 '<text transform="translate('+(B+P+sp/2)+','+(B+T/2)+') rotate(-90)" fill="'+p[2]+'" text-anchor="middle" font-family="Georgia,serif" font-size="'+Math.max(3,Math.min(6,sp*.45))+'">'+esc(title.slice(0,75))+'</text>',
 '<rect x="'+B+'" y="'+B+'" width="'+(W-2*B)+'" height="'+(H-2*B)+'" fill="none" stroke="#1c293b" stroke-width=".3"/>',
 '<text x="'+(W/2)+'" y="'+(H-1)+'" text-anchor="middle" font-family="Arial,sans-serif" font-size="2.5" fill="#9b4444">BLEED '+B.toFixed(1)+' mm · ESTIMATED SPINE '+sp.toFixed(2)+' mm · '+W.toFixed(1)+' × '+H.toFixed(1)+' mm</text></svg>'
 ].join('');
 download(svg,filename('cover-spread','svg'),'image/svg+xml;charset=utf-8');status('Full wrap SVG downloaded. Open in CorelDRAW and confirm spine/bleed with your print vendor before production.','good');
}
function wrapCanvasText(ctx,text,x,y,maxWidth,lineHeight,maxLines=3){
 const words=String(text||'').split(/\s+/).filter(Boolean),lines=[];let line='';
 for(const word of words){const test=(line+' '+word).trim();if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}
 if(line)lines.push(line);
 const shown=lines.slice(0,maxLines);if(lines.length>maxLines&&shown.length){let last=shown[shown.length-1];while(last.length&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);shown[shown.length-1]=last+'…';}
 shown.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));return y+shown.length*lineHeight;
}
function marketingCaptionText(){
 const m=readMarketingSettings(),title=$('title').value.trim()||'A new book',author=$('author').value.trim(),url=m.url.trim();
 return [title+(author?' — '+author:''),m.tagline,m.blurb,m.cta+(url?' · '+url:''),m.hashtags].filter(Boolean).join('\n\n');
}
async function drawMarketingPoster(){
 const canvas=$('marketingCanvas');if(!canvas)return;
 const m=readMarketingSettings(),format=m.format,dimensions=format==='square'?[1080,1080]:format==='story'?[1080,1920]:[1080,1350],[W,H]=dimensions;
 canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d'),themes={
  noir:{a:'#111827',b:'#2d3b58',accent:'#d8bd79',ink:'#fff8e9',muted:'#d9dce4'},
  classic:{a:'#241d31',b:'#67495a',accent:'#e1c27b',ink:'#fff8e9',muted:'#e7dcca'},
  editorial:{a:'#f4eee2',b:'#e4dac8',accent:'#8e734d',ink:'#263247',muted:'#5f6470'},
  botanical:{a:'#102c26',b:'#37644e',accent:'#d4dda9',ink:'#f4f4e7',muted:'#d4e2d8'},
  modern:{a:'#0d2851',b:'#2168ad',accent:'#7ce4e2',ink:'#fff',muted:'#d1e6f8'}
 },p=themes[m.theme]||themes.noir,scale=W/1080;
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,p.a);bg.addColorStop(1,p.b);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.globalAlpha=.14;ctx.strokeStyle=p.accent;ctx.lineWidth=2*scale;
 for(let i=0;i<7;i++){ctx.beginPath();ctx.arc(W*.9,H*.12,90*scale+i*45*scale,0,Math.PI*2);ctx.stroke();}ctx.restore();
 ctx.textAlign='center';ctx.fillStyle=p.accent;ctx.font='800 '+Math.round(22*scale)+'px Arial';ctx.fillText('BOOK RELEASE  ·  NEW TITLE',W/2,H*.075);
 const title=$('title').value.trim()||'Untitled book';ctx.fillStyle=p.ink;ctx.font='700 '+Math.round((title.length>30?58:70)*scale)+'px Georgia,serif';
 const titleBottom=wrapCanvasText(ctx,title,W/2,H*.17,W*.84,Math.round(76*scale),2);
 ctx.fillStyle=p.muted;ctx.font='italic '+Math.round(25*scale)+'px Georgia,serif';ctx.fillText($('author').value.trim()?('A book by '+$('author').value.trim()):'A new book to discover',W/2,titleBottom+20*scale);
 const page=getPageDimensions(readSettings()),coverH=Math.min(H*.39,Math.max(360*scale,H*.39)),coverW=coverH*page.width/page.height,x=(W-coverW)/2,y=H*.34;
 ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=35*scale;ctx.shadowOffsetY=22*scale;ctx.fillStyle='#fff';ctx.fillRect(x,y,coverW,coverH);ctx.restore();
 const cover=readCoverSettings(),template=cover.template,coverColors={classic:['#22223b','#58415c'],noir:['#111820','#273747'],modern:['#1456a0','#152547'],editorial:['#e9e1cf','#f7f1e7'],botanical:['#17382e','#4b7555'],minimal:['#f1eee6','#f1eee6']}[template]||['#22223b','#58415c'];
 const cg=ctx.createLinearGradient(x,y,x+coverW,y+coverH);cg.addColorStop(0,coverColors[0]);cg.addColorStop(1,coverColors[1]);ctx.fillStyle=cg;ctx.fillRect(x,y,coverW,coverH);
 let image=null;if(cover.artwork){image=await new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=cover.artwork;});}
 if(image){ctx.save();ctx.globalAlpha=.9;const ir=image.width/image.height,cr=coverW/coverH;let sx=0,sy=0,sw=image.width,sh=image.height;if(ir>cr){sw=image.height*cr;sx=(image.width-sw)/2;}else{sh=image.width/cr;sy=(image.height-sh)/2;}ctx.drawImage(image,sx,sy,sw,sh,x,y,coverW,coverH);ctx.restore();ctx.fillStyle='#11182755';ctx.fillRect(x,y,coverW,coverH);}
 const inset=coverW*.07;ctx.strokeStyle=cover.accent||p.accent;ctx.lineWidth=2*scale;ctx.strokeRect(x+inset,y+inset,coverW-2*inset,coverH-2*inset);
 ctx.fillStyle=cover.accent||p.accent;ctx.font='800 '+Math.round(14*scale)+'px Arial';ctx.textAlign='center';ctx.fillText(cover.kicker||'A NOVEL',W/2,y+coverH*.27);
 ctx.fillStyle='#fffaf0';ctx.font='700 '+Math.round(Math.min(coverW*.105,36*scale))+'px Georgia,serif';wrapCanvasText(ctx,title,W/2,y+coverH*.48,coverW*.78,Math.round(40*scale),3);
 ctx.fillStyle='#fff7e2';ctx.font='italic '+Math.round(15*scale)+'px Georgia,serif';wrapCanvasText(ctx,cover.subtitle,W/2,y+coverH*.72,coverW*.76,Math.round(20*scale),2);
 ctx.fillStyle=cover.accent||p.accent;ctx.font='700 '+Math.round(12*scale)+'px Arial';ctx.fillText(($('author').value.trim()||'BOOKFLOW EDITION').toUpperCase(),W/2,y+coverH*.9);
 const taglineY=Math.min(H*.81,y+coverH+70*scale);ctx.fillStyle=p.accent;ctx.font='700 '+Math.round(28*scale)+'px Georgia,serif';wrapCanvasText(ctx,m.tagline,W/2,taglineY,W*.84,Math.round(34*scale),2);
 ctx.fillStyle=p.muted;ctx.font=Math.round(16*scale)+'px Arial';const blurb=m.blurb||cover.backText||'Open the book and discover the story.';wrapCanvasText(ctx,blurb,W/2,Math.min(H*.89,taglineY+72*scale),W*.8,Math.round(23*scale),3);
 const ctaY=H-70*scale;ctx.fillStyle=p.accent;ctx.font='800 '+Math.round(20*scale)+'px Arial';ctx.fillText((m.cta||'Discover the story').toUpperCase(),W/2,ctaY);
 if(m.url){ctx.fillStyle=p.muted;ctx.font=Math.round(13*scale)+'px Arial';ctx.fillText(m.url.replace(/^https?:\/\//,''),W/2,ctaY+28*scale);}
 $('marketingPreviewInfo').textContent=format==='square'?'Square · 1080 × 1080':format==='story'?'Story · 1080 × 1920':'Portrait · 1080 × 1350';
 $('marketingOutputNote').textContent='Campaign artwork uses your title, author, cover and editable copy. PNG export is ready to upload.';
 return canvas;
}
async function copyMarketingCaption(){
 const value=marketingCaptionText();
 try{await navigator.clipboard.writeText(value);status('Launch caption copied. Paste it into your social post.','good');}
 catch{const box=document.createElement('textarea');box.value=value;document.body.append(box);box.select();const ok=document.execCommand('copy');box.remove();status(ok?'Launch caption copied.':'Clipboard permission was blocked; copy the caption manually.',ok?'good':'warn');}
}
async function exportMarketingPNG(){
 try{await drawMarketingPoster();const canvas=$('marketingCanvas');canvas.toBlob(blob=>{if(!blob){status('Could not encode the poster PNG.','warn');return;}download(blob,filename('social-promo','png'),'image/png');status('Social promo poster exported as PNG.','good');},'image/png');}
 catch(e){status('Poster export failed: '+e.message,'warn');alert(e.message);}
}
function buildReaderPayload(){
 const renderWidth=340,d=getPageDimensions(readSettings()),pages=layouts.map((_,i)=>{const host=document.createElement('div');renderBookPage(host,i,renderWidth);return host.innerHTML;});
 return {title:$('title').value.trim()||'Untitled book',author:$('author').value.trim(),cover:readCoverSettings(),pageWidth:renderWidth,pageHeight:d.height*renderWidth/d.width,pages};
}
async function exportMarketingLanding(){
 try{
  await drawMarketingPoster();const m=readMarketingSettings(),poster=$('marketingCanvas').toDataURL('image/png'),readerHTML=buildShareableReaderHTML(buildReaderPayload());
  const safeReader=JSON.stringify(readerHTML).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  const safeTitle=xmlEscape($('title').value.trim()||'Untitled book'),safeAuthor=xmlEscape($('author').value.trim()),safeBlurb=xmlEscape(m.blurb||readCoverSettings().backText);
  let target='';try{const u=new URL(m.url);if(['http:','https:'].includes(u.protocol))target=u.href;}catch{}
  const cta=target?'<a class="cta" href="'+xmlEscape(target)+'" target="_blank" rel="noopener">'+xmlEscape(m.cta)+'</a>':'<button class="cta" id="downloadReader">Download interactive reader</button>';
  const page='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="'+safeBlurb.slice(0,300)+'"><title>'+safeTitle+' · Book</title><style>*{box-sizing:border-box}body{margin:0;background:#101827;color:#f4f0e8;font:16px/1.6 system-ui,Arial,sans-serif}.wrap{max-width:920px;margin:0 auto;padding:30px 16px 70px;text-align:center}.poster{display:block;width:min(100%,580px);height:auto;margin:0 auto 28px;border-radius:10px;box-shadow:0 18px 45px #0008}.title{font:700 clamp(30px,7vw,54px)/1.08 Georgia,serif;margin:10px 0}.author{color:#d8bd79}.blurb{max-width:620px;margin:22px auto;color:#d7deea;white-space:pre-wrap}.cta{display:inline-block;padding:14px 22px;border-radius:999px;background:#d8bd79;color:#182134;font-weight:800;text-decoration:none;border:0;cursor:pointer;font-size:15px}.foot{margin-top:35px;color:#9aa8bd;font-size:12px}</style></head><body><main class="wrap"><img class="poster" src="'+poster+'" alt="Book campaign poster"><h1 class="title">'+safeTitle+'</h1><div class="author">'+safeAuthor+'</div><p class="blurb">'+safeBlurb+'</p>'+cta+'<div class="foot">Book preview prepared with BookFlow Studio</div></main><script>const readerHTML='+safeReader+';document.getElementById("downloadReader")?.addEventListener("click",()=>{const url=URL.createObjectURL(new Blob([readerHTML],{type:"text/html;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="book-reader.html";a.click();setTimeout(()=>URL.revokeObjectURL(url),4000)});</script></body></html>';
  download(page,filename('book-landing-page','html'),'text/html;charset=utf-8');status('Standalone book landing page exported. Add it to your website or send the file; it includes a reader download when no store link is supplied.','good');
 }catch(e){status('Landing page export failed: '+e.message,'warn');alert(e.message);}
}
function imposition(){return createImposition(layouts.length,+$('signature').value);}
function renderSheetPreview(r=imposition()){
 const host=$('sheetPhysical'),dims=getSheetDimensions(readSettings()),geo=calculateImpositionGeometry(readSettings()),sheet=r.spreads[selectedSheetIndex];if(!host||!sheet)return;
 const nums=sheet[selectedSheetSide];
 $('sheetPreviewIndex').value=String(selectedSheetIndex);$('sheetPreviewDimensions').textContent=dims.width+' × '+dims.height+' mm · '+nums.map(n=>n===null?'Blank':'Page '+n).join(' / ');
 $('sheetPreviewCaption').textContent='Sheet '+(selectedSheetIndex+1)+' of '+r.spreads.length+' · Signature '+(sheet.signatureIndex+1)+' · '+(selectedSheetSide==='front'?'Front side':'Reverse side')+' · '+$('flip').selectedOptions[0].textContent;
 document.querySelectorAll('[data-sheet-side]').forEach(b=>b.classList.toggle('active',b.dataset.sheetSide===selectedSheetSide));
 $('sheetPrev').disabled=selectedSheetIndex<=0;$('sheetNext').disabled=selectedSheetIndex>=r.spreads.length-1;
 const canvasWidth=Math.min(760,Math.max(320,host.clientWidth||760));host.style.aspectRatio=dims.width+' / '+dims.height;host.style.width='min(100%, 760px)';
 const pxPerMm=canvasWidth/dims.width,pageW=geo.pageWidthMm*geo.scale*pxPerMm,pageH=geo.pageHeightMm*geo.scale*pxPerMm,left=geo.offsetXmm*pxPerMm,top=geo.offsetYmm*pxPerMm;
 const slots=[$('sheetPreviewLeft'),$('sheetPreviewRight')];
 slots.forEach((slot,col)=>{slot.replaceChildren();slot.style.left=(left+col*pageW)+'px';slot.style.top=top+'px';slot.style.width=pageW+'px';slot.style.height=pageH+'px';const number=nums[col];renderBookPage(slot,number===null?-1:number-1,pageW);if(number===null){const blank=document.createElement('span');blank.className='press-blank-label';blank.textContent='PADDING BLANK';slot.append(blank);}});
}
function renderSheets(){
 try{
  const r=imposition(),box=$('sheetList');box.replaceChildren();
  $('sheetSummary').textContent=r.readerPageCount+' reading pages → '+r.imposedPageCount+' imposed pages · '+r.blankPageCount+' padding blanks · '+r.physicalSheetsDuplex+' physical sheets (front + reverse). The preview below uses your selected physical sheet dimensions and fit scale.';
  selectedSheetIndex=Math.max(0,Math.min(selectedSheetIndex,r.spreads.length-1));
  const select=$('sheetPreviewIndex'),current=String(selectedSheetIndex);select.replaceChildren();
  r.spreads.forEach((sp,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent='Sheet '+(i+1)+' · Signature '+(sp.signatureIndex+1)+' · '+sp.front.map(n=>n===null?'Blank':n).join(' / ');select.append(o);});select.value=current;
  for(const sp of r.spreads){
   const i=sp.sheetIndex,card=document.createElement('button');card.type='button';card.className='sheet selectable-sheet'+(i===selectedSheetIndex?' active':'');card.setAttribute('aria-pressed',String(i===selectedSheetIndex));
   const head=document.createElement('b');head.textContent='Sheet '+(i+1)+' · Signature '+(sp.signatureIndex+1);
   const preview=document.createElement('div');preview.className='sheet-mini-pages';
   for(const side of ['front','back'])for(const n of sp[side]){const cell=document.createElement('span');cell.textContent=(side==='front'?'F ':'B ')+(n===null?'Blank':n);preview.append(cell);}
   card.append(head,preview);card.addEventListener('click',()=>{selectedSheetIndex=i;selectedSheetSide='front';renderSheets();});box.append(card);
  }
  renderSheetPreview(r);
 }catch(e){$('sheetSummary').textContent=e.message;}
}
function renderChecks(){
 let box=$('checks');box.replaceChildren();const s=readSettings();
 const add=(ok,msg)=>{let d=document.createElement('div');d.className='note '+(ok?'good':'warn');d.textContent=(ok?'✓ ':'⚠ ')+msg;box.append(d);};
 add(!!$('manuscript').value.trim(),'Manuscript contains text.');
 try{
  const d=getPageDimensions(s),sheet=getSheetDimensions(s),g=s.printMode==='normal'?{fits:d.width<=sheet.width+0.2&&d.height<=sheet.height+0.2,needsScaling:false,scale:1,sheetWidthMm:sheet.width,sheetHeightMm:sheet.height,geometricClearanceMm:Math.min((sheet.width-d.width)/2,(sheet.height-d.height)/2),safeAreaFit:Math.min((sheet.width-d.width)/2,(sheet.height-d.height)/2)>=s.safeEdgeMarginMm}:calculateImpositionGeometry(s);
  add(true,'Finished book page: '+d.width+' × '+d.height+' mm.');
  add(s.marginTop+s.marginBottom<d.height,'Vertical margins leave a content area.');
  add(s.marginInner+s.marginOuter+s.gutter<d.width,'Margins and binding gutter leave a content area.');
  add(g.fits,s.printMode==='normal'?'Normal reader-order PDF page fits the selected physical sheet.':'Two-up spread fits the physical sheet dimensions.');
  if(g.needsScaling)add(false,'Pages are reduced to '+(g.scale*100).toFixed(2)+'% of the finished page size.');
  if(g.geometricClearanceMm<s.safeEdgeMarginMm-0.1)add(false,'Only '+g.geometricClearanceMm.toFixed(1)+' mm edge clearance is available; your assumed printer-safe margin is '+s.safeEdgeMarginMm+' mm. The driver may clip the sheet edge. Select “Fit inside printer-safe area” or test a sheet before production.');
  else add(true,'The calculated spread has at least '+s.safeEdgeMarginMm+' mm edge clearance. This is an assumption; confirm the real printer driver.');
  if(s.printMode==='normal'&&d.width===sheet.width&&d.height===sheet.height)add(false,'This is an edge-to-edge page on paper of the same size. A normal office printer may scale it down or clip it.');
 }catch(e){add(false,e.message);}
 try{
  let r=imposition(),used=r.spreads.flatMap(x=>[...x.front,...x.back]).filter(n=>n!==null);
  add(r.imposedPageCount%4===0,'Imposed page count is a multiple of four.');
  add(used.length===layouts.length&&new Set(used).size===layouts.length,'Every reader page maps exactly once to the booklet.');
  add(r.blankPageCount===0,r.blankPageCount+' padding blanks will be added.');
 }catch(e){add(false,e.message);}
 add(false,'Open the exported PDF and proof fonts, line breaks, margins and page order before printing.');
 if(s.printerProfile==='l8050')add(true,'L8050 profile uses manual-duplex or single-sided cover workflow.');
 if(s.printerProfile==='hp400')add(false,'Confirm the exact HP LaserJet 400 model and driver. Duplex capability differs by model.');
 if(/[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF]/.test($('manuscript').value))add(false,'Urdu/Arabic PDF text needs an embedded Unicode font and shaping. This export does not support it yet.');
}
function renderPrinter(){const p=$('printer').value,model=$('hpModel')?.value||'unknown',mode=$('mode').value;$('hpModelWrap').classList.toggle('hidden',p!=='hp400');let t='',autoConfirmed=p==='et4850'||(p==='hp400'&&['m401dn','m401dw'].includes(model));if(p==='et4850'){t='ET-4850: automatic duplex is supported for compatible media; Epson lists plain A4/Letter for automatic two-sided printing in its US guidance. For glossy/photo cover stock, use a separate job and confirm driver settings.';}else if(p==='l8050'){t='L8050: automatic two-sided printing is not listed in Epson specifications. Use manual-duplex fronts/backs or print the cover as a separate single-sided job. Set media type and quality in the driver.';}else if(p==='hp400'&&model==='m401n'){t='HP LaserJet Pro 400 M401n: model specifications list manual duplex, so use the separate fronts/backs PDFs.';}else if(p==='hp400'&&['m401dn','m401dw'].includes(model)){t='HP LaserJet Pro 400 '+model.toUpperCase()+': these M401 variants list automatic duplex. Check your installed driver and paper orientation, then run a test sheet.';}else if(p==='hp400'){t='HP LaserJet Pro 400 is a family, not one exact model. Until the model suffix is confirmed, keep manual duplex selected. M401n is manual; M401dn/M401dw list automatic duplex.';}else t='Confirm the installed driver supports the selected paper size and duplex method; test one sheet first.';const el=$('printerNote');el.textContent=t;if(mode==='auto'&&!autoConfirmed){let warning=document.createElement('div');warning.className='note warn';warning.textContent='Automatic duplex is not confirmed for this profile/model. Select manual duplex or confirm the exact driver capability first.';el.append(warning);}if(p==='l8050'&&mode==='auto')$('mode').value='manual';}
function showOutputOptions(){$('customScaleBox').classList.toggle('hidden',$('fit').value!=='custom');$('backOrder').disabled=$('mode').value!=='manual';$('frontsPdf').disabled=$('mode').value!=='manual';$('backsPdf').disabled=$('mode').value!=='manual';$('singlePdf').disabled=$('mode').value!=='simplex';}
async function initPDF(){pdfReady();const {PDFDocument,StandardFonts}=window.PDFLib,doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.TimesRoman),bold=await doc.embedFont(StandardFonts.TimesBold);return {doc,regular,bold,measure:(text,kind)=> (kind==='heading'?bold:regular).widthOfTextAtSize(text,+$('fontSize').value||11)};}
async function embedBookImages(doc){const embedded=new Map();for(const im of imageAssets){if(!im?.id||!im.data)continue;const bytes=dataURLBytes(im.data),image=im.mimeType==='image/jpeg'?await doc.embedJpg(bytes):await doc.embedPng(bytes);embedded.set(im.id,image);}return embedded;}
async function readerPDF(){sync();if(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test($('manuscript').value))throw Error('This version does not yet embed Urdu/Arabic Unicode fonts. PDF export stopped to avoid corrupted text.');const s=readSettings(),d=getPageDimensions(s),{doc,regular,bold,measure}=await initPDF(),pages=paginateManuscript($('manuscript').value,opts(s,d,measure)),embedded=await embedBookImages(doc),PW=pt(d.width),PH=pt(d.height),left=pt(s.marginInner+s.gutter),top=pt(s.marginTop),right=pt(s.marginOuter),gap=pt(5),cw=(PW-left-right-gap*(s.columns-1))/s.columns,fs=s.fontSize;
 for(let i=0;i<pages.length;i++){const page=doc.addPage([PW,PH]);for(let c=0;c<pages[i].columns.length;c++)for(const l of pages[i].columns[c]){if(l.kind==='blank')continue;if(l.kind==='image'){const image=embedded.get(l.imageId);if(!image)continue;const x0=left+c*(cw+gap),iw=l.imageWidthPt,ih=l.imageHeightPt,baseX=x0+(l.imageAlign==='right'?cw-iw:l.imageAlign==='center'?(cw-iw)/2:0),x=baseX+(l.imageOffsetXPt||0),y=PH-top-l.yTopPt-(l.imageOffsetYPt||0)-ih;page.drawImage(image,{x,y,width:iw,height:ih});if(l.caption)page.drawText(l.caption,{x,y:y-10,size:8,font:regular,maxWidth:iw,color:window.PDFLib.rgb(.3,.3,.32)});continue;}if(!l.text)continue;const font=l.kind==='heading'?bold:regular,x0=left+c*(cw+gap);let x=x0;if(s.textAlign==='center')x+=Math.max(0,(cw-font.widthOfTextAtSize(l.text,fs))/2);page.drawText(l.text,{x,y:PH-top-l.yTopPt-fs,size:fs,font,maxWidth:cw,color:window.PDFLib.rgb(.07,.08,.1)});}if(s.pageNumbers){const label=String(i+1),size=8;page.drawText(label,{x:(PW-regular.widthOfTextAtSize(label,size))/2,y:pt(Math.min(8,s.marginBottom/2)),size,font:regular,color:window.PDFLib.rgb(.35,.35,.38)});}}
 doc.setTitle($('title').value||'Book');doc.setAuthor($('author').value||'');return {bytes:await doc.save(),pageCount:pages.length};}

function download(bytes,name,mime='application/pdf'){const blob=new Blob([bytes],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
async function createPDF(kind='all'){let s=readSettings();if(kind==='all'&&s.printMode==='manual')throw Error('Manual duplex is exported in two files. Download fronts first, then backs.');const reader=await readerPDF();if(s.printMode==='normal')return {bytes:reader.bytes,readerPageCount:reader.pageCount};const {PDFDocument}=window.PDFLib,source=await PDFDocument.load(reader.bytes),orig=source.getPages(),out=await PDFDocument.create(),emb=await out.embedPages(orig),r=createImposition(reader.pageCount,s.signatureSize);if(s.printMode==='nup'){const geo=calculateImpositionGeometry(s),sheet=getSheetDimensions(s),SW=pt(sheet.width),SH=pt(sheet.height),d=getPageDimensions(s),scale=geo.scale;for(let i=0;i<reader.pageCount;i+=2){let page=out.addPage([SW,SH]),w=pt(d.width)*scale,h=pt(d.height)*scale,left=(SW-2*w)/2,y=(SH-h)/2;for(let j=0;j<2;j++)if(i+j<emb.length)page.drawPage(emb[i+j],{x:left+j*w,y,width:w,height:h});if(s.cropMarks)drawMarks(page,SW,SH);}return {bytes:await out.save(),readerPageCount:reader.pageCount};}
const geo=calculateImpositionGeometry(s),SW=pt(geo.sheetWidthMm),SH=pt(geo.sheetHeightMm),w=pt(geo.pageWidthMm*geo.scale),h=pt(geo.pageHeightMm*geo.scale),x=pt(geo.offsetXmm),y=pt(geo.offsetYmm);let jobs=[];
if(s.printMode==='simplex')jobs=r.spreads.map(sp=>({spread:sp,side:'front'}));
else if(kind==='fronts')jobs=r.spreads.map(sp=>({spread:sp,side:'front'}));
else if(kind==='backs'){const list=s.backOrder==='reverse'?[...r.spreads].reverse():r.spreads;jobs=list.map(sp=>({spread:sp,side:'back'}));}
else jobs=r.spreads.flatMap(sp=>[{spread:sp,side:'front'},{spread:sp,side:'back'}]);
for(const j of jobs){let p=out.addPage([SW,SH]),nums=j.spread[j.side];for(let col=0;col<2;col++){let n=nums[col];if(n===null||n===undefined)continue;if(!emb[n-1])throw Error('Invalid page number in imposition map: '+n);p.drawPage(emb[n-1],{x:x+col*w,y,width:w,height:h});}if(s.cropMarks)drawMarks(p,SW,SH);}
out.setTitle(($('title').value||'Book')+' — '+kind);out.setAuthor($('author').value||'');out.setSubject('Reader pages: '+reader.pageCount+'; signature size '+s.signatureSize+'; sheet '+geo.sheetWidthMm+'×'+geo.sheetHeightMm+' mm; scale '+(geo.scale*100).toFixed(2)+'%; flip '+s.flip+'.');
return {bytes:await out.save(),readerPageCount:reader.pageCount,imposition:r};}
function drawMarks(page,SW,SH){const P=window.PDFLib,c=P.rgb(.55,.58,.64),mid=SW/2;page.drawLine({start:{x:mid,y:0},end:{x:mid,y:SH},thickness:.4,color:c,opacity:.6});const m=pt(2),len=pt(3);for(const [x,y] of [[m,m],[SW-m,m],[m,SH-m],[SW-m,SH-m]]){page.drawLine({start:{x:x-len,y},end:{x:x+len,y},thickness:.5,color:c});page.drawLine({start:{x,y:y-len},end:{x,y:y+len},thickness:.5,color:c});}}
async function exportReader(){try{status('Creating reading-order PDF…');const x=await readerPDF();download(x.bytes,filename('reading-order'));status('Reading PDF downloaded. Open and proof it before print.','good');}catch(e){status(e.message,'warn');alert(e.message);}}
async function exportImposed(kind){try{const s=readSettings();if(kind==='fronts'&&s.printMode!=='manual')throw Error('Choose manual-duplex mode to export fronts separately.');if(kind==='backs'&&s.printMode!=='manual')throw Error('Choose manual-duplex mode to export backs separately.');if(kind==='single'&&s.printMode!=='simplex')throw Error('Choose single-sided booklet mode.');status('Building and checking PDF…');const result=await createPDF(kind);const suffix=kind==='fronts'?'manual-fronts':kind==='backs'?'manual-backs':kind==='single'?'single-sided-booklet':s.printMode==='nup'?'two-up':s.printMode==='normal'?'reading-order':'imposed-booklet';download(result.bytes,filename(suffix));if(s.printMode==='simplex')status('Single-sided file ready: '+result.imposition.physicalSheetsDuplex+' printed sheets; reverse sides stay blank.','good');else status('PDF ready for '+result.readerPageCount+' reader pages. Use Actual size/100% in driver and print a test sheet first.','good');}catch(e){status(e.message,'warn');alert(e.message);}}
async function testSheet(){try{pdfReady();const {PDFDocument,StandardFonts,rgb}=window.PDFLib,s=readSettings(),d=getSheetDimensions(s),w=pt(d.width),h=pt(d.height),pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),m=pt(8),mid=w/2;for(const side of ['FRONT','BACK']){let p=pdf.addPage([w,h]);p.drawRectangle({x:m,y:m,width:w-2*m,height:h-2*m,borderWidth:1,borderColor:rgb(.12,.2,.4)});p.drawText(side+' SIDE — DUPLEX TEST',{x:m+pt(5),y:h-m-pt(13),size:14,font:bold,color:rgb(.08,.14,.3)});p.drawText('TOP ↑  KEEP THIS EDGE UP',{x:m+pt(5),y:h-m-pt(25),size:12,font:bold,color:rgb(.08,.14,.3)});p.drawText('LEFT • A',{x:m+pt(5),y:h/2,size:13,font:bold,color:rgb(.06,.27,.65)});p.drawText('RIGHT • B',{x:mid+pt(3),y:h/2,size:13,font:bold,color:rgb(.65,.16,.1)});p.drawLine({start:{x:mid,y:m},end:{x:mid,y:h-m},thickness:1,dashArray:[3,3],color:rgb(.5,.55,.62)});p.drawText('Paper '+d.width+'×'+d.height+'mm | driver flip '+s.flip,{x:m+pt(5),y:m+pt(5),size:8,font,color:rgb(.3,.33,.4)});}download(await pdf.save(),filename('duplex-test-sheet'));status('Two-page test sheet downloaded. Print double-sided once and check TOP, LEFT and RIGHT on the reverse.','good');}catch(e){status(e.message,'warn');alert(e.message);}}

function xmlEscape(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
async function exportDocx(){
 if(!window.JSZip)throw Error('Word export library did not load. Refresh the page and try again.');sync();const zip=new window.JSZip(),s=readSettings(),d=getPageDimensions(s),title=$('title').value||'Book',author=$('author').value||'',content=String($('manuscript').value||'').replace(/\r\n?/g,'\n').split('\n'),footnoteDefinitions=new Map();
 for(const line of content){const m=line.match(/^\s*\[\^([a-zA-Z0-9_-]{1,48})\]:\s*(.*)$/);if(m)footnoteDefinitions.set(m[1],m[2]);}
 const footnoteIds=new Map();for(const line of content)for(const m of line.matchAll(/\[\^([a-zA-Z0-9_-]{1,48})\]/g))if(footnoteDefinitions.has(m[1])&&!footnoteIds.has(m[1]))footnoteIds.set(m[1],footnoteIds.size+1);
 const wordRuns=value=>{const input=String(value??''),parts=[],re=/\[\^([a-zA-Z0-9_-]{1,48})\]/g;let last=0,m;while((m=re.exec(input))){if(m.index>last)parts.push('<w:r><w:t xml:space="preserve">'+xmlEscape(input.slice(last,m.index))+'</w:t></w:r>');const id=footnoteIds.get(m[1]);if(id)parts.push('<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="'+id+'"/></w:r>');else parts.push('<w:r><w:t>'+xmlEscape(m[0])+'</w:t></w:r>');last=re.lastIndex;}if(last<input.length||!parts.length)parts.push('<w:r><w:t xml:space="preserve">'+xmlEscape(input.slice(last))+'</w:t></w:r>');return parts.join('');};
 const imageById=new Map(imageAssets.map(im=>[im.id,im])),imageRelMap=new Map(),imageRelations=[],mediaFolder=zip.folder('word').folder('media');
 function drawingFor(im){let rel=imageRelMap.get(im.id);if(!rel){const n=imageRelMap.size+1;rel='rIdImage'+n;imageRelMap.set(im.id,rel);const ext=im.mimeType==='image/jpeg'?'jpg':'png',fileName='image'+n+'.'+ext;mediaFolder.file(fileName,dataURLBytes(im.data));imageRelations.push('<Relationship Id="'+rel+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/'+fileName+'"/>');}const index=Number(rel.replace('rIdImage','')),available=pt(d.width)-pt(s.innerMargin+s.gutter+s.outerMargin),width=Math.min(available,Number(im.widthMm)>0?pt(im.widthMm):available*(Math.max(20,Math.min(100,Number(im.widthPercent)||80))/100)),aspect=(Number(im.width)||4)/(Number(im.height)||3),height=Number(im.heightMm)>0?pt(im.heightMm):width/aspect,cx=Math.round(width*12700),cy=Math.round(height*12700),align=['left','right','center'].includes(im.align)?im.align:'center',name=xmlEscape(im.name||'Book image'),xIndent=Math.round((Number(im.offsetXmm)||0)*1440/25.4),ySpacing=Math.max(0,Math.round((Number(im.offsetYmm)||0)*1440/25.4));return '<w:p><w:pPr><w:jc w:val="'+align+'"/><w:ind w:left="'+xIndent+'"/><w:spacing w:before="'+ySpacing+'"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+index+'" name="'+name+'"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="'+index+'" name="'+name+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+rel+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'+(im.caption?'<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="16"/></w:rPr><w:t>'+xmlEscape(im.caption)+'</w:t></w:r></w:p>':'');}
 const paragraphs=[];if(s.wordToc){paragraphs.push('<w:p><w:pPr><w:pStyle w:val="TOCHeading"/></w:pPr><w:r><w:t>Contents</w:t></w:r></w:p>');const slash=String.fromCharCode(92),instruction=' TOC '+slash+'o "1-3" '+slash+'h '+slash+'z '+slash+'u ';paragraphs.push('<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve">'+instruction+'</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Open in Word and update this field to populate the contents page.</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p><w:p><w:r><w:br w:type="page"/></w:r></w:p>');}
 for(const line of content){const clean=line.trim();if(/^\[\^[a-zA-Z0-9_-]{1,48}\]:/.test(clean))continue;if(clean==='[PAGE BREAK]'){paragraphs.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');continue;}const imageMatch=clean.match(/^\[\[IMAGE:([a-z0-9_-]+)\]\]$/i);if(imageMatch){const im=imageById.get(imageMatch[1]);paragraphs.push(im?drawingFor(im):'<w:p><w:r><w:t>[Missing manuscript image]</w:t></w:r></w:p>');continue;}const match=clean.match(/^(#{1,3})\s+(.*)$/),text=match?match[2]:clean;if(!text){paragraphs.push('<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>');continue;}const level=match?Math.min(3,match[1].length):0,style=level?'Heading'+level:'Normal',align=s.textAlign==='center'?'center':s.textAlign==='justify'?'both':'left';paragraphs.push('<w:p><w:pPr><w:pStyle w:val="'+style+'"/><w:jc w:val="'+align+'"/>'+(level?'<w:keepNext/>':'')+'</w:pPr>'+wordRuns(text)+'</w:p>');}
 const twips=n=>Math.round(n*1440/25.4),pgW=twips(d.width),pgH=twips(d.height),headerText=String(s.wordHeaderText||'').replace(/\{title\}/gi,title).replace(/\{author\}/gi,author),footerText=String(s.wordFooterText||'').replace(/\{title\}/gi,title).replace(/\{author\}/gi,author);
 const headerXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="'+s.wordHeaderAlign+'"/></w:pPr><w:r><w:t>'+xmlEscape(headerText)+'</w:t></w:r></w:p></w:hdr>';
 const footerXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="'+s.wordFooterAlign+'"/></w:pPr><w:r><w:t>'+xmlEscape(footerText)+'</w:t></w:r>'+(s.pageNumbers?'<w:r><w:t xml:space="preserve">  ·  </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> / </w:t></w:r><w:fldSimple w:instr="NUMPAGES"><w:r><w:t>1</w:t></w:r></w:fldSimple>':'')+'</w:p></w:ftr>';
 const footnoteXml=footnoteIds.size?'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>'+[...footnoteIds].map(([key,id])=>'<w:footnote w:id="'+id+'"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr>'+wordRuns(footnoteDefinitions.get(key))+'</w:p></w:footnote>').join('')+'</w:footnotes>':'';
 const docXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+paragraphs.join('')+'<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="'+pgW+'" w:h="'+pgH+'"/><w:pgMar w:top="'+twips(s.topMargin)+'" w:right="'+twips(s.outerMargin)+'" w:bottom="'+twips(s.bottomMargin)+'" w:left="'+twips(s.innerMargin+s.gutter)+'" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>';
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="'+Math.round(s.fontSize*2)+'"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="'+Math.round(s.fontSize*s.lineSpacing*20)+'" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:keepNext/><w:outlineLvl w:val="0"/><w:rPr><w:b/><w:sz w:val="'+Math.round((s.fontSize+3)*2)+'"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:keepNext/><w:outlineLvl w:val="1"/><w:rPr><w:b/><w:sz w:val="'+Math.round((s.fontSize+1)*2)+'"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:keepNext/><w:outlineLvl w:val="2"/><w:rPr><w:b/><w:i/><w:sz w:val="'+Math.round(s.fontSize*2)+'"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="FootnoteText"><w:name w:val="footnote text"/><w:rPr><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="TOCHeading"><w:name w:val="Contents Heading"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style></w:styles>';
 const rels='<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'+(footnoteIds.size?'<Relationship Id="rIdFootnotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>':'')+imageRelations.join('');
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'+(footnoteIds.size?'<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>':'')+'</Types>');
 zip.folder('_rels').file('.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 const word=zip.folder('word');word.file('document.xml',docXml);word.file('styles.xml',styles);word.file('header1.xml',headerXml);word.file('footer1.xml',footerXml);word.file('settings.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/></w:settings>');word.folder('_rels').file('document.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels+'</Relationships>');if(footnoteIds.size)word.file('footnotes.xml',footnoteXml);
 const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});download(blob,filename('editable','docx'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');status('Word DOCX ready with anchored images, Heading 1–3, headers/footers, native footnotes and an updateable Table of Contents. Update the TOC field in Word to populate page numbers.','good');
}

$('wordExport')?.addEventListener('click',()=>exportDocx().catch(e=>{status(e.message,'warn');alert(e.message);}));

function backup(){sync();store();download(new Blob([JSON.stringify({format:'BookFlowStudioProject',version:2,projects,activeId},null,2)],{type:'application/json'}),filename('backup','json'),'application/json');}
async function importBackup(file){try{const d=JSON.parse(await file.text());if(d.format!=='BookFlowStudioProject'||!Array.isArray(d.projects))throw Error('Not a BookFlow Studio backup.');const val=d.projects.filter(p=>p&&typeof p.id==='string'&&typeof p.text==='string'&&p.settings);if(!val.length)throw Error('No valid projects in this backup.');projects=val;activeId=projects.some(p=>p.id===d.activeId)?d.activeId:projects[0].id;deletedProjectIds.clear();store(true,true);loadActive();status('Project backup imported.','good');}catch(e){alert(e.message);}}
$('projectSearch')?.addEventListener('input',renderProjects);
$('newBook').onclick=$('newBook2').onclick=newBook;$('save').onclick=()=>{sync();store();renderProjects();status('Saved in this browser. Export a backup for safekeeping.','good');};$('readingPdf').onclick=exportReader;$('bookletPdf').onclick=()=>exportImposed('all');$('frontsPdf').onclick=()=>exportImposed('fronts');$('backsPdf').onclick=()=>exportImposed('backs');$('singlePdf').onclick=()=>exportImposed('single');$('testSheet').onclick=testSheet;$('backup').onclick=backup;$('importBackup').onclick=()=>$('backupFile').click();$('backupFile').onchange=async e=>{if(e.target.files[0])await importBackup(e.target.files[0]);e.target.value='';};
async function extractImportedText(file){
 const ext=(file.name.split('.').pop()||'').toLowerCase();
 if(['txt','md','markdown'].includes(ext))return await file.text();
 if(ext==='docx'){
  if(!window.mammoth)throw Error('Word import library did not load. Refresh the app or import a .txt file.');
  const result=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
  return String(result.value||'');
 }
 if(ext==='pdf'){
  const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,parts=[];
  for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
   const page=await pdf.getPage(pageNo),content=await page.getTextContent();
   const lines=[];let line='';
   for(const item of content.items){if(!('str' in item))continue;line+=item.str||'';if(item.hasEOL){lines.push(line);line='';}}
   if(line)lines.push(line);parts.push(lines.join('\\n'));
  }
  const text=parts.join('\\n\\n[PAGE BREAK]\\n\\n');
  if(!text.trim())throw Error('This PDF appears to contain scanned images instead of selectable text. OCR is not included yet; use a text-based PDF or convert it to text first.');
  return text;
 }
 throw Error('Supported import types: TXT, Markdown, DOCX and text-based PDF.');
}
$('textImport').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 const button=$('textImport');button.disabled=true;
 try{
  const text=await extractImportedText(file);if(!text.trim())throw Error('The imported file contains no readable text.');
  sync();undo.push($('manuscript').value);redo=[];$('manuscript').value=text;previousText=text;refresh();status('Imported '+file.name+' · '+wordCount(text)+' words. Check headings and page breaks before export.','good');
 }catch(err){alert(err.message||'Import failed.');}
 finally{button.disabled=false;e.target.value='';}
};
$('pageBreak').onclick=()=>{const e=$('manuscript'),a=e.selectionStart,b=e.selectionEnd;undo.push(e.value);e.setRangeText('\n[PAGE BREAK]\n',a,b,'end');previousText=e.value;refresh();e.focus();};
$('textStyle').onchange=()=>{const e=$('manuscript'),a=e.selectionStart,b=e.selectionEnd;if(a===b){status('Select some text first.');return;}undo.push(e.value);let t=e.value.slice(a,b);if($('textStyle').value==='title')t=t.toUpperCase();if($('textStyle').value==='heading')t='# '+t.replace(/^#\s*/,'');e.setRangeText(t,a,b,'select');previousText=e.value;refresh();};
$('manuscript').oninput=()=>{if($('manuscript').value!==previousText){undo.push(previousText);if(undo.length>80)undo.shift();redo=[];previousText=$('manuscript').value;}refresh();};
$('undo').onclick=()=>{if(!undo.length)return;redo.push($('manuscript').value);$('manuscript').value=undo.pop();previousText=$('manuscript').value;refresh();};$('redo').onclick=()=>{if(!redo.length)return;undo.push($('manuscript').value);$('manuscript').value=redo.pop();previousText=$('manuscript').value;refresh();};
$('prev').onclick=()=>{pageIndex=Math.max(0,pageIndex-1);refresh();};$('next').onclick=()=>{pageIndex=Math.min(layouts.length-1,pageIndex+1);refresh();};$('bookPrev').onclick=()=>flipBook('backward');$('bookNext').onclick=()=>flipBook('forward');
document.querySelectorAll('[data-book-presentation]').forEach(b=>b.addEventListener('click',()=>{bookPresentation=b.dataset.bookPresentation;renderBookPreview();}));
document.querySelectorAll('[data-book-style]').forEach(b=>b.addEventListener('click',()=>{bookVisualMode=b.dataset.bookStyle;renderBookPreview();}));
$('exportShareableReader').onclick=()=>{try{exportShareableReader();}catch(e){status(e.message,'warn');alert(e.message);}};
['coverTemplate','coverKicker','coverSubtitle','coverBackText','coverAccent','coverBinding','coverCaliper','coverBleed','coverSafe'].forEach(id=>$(id).addEventListener('input',()=>{sync();store();if(activePreviewView==='book'){renderClosedCover();renderCoverSpread();}void drawMarketingPoster();}));
$('coverImageFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const cover=await normaliseBookImage(await readFileDataURL(file),file.name);coverArtworkData=cover.data;sync();store();$('coverImageStatus').textContent='Cover artwork loaded · '+file.name;if(activePreviewView==='book'){renderClosedCover();renderCoverSpread();}void drawMarketingPoster();}catch(err){alert('Cover image failed: '+err.message);}finally{e.target.value='';}});
['title','author'].forEach(id=>$(id).addEventListener('input',()=>{if(activePreviewView==='book')renderBookPreview();void drawMarketingPoster();}));
$('removeCoverImage').onclick=()=>{coverArtworkData='';sync();store();$('coverImageStatus').textContent='No cover artwork selected.';if(activePreviewView==='book'){renderClosedCover();renderCoverSpread();}void drawMarketingPoster();};
$('exportCoverSVG').onclick=exportCoverSpreadSVG;$('exportCoverSVG2').onclick=exportCoverSpreadSVG;
document.querySelectorAll('[data-book-angle]').forEach(b=>b.addEventListener('click',()=>{bookAngle=b.dataset.bookAngle;renderBookPreview();}));
$('sheetPreviewIndex').addEventListener('change',()=>{selectedSheetIndex=Number($('sheetPreviewIndex').value)||0;renderSheets();});
document.querySelectorAll('[data-sheet-side]').forEach(b=>b.addEventListener('click',()=>{selectedSheetSide=b.dataset.sheetSide;renderSheetPreview();}));
$('sheetPrev').onclick=()=>{selectedSheetIndex=Math.max(0,selectedSheetIndex-1);renderSheets();};
$('sheetNext').onclick=()=>{selectedSheetIndex=Math.min(imposition().spreads.length-1,selectedSheetIndex+1);renderSheets();};
['marketingTagline','marketingBlurb','marketingCTA','marketingURL','marketingTheme','marketingFormat','marketingHashtags'].forEach(id=>$(id).addEventListener('input',()=>{sync();store();void drawMarketingPoster();}));
$('marketingExportPNG').onclick=exportMarketingPNG;$('marketingCopyCaption').onclick=copyMarketingCaption;$('marketingExportLanding').onclick=exportMarketingLanding;


document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{activePreviewView=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));$('readerView').classList.toggle('hidden',activePreviewView!=='reader');$('bookView').classList.toggle('hidden',activePreviewView!=='book');$('sheetsView').classList.toggle('hidden',activePreviewView!=='sheets');$('checksView').classList.toggle('hidden',activePreviewView!=='checks');if(activePreviewView==='book'){bookSpreadIndex=bookSpreadForPage(pageIndex);renderBookPreview();}if(activePreviewView==='sheets')requestAnimationFrame(()=>renderSheetPreview());});
const ids=['title','author','wordHeader','wordFooter','wordHeaderAlign','wordFooterAlign','wordToc','pagePreset','pageW','pageH','orientation','fontSize','columns','lineSpacing','align','topMargin','bottomMargin','innerMargin','outerMargin','gutter','pageNumbers','chapterStart','sheetPreset','sheetW','sheetH' ,'sheetOrientation','printer','hpModel','mode','signature','fit','customScale','flip','backOrder','marks'];
for(const id of ids)$(id).addEventListener('change',()=>{if(id==='pagePreset'&&PAPER_MM[$('pagePreset').value]){let [w,h]=PAPER_MM[$('pagePreset').value];$('pageW').value=w;$('pageH').value=h;}if(id==='sheetPreset'&&PAPER_MM[$('sheetPreset').value]){let [w,h]=PAPER_MM[$('sheetPreset').value];if($('sheetOrientation').value==='landscape'){$('sheetW').value=Math.max(w,h);$('sheetH').value=Math.min(w,h);}else{$('sheetW').value=Math.min(w,h);$('sheetH').value=Math.max(w,h);}}if(id==='printer'){if($('printer').value==='l8050')$('mode').value='manual';if($('printer').value==='hp400'||$('printer').value==='other')$('mode').value='manual';if($('printer').value==='et4850')$('mode').value='auto';if($('printer').value==='hp400'&&$('hpModel').value!=='m401dn'&&$('hpModel').value!=='m401dw')$('mode').value='manual';}if(id==='hpModel')$('mode').value=['m401dn','m401dw'].includes($('hpModel').value)?'auto':'manual';pageIndex=0;refresh();});
window.addEventListener('resize',()=>{renderReader();renderBookPreview();if(activePreviewView==='sheets')renderSheetPreview();});window.addEventListener('beforeunload',()=>{sync();store(true);});
window.addEventListener('pagehide',()=>{sync();store(true);});
async function boot(){
 const saved=await loadStoredProjects();projects=Array.isArray(saved.projects)?saved.projects:[];activeId=saved.activeId||'';fullSaveNeeded=!saved.fromDB;
 if(!projects.length){const p=def();p.title='My Book';projects=[p];activeId=p.id;}
 if(!projects.some(p=>p.id===activeId))activeId=projects[0].id;
 loadActive();store(true);
 if(lastStorageError)$('saved').textContent='Storage warning — '+lastStorageError;
}
void boot();


// Saved layout presets: built-ins keep printer, trim size, typography and imposition settings together.
const BUILTIN_PRESETS = {
 "paperback-a5":{label:"A5 Paperback",pagePreset:"A5",pageW:148,pageH:210,orientation:"portrait",fontSize:11,columns:1,lineSpacing:1.4,align:"justify",topMargin:18,bottomMargin:18,innerMargin:20,outerMargin:14,gutter:5,pageNumbers:true,chapterStart:true,sheetPreset:"A4",sheetW:297,sheetH:210,sheetOrientation:"landscape",printer:"hp400",mode:"manual",signature:32,fit:"fit"},
 "pocket-a6":{label:"A6 Pocket Book",pagePreset:"A6",pageW:105,pageH:148,orientation:"portrait",fontSize:9.5,columns:1,lineSpacing:1.25,align:"justify",topMargin:12,bottomMargin:12,innerMargin:14,outerMargin:10,gutter:3,pageNumbers:true,chapterStart:true,sheetPreset:"A4",sheetW:297,sheetH:210,sheetOrientation:"landscape",printer:"hp400",mode:"manual",signature:32,fit:"fit"},
 "textbook-b5":{label:"B5 Textbook · 2 columns",pagePreset:"B5",pageW:176,pageH:250,orientation:"portrait",fontSize:10.5,columns:2,lineSpacing:1.3,align:"justify",topMargin:16,bottomMargin:16,innerMargin:18,outerMargin:13,gutter:4,pageNumbers:true,chapterStart:true,sheetPreset:"A3",sheetW:420,sheetH:297,sheetOrientation:"landscape",printer:"hp400",mode:"manual",signature:16,fit:"fit"},
 "workbook-a4":{label:"A4 Colour Workbook · normal print",pagePreset:"A4",pageW:210,pageH:297,orientation:"portrait",fontSize:11,columns:1,lineSpacing:1.45,align:"left",topMargin:18,bottomMargin:18,innerMargin:16,outerMargin:16,gutter:3,pageNumbers:true,chapterStart:true,sheetPreset:"A4",sheetW:210,sheetH:297,sheetOrientation:"portrait",printer:"et4850",mode:"normal",signature:16,fit:"actual"},
 "bw-a5":{label:"A5 Black & White Interior",pagePreset:"A5",pageW:148,pageH:210,orientation:"portrait",fontSize:10.5,columns:1,lineSpacing:1.35,align:"justify",topMargin:17,bottomMargin:17,innerMargin:20,outerMargin:13,gutter:6,pageNumbers:true,chapterStart:true,sheetPreset:"A4",sheetW:297,sheetH:210,sheetOrientation:"landscape",printer:"hp400",mode:"manual",signature:32,fit:"fit"},
 "cover-l8050":{label:"Cover / Photo Job · L8050",pagePreset:"A5",pageW:148,pageH:210,orientation:"portrait",fontSize:12,columns:1,lineSpacing:1.4,align:"center",topMargin:8,bottomMargin:8,innerMargin:8,outerMargin:8,gutter:0,pageNumbers:false,chapterStart:false,sheetPreset:"A4",sheetW:297,sheetH:210,sheetOrientation:"landscape",printer:"l8050",mode:"simplex",signature:4,fit:"fit"}
};
const CUSTOM_PRESET_KEY=KEY+'-named-presets';
const SETTING_TO_ELEMENT={pagePreset:'pagePreset',pageW:'pageW',pageH:'pageH',orientation:'orientation',fontSize:'fontSize',columns:'columns',lineSpacing:'lineSpacing',align:'align',topMargin:'topMargin',bottomMargin:'bottomMargin',innerMargin:'innerMargin',outerMargin:'outerMargin',gutter:'gutter',pageNumbers:'pageNumbers',chapterStart:'chapterStart',sheetPreset:'sheetPreset',sheetW:'sheetW',sheetH:'sheetH',sheetOrientation:'sheetOrientation',printer:'printer',hpModel:'hpModel',mode:'mode',signature:'signature',fit:'fit',customScale:'customScale',safeMargin:'safeMargin',flip:'flip',backOrder:'backOrder',marks:'marks'};
function readCustomPresets(){try{const o=JSON.parse(localStorage.getItem(CUSTOM_PRESET_KEY)||'{}');return o&&typeof o==='object'?o:{};}catch{return {};}}
function renderCustomPresets(){
 const sel=$('customPresetSelect');if(!sel)return;const saved=readCustomPresets(),values=Object.entries(saved);
 sel.replaceChildren();
 if(!values.length){const o=document.createElement('option');o.value='';o.textContent='No custom layouts saved yet';sel.append(o);sel.disabled=true;return;}
 sel.disabled=false;const place=document.createElement('option');place.value='';place.textContent='Choose a saved layout…';sel.append(place);
 for(const [id,p] of values){const o=document.createElement('option');o.value=id;o.textContent=p.label||id;sel.append(o);}
}
function applySettingsObject(p,label){
 if(!p||typeof p!=='object')return;
 for(const [key,id] of Object.entries(SETTING_TO_ELEMENT)){if(!(key in p))continue;const el=$(id);if(!el)continue;if(el.type==='checkbox')el.checked=!!p[key];else if(p[key]!==undefined&&p[key]!==null)el.value=String(p[key]);}
 if(p.pagePreset&&PAPER_MM[p.pagePreset]&&(!p.pageW||!p.pageH)){const [w,h]=PAPER_MM[p.pagePreset];$('pageW').value=w;$('pageH').value=h;}
 if(p.sheetPreset&&PAPER_MM[p.sheetPreset]&&(!p.sheetW||!p.sheetH)){const [w,h]=PAPER_MM[p.sheetPreset];$('sheetW').value=Math.max(w,h);$('sheetH').value=Math.min(w,h);}
 pageIndex=0;refresh();$('presetInfo').textContent=(label||p.label||'Layout')+' applied. Book text has not been changed.';
}
$('presetApply')?.addEventListener('click',()=>{
 const id=$('presetSelect').value,p=BUILTIN_PRESETS[id];if(!p)return;
 applySettingsObject(p,p.label);
 $('presetInfo').textContent='Applied '+p.label+'. You can now fine-tune any setting below; manuscript text remains unchanged.';
});
$('presetSave')?.addEventListener('click',()=>{
 const label=$('presetName').value.trim();if(!label){alert('Enter a name for this layout first.');$('presetName').focus();return;}
 const saved=readCustomPresets(),id='custom-'+label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)+'-'+Date.now().toString(36);
 saved[id]={label,settings:fromUI(),savedAt:new Date().toISOString()};
 try{localStorage.setItem(CUSTOM_PRESET_KEY,JSON.stringify(saved));renderCustomPresets();$('customPresetSelect').value=id;$('presetInfo').textContent='Saved “'+label+'” to this browser. It can be reused for future book projects.';status('Named layout preset saved locally.','good');}
 catch(e){alert('Could not save this preset in browser storage. Export a project backup or remove old presets.');}
});
$('customPresetSelect')?.addEventListener('change',()=>{
 const id=$('customPresetSelect').value;if(!id)return;const p=readCustomPresets()[id];if(!p)return;
 applySettingsObject(p.settings||p,p.label||'Custom layout');
});
$('presetSelect')?.addEventListener('change',()=>{
 const p=BUILTIN_PRESETS[$('presetSelect').value];if(p&&$('presetInfo'))$('presetInfo').textContent=p.label+' · '+p.pageW+'×'+p.pageH+' mm finished pages · '+p.columns+' column(s) · '+p.printer.toUpperCase()+' print profile.';
});
renderCustomPresets();
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('.workflow .step').forEach(x=>x.classList.toggle('on',x===b));
 const target=$(b.dataset.jump);if(target){target.scrollIntoView({behavior:'smooth',block:'start'});if(b.dataset.jump==='aiStudio')document.querySelector('.ai-panel')?.classList.add('jump-focus');}
}));

// AI connections use server-only Vercel variables; keys never live in this browser or the repository.
let aiHistory=[],attachedVisionData='',attachedVisionName='',attachedReferenceData='',lastVideoModel='agnes-video-2.5-flash';
function escapeText(s){return String(s??'');}
function renderAIStatus(data){
 const p=data?.providers||{};
 const ag=!!p.agnes?.configured,or=!!p.openrouter?.configured;
 $('agnesDot').className='provider-dot '+(ag?'ok':'bad');$('agnesStatus').textContent='Agnes · '+(ag?'connected':'key needed');
 $('orDot').className='provider-dot '+(or?'ok':'bad');$('orStatus').textContent='OpenRouter · '+(or?'connected':'key needed');
 $('setupDetails').textContent='AGNES_API_KEY: '+(ag?'configured':'not configured')+' · OPENROUTER_API_KEY: '+(or?'configured':'not configured')+'. Values are never returned to this page.';
}
async function refreshAIStatus(){
 $('agnesStatus').textContent='Agnes · checking';$('orStatus').textContent='OpenRouter · checking';
 try{const r=await fetch('/api/ai?action=status',{cache:'no-store'}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Status endpoint unavailable');renderAIStatus(d);}
 catch(e){$('agnesDot').className='provider-dot bad';$('orDot').className='provider-dot bad';$('agnesStatus').textContent='AI API unavailable';$('orStatus').textContent='Check deployment';$('setupDetails').textContent='The /api/ai status route could not be reached. '+e.message+' If this is a static preview, deploy the Vercel API route too.';}
}
function currentBookPayload(){const p=active();return {title:p?.title||$('title').value,author:p?.author||$('author').value,text:String($('manuscript').value||'').slice(0,250000),settings:fromUI()};}
function updateAIContext(){
 const p=active(),s=readSettings();if(!$('aiBookContext'))return;
 $('aiBookContext').textContent=(p?.title||$('title').value||'Untitled book')+'\\n'+wordCount($('manuscript').value)+' words · '+layouts.length+' estimated pages\\n'+(s.pagePreset||'Custom')+' · '+s.pageW+'×'+s.pageH+' mm · '+s.columns+' column(s)\\n'+s.printer+' · '+s.mode+' · '+s.sheetW+'×'+s.sheetH+' mm sheet';
}
function addChatMessage(role,text,extraClass=''){
 const host=$('aiMessages'),welcome=host.querySelector('.welcome');welcome?.remove();
 const m=document.createElement('div');m.className='chat-message '+(role==='user'?'user':'assistant');
 const label=document.createElement('span');label.className='chat-role';label.textContent=role==='user'?'You':'BookFlow AI';
 const body=document.createElement('div');body.textContent=String(text||'');m.append(label,body);
 if(extraClass)m.dataset.kind=extraClass;
 host.append(m);host.scrollTop=host.scrollHeight;return m;
}
function appendToolCards(runs){
 const host=$('aiMessages');
 for(const run of (runs||[])){
  const result=run?.result||{};
  if(run.name==='suggest_layout_preset'&&result.applyable&&result.settings){
   const wrap=document.createElement('div');wrap.className='ai-card apply-suggestion';
   const title=document.createElement('div');title.className='ai-card-title';title.textContent='Layout preset suggestion';
   const copy=document.createElement('p');copy.textContent=(result.label||result.presetId)+' — '+(result.reason||'Suggested for this book.');
   const button=document.createElement('button');button.className='primary wide';button.textContent='Apply '+(result.label||'suggested layout');
   button.addEventListener('click',()=>{applySettingsObject(result.settings,result.label);button.textContent='Applied ✓';button.disabled=true;});
   wrap.append(title,copy,button);host.append(wrap);
   $('aiSuggestionBox').classList.remove('hidden');$('aiSuggestion').textContent=(result.label||result.presetId)+' — '+(result.reason||'Review the preset, then apply it.');
   const sideButton=document.createElement('button');sideButton.className='primary wide mt';sideButton.textContent='Apply suggested layout';sideButton.onclick=()=>{applySettingsObject(result.settings,result.label);sideButton.textContent='Applied ✓';sideButton.disabled=true;};
   $('aiSuggestion').append(sideButton);
  } else if(run.name==='check_print_setup'){
   const card=document.createElement('div');card.className='ai-card apply-suggestion';const t=document.createElement('div');t.className='ai-card-title';t.textContent='Print setup check';
   const p=document.createElement('p');p.textContent='Finished page '+(result.finishedPageMm||[]).join(' × ')+' mm · sheet '+(result.physicalSheetMm||[]).join(' × ')+' mm · scale '+(result.scalePercent??'?')+'%. '+(result.warning||'Review the result before printing.');
   card.append(t,p);host.append(card);
  } else if(run.name==='get_book_overview'){
   const card=document.createElement('div');card.className='ai-card apply-suggestion';const t=document.createElement('div');t.className='ai-card-title';t.textContent='Book overview';
   const p=document.createElement('p');p.textContent=(result.wordCount??'?')+' words · '+((result.headings||[]).length)+' headings'+((result.headings||[]).length?': '+result.headings.slice(0,12).join(' · '):'');
   card.append(t,p);host.append(card);
  } else if(run.name==='find_sections'||run.name==='get_relevant_passages'){
   const card=document.createElement('div');card.className='ai-card apply-suggestion';const t=document.createElement('div');t.className='ai-card-title';t.textContent='Manuscript passages · '+(result.totalMatches??(result.matches||[]).length)+' matches';
   card.append(t);
   for(const match of (result.matches||[]).slice(0,6)){const p=document.createElement('p');p.className='small';p.textContent=(match.index?('Paragraph '+match.index+': '):'')+match.text;card.append(p);}
   host.append(card);
  } else if(run.name==='suggest_text_edits'){
   const card=document.createElement('div');card.className='ai-card apply-suggestion';const heading=document.createElement('div');heading.className='ai-card-title';heading.textContent='Suggested manuscript edits';
   const summary=document.createElement('p');summary.textContent=result.summary||'Review each proposed change before applying.';card.append(heading,summary);
   for(const edit of (result.edits||[])){
    const item=document.createElement('div');item.className='edit-proposal';
    const name=document.createElement('b');name.textContent=edit.label||'Suggested edit';
    const reason=document.createElement('p');reason.className='small muted';reason.textContent=edit.reason||'';
    const before=document.createElement('div');before.className='edit-before';before.textContent='BEFORE\\n'+edit.originalText;
    const after=document.createElement('div');after.className='edit-after';after.textContent='AFTER\\n'+edit.suggestedText;
    const button=document.createElement('button');button.className='primary wide';button.type='button';button.textContent=edit.applyable?'Apply this edit':'Cannot apply automatically — source text is not a unique exact match';
    button.disabled=!edit.applyable;
    button.onclick=()=>{
      const current=$('manuscript').value,needle=edit.originalText,at=current.indexOf(needle);
      if(at<0||current.indexOf(needle,at+needle.length)!==-1){button.textContent='Source changed — ask AI to review again';button.disabled=true;return;}
      undo.push(current);if(undo.length>80)undo.shift();redo=[];$('manuscript').value=current.slice(0,at)+edit.suggestedText+current.slice(at+needle.length);previousText=$('manuscript').value;pageIndex=0;refresh();button.textContent='Applied ✓';button.disabled=true;
    };
    item.append(name,reason,before,after,button);card.append(item);
   }
   host.append(card);
  }
 }
 host.scrollTop=host.scrollHeight;
}
async function sendAIChat(textOverride){
 const prompt=String(textOverride??$('aiInput').value).trim();if(!prompt)return;
 const provider=$('aiProvider').value,model=$('aiModel').value.trim()||(provider==='agnes'?'agnes-2.5-flash':'');
 let userContent=prompt;
 if(attachedVisionData)userContent=[{type:'text',text:prompt},{type:'image_url',image_url:{url:attachedVisionData,detail:'auto'}}];
 addChatMessage('user',prompt+(attachedVisionName?'\n[Attached image: '+attachedVisionName+']':''));
 const requestMessages=[...aiHistory,{role:'user',content:userContent}];
 $('aiInput').value='';$('aiSend').disabled=true;$('aiSend').textContent='Thinking…';
 const pending=addChatMessage('assistant','Checking the book context and working on your request…','pending');
 try{
  const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'chat',provider,model,messages:requestMessages,book:currentBookPayload(),enableTools:true,semanticSearch:$('semanticRetrieval')?.checked===true,semanticModel:$('embeddingModel')?.value.trim()||''})});
  const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||('Provider error '+response.status));
  pending.remove();const reply=data.reply||'(The model returned an empty message.)';addChatMessage('assistant',reply);
  aiHistory.push({role:'user',content:prompt},{role:'assistant',content:reply});if(aiHistory.length>18)aiHistory=aiHistory.slice(-18);
  appendToolCards(data.toolRuns||[]);if(data.semanticMatches?.length){const card=document.createElement('div');card.className='ai-card apply-suggestion';const head=document.createElement('div');head.className='ai-card-title';head.textContent='Semantic book matches';card.append(head);for(const match of data.semanticMatches){const p=document.createElement('p');p.className='small';p.textContent='Similarity '+Math.round((match.score||0)*100)+'% · '+match.text;card.append(p);}$('aiMessages').append(card);}if(data.semanticWarning){const warning=document.createElement('p');warning.className='small muted';warning.textContent='Semantic search skipped: '+data.semanticWarning;$('aiMessages').append(warning);}
  const use=$('modelLoadStatus');use.textContent='Provider: '+data.provider+' · model: '+data.model+(data.usage?.total_tokens?' · tokens: '+data.usage.total_tokens:'');
 }catch(e){pending.remove();addChatMessage('assistant','Request failed: '+e.message+'\\nOpen API setup to check provider keys and model access.');}
 finally{$('aiSend').disabled=false;$('aiSend').textContent='Ask AI ↗';attachedVisionData='';attachedVisionName='';$('visionFile').value='';$('visionName').textContent='';updateAIContext();}
}
$('aiChatForm')?.addEventListener('submit',e=>{e.preventDefault();sendAIChat();});
document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{const prompt=b.dataset.prompt;$('aiInput').value=prompt;sendAIChat(prompt);}));
$('visionFile')?.addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;if(file.size>2_500_000){alert('For this AI preview, choose an image below 2.5 MB.');e.target.value='';return;}
 try{attachedVisionData=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(String(rd.result));rd.onerror=reject;rd.readAsDataURL(file);});attachedVisionName=file.name;$('visionName').textContent=file.name;}
 catch(err){alert('Could not read that image.');}
});
$('aiProvider')?.addEventListener('change',()=>{
 const p=$('aiProvider').value;$('aiModel').value=p==='agnes'?'agnes-2.5-flash':'';$('aiModel').placeholder=p==='agnes'?'agnes-2.5-flash':'Choose an OpenRouter model ID';$('modelLoadStatus').textContent=p==='agnes'?'Default: Agnes 2.5 Flash. Load your available model list.':'Enter or load an OpenRouter model ID.';aiHistory=[];
});
$('loadModels')?.addEventListener('click',async()=>{
 const provider=$('aiProvider').value;const button=$('loadModels');button.disabled=true;button.textContent='Loading…';
 try{const res=await fetch('/api/ai?action=models&provider='+encodeURIComponent(provider)),d=await res.json();if(!res.ok||!d.ok)throw Error(d.error||'Could not load models');const list=$('aiModelList');list.replaceChildren();for(const m of (d.models||[])){const option=document.createElement('option');option.value=m.id;option.label=m.name;list.append(option);} $('modelLoadStatus').textContent=(d.models||[]).length+' models returned by '+provider+'. Type or select the exact model ID supported by your API key.';}
 catch(e){$('modelLoadStatus').textContent='Model list could not be loaded: '+e.message;}
 finally{button.disabled=false;button.textContent='Load models';}
});
async function loadProviderModels(provider,modality,listId,statusId){
 const target=$(listId),statusEl=$(statusId);
 if(!target)return [];
 statusEl.textContent='Loading '+modality+' models from '+provider+'…';
 const buttonId=modality==='image'?'loadImageModels':modality==='video'?'loadVideoModels':'loadEmbeddingModels';
 const btn=$(buttonId);if(btn){btn.disabled=true;btn.textContent='Loading…';}
 try{
  const res=await fetch('/api/ai?action=models&provider='+encodeURIComponent(provider)+'&modality='+encodeURIComponent(modality),{cache:'no-store'});
  const data=await res.json();if(!res.ok||!data.ok)throw Error(data.error||'Model discovery failed');
  const models=data.models||[];target.replaceChildren();
  for(const m of models){const option=document.createElement('option');option.value=m.id;option.label=m.name||m.id;option.title=m.description||'';target.append(option);}
  statusEl.textContent=models.length+' '+modality+' model(s) returned by '+provider+'. Only models available through your key will work.';
  return models;
 }catch(e){statusEl.textContent='Could not load '+modality+' models: '+e.message;return [];}
 finally{if(btn){btn.disabled=false;btn.textContent='Load models';}}
}
$('refreshAIStatus')?.addEventListener('click',refreshAIStatus);$('checkKeys')?.addEventListener('click',refreshAIStatus);
document.querySelectorAll('[data-ai-mode]').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('[data-ai-mode]').forEach(x=>x.classList.toggle('active',x===b));
 const map={chat:'aiChatPane',image:'aiImagePane',video:'aiVideoPane',embeddings:'aiEmbeddingsPane',setup:'aiSetupPane'};
 for(const [key,id] of Object.entries(map))$(id).classList.toggle('hidden',key!==b.dataset.aiMode);
}));
$('imageProvider')?.addEventListener('change',()=>{
 const p=$('imageProvider').value;
 $('imageModel').value=p==='agnes'?'agnes-image-2.5-flash':'';
 $('imageStatus').textContent=p==='agnes'?'Default Agnes model: agnes-image-2.5-flash.':'Load OpenRouter image models and choose a model that supports image output.';
});
$('loadImageModels')?.addEventListener('click',async()=>{
 const provider=$('imageProvider').value;
 const models=await loadProviderModels(provider,'image','imageModelList','imageStatus');
 if(models.length&&!models.some(m=>m.id===$('imageModel').value))$('imageModel').value=models[0].id;
});
// Keep model discovery explicit so the user can inspect provider availability/quota before generating.
$('imageReference')?.addEventListener('change',async e=>{
 const f=e.target.files?.[0];if(!f)return;if(f.size>2_500_000){alert('Please choose a reference image under 2.5 MB.');e.target.value='';return;}
 try{attachedReferenceData=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(f);});}
 catch{alert('Unable to read reference image.');}
});
function imageDataSource(im){if(im.b64)return 'data:'+(im.mediaType||'image/png')+';base64,'+im.b64;return im.url||'';}
$('generateImage')?.addEventListener('click',async()=>{
 const button=$('generateImage'),provider=$('imageProvider').value,prompt=$('imagePrompt').value.trim();if(!prompt){alert('Write an image prompt first.');return;}if(provider==='openrouter'&&['3K','4K'].includes($('imageSize').value))$('imageStatus').textContent='To keep the image response inside the server limit, this request will use 2K. The actual returned tier is shown after generation.';
 button.disabled=true;button.textContent='Generating…';$('imageStatus').textContent='Sending image request to '+provider+'…';$('imageResults').replaceChildren();
 try{const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'image',provider,model:$('imageModel').value.trim(),prompt,size:$('imageSize').value,ratio:$('imageRatio').value,referenceImages:attachedReferenceData?[attachedReferenceData]:[]})});const d=await res.json();if(!res.ok||!d.ok)throw Error(d.error||'Image request failed');
 for(const im of (d.images||[])){const card=document.createElement('div');card.className='image-result';const img=document.createElement('img');img.alt='AI-generated image';img.src=imageDataSource(im);const a=document.createElement('a');a.href=img.src;a.target='_blank';a.rel='noreferrer';a.textContent='Open / save image ↗';const insert=document.createElement('button');insert.type='button';insert.className='wide';insert.textContent='Insert into current book';insert.onclick=async()=>{insert.disabled=true;insert.textContent='Adding…';try{await addBookImage(img.src,'AI image · '+d.model);$('imageStatus').textContent='Generated image inserted into the manuscript and saved locally.';insert.textContent='Inserted ✓';}catch(err){$('imageStatus').textContent='Could not insert generated image: '+err.message;insert.disabled=false;insert.textContent='Retry insert';}};card.append(img,a,insert);$('imageResults').append(card);}
 if(!d.images?.length)throw Error('No image output was returned.');
 $('imageStatus').textContent='Image ready · '+d.provider+' / '+d.model+(d.resolution?' · actual resolution '+d.resolution:'')+(d.usage?.cost!=null?' · cost $'+d.usage.cost:'')+' · review before print.';
 }catch(e){$('imageStatus').textContent='Image generation failed: '+e.message;$('imageResults').textContent='No image was returned.';}
 finally{button.disabled=false;button.textContent='Generate image';}
});
$('videoProvider')?.addEventListener('change',()=>{
 const provider=$('videoProvider').value;
 $('videoModel').value=provider==='agnes'?'agnes-video-2.5-flash':'';
 $('videoStatus').textContent=provider==='agnes'?'Agnes Video 2.5 Flash default selected.':'Load OpenRouter video models to see current IDs, supported durations and resolutions.';
 $('videoSize').value=provider==='agnes'?'720P':'720p';
});
$('loadVideoModels')?.addEventListener('click',async()=>{
 const provider=$('videoProvider').value;
 const models=await loadProviderModels(provider,'video','videoModelList','videoStatus');
 if(models.length&&!models.some(m=>m.id===$('videoModel').value))$('videoModel').value=models[0].id;
});
$('createVideo')?.addEventListener('click',async()=>{
 const button=$('createVideo'),prompt=$('videoPrompt').value.trim(),provider=$('videoProvider').value,model=$('videoModel').value.trim();
 if(!prompt){alert('Write a video prompt first.');return;}
 if(!model){alert('Load models and choose a video model ID first.');return;}
 button.disabled=true;button.textContent='Submitting…';$('videoStatus').textContent='Submitting asynchronous generation job through '+provider+'…';
 try{
  const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'video',provider,model,prompt,seconds:$('videoSeconds').value,size:$('videoSize').value,ratio:$('videoRatio').value,generateAudio:$('videoAudio').checked})});
  const d=await res.json();if(!res.ok||!d.ok)throw Error(d.error||'Video request failed');
  $('videoId').value=d.videoId||'';lastVideoModel=d.model;
  $('videoStatus').textContent='Job created · '+provider+' · '+(d.status||'pending')+(d.videoId?' · ID saved above':' · provider did not return a job ID')+(d.usage?.cost!=null?' · reported cost $'+d.usage.cost:'');
  $('videoResult').replaceChildren();const pre=document.createElement('pre');pre.className='small';pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';pre.textContent=JSON.stringify(d.raw||d,null,2);$('videoResult').append(pre);
 }catch(e){$('videoStatus').textContent='Video request failed: '+e.message;}
 finally{button.disabled=false;button.textContent='Start video generation';}
});
$('pollVideo')?.addEventListener('click',async()=>{
 const id=$('videoId').value.trim(),provider=$('videoProvider').value,model=$('videoModel').value.trim();
 if(!id){alert('Create a video job or enter the returned job/video ID first.');return;}
 $('pollVideo').disabled=true;$('videoStatus').textContent='Checking '+provider+' job…';
 try{
  const res=await fetch('/api/ai?action=video-status&provider='+encodeURIComponent(provider)+'&video_id='+encodeURIComponent(id)+'&model='+encodeURIComponent(model)),d=await res.json();
  if(!res.ok||!d.ok)throw Error(d.error||'Status request failed');
  const r=d.result||{};$('videoStatus').textContent='Video status: '+(r.status||'provider response received')+(r.error?' · '+r.error:'');
  $('videoResult').replaceChildren();
  const videoUrl=(r.url||r.unsigned_urls?.[0]||r.data?.url||"");
  if(typeof videoUrl==="string"&&videoUrl.startsWith("https://")){
   const v=document.createElement('video');v.src=videoUrl;v.controls=true;v.playsInline=true;v.style.width='100%';v.style.maxHeight='420px';$('videoResult').append(v);
   const a=document.createElement('a');a.href=videoUrl;a.target='_blank';a.rel='noreferrer';a.textContent='Open / save generated video ↗';a.style.display='block';a.style.marginTop='10px';$('videoResult').append(a);
  } else {const pre=document.createElement('pre');pre.className='small';pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';pre.textContent=JSON.stringify(r,null,2);$('videoResult').append(pre);}
 }catch(e){$('videoStatus').textContent='Video status check failed: '+e.message;}
 finally{$('pollVideo').disabled=false;}
});
$('loadEmbeddingModels')?.addEventListener('click',async()=>{
 const models=await loadProviderModels('openrouter','embeddings','embeddingModelList','embeddingStatus');
 if(models.length&&!models.some(m=>m.id===$('embeddingModel').value))$('embeddingModel').value=models[0].id;
});
$('testEmbedding')?.addEventListener('click',async()=>{
 const text=$('embeddingText').value.trim(),model=$('embeddingModel').value.trim();if(!text||!model){alert('Enter an embedding model ID and a short text sample.');return;}
 $('testEmbedding').disabled=true;$('embeddingStatus').textContent='Calling OpenRouter embeddings…';
 try{const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'embeddings',model,input:text})});const d=await res.json();if(!res.ok||!d.data)throw Error(d.error||'Embedding request failed');$('embeddingStatus').textContent='Success · '+d.data.length+' embedding(s) · vector size '+(d.data[0]?.embedding?.length||'unknown')+' · tokens '+(d.usage?.total_tokens??'unknown')+'.';}
 catch(e){$('embeddingStatus').textContent='Embedding test failed: '+e.message;}
 finally{$('testEmbedding').disabled=false;}
});
refreshAIStatus();updateAIContext();
