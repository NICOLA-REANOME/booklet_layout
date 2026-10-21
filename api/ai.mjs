const AGNES_BASE = "https://apihub.agnes-ai.com/v1";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const APP_ORIGINS = new Set([
  "https://bookflow-studio-fastcomputerspc2-1341.vercel.app",
  "https://bookflow-studio-rust.vercel.app",
  "https://bookflow-studio-git.vercel.app",
  "https://bookflow-studio-git-fastcomputerspc2-1341.vercel.app",
  "https://bookflow-studio-git-git-main-fastcomputerspc2-1341.vercel.app"
]);
const MAX_BODY_CHARS = 5_500_000;
const PRESETS = {
  "paperback-a5": { label:"A5 Paperback", pagePreset:"A5",pageW:148,pageH:210,orientation:"portrait",fontSize:11,columns:1,lineSpacing:1.4,align:"justify",topMargin:18,bottomMargin:18,innerMargin:20,outerMargin:14,gutter:5,pageNumbers:true,chapterStart:true,sheetPreset:"A4",sheetW:297,sheetH:210,sheetOrientation:"landscape",printer:"hp400",mode:"manual",signature:32,fit:"fit" },
  "pocket-a6": { label:"A6 Pocket Book",pagePreset:"A6",pageW:105,pageH:148,orientation:"portrait",fontSize:9.5,columns:1,lineSpacing:1.25,align:"justify",topMargin:12,bottomMargin:12,innerMargin:14,outerMargin:10,gutter:3,pageNumbers:true,chapterStart:true,sheetPreset:"A4",sheetW:297,sheetH:210,sheetOrientation:"landscape",printer:"hp400",mode:"manual",signature:32,fit:"fit" },
  "textbook-b5": { label:"B5 Textbook · 2 columns",pagePreset:"B5",pageW:176,pageH:250,orientation:"portrait",fontSize:10.5,columns:2,lineSpacing:1.3,align:"justify",topMargin:16,bottomMargin:16,innerMargin:18,outerMargin:13,gutter:4,pageNumbers:true,chapterStart:true,sheetPreset:"A3",sheetW:420,sheetH:297,sheetOrientation:"landscape",printer:"hp400",mode:"manual",signature:16,fit:"fit" },
  "workbook-a4": { label:"A4 Colour Workbook · normal print",pagePreset:"A4",pageW:210,pageH:297,orientation:"portrait",fontSize:11,columns:1,lineSpacing:1.45,align:"left",topMargin:18,bottomMargin:18,innerMargin:16,outerMargin:16,gutter:3,pageNumbers:true,chapterStart:true,sheetPreset:"A4",sheetW:297,sheetH:210,sheetOrientation:"landscape",printer:"et4850",mode:"normal",signature:16,fit:"actual" },
  "bw-a5": { label:"A5 Black & White Interior",pagePreset:"A5",pageW:148,pageH:210,orientation:"portrait",fontSize:10.5,columns:1,lineSpacing:1.35,align:"justify",topMargin:17,bottomMargin:17,innerMargin:20,outerMargin:13,gutter:6,pageNumbers:true,chapterStart:true,sheetPreset:"A4",sheetW:297,sheetH:210,sheetOrientation:"landscape",printer:"hp400",mode:"manual",signature:32,fit:"fit" },
  "cover-l8050": { label:"Cover / Photo Job · L8050",pagePreset:"A5",pageW:148,pageH:210,orientation:"portrait",fontSize:12,columns:1,lineSpacing:1.4,align:"center",topMargin:8,bottomMargin:8,innerMargin:8,outerMargin:8,gutter:0,pageNumbers:false,chapterStart:false,sheetPreset:"A4",sheetW:297,sheetH:210,sheetOrientation:"landscape",printer:"l8050",mode:"simplex",signature:4,fit:"fit" }
};
const TOOL_DEFINITIONS = [
  { type:"function", function:{ name:"get_book_overview", description:"Inspect the current book without editing it. Returns word count, detected headings, and page setup.", parameters:{type:"object",properties:{},additionalProperties:false} } },
  { type:"function", function:{ name:"check_print_setup", description:"Calculate whether the current finished page and physical print sheet fit for a two-up booklet. Does not print.", parameters:{type:"object",properties:{},additionalProperties:false} } },
  { type:"function", function:{ name:"suggest_layout_preset", description:"Recommend a named BookFlow layout preset to the user. This only proposes; it does not apply settings until the user clicks Apply.", parameters:{type:"object",properties:{presetId:{type:"string",enum:Object.keys(PRESETS)},reason:{type:"string",description:"Short reason this named preset suits the book"}} ,required:["presetId","reason"],additionalProperties:false} } },
  { type:"function", function:{ name:"find_sections", description:"Find chapter headings and relevant sections in the current manuscript. Does not change source text.", parameters:{type:"object",properties:{query:{type:"string",description:"Optional words/topic to search for"}},additionalProperties:false} } }
];
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(body));
}
function safeOrigin(req) {
  let origin = req.headers.origin;
  // Same-origin GET requests may omit Origin; in production require a matching Referer instead of treating a missing Origin as trusted.
  if (!origin) {
    try { origin = new URL(req.headers.referer || "").origin; }
    catch { return !process.env.VERCEL && process.env.NODE_ENV !== "production"; }
  }
  if (APP_ORIGINS.has(origin)) return true;
  if (process.env.BOOKFLOW_APP_ORIGIN && origin === process.env.BOOKFLOW_APP_ORIGIN) return true;
  // Permit localhost only for local development; never as a production wildcard.
  return !process.env.VERCEL && process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin);
}
function readBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    if (body.length > MAX_BODY_CHARS) throw Object.assign(new Error("Request is too large. Keep image uploads under 3 MB."), { status:413 });
    body = JSON.parse(body || "{}");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw Object.assign(new Error("Request body must be a JSON object."), {status:400});
  if (JSON.stringify(body).length > MAX_BODY_CHARS) throw Object.assign(new Error("Request is too large. Keep image uploads under 3 MB."), {status:413});
  return body;
}
function providerInfo(provider) {
  if (provider === "agnes") return { key:process.env.AGNES_API_KEY, base:AGNES_BASE, chat:AGNES_BASE+"/chat/completions", models:AGNES_BASE+"/models" };
  if (provider === "openrouter") return { key:process.env.OPENROUTER_API_KEY, base:OPENROUTER_BASE, chat:OPENROUTER_BASE+"/chat/completions", models:OPENROUTER_BASE+"/models" };
  throw Object.assign(new Error("Unknown provider. Choose Agnes AI or OpenRouter."),{status:400});
}
function apiErrorText(text) {
  try {
    const j=JSON.parse(text);
    const e=j?.error;
    return String(e?.message || j?.message || "Provider request failed").slice(0,700);
  } catch { return String(text || "Provider request failed").replace(/Bearer\s+\S+/ig,"Bearer [redacted]").slice(0,700); }
}
async function requestJSON(url, opts, timeoutMs=90000) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const r = await fetch(url,{...opts,signal:controller.signal});
    const text = await r.text();
    let data;
    try { data=JSON.parse(text); } catch { data={raw:text.slice(0,1000)}; }
    if (!r.ok) throw Object.assign(new Error(apiErrorText(text)),{status:r.status,upstreamStatus:r.status});
    return data;
  } catch(e) {
    if(e.name==="AbortError") throw Object.assign(new Error("Provider timed out. Try a shorter prompt or another model."),{status:504});
    throw e;
  } finally { clearTimeout(timer); }
}
function headersFor(provider, key) {
  const h={Authorization:"Bearer "+key,"Content-Type":"application/json"};
  if(provider==="openrouter") {
    h["HTTP-Referer"]=process.env.BOOKFLOW_APP_ORIGIN || "https://bookflow-studio-git.vercel.app";
    h["X-OpenRouter-Title"]="BookFlow Studio";
    h["X-OpenRouter-Categories"]="productivity,writing";
  }
  return h;
}
function getBookContext(body) {
  const b=body.book&&typeof body.book==="object"?body.book:{};
  const text=String(b.text||"").slice(0,30000);
  const settings=b.settings&&typeof b.settings==="object"?b.settings:{};
  return {title:String(b.title||"Untitled book").slice(0,200),author:String(b.author||"").slice(0,200),text,settings};
}
function wordCount(s){return (String(s).trim().match(/\S+/g)||[]).length;}
function headings(text){return String(text).split(/\r?\n/).filter(l=>/^#{1,3}\s+/.test(l.trim())).map(l=>l.trim().replace(/^#{1,3}\s+/,"")).slice(0,100);}
function printReport(book){
 const s=book.settings||{}, pageW=Number(s.pageW)||148,pageH=Number(s.pageH)||210, sheetW=Number(s.sheetW)||297,sheetH=Number(s.sheetH)||210;
 const landscape=s.sheetOrientation!=="portrait";
 const sw=landscape?Math.max(sheetW,sheetH):Math.min(sheetW,sheetH), sh=landscape?Math.min(sheetW,sheetH):Math.max(sheetW,sheetH);
 const pW=s.orientation==="landscape"?Math.max(pageW,pageH):Math.min(pageW,pageH),pH=s.orientation==="landscape"?Math.min(pageW,pageH):Math.max(pageW,pageH);
 const booklet=s.mode!=="normal", requiredWidth=booklet?2*pW:pW, fit=s.fit||"fit";
 let scale=fit==="actual"?1:fit==="custom"?Math.max(0.1,Math.min(2,(Number(s.customScale)||100)/100)):Math.min(1,sw/requiredWidth,sh/pH);
 const fits=requiredWidth*scale<=sw+0.2&&pH*scale<=sh+0.2, words=wordCount(book.text),lines=String(book.text).split(/\r?\n/).filter(Boolean).length;
 return {finishedPageMm:[pW,pH],physicalSheetMm:[sw,sh],requiredSpreadMm:[requiredWidth,pH],fit:fits,scalePercent:Math.round(scale*10000)/100,needsScaling:scale<0.999,booklet,innerMarginMm:s.innerMargin||0,gutterMm:s.gutter||0,words,approxLines:lines,warning:!fits?"This setup does not fit the selected physical sheet at the chosen scale.":scale<0.999?"This page size needs proportional scaling to fit the selected physical sheet.":booklet?"The two-up geometry fits the selected physical sheet.":"Normal reader-order page size fits the selected physical sheet."};
}
function presetAdvice(presetId,reason){
 const p=PRESETS[presetId]; if(!p)return {error:"Unknown preset"};
 return {presetId,label:p.label,reason:String(reason||"Suggested from the current book and print settings").slice(0,400),applyable:true,settings:p};
}
function executeTool(name,args,book){
 if(name==="get_book_overview") return {title:book.title,author:book.author,wordCount:wordCount(book.text),headings:headings(book.text),settings:book.settings};
 if(name==="check_print_setup") return printReport(book);
 if(name==="suggest_layout_preset") return presetAdvice(args.presetId,args.reason);
 if(name==="find_sections"){
   const query=String(args.query||"").trim().toLowerCase();
   const parts=String(book.text).split(/\n\s*\n/);
   const hits=parts.map((p,i)=>({index:i+1,text:p.trim().slice(0,450)})).filter(p=>p.text&&(!query||p.text.toLowerCase().includes(query))).slice(0,12);
   return {query:query||"(chapter headings)",headings:headings(book.text),matches:hits};
 }
 return {error:"This tool is not available in BookFlow."};
}
function cleanMessages(messages) {
 if(!Array.isArray(messages)) throw Object.assign(new Error("messages must be an array"),{status:400});
 if(messages.length>24) messages=messages.slice(-24);
 const out=[];
 for(const m of messages){
   if(!m||!["user","assistant"].includes(m.role)) continue;
   let content=m.content;
   if(typeof content==="string") content=content.slice(0,16000);
   else if(Array.isArray(content)){
     content=content.slice(0,12).map(part=>{
       if(part.type==="text") return {type:"text",text:String(part.text||"").slice(0,12000)};
       if(part.type==="image_url"&&part.image_url&&typeof part.image_url.url==="string"){
         const u=part.image_url.url;
         if(!/^https:\/\/|^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(u)) throw Object.assign(new Error("Image input must be a public HTTPS image URL or a supported image data URI."),{status:400});
         if(u.startsWith("data:")&&u.length>4_000_000) throw Object.assign(new Error("Image is too large. Keep it under about 3 MB."),{status:413});
         return {type:"image_url",image_url:{url:u,detail:"auto"}};
       }
       throw Object.assign(new Error("Unsupported multimodal message part."),{status:400});
     });
   } else throw Object.assign(new Error("Message content must be text or supported image/text parts."),{status:400});
   out.push({role:m.role,content});
 }
 if(!out.length) throw Object.assign(new Error("Send a message first."),{status:400});
 return out;
}
async function chat(req,body) {
 const provider=String(body.provider||"agnes"), info=providerInfo(provider);
 if(!info.key) throw Object.assign(new Error(provider==="agnes"?"Add AGNES_API_KEY in Vercel Environment Variables first.":"Add OPENROUTER_API_KEY in Vercel Environment Variables first."),{status:424,code:"PROVIDER_NOT_CONFIGURED"});
 let model=String(body.model||(provider==="agnes"?"agnes-2.5-flash":"")).trim();
 if(!model||model.length>150) throw Object.assign(new Error("Choose a valid model ID for the selected provider."),{status:400});
 if(provider==="agnes"&&!/^agnes-[a-zA-Z0-9.-]+$/.test(model)) throw Object.assign(new Error("For Agnes, use a model ID listed by the Agnes API, for example agnes-2.5-flash."),{status:400});
 const book=getBookContext(body),messages=cleanMessages(body.messages);
 const system="You are BookFlow Studio's book-production assistant. Help the user write, organise, format, and print their own book. Preserve their manuscript's wording: never silently rewrite or delete source content. Use the supplied BookFlow tools when a factual page/layout check or a manuscript lookup is useful. Suggest a named layout preset when the user wants settings matched. Tool calls may inspect or recommend only; they never apply a preset or mutate the manuscript. Ask before suggesting major changes. For print jobs, clearly distinguish finished reader page size, physical printer sheet, imposition and duplex flip edge. Warn that final physical feed direction needs a test sheet. Be concise and beginner-friendly. Respond in the language the user uses. Current book title: "+book.title+". Current book text is provided as tool context; only quote relevant short snippets.";
 const loopMessages=[{role:"system",content:system},...messages];
 const toolRuns=[];
 const useTools=body.enableTools!==false;
 for(let round=0;round<5;round++){
  const payload={model,messages:loopMessages,temperature:0.3,max_tokens:1400};
  if(useTools){payload.tools=TOOL_DEFINITIONS;payload.tool_choice="auto";payload.parallel_tool_calls=false;}
  const response=await requestJSON(info.chat,{method:"POST",headers:headersFor(provider,info.key),body:JSON.stringify(payload)});
  const choice=response?.choices?.[0],message=choice?.message;
  if(!message) throw Object.assign(new Error("Provider returned no assistant message."),{status:502});
  const calls=Array.isArray(message.tool_calls)?message.tool_calls:[];
  if(!calls.length) return {ok:true,provider,model,reply:typeof message.content==="string"?message.content:(Array.isArray(message.content)?message.content.map(x=>x.text||"").join("\n"):""),toolRuns,usage:response.usage||null,finishReason:choice.finish_reason||null};
  loopMessages.push({role:"assistant",content:message.content||null,tool_calls:calls});
  let count=0;
  for(const call of calls){
   if(count++>=4) break;
   const name=call.function?.name||"";
   let args={};try{args=JSON.parse(call.function?.arguments||"{}");}catch{}
   let result;
   try{result=executeTool(name,args,book);}catch(e){result={error:e.message};}
   toolRuns.push({name,args,result});
   loopMessages.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(result).slice(0,8000)});
  }
 }
 return {ok:true,provider,model,reply:"I checked the available book tools, but this model did not finish a final answer. Please retry with a shorter instruction.",toolRuns,usage:null,finishReason:"tool_loop_limit"};
}
async function generateImage(body) {
 const provider=String(body.provider||"agnes"),prompt=String(body.prompt||"").trim();
 if(!prompt) throw Object.assign(new Error("Write an image prompt first."),{status:400});
 if(prompt.length>7000) throw Object.assign(new Error("Image prompt is too long (7,000 character limit)."),{status:413});
 const size=["1K","2K","3K","4K"].includes(body.size)?body.size:"1K", ratio=["1:1","3:4","4:3","16:9","9:16","2:3","3:2","21:9"].includes(body.ratio)?body.ratio:"1:1";
 if(provider==="agnes"){
  const key=process.env.AGNES_API_KEY;
  if(!key) throw Object.assign(new Error("Add AGNES_API_KEY in Vercel Environment Variables first."),{status:424,code:"PROVIDER_NOT_CONFIGURED"});
  const refs=Array.isArray(body.referenceImages)?body.referenceImages.filter(x=>typeof x==="string"&&/^https:\/\/|^data:image\//i.test(x)).slice(0,4):[];
  const payload={model:String(body.model||"agnes-image-2.5-flash"),prompt,size,ratio,n:1,extra_body:{response_format:"url"}};
  if(refs.length) payload.extra_body.image=refs;
  const result=await requestJSON(AGNES_BASE+"/images/generations",{method:"POST",headers:headersFor("agnes",key),body:JSON.stringify(payload)},120000);
  const images=(result.data||[]).map(x=>({url:x.url||null,b64:x.b64_json||null,revisedPrompt:x.revised_prompt||null})).filter(x=>x.url||x.b64);
  if(!images.length) throw Object.assign(new Error("Image provider returned no usable image URL or base64 result."),{status:502});
  return {ok:true,provider,model:payload.model,images,rawStatus:result.status||null};
 }
 if(provider==="openrouter"){
  const info=providerInfo("openrouter");if(!info.key)throw Object.assign(new Error("Add OPENROUTER_API_KEY in Vercel Environment Variables first."),{status:424,code:"PROVIDER_NOT_CONFIGURED"});
  const model=String(body.model||"").trim();if(!model)throw Object.assign(new Error("Choose an OpenRouter image model from Load models."),{status:400});
  const refs=Array.isArray(body.referenceImages)?body.referenceImages.filter(x=>typeof x==="string"&&(/^https:\/\/|^data:image\/(?:png|jpeg|webp);base64,/i.test(x))).slice(0,4):[];
  const payload={model,prompt,aspect_ratio:ratio,resolution:size==="3K"?"2K":size,n:1};
  if(refs.length)payload.input_references=refs.map(url=>({type:"image_url",image_url:{url}}));
  const result=await requestJSON(OPENROUTER_BASE+"/images",{method:"POST",headers:headersFor("openrouter",info.key),body:JSON.stringify(payload)},150000);
  const images=(Array.isArray(result.data)?result.data:[]).map(x=>({url:x.url||null,b64:x.b64_json||null,mediaType:x.media_type||"image/png",revisedPrompt:x.revised_prompt||null})).filter(x=>x.url||x.b64);
  if(!images.length)throw Object.assign(new Error("OpenRouter returned no image bytes. Check model support, required parameters and available credits."),{status:502});
  return {ok:true,provider,model,images,usage:result.usage||null};
 }
 throw Object.assign(new Error("Image generation is available through Agnes, or OpenRouter models that explicitly support image output."),{status:400});
}
async function createVideo(body) {
 const provider=String(body.provider||"agnes"),prompt=String(body.prompt||"").trim();
 if(!prompt)throw Object.assign(new Error("Write a video prompt first."),{status:400});
 if(prompt.length>4000)throw Object.assign(new Error("Video prompt is too long."),{status:413});
 const seconds=Number(["4","5","6","8","10","12"].includes(String(body.seconds))?body.seconds:"4");
 const aspect=["1:1","3:4","4:3","16:9","9:16","2:3","3:2","21:9"].includes(body.ratio)?body.ratio:"16:9";
 const model=String(body.model||(provider==="agnes"?"agnes-video-2.5-flash":"")).trim();
 if(provider==="agnes"){
  const key=process.env.AGNES_API_KEY;if(!key)throw Object.assign(new Error("Add AGNES_API_KEY in Vercel Environment Variables first."),{status:424,code:"PROVIDER_NOT_CONFIGURED"});
  if(!["agnes-video-2.5","agnes-video-2.5-flash","agnes-video-v2.0"].includes(model))throw Object.assign(new Error("Select a supported Agnes video model."),{status:400});
  const size=model==="agnes-video-2.5-flash"?"720P":(["720P","1080P","1K","2K"].includes(body.size)?body.size:"720P");
  const payload={model,prompt,size,seconds:String(seconds),n:1,mode:"text"};
  const result=await requestJSON(AGNES_BASE+"/videos",{method:"POST",headers:headersFor("agnes",key),body:JSON.stringify(payload)},120000);
  const videoId=result.video_id||result.id||null;
  return {ok:true,provider,model,videoId,taskId:result.task_id||null,status:result.status||"queued",raw:result};
 }
 if(provider==="openrouter"){
  const key=process.env.OPENROUTER_API_KEY;if(!key)throw Object.assign(new Error("Add OPENROUTER_API_KEY in Vercel Environment Variables first."),{status:424,code:"PROVIDER_NOT_CONFIGURED"});
  if(!model||model.length>180)throw Object.assign(new Error("Choose a model from the OpenRouter video model list."),{status:400});
  const allowedRes=["480p","720p","1080p","1K","2K"];
  const resolution=allowedRes.find(x=>x.toLowerCase()===String(body.size||"720p").toLowerCase())||"720p";
  const payload={model,prompt,aspect_ratio:aspect,duration:seconds,resolution,generate_audio:body.generateAudio===true};
  const result=await requestJSON(OPENROUTER_BASE+"/videos",{method:"POST",headers:headersFor("openrouter",key),body:JSON.stringify(payload)},120000);
  const videoId=result.id||result.data?.id||null;
  return {ok:true,provider,model,videoId,status:result.status||"pending",pollingUrl:result.polling_url||null,generationId:result.generation_id||null,raw:result};
 }
 throw Object.assign(new Error("Video generation is available through Agnes or OpenRouter."),{status:400});
}
async function videoStatus(query) {
 const provider=String(query.provider||"agnes"),id=String(query.video_id||"").trim(),model=String(query.model||"agnes-video-2.5-flash").trim();
 if(!id||id.length>240)throw Object.assign(new Error("video_id is required."),{status:400});
 if(provider==="openrouter"){
  const key=process.env.OPENROUTER_API_KEY;if(!key)throw Object.assign(new Error("Add OPENROUTER_API_KEY in Vercel Environment Variables first."),{status:424,code:"PROVIDER_NOT_CONFIGURED"});
  const result=await requestJSON(OPENROUTER_BASE+"/videos/"+encodeURIComponent(id),{method:"GET",headers:headersFor("openrouter",key)},45000);
  return {ok:true,provider,videoId:id,result};
 }
 if(provider==="agnes"){
  const key=process.env.AGNES_API_KEY;if(!key)throw Object.assign(new Error("Add AGNES_API_KEY in Vercel Environment Variables first."),{status:424,code:"PROVIDER_NOT_CONFIGURED"});
  const url="https://apihub.agnes-ai.com/agnesapi?video_id="+encodeURIComponent(id)+"&model_name="+encodeURIComponent(model);
  const result=await requestJSON(url,{method:"GET",headers:{Authorization:"Bearer "+key}},45000);
  return {ok:true,provider,videoId:id,result};
 }
 throw Object.assign(new Error("Unknown video provider."),{status:400});
}

async function embeddings(body) {
 const key=process.env.OPENROUTER_API_KEY;if(!key)throw Object.assign(new Error("Add OPENROUTER_API_KEY in Vercel Environment Variables first."),{status:424,code:"PROVIDER_NOT_CONFIGURED"});
 const model=String(body.model||"").trim(),input=body.input;
 if(!model||!input||(typeof input!=="string"&&!Array.isArray(input)))throw Object.assign(new Error("Choose an OpenRouter embedding model and provide input text."),{status:400});
 return await requestJSON(OPENROUTER_BASE+"/embeddings",{method:"POST",headers:headersFor("openrouter",key),body:JSON.stringify({model,input})},90000);
}
async function main(req,res) {
 if(!safeOrigin(req)) return send(res,403,{error:"Origin not allowed."});
 if(req.headers.origin)res.setHeader("Access-Control-Allow-Origin",req.headers.origin);
 res.setHeader("Vary","Origin");
 res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
 res.setHeader("Access-Control-Allow-Headers","Content-Type");
 if(req.method==="OPTIONS"){res.statusCode=204;return res.end();}
 const url=new URL(req.url,"https://bookflow.local"),action=String(url.searchParams.get("action")||"");
 try{
  if(req.method==="GET"&&action==="status"){
   return send(res,200,{ok:true,providers:{agnes:{configured:!!process.env.AGNES_API_KEY,chat:true,vision:true,image:true,video:true,toolCalling:true},openrouter:{configured:!!process.env.OPENROUTER_API_KEY,chat:true,vision:true,image:true,video:true,embeddings:true,toolCalling:true}},app:"BookFlow Studio",requiresServerKeys:true});
  }
  if(req.method==="GET"&&action==="models"){
   const provider=String(url.searchParams.get("provider")||"agnes"),modality=String(url.searchParams.get("modality")||"chat"),info=providerInfo(provider);
   if(!info.key)return send(res,424,{error:"API key is not configured in Vercel Environment Variables.",code:"PROVIDER_NOT_CONFIGURED"});
   let endpoint=info.models;
   if(provider==="openrouter"){
    const paths={chat:"/models?output_modalities=text",image:"/images/models",video:"/videos/models",embeddings:"/embeddings/models"};
    if(!paths[modality])return send(res,400,{error:"Unsupported model modality.",supportedModalities:Object.keys(paths)});
    endpoint=OPENROUTER_BASE+paths[modality];
   } else if(!["chat","image","video"].includes(modality)) return send(res,400,{error:"Agnes model discovery supports chat, image and video model lists."});
   const result=(provider==="agnes"&&modality!=="chat")?{data:[]}:await requestJSON(endpoint,{method:"GET",headers:headersFor(provider,info.key)},45000);
   let data=Array.isArray(result.data)?result.data:[];
   if(provider==="agnes"&&modality==="image")data=[{id:"agnes-image-2.5-flash",name:"Agnes Image 2.5 Flash",description:"Image generation and image editing, subject to key access."},{id:"agnes-image-2.1-flash",name:"Agnes Image 2.1 Flash (legacy)"}];
   if(provider==="agnes"&&modality==="video")data=[{id:"agnes-video-2.5-flash",name:"Agnes Video 2.5 Flash · 720P"},{id:"agnes-video-2.5",name:"Agnes Video 2.5 · 720P–2K"},{id:"agnes-video-v2.0",name:"Agnes Video v2.0 (legacy)"}];
   return send(res,200,{ok:true,provider,modality,models:data.map(m=>({id:m.id,name:m.name||m.id,description:m.description||"",context_length:m.context_length||null,architecture:m.architecture||null,top_provider:m.top_provider||null,pricing:m.pricing||null,supported_parameters:m.supported_parameters||null,capabilities:m.capabilities||null})).slice(0,500)});
  }
  if(req.method==="GET"&&action==="video-status")return send(res,200,await videoStatus({provider:url.searchParams.get("provider")||"agnes",video_id:url.searchParams.get("video_id"),model:url.searchParams.get("model")}));
  if(req.method!=="POST")return send(res,405,{error:"Use GET for status/model discovery or POST for provider requests."});
  const body=readBody(req),task=String(body.action||"chat");
  if(task==="chat")return send(res,200,await chat(req,body));
  if(task==="image")return send(res,200,await generateImage(body));
  if(task==="video")return send(res,200,await createVideo(body));
  if(task==="embeddings")return send(res,200,await embeddings(body));
  return send(res,400,{error:"Unknown action.",supportedActions:["chat","image","video","embeddings"]});
 }catch(e){
  const status=Number.isInteger(e.status)&&e.status>=400&&e.status<=599?e.status:502;
  return send(res,status,{ok:false,error:String(e.message||"AI request failed").slice(0,900),code:e.code||null,providerStatus:e.upstreamStatus||null});
 }
}
export default async function handler(req,res){return main(req,res);}
