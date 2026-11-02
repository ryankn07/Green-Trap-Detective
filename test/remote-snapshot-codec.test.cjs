const {test}=require('node:test');
const assert=require('node:assert/strict');
test('snapshot codec preserves session secrets and locked actions while validating data',()=>{
 const {serializeRoom,validateSnapshot}=require('../server/room-store.cjs');
 const room={code:'ABC234',hostId:'p',players:[{id:'p',name:'A',secret:'a'.repeat(64)}],lastActivity:1,revision:2,deadline:null,state:{version:1,lockedActions:{p:{invest:true}}}};
 const snapshot=JSON.parse(JSON.stringify({version:1,rooms:[serializeRoom(room)]}));
 assert.equal(validateSnapshot(snapshot)[0].players[0].secret,'a'.repeat(64));
 assert.equal(snapshot.rooms[0].state.lockedActions.p.invest,true);
 assert.throws(()=>validateSnapshot({version:1,rooms:[{...snapshot.rooms[0],players:[]}]}));
});
