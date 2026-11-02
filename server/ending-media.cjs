'use strict';
const fs=require('node:fs');
const path=require('node:path');
const directory=path.resolve(__dirname,'../ui/endings');

// Only the owner's two films and their extracted poster frames are public.
async function serveEndingMedia(req,res,pathname){
  const match=pathname.match(/^\/endings\/(good|bad)(\.mp4|-poster\.jpg)$/);
  if(!match||!['GET','HEAD'].includes(req.method))return false;
  const filename=match[1]+match[2];
  let stat;
  try{stat=await fs.promises.stat(path.join(directory,filename));}
  catch(error){if(error.code!=='ENOENT')throw error;res.writeHead(404);res.end();return true;}
  const headers={'Content-Type':filename.endsWith('.mp4')?'video/mp4':'image/jpeg','Cache-Control':'public, max-age=86400','Accept-Ranges':'bytes'};
  let start=0,end=stat.size-1,status=200;
  if(req.headers.range){
    const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(range&&(range[1]||range[2])){
      if(!range[1]){start=Math.max(0,stat.size-Number(range[2]));}
      else{start=Number(range[1]);if(range[2])end=Math.min(Number(range[2]),end);}
    }
    if(!range||(!range[1]&&!range[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=stat.size||end<start||(!range[1]&&Number(range[2])===0)){
      res.writeHead(416,{...headers,'Content-Range':'bytes */'+stat.size,'Content-Length':0});res.end();return true;
    }
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
  }
  headers['Content-Length']=end-start+1;
  res.writeHead(status,headers);
  if(req.method==='HEAD'){res.end();return true;}
  const stream=fs.createReadStream(path.join(directory,filename),{start,end});
  stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  return true;
}
module.exports={serveEndingMedia};
