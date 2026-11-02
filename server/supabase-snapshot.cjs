'use strict';
// The only credential-bearing module; never include responses or credentials in errors.
class SupabaseSnapshotStore {
  constructor({url,key,fetch:request=globalThis.fetch}) {
    const parsed=new URL(url);
    if(parsed.protocol!=='https:'||!key)throw Error('Invalid remote snapshot configuration');
    this.url=parsed.origin;this.key=key;this.request=request;this.revision=null;
  }
  async call(name,body){
    const response=await this.request(this.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:this.key,Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Remote snapshot request failed');
    return response.json();
  }
  async load(){
    const result=await this.call('game_snapshot_load',{});
    if(!result||!Number.isSafeInteger(result.revision)||result.revision<0||!result.snapshot||result.snapshot.version!==1||!Array.isArray(result.snapshot.rooms))throw Error('Invalid remote snapshot response');
    this.revision=result.revision;return result.snapshot;
  }
  async commit(snapshot){
    if(this.revision===null)throw Error('Remote snapshot not loaded');
    const result=await this.call('game_snapshot_compare_and_swap',{expected_revision:this.revision,new_snapshot:snapshot});
    if(!result||result.revision!==this.revision+1)throw Error('Remote snapshot conflict');
    this.revision=result.revision;
  }
}
module.exports={SupabaseSnapshotStore};
