// Douyin container uses explicit server-only Tencent credentials.
const http=require('node:http'),cloud=require('wx-server-sdk');
const {createHandler}=require('./core'),{createHTTPHandler}=require('./http-handler');
if(!process.env.DOUP_CLOUD_ENV)throw Error('Missing DOUP_CLOUD_ENV');
if(!process.env.DOUP_APP_SECRET||!process.env.DOUP_SESSION_SECRET||process.env.DOUP_SESSION_SECRET.length<32)throw Error('Configure server-side Douyin credentials first');
if(!process.env.TENCENTCLOUD_SECRETID||!process.env.TENCENTCLOUD_SECRETKEY)throw Error('Configure server-only Tencent credentials: TENCENTCLOUD_SECRETID and TENCENTCLOUD_SECRETKEY');
cloud.init({env:process.env.DOUP_CLOUD_ENV,secretId:process.env.TENCENTCLOUD_SECRETID,secretKey:process.env.TENCENTCLOUD_SECRETKEY,...(process.env.TENCENTCLOUD_SESSIONTOKEN?{sessionToken:process.env.TENCENTCLOUD_SESSIONTOKEN}:{}),timeout:55000});
const originalDB=cloud.database();
// Separate all three collections from the production WeChat game.
function scoped(db){return new Proxy(db,{get(target,key){if(key==='collection')return name=>target.collection(name.replace(/^mw_/,'dy_'));if(key==='runTransaction')return fn=>target.runTransaction(tx=>fn(scoped(tx)));const value=target[key];return typeof value==='function'?value.bind(target):value;}});}
const invoke=createHTTPHandler(createHandler({db:scoped(originalDB),storage:cloud,getCloudAI:()=>typeof cloud.ai==='function'?cloud.ai():null}));
http.createServer((req,res)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');if(req.url==='/api/health'&&req.method==='GET'){res.end(JSON.stringify({ok:true,service:'douyin-cat'}));return;}if(!['/','/api/home'].includes(req.url)||req.method!=='POST'){res.statusCode=404;res.end('{}');return;}let size=0,chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size>1800000){res.statusCode=413;res.end('{}');req.destroy();}else chunks.push(chunk);});req.on('end',async()=>{if(res.writableEnded)return;let event;try{event=JSON.parse(Buffer.concat(chunks).toString());}catch(_){res.statusCode=400;res.end('{}');return;}const r=await invoke(event,req.headers.authorization);res.statusCode=r.status;res.end(JSON.stringify(r.body));});}).listen(Number(process.env.PORT)||8000,'0.0.0.0');
