'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..');
const names=['engine/dist/data/projects.json','public/index.html','public/app.js','public/style.css'];
function entry(name){
 const data=Buffer.from(fs.readFileSync(path.join(root,name),'utf8').replace(/\r\n/g,'\n'));
 const header=Buffer.alloc(512);
 const write=(text,offset,length)=>header.write(text,offset,length,'ascii');
 write(name,0,100);write('0000644\0',100,8);write('0000000\0',108,8);write('0000000\0',116,8);
 write(data.length.toString(8).padStart(11,'0')+'\0',124,12);write('00000000000\0',136,12);
 header.fill(32,148,156);header[156]=48;write('ustar\0',257,6);write('00',263,2);
 const checksum=header.reduce((sum,byte)=>sum+byte,0);
 write(checksum.toString(8).padStart(6,'0')+'\0 ',148,8);
 return Buffer.concat([header,data,Buffer.alloc((512-data.length%512)%512)]);
}
const archive=Buffer.concat([...names.map(entry),Buffer.alloc(1024)]);
const encoded=zlib.gzipSync(archive,{level:9}).toString('base64');
const width=Math.ceil(encoded.length/3);
const bundleDir=path.join(root,'runtime','compatibility');
fs.mkdirSync(bundleDir,{recursive:true});
for(let i=0;i<3;i++)fs.writeFileSync(path.join(bundleDir,'part0'+(i+1)+'.b64'),encoded.slice(i*width,(i+1)*width)+'\n');
console.log('Packaged current runtime sources and original project catalog.');
