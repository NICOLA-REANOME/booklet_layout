import {PAPER_MM,getPageDimensions,getSheetDimensions,calculateImpositionGeometry,createImposition,paginateManuscript} from './src/engine.mjs';
const $=id=>document.getElementById(id),KEY='bookflow-projects-v2',MM=72/25.4;
let projects=[],activeId='',layouts=[],pageIndex=0,undo=[],redo=[],previousText='';
const def=()=>({id:'book-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),title:'Untitled book',author:'',text:'',settings:{pagePreset:'A5',pageW:148,pageH:210,orientation:'portrait',fontSize:11,columns:1,lineSpacing:1.4,align:'left',topMargin:18,bottomMargin:18,innerMargin:18,outerMargin:14,gutter:5,pageNumbers:true,chapterStart:true,sheetPreset:'A4',sheetW:297,sheetH:210,sheetOrientation:'landscape',printer:'et4850',hpModel:'unknown',mode:'auto',signature:32,fit:'fit',customScale:100,flip:'long',backOrder:'same',marks:false},updated:Date.now()});
const active=()=>projects.find(p=>p.id===activeId)||projects[0];
function readSettings(){return {pageSize:$('pagePreset').value,pageW:+$('pageW').value,pageH:+$('pageH').value,orientation:$('orientation').value,fontSize:+$('fontSize').value,columns:+$('columns').value,lineSpacing:+$('lineSpacing').value,textAlign:$('align').value,marginTop:+$('topMargin').value,marginBottom:+$('bottomMargin').value,marginInner:+$('innerMargin').value,marginOuter:+$('outerMargin').value,gutter:+$('gutter').value,pageNumbers:$('pageNumbers').checked,chapterNewPage:$('chapterStart').checked,sheetSize:$('sheetPreset').value,sheetW:+$('sheetW').value,sheetH:+$('sheetH').value,sheetOrientation:$('sheetOrientation').value,printerProfile:$('printer').value,hpModel:$('hpModel')?.value||'unknown',printMode:$('mode').value,signatureSize:+$('signature').value,fitMode:$('fit').value,customScalePercent:+$('customScale').value,flipEdge:$('flip').value,backOrder:$('backOrder').value,cropMarks:$('marks').checked};}
function sync(){const p=active();if(!p)return;p.title=$('title').value.trim()||'Untitled book';p.author=$('author').value.trim();p.text=$('manuscript').value;p.settings={...p.settings,...fromUI()};p.updated=Date.now();}
function fromUI(){return {pagePreset:$('pagePreset').value,pageW:+$('pageW').value,pageH:+$('pageH').value,orientation:$('orientation').value,fontSize:+$('fontSize').value,columns:+$('columns').value,lineSpacing:+$('lineSpacing').value,align:$('align').value,topMargin:+$('topMargin').value,bottomMargin:+$('bottomMargin').value,innerMargin:+$('innerMargin').value,outerMargin:+$('outerMargin').value,gutter:+$('gutter').value,pageNumbers:$('pageNumbers').checked,chapterStart:$('chapterStart').checked,sheetPreset:$('sheetPreset').value,sheetW:+$('sheetW').value,sheetH:+$('sheetH').value,sheetOrientation:$('sheetOrientation').value,printer:$('printer').value,hpModel:$('hpModel')?.value||'unknown',mode:$('mode').value,signature:+$('signature').value,fit:$('fit').value,customScale:+$('customScale').value,flip:$('flip').value,backOrder:$('backOrder').value,marks:$('marks').checked};}
function store(){try{localStorage.setItem(KEY,JSON.stringify({projects,activeId}));$('saved').textContent='Saved locally';}catch{$('saved').textContent='Storage full';}}
function wordCount(s){return (String(s).trim().match(/\S+/g)||[]).length;}
function filename(suffix,ext='pdf'){let x=($('title').value||'book').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'book';return x+'-'+suffix+'.'+ext;}
function status(msg,kind='muted'){const e=$('status');e.textContent=msg;e.className='small '+(kind==='warn'?'note warn':kind==='good'?'note good':'muted');$('editStatus').textContent=kind==='good'?'Saved locally':'Autosaves locally';}
function renderProjects(){let box=$('projectList');box.replaceChildren();for(const p of projects){let b=document.createElement('button');b.className='project'+(p.id===activeId?' active':'');let name=document.createElement('span');name.textContent=p.title||'Untitled book';let count=document.createElement('small');count.textContent=wordCount(p.text)+'w';b.append(name,count);b.onclick=()=>{sync();store();activeId=p.id;loadActive();};box.append(b);}}
function loadActive(){const p=active()||def();const s={...def().settings,...p.settings};$('title').value=p.title||'Untitled book';$('author').value=p.author||'';$('manuscript').value=p.text||'';for(const [k,v] of Object.entries(s)){let id=k==='pagePreset'?'pagePreset':k==='sheetPreset'?'sheetPreset':k==='signature'?'signature':k==='customScale'?'customScale':k;let el=$(id);if(!el)continue;if(el.type==='checkbox')el.checked=!!v;else el.value=String(v);}previousText=$('manuscript').value;pageIndex=0;undo=[];redo=[];renderProjects();refresh();}
function newBook(){sync();store();let p=def();p.title='Untitled book '+(projects.length+1);projects.unshift(p);activeId=p.id;loadActive();}
function pdfReady(){if(!window.PDFLib?.PDFDocument)throw Error('PDF library did not load. Check internet access and refresh.');}
function pt(mm){return mm*MM;}
function roughMeasure(t,k='body'){return t.length*(+$('fontSize').value||11)*(k==='heading'?.54:.49);}
function opts(s,d,measure){return {pageWidthPt:pt(d.width),pageHeightPt:pt(d.height),fontSize:s.fontSize,lineSpacing:s.lineSpacing,columns:s.columns,topMarginPt:pt(s.marginTop),bottomMarginPt:pt(s.marginBottom),leftMarginPt:pt(s.marginInner+s.gutter),rightMarginPt:pt(s.marginOuter),columnGapPt:pt(5),chapterNewPage:s.chapterNewPage,measureText:measure};}
function compute(){let s=readSettings(),d=getPageDimensions(s);return paginateManuscript($('manuscript').value,opts(s,d,roughMeasure));}
function refresh(){try{sync();layouts=compute();pageIndex=Math.max(0,Math.min(pageIndex,layouts.length-1));$('words').textContent=wordCount($('manuscript').value).toLocaleString();$('chars').textContent=$('manuscript').value.length.toLocaleString();$('pages').textContent=layouts.length;$('pageIndex').textContent='Page '+(pageIndex+1)+' / '+layouts.length;$('pageLabel').textContent='Page '+(pageIndex+1)+' of '+layouts.length;renderReader();renderSheets();renderChecks();renderPrinter();renderProjects();showOutputOptions();if(typeof updateAIContext==='function')updateAIContext();store();}catch(e){status(e.message,'warn');}}
function renderReader(){const s=readSettings(),d=getPageDimensions(s),w=Math.min(430,Math.max(205,window.innerWidth-92)),scale=w/d.width,paper=$('paper');paper.style.width=w+'px';paper.style.height=d.height*scale+'px';const text=$('papertext');text.replaceChildren();const pg=layouts[pageIndex]||{columns:[[]]},usable=d.width-s.marginInner-s.gutter-s.marginOuter,gap=5,cw=(usable-(s.columns-1)*gap)/s.columns;for(let c=0;c<pg.columns.length;c++){for(const l of pg.columns[c]){if(l.kind==='blank'||!l.text)continue;let el=document.createElement('div');el.className='paperline';el.textContent=l.text;el.style.left=((s.marginInner+s.gutter+c*(cw+gap))*scale)+'px';el.style.top=((s.marginTop+l.yTopPt*25.4/72)*scale)+'px';el.style.width=(cw*scale)+'px';el.style.fontSize=(s.fontSize*25.4/72*scale)+'px';if(l.kind==='heading')el.style.fontWeight='bold';el.style.textAlign=s.textAlign||'left';text.append(el);}}$('pagenum').textContent=s.pageNumbers?pageIndex+1:'';$('pagenum').style.display=s.pageNumbers?'block':'none';$('prev').disabled=pageIndex===0;$('next').disabled=pageIndex>=layouts.length-1;}
function imposition(){return createImposition(layouts.length,+$('signature').value);}
function renderSheets(){try{let r=imposition(),box=$('sheetList');box.replaceChildren();$('sheetSummary').textContent=r.readerPageCount+' reader pages → '+r.imposedPageCount+' imposed pages; '+r.blankPageCount+' padding blanks; '+r.physicalSheetsDuplex+' physical sheets when duplexed.';for(const s of r.spreads.slice(0,12)){for(const side of ['front','back']){let card=document.createElement('div');card.className='sheet';let head=document.createElement('b');head.textContent='Sheet '+(s.sheetIndex+1)+' · '+side;let spread=document.createElement('div');spread.className='spread';for(const n of s[side]){let cell=document.createElement('div');cell.textContent=n===null?'Blank':'Page '+n;spread.append(cell);}card.append(head,spread);box.append(card);}}if(r.spreads.length>12){let note=document.createElement('div');note.className='note info';note.textContent='Showing the first 12 sheets. Export includes all pages.';box.append(note);}}catch(e){$('sheetSummary').textContent=e.message;}}
function renderChecks(){let box=$('checks');box.replaceChildren();const s=readSettings();const add=(ok,msg)=>{let d=document.createElement('div');d.className='note '+(ok?'good':'warn');d.textContent=(ok?'✓ ':'⚠ ')+msg;box.append(d);};add(!!$('manuscript').value.trim(),'Manuscript contains text.');try{const d=getPageDimensions(s),g=s.printMode==='normal'?(()=>{const sh=getSheetDimensions(s),fits=d.width<=sh.width+0.2&&d.height<=sh.height+0.2;return {fits,needsScaling:false,scale:1,sheetWidthMm:sh.width,sheetHeightMm:sh.height};})():calculateImpositionGeometry(s);add(true,'Finished page: '+d.width+' × '+d.height+' mm.');add(s.marginTop+s.marginBottom<d.height,'Vertical margins leave a content area.');add(s.marginInner+s.marginOuter+s.gutter<d.width,'Margins and binding gutter leave a content area.');add(g.fits,s.printMode==='normal'?'Normal reader-order page fits physical sheet '+g.sheetWidthMm+' × '+g.sheetHeightMm+' mm.':'Two-up spread geometry fits physical sheet '+g.sheetWidthMm+' × '+g.sheetHeightMm+' mm.');if(g.needsScaling)add(false,'Pages will be proportionally scaled to '+(g.scale*100).toFixed(2)+'%.');}catch(e){add(false,e.message);}try{let r=imposition(),used=r.spreads.flatMap(x=>[...x.front,...x.back]).filter(n=>n!==null);add(r.imposedPageCount%4===0,'Imposed page count is a multiple of four.');add(used.length===layouts.length&&new Set(used).size===layouts.length,'Every reader page maps exactly once to the booklet.');add(r.blankPageCount===0,r.blankPageCount+' padding blanks will be added.');}catch(e){add(false,e.message);}add(false,'Proof the PDF for text clipping, font support, images and line breaks.');if(s.printerProfile==='l8050')add(true,'L8050 profile uses manual-duplex workflow.');if(s.printerProfile==='hp400')add(false,'LaserJet Pro 400 is a family name. Confirm full model and driver duplex option.');if(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test($('manuscript').value))add(false,'Arabic/Urdu script needs an embedded Unicode font; current PDF export will stop rather than silently corrupt it.');}
function renderPrinter(){const p=$('printer').value,model=$('hpModel')?.value||'unknown',mode=$('mode').value;$('hpModelWrap').classList.toggle('hidden',p!=='hp400');let t='',autoConfirmed=p==='et4850'||(p==='hp400'&&['m401dn','m401dw'].includes(model));if(p==='et4850'){t='ET-4850: automatic duplex is supported for compatible media; Epson lists plain A4/Letter for automatic two-sided printing in its US guidance. For glossy/photo cover stock, use a separate job and confirm driver settings.';}else if(p==='l8050'){t='L8050: automatic two-sided printing is not listed in Epson specifications. Use manual-duplex fronts/backs or print the cover as a separate single-sided job. Set media type and quality in the driver.';}else if(p==='hp400'&&model==='m401n'){t='HP LaserJet Pro 400 M401n: model specifications list manual duplex, so use the separate fronts/backs PDFs.';}else if(p==='hp400'&&['m401dn','m401dw'].includes(model)){t='HP LaserJet Pro 400 '+model.toUpperCase()+': these M401 variants list automatic duplex. Check your installed driver and paper orientation, then run a test sheet.';}else if(p==='hp400'){t='HP LaserJet Pro 400 is a family, not one exact model. Until the model suffix is confirmed, keep manual duplex selected. M401n is manual; M401dn/M401dw list automatic duplex.';}else t='Confirm the installed driver supports the selected paper size and duplex method; test one sheet first.';const el=$('printerNote');el.textContent=t;if(mode==='auto'&&!autoConfirmed){let warning=document.createElement('div');warning.className='note warn';warning.textContent='Automatic duplex is not confirmed for this profile/model. Select manual duplex or confirm the exact driver capability first.';el.append(warning);}if(p==='l8050'&&mode==='auto')$('mode').value='manual';}
function showOutputOptions(){$('customScaleBox').classList.toggle('hidden',$('fit').value!=='custom');$('backOrder').disabled=$('mode').value!=='manual';$('frontsPdf').disabled=$('mode').value!=='manual';$('backsPdf').disabled=$('mode').value!=='manual';$('singlePdf').disabled=$('mode').value!=='simplex';}
async function initPDF(){pdfReady();const {PDFDocument,StandardFonts}=window.PDFLib,doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.TimesRoman),bold=await doc.embedFont(StandardFonts.TimesBold);return {doc,regular,bold,measure:(text,kind)=> (kind==='heading'?bold:regular).widthOfTextAtSize(text,+$('fontSize').value||11)};}
async function readerPDF(){sync();if(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test($('manuscript').value))throw Error('This version does not yet embed Urdu/Arabic Unicode fonts. PDF export stopped to avoid corrupted text.');const s=readSettings(),d=getPageDimensions(s),{doc,regular,bold,measure}=await initPDF(),pages=paginateManuscript($('manuscript').value,opts(s,d,measure)),PW=pt(d.width),PH=pt(d.height),left=pt(s.marginInner+s.gutter),top=pt(s.marginTop),right=pt(s.marginOuter),gap=pt(5),cw=(PW-left-right-gap*(s.columns-1))/s.columns,fs=s.fontSize;for(let i=0;i<pages.length;i++){const page=doc.addPage([PW,PH]);for(let c=0;c<pages[i].columns.length;c++)for(const l of pages[i].columns[c]){if(l.kind==='blank'||!l.text)continue;let font=l.kind==='heading'?bold:regular,x=left+c*(cw+gap);if(s.textAlign==='center')x+=Math.max(0,(cw-font.widthOfTextAtSize(l.text,fs))/2);page.drawText(l.text,{x,y:PH-top-l.yTopPt-fs,size:fs,font,maxWidth:cw,color:window.PDFLib.rgb(.07,.08,.1)});}if(s.pageNumbers){let label=String(i+1),size=8;page.drawText(label,{x:(PW-regular.widthOfTextAtSize(label,size))/2,y:pt(Math.min(8,s.marginBottom/2)),size,font:regular,color:window.PDFLib.rgb(.35,.35,.38)});}}doc.setTitle($('title').value||'Book');doc.setAuthor($('author').value||'');return {bytes:await doc.save(),pageCount:pages.length};}
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
function backup(){sync();store();download(new Blob([JSON.stringify({format:'BookFlowStudioProject',version:2,projects,activeId},null,2)],{type:'application/json'}),filename('backup','json'),'application/json');}
async function importBackup(file){try{const d=JSON.parse(await file.text());if(d.format!=='BookFlowStudioProject'||!Array.isArray(d.projects))throw Error('Not a BookFlow Studio backup.');const val=d.projects.filter(p=>p&&typeof p.id==='string'&&typeof p.text==='string'&&p.settings);if(!val.length)throw Error('No valid projects in this backup.');projects=val;activeId=projects.some(p=>p.id===d.activeId)?d.activeId:projects[0].id;store();loadActive();status('Project backup imported.','good');}catch(e){alert(e.message);}}
$('newBook').onclick=$('newBook2').onclick=newBook;$('save').onclick=()=>{sync();store();renderProjects();status('Saved in this browser. Export a backup for safekeeping.','good');};$('readingPdf').onclick=exportReader;$('bookletPdf').onclick=()=>exportImposed('all');$('frontsPdf').onclick=()=>exportImposed('fronts');$('backsPdf').onclick=()=>exportImposed('backs');$('singlePdf').onclick=()=>exportImposed('single');$('testSheet').onclick=testSheet;$('backup').onclick=backup;$('importBackup').onclick=()=>$('backupFile').click();$('backupFile').onchange=async e=>{if(e.target.files[0])await importBackup(e.target.files[0]);e.target.value='';};
$('textImport').onchange=async e=>{const f=e.target.files[0];if(f){undo.push($('manuscript').value);$('manuscript').value=await f.text();previousText=$('manuscript').value;refresh();status('Imported '+f.name+'. Review the page breaks.','good');}e.target.value='';};
$('pageBreak').onclick=()=>{const e=$('manuscript'),a=e.selectionStart,b=e.selectionEnd;undo.push(e.value);e.setRangeText('\n[PAGE BREAK]\n',a,b,'end');previousText=e.value;refresh();e.focus();};
$('textStyle').onchange=()=>{const e=$('manuscript'),a=e.selectionStart,b=e.selectionEnd;if(a===b){status('Select some text first.');return;}undo.push(e.value);let t=e.value.slice(a,b);if($('textStyle').value==='title')t=t.toUpperCase();if($('textStyle').value==='heading')t='# '+t.replace(/^#\s*/,'');e.setRangeText(t,a,b,'select');previousText=e.value;refresh();};
$('manuscript').oninput=()=>{if($('manuscript').value!==previousText){undo.push(previousText);if(undo.length>80)undo.shift();redo=[];previousText=$('manuscript').value;}refresh();};
$('undo').onclick=()=>{if(!undo.length)return;redo.push($('manuscript').value);$('manuscript').value=undo.pop();previousText=$('manuscript').value;refresh();};$('redo').onclick=()=>{if(!redo.length)return;undo.push($('manuscript').value);$('manuscript').value=redo.pop();previousText=$('manuscript').value;refresh();};
$('prev').onclick=()=>{pageIndex=Math.max(0,pageIndex-1);refresh();};$('next').onclick=()=>{pageIndex=Math.min(layouts.length-1,pageIndex+1);refresh();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));$('readerView').classList.toggle('hidden',b.dataset.view!=='reader');$('sheetsView').classList.toggle('hidden',b.dataset.view!=='sheets');$('checksView').classList.toggle('hidden',b.dataset.view!=='checks');});
const ids=['title','author','pagePreset','pageW','pageH','orientation','fontSize','columns','lineSpacing','align','topMargin','bottomMargin','innerMargin','outerMargin','gutter','pageNumbers','chapterStart','sheetPreset','sheetW','sheetH' ,'sheetOrientation','printer','hpModel','mode','signature','fit','customScale','flip','backOrder','marks'];
for(const id of ids)$(id).addEventListener('change',()=>{if(id==='pagePreset'&&PAPER_MM[$('pagePreset').value]){let [w,h]=PAPER_MM[$('pagePreset').value];$('pageW').value=w;$('pageH').value=h;}if(id==='sheetPreset'&&PAPER_MM[$('sheetPreset').value]){let [w,h]=PAPER_MM[$('sheetPreset').value];if($('sheetOrientation').value==='landscape'){$('sheetW').value=Math.max(w,h);$('sheetH').value=Math.min(w,h);}else{$('sheetW').value=Math.min(w,h);$('sheetH').value=Math.max(w,h);}}if(id==='printer'){if($('printer').value==='l8050')$('mode').value='manual';if($('printer').value==='hp400'||$('printer').value==='other')$('mode').value='manual';if($('printer').value==='et4850')$('mode').value='auto';if($('printer').value==='hp400'&&$('hpModel').value!=='m401dn'&&$('hpModel').value!=='m401dw')$('mode').value='manual';}if(id==='hpModel')$('mode').value=['m401dn','m401dw'].includes($('hpModel').value)?'auto':'manual';pageIndex=0;refresh();});
window.addEventListener('resize',renderReader);window.addEventListener('beforeunload',()=>{sync();store();});
function boot(){try{let d=JSON.parse(localStorage.getItem(KEY)||'{}');if(Array.isArray(d.projects))projects=d.projects;activeId=d.activeId||'';}catch{}if(!projects.length){let p=def();p.title='My Book';projects=[p];activeId=p.id;}if(!projects.some(p=>p.id===activeId))activeId=projects[0].id;loadActive();}
boot();


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
const SETTING_TO_ELEMENT={pagePreset:'pagePreset',pageW:'pageW',pageH:'pageH',orientation:'orientation',fontSize:'fontSize',columns:'columns',lineSpacing:'lineSpacing',align:'align',topMargin:'topMargin',bottomMargin:'bottomMargin',innerMargin:'innerMargin',outerMargin:'outerMargin',gutter:'gutter',pageNumbers:'pageNumbers',chapterStart:'chapterStart',sheetPreset:'sheetPreset',sheetW:'sheetW',sheetH:'sheetH',sheetOrientation:'sheetOrientation',printer:'printer',hpModel:'hpModel',mode:'mode',signature:'signature',fit:'fit',customScale:'customScale',flip:'flip',backOrder:'backOrder',marks:'marks'};
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
function currentBookPayload(){const p=active();return {title:p?.title||$('title').value,author:p?.author||$('author').value,text:String($('manuscript').value||'').slice(0,30000),settings:fromUI()};}
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
 const host=$('aiMessages');let suggestion=null;
 for(const run of (runs||[])){
  const result=run?.result||{};
  if(run.name==='suggest_layout_preset'&&result.applyable&&result.settings){
   suggestion=result;const wrap=document.createElement('div');wrap.className='ai-card apply-suggestion';
   const title=document.createElement('div');title.className='ai-card-title';title.textContent='Layout preset suggestion';
   const copy=document.createElement('p');copy.textContent=(result.label||result.presetId)+' — '+(result.reason||'Suggested for this book.');
   const button=document.createElement('button');button.className='primary wide';button.textContent='Apply '+(result.label||'suggested layout');
   button.addEventListener('click',()=>{applySettingsObject(result.settings,result.label);button.textContent='Applied ✓';button.disabled=true;});
   wrap.append(title,copy,button);host.append(wrap);
   $('aiSuggestionBox').classList.remove('hidden');$('aiSuggestion').textContent=(result.label||result.presetId)+' — '+(result.reason||'Review the preset, then apply it.');
   const sideButton=document.createElement('button');sideButton.className='primary wide mt';sideButton.textContent='Apply suggested layout';sideButton.onclick=()=>{applySettingsObject(result.settings,result.label);sideButton.textContent='Applied ✓';sideButton.disabled=true;};
   $('aiSuggestion').append(sideButton);
  } else if(run.name==='check_print_setup'){
   const card=document.createElement('div');card.className='ai-card apply-suggestion';
   const t=document.createElement('div');t.className='ai-card-title';t.textContent='Print geometry check';
   const p=document.createElement('p');p.textContent='Finished page '+(result.finishedPageMm||[]).join(' × ')+' mm · sheet '+(result.physicalSheetMm||[]).join(' × ')+' mm · calculated scale '+(result.scalePercent??'?')+'%. '+(result.warning||'Review output before printing.');
   card.append(t,p);host.append(card);
  } else if(run.name==='get_book_overview'){
   const card=document.createElement('div');card.className='ai-card apply-suggestion';
   const t=document.createElement('div');t.className='ai-card-title';t.textContent='Book overview';
   const p=document.createElement('p');p.textContent=(result.wordCount??'?')+' words · '+((result.headings||[]).length)+' headings'+((result.headings||[]).length?': '+result.headings.slice(0,12).join(' · '):'');
   card.append(t,p);host.append(card);
  } else if(run.name==='find_sections'){
   const card=document.createElement('div');card.className='ai-card apply-suggestion';
   const t=document.createElement('div');t.className='ai-card-title';t.textContent='Section search';
   const p=document.createElement('p');p.textContent=(result.matches||[]).length+' matching paragraphs. '+(result.matches||[]).slice(0,4).map(x=>x.text).join(' · ');
   card.append(t,p);host.append(card);
  }
 }
 host.scrollTop=host.scrollHeight;
}
async function sendAIChat(textOverride){
 const prompt=String(textOverride??$('aiInput').value).trim();if(!prompt)return;
 const provider=$('aiProvider').value,model=$('aiModel').value.trim()||(provider==='agnes'?'agnes-2.5-flash':'');
 let userContent=prompt;
 if(attachedVisionData)userContent=[{type:'text',text:prompt},{type:'image_url',image_url:{url:attachedVisionData,detail:'auto'}}];
 addChatMessage('user',prompt+(attachedVisionName?'\\n[Attached image: '+attachedVisionName+']':''));
 aiHistory.push({role:'user',content:userContent});if(aiHistory.length>18)aiHistory=aiHistory.slice(-18);
 $('aiInput').value='';$('aiSend').disabled=true;$('aiSend').textContent='Thinking…';
 const pending=addChatMessage('assistant','Checking the book context and working on your request…','pending');
 try{
  const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'chat',provider,model,messages:aiHistory,book:currentBookPayload(),enableTools:true})});
  const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||('Provider error '+response.status));
  pending.remove();const reply=data.reply||'(The model returned an empty message.)';addChatMessage('assistant',reply);
  aiHistory.push({role:'assistant',content:reply});if(aiHistory.length>18)aiHistory=aiHistory.slice(-18);
  appendToolCards(data.toolRuns||[]);
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
 const button=$('generateImage'),provider=$('imageProvider').value,prompt=$('imagePrompt').value.trim();if(!prompt){alert('Write an image prompt first.');return;}if(provider==='openrouter'&&$('imageSize').value==='3K'){$('imageStatus').textContent='OpenRouter image models commonly expose 512, 1K, 2K and 4K tiers; this request will use 2K instead of unsupported 3K.';}
 button.disabled=true;button.textContent='Generating…';$('imageStatus').textContent='Sending image request to '+provider+'…';$('imageResults').replaceChildren();
 try{const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'image',provider,model:$('imageModel').value.trim(),prompt,size:$('imageSize').value,ratio:$('imageRatio').value,referenceImages:attachedReferenceData?[attachedReferenceData]:[]})});const d=await res.json();if(!res.ok||!d.ok)throw Error(d.error||'Image request failed');
 for(const im of (d.images||[])){const card=document.createElement('div');card.className='image-result';const img=document.createElement('img');img.alt='AI-generated image';img.src=imageDataSource(im);const a=document.createElement('a');a.href=img.src;a.target='_blank';a.rel='noreferrer';a.textContent='Open / save image ↗';card.append(img,a);$('imageResults').append(card);}
 if(!d.images?.length)throw Error('No image output was returned.');$('imageStatus').textContent='Image ready · '+d.provider+' / '+d.model+' · review resolution before printing.';
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

