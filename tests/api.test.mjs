import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/ai.mjs';

async function invoke({method='GET',url='/api/ai?action=status',origin='https://bookflow-studio-git.vercel.app',body}={}){
 const res={statusCode:200,headers:{},body:''};
 res.setHeader=(name,value)=>{res.headers[name.toLowerCase()]=value;};
 res.end=(value='')=>{res.body=String(value);};
 await handler({method,url,headers:{origin,'x-real-ip':'198.51.100.10'},body},res);
 let parsed={};try{parsed=JSON.parse(res.body);}catch{}
 return {status:res.statusCode,headers:res.headers,body:parsed};
}

test('status endpoint returns provider key presence without exposing credentials',async()=>{
 const out=await invoke();
 assert.equal(out.status,200);
 assert.equal(out.body.ok,true);
 assert.equal(typeof out.body.providers.agnes.configured,'boolean');
 assert.equal(typeof out.body.providers.openrouter.configured,'boolean');
 assert.equal(JSON.stringify(out.body).includes('sk-or-'),false);
});

test('unknown browser origins are rejected before any provider action',async()=>{
 const out=await invoke({origin:'https://example.invalid',method:'POST',url:'/api/ai',body:{action:'chat'}});
 assert.equal(out.status,403);
});

test('canonical origin receives CORS preflight',async()=>{
 const out=await invoke({method:'OPTIONS',url:'/api/ai',origin:'https://bookflow-studio-git.vercel.app'});
 assert.equal(out.status,204);
 assert.equal(out.headers['access-control-allow-origin'],'https://bookflow-studio-git.vercel.app');
});

test('malformed JSON gets a client error rather than an internal server error',async()=>{
 const out=await invoke({method:'POST',url:'/api/ai',body:'{'});
 assert.equal(out.status,400);
 assert.match(out.body.error,/valid JSON/i);
});

test('unknown API actions are rejected explicitly',async()=>{
 const out=await invoke({method:'POST',url:'/api/ai',body:{action:'delete-all-books'}});
 assert.equal(out.status,400);
 assert.deepEqual(out.body.supportedActions,['chat','image','video','embeddings']);
});
