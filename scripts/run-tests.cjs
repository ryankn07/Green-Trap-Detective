'use strict';
// CI must exercise the browser and PostgreSQL tests, not silently skip them.
// Keep this file outside Node's test-*.cjs discovery pattern.
const {spawn}=require('node:child_process');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
function dependency(variable,name){
  const requested=process.env[variable]||name;
  try{return require.resolve(requested,{paths:[root]});}
  catch{throw Error(`Missing ${name}. Run npm ci or set ${variable} to an installed module.`);}
}

try{
  const env={...process.env,
    PLAYWRIGHT_MODULE_PATH:dependency('PLAYWRIGHT_MODULE_PATH','playwright'),
    PGLITE_MODULE_PATH:dependency('PGLITE_MODULE_PATH','@electric-sql/pglite'),
    BROWSER_CHANNEL:process.env.BROWSER_CHANNEL||'chrome'
  };
  const child=spawn(process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',...process.argv.slice(2)],{cwd:root,env,stdio:['inherit','pipe','inherit']});
  let output='';
  child.stdout.on('data',chunk=>{output+=chunk;process.stdout.write(chunk);});
  child.on('error',error=>{console.error(error.message);process.exitCode=1;});
  child.on('close',code=>{
    if(code!==0){process.exitCode=code||1;return;}
    const summaries=[...output.matchAll(/^# skipped (\d+)\s*$/gm)];
    if(!summaries.length||summaries.some(match=>Number(match[1])!==0)){
      console.error('Full verification requires a completed test report with zero skipped tests.');
      process.exitCode=1;
    }
  });
}catch(error){console.error(error.message);process.exitCode=1;}
