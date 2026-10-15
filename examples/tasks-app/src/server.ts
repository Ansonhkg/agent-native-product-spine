import {operationCatalog,openApi,llmsText} from './documentation.ts';
import { createServer } from 'node:http';
import { readFileSync,existsSync } from 'node:fs';
import { resolve,extname } from 'node:path';
import { execute,ownerToken,authenticate,discovery,db } from './host.ts';
import { definitions,type Surface } from './contracts.ts';
const port=Number(process.env.PORT??4347);
const server=createServer(async(req,res)=>{
 const send=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 // Reject foreign authorities before bootstrap, authentication, discovery or dispatch.
 const authorities=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
 const origins=new Set([...authorities].map(authority=>`http://${authority}`));
 if(!req.headers.host || !authorities.has(req.headers.host)){send(403,{error:'Host denied'});return;}
 if(req.headers.origin && !origins.has(req.headers.origin)){send(403,{error:'Origin denied'});return;}
 let url:URL;let pathname:string;
 try{url=new URL(req.url??'/',`http://127.0.0.1:${port}`);if(!origins.has(url.origin))throw new Error('Foreign request target');pathname=decodeURIComponent(url.pathname);}
 catch{send(400,{error:'Invalid request URL'});return;}
 if(['/docs/operations.json','/docs/openapi.json','/llms.txt'].includes(url.pathname)){if(req.method!=='GET'){send(405,{error:'GET required'});return;}if(url.pathname==='/llms.txt'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-cache'});res.end(llmsText());}else send(200,url.pathname==='/docs/openapi.json'?openApi():operationCatalog());return;}
 const token=req.headers.authorization?.replace(/^Bearer /,'') ?? req.headers.cookie?.match(/(?:^|; )tasks-session=([^;]+)/)?.[1];
 if(url.pathname==='/api/discover'){try{send(200,discovery(authenticate(token),url.searchParams.get('workspace')??''));}catch{send(403,{error:'Denied'});}return;}
 const entry=Object.entries(definitions).find(([,d])=>d.http===url.pathname);
 if(entry){
 if(req.method!=='POST'){send(405,{error:'POST required'});return;}
 const abort=new AbortController();req.on('aborted',()=>abort.abort());res.on('close',()=>{if(!res.writableEnded)abort.abort();});
 try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16384){send(413,{error:'Too large'});return;}}
 const surface=(['cli','mcp','ui'].includes(String(req.headers['x-tasks-surface']))?req.headers['x-tasks-surface']:'http') as Surface;
 const result=await execute(entry[0],JSON.parse(raw),token,surface,abort.signal);send(result.ok?200:({INVALID:400,DENIED:403,NOT_FOUND:404,CONFLICT:409,INTERNAL:500,CANCELLED:499}[result.error.code]),result);
 }catch{send(400,{ok:false,error:{code:'INVALID',message:'Invalid JSON'}});}return;
 }
 if(url.pathname.startsWith('/api/')){send(404,{error:'Unknown route'});return;}
 // Trusted local loopback UI grants the OS user an HttpOnly session.
 if(req.method!=='GET'){send(405,{error:'GET required'});return;}
 const root=resolve('dist');let file=resolve(root,'.'+pathname);
 if(!file.startsWith(root+'/') || !existsSync(file) || !extname(file))file=resolve(root,'index.html');
 if(!existsSync(file)){send(503,{error:'Run npm run build first'});return;}
 res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(file)]??'application/octet-stream'),'Set-Cookie':`tasks-session=${ownerToken}; HttpOnly; SameSite=Strict; Path=/`,'Cache-Control':'no-cache'});res.end(readFileSync(file));
});
server.listen(port,'127.0.0.1',()=>console.log(`Tasks: http://127.0.0.1:${port}`));
function close(){server.close(()=>{db.close();process.exit(0);});server.closeAllConnections();}
process.on('SIGTERM',close);process.on('SIGINT',close);
