'use strict';
const {randomUUID}=require('node:crypto');
// The only credential-bearing module; never include responses or credentials in errors.
class SupabaseSnapshotStore {
  constructor({url,key,fetch:request=globalThis.fetch}) {
    const parsed=new URL(url);
    if(parsed.protocol!=='https:'||!key)throw Error('Invalid remote snapshot configuration');
    this.url=parsed.origin;this.key=key;this.request=request;this.revision=null;this.writer=randomUUID();
  }
  async call(name,body,timeout=10000){
    const response=await this.request(this.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:this.key,Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
    if(!response.ok){const error=Error('Remote snapshot request failed');error.status=response.status;throw error;}
    return response.json();
  }
  async load(){
    const result=await this.call('game_snapshot_claim',{writer_token:this.writer});
    if(!result||!Number.isSafeInteger(result.revision)||result.revision<0||!result.snapshot||result.snapshot.version!==1||!Array.isArray(result.snapshot.rooms))throw Error('Invalid remote snapshot response');
    this.revision=result.revision;return result.snapshot;
  }
  async commit(snapshot){
    if(this.revision===null)throw Error('Remote snapshot not loaded');
    const result=await this.call('game_snapshot_compare_and_swap',{writer_token:this.writer,expected_revision:this.revision,new_snapshot:snapshot});
    if(!result||result.revision!==this.revision+1)throw Error('Remote snapshot conflict');
    this.revision=result.revision;
  }
  async verify(){
    if(this.revision===null)throw Error('Remote snapshot not loaded');
    const deadline=performance.now()+3000;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const remaining=Math.floor(deadline-performance.now());
        if(remaining<=0){const error=Error('Remote verification timed out');error.name='TimeoutError';throw error;}
        const result=await this.call('game_snapshot_verify',{writer_token:this.writer,expected_revision:this.revision},remaining);
        if(!result||result.revision!==this.revision)throw Error('Remote snapshot ownership lost');
        if(performance.now()>deadline){const error=Error('Remote verification timed out');error.name='TimeoutError';throw error;}
        return;
      }catch(error){
        const transient=error instanceof TypeError||error?.name==='TimeoutError'||[429,502,503,504].includes(error?.status);
        const wait=100*(attempt+1);
        if(!transient||attempt===2||performance.now()+wait>=deadline)throw error;
        await new Promise(resolve=>setTimeout(resolve,wait));
      }
    }
  }
}
module.exports={SupabaseSnapshotStore};
