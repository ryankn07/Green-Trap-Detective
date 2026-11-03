'use strict';
// Measure the green outer frame, not every non-white export pixel. Never rewrite artwork.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function readPng(file){
 const png=fs.readFileSync(file),w=png.readUInt32BE(16),h=png.readUInt32BE(20),channels=png[25]===2?3:png[25]===6?4:0;
 if(png[24]!==8||png[28]!==0||!channels)throw Error('Expected non-interlaced RGB/RGBA PNG: '+file);
 const chunks=[];for(let p=8;p<png.length;){const size=png.readUInt32BE(p);if(png.toString('ascii',p+4,p+8)==='IDAT')chunks.push(png.subarray(p+8,p+8+size));p+=size+12;}
 const raw=zlib.inflateSync(Buffer.concat(chunks)),stride=w*channels,pixels=Buffer.alloc(h*stride);
 const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 for(let y=0;y<h;y++){
  const filter=raw[y*(stride+1)];if(filter>4)throw Error('Invalid PNG filter');
  for(let x=0;x<stride;x++){
   const i=y*stride+x,left=x>=channels?pixels[i-channels]:0,up=y?pixels[i-stride]:0,corner=y&&x>=channels?pixels[i-stride-channels]:0;
   const prediction=filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):filter===4?paeth(left,up,corner):0;
   pixels[i]=(raw[y*(stride+1)+1+x]+prediction)&255;
  }
 }
 return {w,h,channels,pixels,sha256:crypto.createHash('sha256').update(png).digest('hex')};
}
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
function measure(image){
 const {w,h,channels,pixels}=image,total=w*h,green=new Uint8Array(total);
 for(let i=0;i<total;i++){const p=i*channels,r=pixels[p],g=pixels[p+1],b=pixels[p+2];green[i]=g>r+5&&g>b+5&&g>(r+b)*.57?1:0;}
 const lefts=[],rights=[],bottoms=[];
 for(let n=0;n<25;n++){
  const y=Math.round(h*(.3+n*.4/24));let left=0,right=w-1;
  while(left<w&&!green[y*w+left])left++;while(right>=0&&!green[y*w+right])right--;
  if(left<right){lefts.push(left);rights.push(right);}
  const x=Math.round(w*(.25+n*.5/24));let bottom=h-1;while(bottom>=0&&!green[bottom*w+x])bottom--;
  if(bottom>=0)bottoms.push(bottom);
 }
 const left=median(lefts),right=median(rights),bottom=median(bottoms);
 if(!Number.isFinite(left)||!Number.isFinite(right)||!Number.isFinite(bottom))throw Error('Frame edges not found');
 const queue=new Uint32Array(total),frame=new Uint8Array(total);let head=0,tail=0,seed=-1;
 for(let y=Math.round(h*.4);y<Math.round(h*.6)&&seed<0;y++)for(let x=left;x<Math.min(right,left+w*.04);x++)if(green[y*w+x]){seed=y*w+x;break;}
 if(seed<0)throw Error('Frame seed not found');
 const add=i=>{if(!frame[i]&&green[i]){const x=i%w,y=Math.floor(i/w);if(x>=left-1&&x<=right+1&&y<=bottom+1){frame[i]=1;queue[tail++]=i;}}};
 add(seed);
 while(head<tail){const i=queue[head++],x=i%w;if(x)add(i-1);if(x<w-1)add(i+1);if(i>=w)add(i-w);if(i<total-w)add(i+w);}
 if(tail<total*.02)throw Error('Disconnected frame measurement');
 // One native pixel retains the antialiased dark border around the green frame.
 const mask=frame.slice();for(let i=0;i<tail;i++){
  const p=queue[i],x=p%w,y=Math.floor(p/w);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)mask[p+dy*w+dx]=1;
 }
 const outside=new Uint8Array(total);head=0;tail=0;
 const flood=i=>{if(!mask[i]&&!outside[i]){outside[i]=1;queue[tail++]=i;}};
 for(let x=0;x<w;x++){flood(x);flood((h-1)*w+x);}for(let y=0;y<h;y++){flood(y*w);flood(y*w+w-1);}
 while(head<tail){const i=queue[head++],x=i%w;if(x)flood(i-1);if(x<w-1)flood(i+1);if(i>=w)flood(i-w);if(i<total-w)flood(i+w);}
 const edges=new Map(),unit=w+1;let area=0;
 const edge=(x,y,nx,ny)=>edges.set(y*unit+x,ny*unit+nx);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!outside[y*w+x]){
  area++;if(!y||outside[(y-1)*w+x])edge(x,y,x+1,y);
  if(x===w-1||outside[y*w+x+1])edge(x+1,y,x+1,y+1);
  if(y===h-1||outside[(y+1)*w+x])edge(x+1,y+1,x,y+1);
  if(!x||outside[y*w+x-1])edge(x,y+1,x,y);
 }
 if(area<total*.45||area>total*.98)throw Error('Implausible frame area: '+area/total);
 const first=edges.keys().next().value,points=[];let p=first;
 do{points.push([p%unit,Math.floor(p/unit)]);p=edges.get(p);if(p===undefined||points.length>edges.size)throw Error('Frame contour is not closed');}while(p!==first);
 const distance=(p,a,b)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
 };
 function simplify(list){
  let far=0,index=0;for(let i=1;i<list.length-1;i++){const d=distance(list[i],list[0],list.at(-1));if(d>far){far=d;index=i;}}
  return far>Math.max(.7,w/800)?[...simplify(list.slice(0,index+1)).slice(0,-1),...simplify(list.slice(index))]:[list[0],list.at(-1)];
 }
 let split=1;for(let i=2;i<points.length;i++)if(Math.hypot(points[i][0]-points[0][0],points[i][1]-points[0][1])>Math.hypot(points[split][0]-points[0][0],points[split][1]-points[0][1]))split=i;
 const outline=[...simplify(points.slice(0,split+1)).slice(0,-1),...simplify([...points.slice(split),points[0]]).slice(0,-1)];
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),width=Math.max(...xs)-x,height=Math.max(...ys)-y;
 const pct=n=>n.toFixed(5)+'%';
 return {bounds:{x,y,width,height},vertices:outline.length,css:'--card-frame-ratio:'+width+' / '+height+';--card-source-width:'+pct(w/width*100)+';--card-source-height:'+pct(h/height*100)+';--card-source-left:'+pct(-x/width*100)+';--card-source-top:'+pct(-y/height*100)+';--card-frame-outline:polygon('+outline.map(p=>(p[0]/w*100).toFixed(3)+'% '+(p[1]/h*100).toFixed(3)+'%').join(',')+')'};
}
function generate(check=false){
 const file=path.join(root,'ui/style.css'),source=fs.readFileSync(file,'utf8'),report=[];
 const output=source.split('\n').map(line=>{
  if(!line.includes(':is(.gi-card-preview,.welcome-card):has('))return line;
  const match=line.match(/\/cards(-hd)?\/(PROJ_\d{2})\.png/);if(!match)return line;
  const relative='ui/cards'+(match[1]||'')+'/'+match[2]+'.png',image=readPng(path.join(root,relative)),shape=measure(image);
  report.push({source:relative,sha256:image.sha256,bounds:shape.bounds,vertices:shape.vertices});
  return line.slice(0,line.indexOf('{')+1)+shape.css+'}'+(line.endsWith('\r')?'\r':'');
 }).join('\n');
 if(report.length!==50)throw Error('Expected 25 thumbnail and 25 HD frame rules');
 if(check){if(output!==source)throw Error('Card outlines are stale');console.log('Verified 50 measured card outlines; source artwork unchanged.');}
 else{fs.writeFileSync(file,output);console.log(JSON.stringify(report,null,2));}
}
if(require.main===module)generate(process.argv.includes('--check'));
module.exports={readPng,measure};
