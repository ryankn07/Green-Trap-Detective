'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('bounded rate limits preserve 12 NAT users and do not trust spoofed forwarding headers',()=>{
 const {RateLimiter,clientAddress}=require('../server/rate-limit.cjs');
 let now=0;const limiter=new RateLimiter({now:()=>now,maxEntries:3});
 assert.equal(clientAddress({socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':'1.2.3.4'}},new Set()),'127.0.0.1');
 assert.equal(clientAddress({socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':'spoof, 1.2.3.4'}},new Set(['127.0.0.1'])),'1.2.3.4');
 for(let i=0;i<12;i++)assert.equal(limiter.take('shared-ip',180,60000),0);
 for(let i=12;i<180;i++)limiter.take('shared-ip',180,60000);
 assert.equal(limiter.take('shared-ip',180,60000),60);
 limiter.take('b',1,60000);limiter.take('c',1,60000);
 assert.ok(limiter.take('d',1,60000)>0);assert.equal(limiter.entries.size,3);
 now=60001;assert.equal(limiter.take('d',1,60000),0);assert.equal(limiter.entries.size,1);
});
