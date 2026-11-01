'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {RoomManager}=require('./rooms.cjs');
const {FileRoomStore}=require('./room-store.cjs');
const {HttpError,readBody,checkOrigin,validateSubmission}=require('./http-guards.cjs');
const {GameError}=require('../engine/dist/errors.js');
const {RateLimiter,clientAddress}=require('./rate-limit.cjs');
const {MAX_STREAMS}=require('./limits.cjs');
const limiter=new RateLimiter();
const trustedProxies=new Set((process.env.TRUSTED_PROXY_IPS||'').split(',').map(x=>x.trim()).filter(Boolean));
function rate(res,key,limit){const retry=limiter.take(key,limit);if(retry){res.setHeader('Retry-After',String(retry));throw new HttpError('RATE_LIMITED','Quá nhiều yêu cầu. Hãy thử lại sau.',429);}}
const port=Number(process.env.PORT||3000);
const host='0.0.0.0';
const streams=new Map();
const publicDir=path.resolve(__dirname,'../public');
const uiDir=path.resolve(__dirname,'../ui');
const uiStylePath=path.resolve(__dirname,'../ui/style.css');
function json(res,status,payload) {if(res.destroyed||res.writableEnded)return;if(res.headersSent){res.destroy();return;}res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));}
const blockedStreams=new WeakMap();
function streamSend(res,type,data){writeStreamFrame(res,'event: '+type+'\ndata: '+JSON.stringify(data)+'\n\n');}
function writeStreamFrame(res,frame){
  if(res.destroyed||res.writableEnded)return;
  const blocked=blockedStreams.get(res);
  if(blocked){blocked.latest=frame;return;}
  if(res.write(frame))return;
  // Snapshots are complete states: coalesce updates while a client drains.
  const pending={latest:null};blockedStreams.set(res,pending);
  const timer=setTimeout(()=>res.destroy(),10000);timer.unref();
  const cleanup=()=>{clearTimeout(timer);blockedStreams.delete(res);};
  res.once('close',cleanup);
  res.once('drain',()=>{res.removeListener('close',cleanup);cleanup();if(pending.latest&&!res.destroyed&&!res.writableEnded){
    writeStreamFrame(res,pending.latest);
  }});
}
function broadcastRoom(room) {for(const [res,who] of (streams.get(room.code)||new Map())) {try{streamSend(res,'snapshot',manager.view(room,who));}catch{res.end();}}}
// Batch near-simultaneous player updates; every frame remains a complete projection.
const pendingBroadcasts=new Map();
function emitRoom(room){
 if(pendingBroadcasts.has(room.code))return;
 const timer=setTimeout(()=>{pendingBroadcasts.delete(room.code);if(manager.rooms.get(room.code)===room)broadcastRoom(room);},16);
 timer.unref();pendingBroadcasts.set(room.code,timer);
}
const snapshotPath=process.env.ROOM_STORE_PATH||(require.main===module?path.resolve(__dirname,'../data/rooms.json'):null);
const manager=new RoomManager({onUpdate:emitRoom,store:snapshotPath?new FileRoomStore(snapshotPath):null});
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
const HEADERS={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
const allowedPaths=new Set(['/','/index.html','/app.js','/style.css']);

const canvaManifest=require('../ui/cards-manifest.json').cards;
const cardDir=path.join(uiDir,'cards');
const cardPattern=/^\/cards\/(PROJ_(?:0[1-9]|1\d|2[0-5])|ROLE_PROTECTOR|ROLE_SABOTEUR|GREENCOIN|BACK_0[1-4])\.png$/;
const fontFiles=new Set(['vollkorn-latin-wght-normal.woff2','vollkorn-vietnamese-wght-normal.woff2','hanken-grotesk-latin-wght-normal.woff2','hanken-grotesk-vietnamese-wght-normal.woff2','vollkorn-OFL.txt','hanken-grotesk-OFL.txt']);
const pendingCards=new Map();
function imageMime(buf){
  if(buf[0]===0x89 && buf.subarray(1,4).toString()==='PNG') return 'image/png';
  if(buf[0]===0xff && buf[1]===0xd8) return 'image/jpeg';
  if(buf.subarray(0,4).toString()==='RIFF' && buf.subarray(8,12).toString()==='WEBP') return 'image/webp';
  return 'application/octet-stream';
}
async function getCanvaCard(id){
  const filepath=path.join(cardDir,id+'.png');
  try{return await fs.promises.readFile(filepath)}catch(e){if(e.code!=='ENOENT')throw e}
  if(!canvaManifest[id])throw Error('Unknown Canva card');
  if(pendingCards.has(id))return pendingCards.get(id);
  const job=(async()=>{
    const r=await fetch(canvaManifest[id].url,{headers:{Accept:'image/avif,image/webp,image/png,image/jpeg,image/*'},signal:AbortSignal.timeout(18000)});
    if(!r.ok)throw Error('Canva card image fetch failed: '+r.status);
    const bytes=Buffer.from(await r.arrayBuffer());
    if(bytes.length<1000||bytes.length>8*1024*1024||!imageMime(bytes).startsWith('image/'))throw Error('Invalid Canva card image');
    await fs.promises.mkdir(cardDir,{recursive:true});
    await fs.promises.writeFile(filepath,bytes);
    return bytes;
  })();
  pendingCards.set(id,job);
  try{return await job}finally{pendingCards.delete(id)}
}

function auth(req,url) {const code=url.searchParams.get('room')||req.headers['x-room-code'];const bearer=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/);return manager.authenticate(code,bearer?.[1]);}
const server=http.createServer(async(req,res)=>{
  Object.entries(HEADERS).forEach(([key,value])=>res.setHeader(key,value));
  let url;try{url=new URL(req.url,'http://local');}catch{return json(res,400,{error:'BAD_URL'});}
  try {
    const address=clientAddress(req,trustedProxies);
    if(url.pathname.startsWith('/api/'))rate(res,'api:'+address,3000);
    if(req.method==='POST'&&url.pathname.startsWith('/api/'))checkOrigin(req);
    if(req.method==='GET' && url.pathname==='/health')return json(res,200,{status:'ok',activeRooms:manager.rooms.size});
    if(req.method==='GET' && allowedPaths.has(url.pathname)) {
      const filename=url.pathname==='/'?'index.html':url.pathname.slice(1);
      const filepath=(filename==='index.html'||filename==='style.css')?path.join(uiDir,filename):path.join(publicDir,filename);
      const data=await fs.promises.readFile(filepath);
      res.writeHead(200,{'Content-Type':MIME[path.extname(filepath)]||'application/octet-stream','Cache-Control':'no-store'});return res.end(data);
    }

    if(req.method==='GET' && url.pathname==='/brand/green-trap-detective.png'){
      const bytes=await fs.promises.readFile(path.join(uiDir,'brand','green-trap-detective.png'));
      res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'});
      return res.end(bytes);
    }
    if(req.method==='GET' && url.pathname.startsWith('/fonts/')){
      const filename=url.pathname.slice('/fonts/'.length);
      if(!fontFiles.has(filename))return json(res,404,{error:'NOT_FOUND'});
      const bytes=await fs.promises.readFile(path.join(uiDir,'fonts',filename));
      res.writeHead(200,{'Content-Type':filename.endsWith('.txt')?'text/plain; charset=utf-8':'font/woff2','Cache-Control':'public, max-age=86400'});
      return res.end(bytes);
    }
    const hdCardMatch=req.method==='GET'?url.pathname.match(/^\/cards-hd\/(PROJ_(?:0[1-9]|1\d|2[0-5]))\.png$/):null;
    if(hdCardMatch){
      try{
        const bytes=await fs.promises.readFile(path.join(uiDir,'cards-hd',hdCardMatch[1]+'.png'));
        res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=3600'});
        return res.end(bytes);
      }catch(e){if(e.code==='ENOENT')return json(res,404,{error:'CARD_UNAVAILABLE'});throw e;}
    }
    const cardMatch=req.method==='GET'?url.pathname.match(cardPattern):null;
    if(cardMatch){
      try{
        const bytes=await getCanvaCard(cardMatch[1]);
        res.writeHead(200,{'Content-Type':imageMime(bytes),'Cache-Control':'public, max-age=3600'});
        return res.end(bytes);
      }catch(e){return json(res,404,{error:'CARD_UNAVAILABLE'});}
    }
    if(req.method==='GET' && url.pathname==='/card-ui.js'){
      const data=await fs.promises.readFile(path.join(uiDir,'card-ui.js'));
      res.writeHead(200,{'Content-Type':MIME['.js'],'Cache-Control':'no-store'});
      return res.end(data);
    }

    if(req.method==='POST' && url.pathname==='/api/create') {
      rate(res,'create:'+address,30);
      const body=await readBody(req);const {room,player}=manager.create(body.name);
      return json(res,200,{roomCode:room.code,playerId:player.id,token:player.secret});
    }
    if(req.method==='POST' && url.pathname==='/api/join') {
      rate(res,'join:'+address,180);
      const body=await readBody(req);const {room,player}=manager.join(body.roomCode,body.name);
      return json(res,200,{roomCode:room.code,playerId:player.id,token:player.secret});
    }
    if(req.method==='GET' && url.pathname==='/api/state') {
      const {room,player}=auth(req,url);rate(res,'state:'+player.id,120);return json(res,200,manager.view(room,player));
    }
    if(req.method==='GET' && url.pathname==='/api/stream') {
      const {room,player}=auth(req,url);
      rate(res,'stream:'+player.id,30);
      let total=0;for(const group of streams.values())total+=group.size;
      const replacing=Array.from(streams.get(room.code)?.values()||[]).some(p=>p.id===player.id);
      if(total>=MAX_STREAMS&&!replacing)throw new HttpError('SERVER_BUSY','Máy chủ đang đầy. Hãy thử lại sau.',503);
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
      res.write(': connected\n\n');
      if(!streams.has(room.code))streams.set(room.code,new Map());
      const subscriptions=streams.get(room.code);
      for(const [old,other] of subscriptions) if(other.id===player.id && old!==res) {streamSend(old,'superseded',{});old.end();subscriptions.delete(old);}
      subscriptions.set(res,player);
      res.on('close',()=>{if(subscriptions.get(res)?.id===player.id){subscriptions.delete(res);if(!subscriptions.size)streams.delete(room.code);if(manager.rooms.get(room.code)===room&&room.players.includes(player)&&!Array.from(subscriptions.values()).some(p=>p.id===player.id))try{manager.disconnected(room,player);}catch(error){console.error('Disconnect persistence failed:',error.name);}}});
      manager.connected(room,player);streamSend(res,'snapshot',manager.view(room,player));
      return;
    }
    if(req.method==='POST' && url.pathname==='/api/action') {
      const {room,player}=auth(req,url);rate(res,'action:'+player.id,60);const body=await readBody(req);
      switch(body.type){case 'start':manager.start(room,player);break;case 'submit':validateSubmission(room,body);manager.submit(room,player,body.payload||{});break;case 'next':manager.next(room,player);break;case 'kick':{
        const target=manager.kickLobby(room,player,body.targetId);
        for(const [stream,who] of streams.get(room.code)||[])if(who.id===target.id)stream.end('event: kicked\ndata: {}\n\n');
        break;
      }case 'leave':manager.leaveLobby(room,player);for(const [stream,who] of streams.get(room.code)||[])if(who.id===player.id)stream.end();break;default:return json(res,400,{error:'INVALID_ACTION',message:'Lệnh không được hỗ trợ.'});}
      return json(res,200,{ok:true});
    }
    return json(res,404,{error:'NOT_FOUND'});
  }catch(err){
    const known=err instanceof HttpError||err instanceof GameError||err.public===true;
    const code=known?err.code:'INTERNAL_ERROR';

    const status=err instanceof HttpError?err.status:!known?500:code==='UNAUTHORIZED'?401:code==='ROOM_NOT_FOUND'?404:code==='SERVER_BUSY'?503:400;
    if(!known)console.error('Request failed:',err.name);
    return json(res,status,{error:code,message:known?err.message:'Máy chủ gặp lỗi. Vui lòng thử lại.'});
  }
});
server.requestTimeout=15000;
server.headersTimeout=10000;
server.keepAliveTimeout=5000;
server.maxConnections=1500;
server.on('close',()=>{for(const timer of pendingBroadcasts.values())clearTimeout(timer);pendingBroadcasts.clear();});
const clock=setInterval(()=>{try{manager.tick();}catch(error){console.error('Room clock failed:',error.name);}},500);clock.unref();
const heartbeat=setInterval(()=>{limiter.prune();for(const group of streams.values())for(const res of group.keys())if(!res.destroyed&&!res.writableEnded)if(!res.writableNeedDrain)res.write(': heartbeat\n\n');},15000);heartbeat.unref();
if(require.main===module)server.listen(port,host,()=>console.log('GREEN IMPACT multiplayer listening on port '+port));
module.exports={server,manager};
