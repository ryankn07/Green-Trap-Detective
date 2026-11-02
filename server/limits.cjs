'use strict';
// Optional room policy; resource ceilings are per process, not hosting guarantees.
const roomLimit=process.env.ROOM_MAX_PLAYERS;
const MAX_PLAYERS=roomLimit===undefined||roomLimit===''?null:Number(roomLimit);
if(MAX_PLAYERS!==null&&(!Number.isSafeInteger(MAX_PLAYERS)||MAX_PLAYERS<3))throw Error('ROOM_MAX_PLAYERS must be an integer >= 3');
module.exports=Object.freeze({MIN_PLAYERS:3,MAX_PLAYERS,MAX_ROOMS:100,MAX_STREAMS:1200,BODY_BYTES:8000,SOURCE_ROOMS:10,SOURCE_SEATS:300});
