'use strict';
const {BODY_BYTES}=require('./limits.cjs');
class HttpError extends Error{
 constructor(code,message,status=400){super(message);this.code=code;this.status=status;}
}
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function readBody(req){
 return new Promise((resolve,reject)=>{
  let bytes=0,chunks=[],failed=false;
  const stop=error=>{if(failed)return;failed=true;chunks=[];reject(error);};
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){
   req.resume();return stop(new HttpError('BAD_CONTENT_TYPE','Yêu cầu phải dùng JSON.',415));
  }
  req.on('data',chunk=>{
   if(failed)return;
   bytes+=chunk.length;
   if(bytes>BODY_BYTES)return stop(new HttpError('TOO_LARGE','Nội dung gửi quá lớn.',413));
   chunks.push(chunk);
  });
  req.on('end',()=>{
   if(failed)return;
   try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!object(value))throw Error();resolve(value);}
   catch{stop(new HttpError('BAD_JSON','Nội dung JSON không hợp lệ.'));}
  });
  req.on('error',()=>stop(new HttpError('BAD_REQUEST','Kết nối yêu cầu bị gián đoạn.')));
  req.on('aborted',()=>stop(new HttpError('BAD_REQUEST','Kết nối yêu cầu bị gián đoạn.')));
 });
}
function checkOrigin(req){
 const origin=req.headers.origin;if(!origin)return;
 try{
  const value=new URL(origin);
  const allowed=(process.env.PUBLIC_ORIGINS||process.env.PUBLIC_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(allowed.length){if(!allowed.some(origin=>value.origin===new URL(origin).origin))throw Error();}
  else if(value.host!==req.headers.host||!['http:','https:'].includes(value.protocol))throw Error();
  if(value.origin!==origin)throw Error();
 }catch{throw new HttpError('BAD_ORIGIN','Nguồn yêu cầu không hợp lệ.',403);}
}
function validateContext(room,body){
 if(!object(body.context)||!room.state||body.context.gameId!==room.state.gameId||
    body.context.round!==room.state.round||body.context.phase!==room.state.phase)
  throw new HttpError('STALE_ACTION','Lượt chơi đã thay đổi. Hãy tải lại trạng thái.',409);
}
function validateSubmission(room,body){
 validateContext(room,body);
 if(!object(body.payload))throw new HttpError('INVALID_ACTION','Lệnh gửi không hợp lệ.');
 if(room.state.phase==='DEBATE'&&typeof body.payload.text!=='string')throw new HttpError('INVALID_STATEMENT','Nhận định phải là văn bản.');
}
module.exports={HttpError,readBody,checkOrigin,validateContext,validateSubmission};
