'use strict';
const {isIP}=require('node:net');
class RateLimiter{
 constructor({now=Date.now,maxEntries=10000}={}){this.now=now;this.maxEntries=maxEntries;this.entries=new Map();}
 prune(){const now=this.now();for(const [key,entry] of this.entries)if(entry.until<=now)this.entries.delete(key);}
 take(key,limit,windowMs=60000){
  const now=this.now();let entry=this.entries.get(key);
  if(!entry||entry.until<=now){
   if(this.entries.size>=this.maxEntries)this.prune();
   if(!this.entries.has(key)&&this.entries.size>=this.maxEntries)return Math.ceil(windowMs/1000);
   entry={count:0,until:now+windowMs};this.entries.set(key,entry);
  }
  if(entry.count>=limit)return Math.max(1,Math.ceil((entry.until-now)/1000));
  entry.count++;return 0;
 }
}
function clientAddress(req,trusted=new Set()){
 let address=req.socket.remoteAddress||'unknown';
 // Walk only explicitly trusted proxy addresses from right to left.
 const forwarded=String(req.headers['x-forwarded-for']||'').split(',').map(x=>x.trim());
 for(let i=forwarded.length-1;i>=0&&trusted.has(address);i--){if(!isIP(forwarded[i]))break;address=forwarded[i];}
 return address;
}
module.exports={RateLimiter,clientAddress};
