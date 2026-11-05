'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),output=path.resolve(root,'.web-dist');
if(path.dirname(output)!==root||path.basename(output)!=='.web-dist')throw Error('Invalid static build output');
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
for(const [source,target] of [['ui/index.html','index.html'],['public/app.js','app.js'],['ui/style.css','style.css'],['ui/motion.js','motion.js'],['ui/motion.css','motion.css'],['ui/card-ui.js','card-ui.js'],['ui/card-webp-manifest.js','card-webp-manifest.js'],['ui/ending.html','ending.html'],['ui/ending.css','ending.css'],['ui/ending-ui.js','ending-ui.js'],['ui/tutorial.css','tutorial.css'],['ui/tutorial-ui.js','tutorial-ui.js'],['ui/rules.css','rules.css'],['ui/rules-ui.js','rules-ui.js'],['ui/action-fx.css','action-fx.css'],['ui/action-fx.js','action-fx.js']])fs.copyFileSync(path.join(root,source),path.join(output,target));
for(const directory of ['brand','fonts','cards','cards-hd','cards-hd-webp','endings','tutorials'])fs.cpSync(path.join(root,'ui',directory),path.join(output,directory),{recursive:true});
console.log('Built shared PC/mobile frontend with original HD artwork.');
