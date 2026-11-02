'use strict';
const original=globalThis.fetch;

// Synchronize an aborted client with the server's actual close observation.
// IPC is available only in the HTTP test child; no session data is sent.
if(process.send){
  const http=require('node:http'),emit=http.Server.prototype.emit;
  http.Server.prototype.emit=function(event,...args){
    if(event==='request'&&args[0].url.startsWith('/api/stream'))args[1].once('close',()=>{if(process.connected)process.send({type:'test-stream-closed'});});
    return emit.call(this,event,...args);
  };
}
globalThis.fetch=(url,options)=>original(String(url).replace('https://example.test',process.env.TEST_REST_ORIGIN),options);
