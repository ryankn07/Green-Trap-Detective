'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {RoomManager}=require('./rooms.cjs');
const port=Number(process.env.PORT||3000);
const host='0.0.0.0';
const streams=new Map();
const publicDir=path.resolve(__dirname,'../public');
const uiDir=path.resolve(__dirname,'../ui');
const uiStylePath=path.resolve(__dirname,'../ui/style.css');
function json(res,status,payload) {if(res.destroyed||res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));}
function streamSend(res,type,data) {if(!res.destroyed&&!res.writableEnded) res.write('event: '+type+'\ndata: '+JSON.stringify(data)+'\n\n');}
function emitRoom(room) {for(const [res,who] of (streams.get(room.code)||new Map())) {try{streamSend(res,'snapshot',manager.view(room,who));}catch{res.end();}}}
const manager=new RoomManager({onUpdate:emitRoom});
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
const HEADERS={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
const allowedPaths=new Set(['/','/index.html','/app.js','/style.css']);
function readBody(req) {return new Promise((resolve,reject)=>{let content='';req.on('data',chunk=>{content+=chunk;if(content.length>8000){reject(Object.assign(Error('Request too large'),{code:'TOO_LARGE'}));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(content||'{}'))}catch{reject(Object.assign(Error('Malformed JSON'),{code:'BAD_JSON'}))}});req.on('error',reject);});}
function auth(req,url) {const code=url.searchParams.get('room')||req.headers['x-room-code'];const bearer=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/);return manager.authenticate(code,bearer?.[1]);}
const server=http.createServer(async(req,res)=>{
  Object.entries(HEADERS).forEach(([key,value])=>res.setHeader(key,value));
  let url;try{url=new URL(req.url,'http://local');}catch{return json(res,400,{error:'BAD_URL'});}
  try {
    if(req.method==='GET' && url.pathname==='/health')return json(res,200,{status:'ok',activeRooms:manager.rooms.size});
    if(req.method==='GET' && allowedPaths.has(url.pathname)) {
      const filename=url.pathname==='/'?'index.html':url.pathname.slice(1);
      const filepath=(filename==='index.html'||filename==='style.css')?path.join(uiDir,filename):path.join(publicDir,filename);
      const data=await fs.promises.readFile(filepath);
      res.writeHead(200,{'Content-Type':MIME[path.extname(filepath)]||'application/octet-stream','Cache-Control':'no-store'});return res.end(data);
    }
    if(req.method==='POST' && url.pathname==='/api/create') {
      const body=await readBody(req);const {room,player}=manager.create(body.name);
      return json(res,200,{roomCode:room.code,playerId:player.id,token:player.secret});
    }
    if(req.method==='POST' && url.pathname==='/api/join') {
      const body=await readBody(req);const {room,player}=manager.join(body.roomCode,body.name);
      return json(res,200,{roomCode:room.code,playerId:player.id,token:player.secret});
    }
    if(req.method==='GET' && url.pathname==='/api/state') {
      const {room,player}=auth(req,url);return json(res,200,manager.view(room,player));
    }
    if(req.method==='GET' && url.pathname==='/api/stream') {
      const {room,player}=auth(req,url);
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
      res.write(': connected\n\n');
      if(!streams.has(room.code))streams.set(room.code,new Map());
      const subscriptions=streams.get(room.code);
      for(const [old,other] of subscriptions) if(other.id===player.id && old!==res) {streamSend(old,'superseded',{});old.end();subscriptions.delete(old);}
      subscriptions.set(res,player);manager.connected(room,player);
      streamSend(res,'snapshot',manager.view(room,player));
      res.on('close',()=>{if(subscriptions.get(res)?.id===player.id){subscriptions.delete(res);if(!Array.from(subscriptions.values()).some(p=>p.id===player.id))manager.disconnected(room,player);}});
      return;
    }
    if(req.method==='POST' && url.pathname==='/api/action') {
      const {room,player}=auth(req,url);const body=await readBody(req);
      switch(body.type){case 'start':manager.start(room,player);break;case 'submit':manager.submit(room,player,body.payload||{});break;case 'next':manager.next(room,player);break;case 'leave':manager.leaveLobby(room,player);break;default:return json(res,400,{error:'INVALID_ACTION',message:'Lệnh không được hỗ trợ.'});}
      return json(res,200,{ok:true});
    }
    return json(res,404,{error:'NOT_FOUND'});
  }catch(err){const bad=String(err.code||'RULE_ERROR');const isAuth=bad==='UNAUTHORIZED';return json(res,isAuth?401:(bad==='ROOM_NOT_FOUND'?404:400),{error:bad,message:err.message||'Unknown error'});}
});
const clock=setInterval(()=>manager.tick(),500);clock.unref();
const heartbeat=setInterval(()=>{for(const group of streams.values())for(const res of group.keys())if(!res.destroyed&&!res.writableEnded)res.write(': heartbeat\n\n');},15000);heartbeat.unref();
if(require.main===module)server.listen(port,host,()=>console.log('GREEN IMPACT multiplayer listening on port '+port));
module.exports={server,manager};
