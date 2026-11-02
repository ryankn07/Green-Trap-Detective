/* A bounded QR encoder for ending links: byte mode, version 5-L, mask 0.
 * One 108-byte data block and 26 Reed-Solomon parity bytes; no remote QR service.
 * Format and layout follow QR Code Model 2. Four modules of quiet zone are retained.
 */
(function(root){
  'use strict';
  function matrix(text){
    const bytes=new TextEncoder().encode(text);
    if(bytes.length>106)throw new RangeError('Ending link exceeds QR capacity');
    const bits=[];
    const append=(value,count)=>{for(let i=count-1;i>=0;i--)bits.push((value>>>i)&1);};
    append(4,4);append(bytes.length,8);for(const byte of bytes)append(byte,8);
    append(0,Math.min(4,864-bits.length));while(bits.length%8)bits.push(0);
    const data=[];for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((a,b)=>(a<<1)|b,0));
    for(let i=0;data.length<108;i++)data.push(i%2?0x11:0xec);
    const multiply=(a,b)=>{let out=0;for(let i=0;i<8;i++){if(b&1)out^=a;b>>>=1;a<<=1;if(a&256)a^=0x11d;}return out;};
    let generator=[1],power=1;
    for(let i=0;i<26;i++){
      const next=Array(generator.length+1).fill(0);
      generator.forEach((coefficient,j)=>{next[j]^=coefficient;next[j+1]^=multiply(coefficient,power);});
      generator=next;power=multiply(power,2);
    }
    const remainder=[...data,...Array(26).fill(0)];
    for(let i=0;i<data.length;i++){const factor=remainder[i];generator.forEach((coefficient,j)=>{remainder[i+j]^=multiply(coefficient,factor);});}
    const words=[...data,...remainder.slice(-26)],size=37;
    const cells=Array.from({length:size},()=>Array(size).fill(false)),reserved=Array.from({length:size},()=>Array(size).fill(false));
    const set=(x,y,dark)=>{if(x>=0&&x<size&&y>=0&&y<size){cells[y][x]=Boolean(dark);reserved[y][x]=true;}};
    for(const [cx,cy] of [[3,3],[size-4,3],[3,size-4]])for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
      const distance=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,distance!==2&&distance!==4);
    }
    for(let i=8;i<size-8;i++){set(i,6,i%2===0);set(6,i,i%2===0);}
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(30+dx,30+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
    let formatRemainder=8;
    for(let i=0;i<10;i++)formatRemainder=(formatRemainder<<1)^((formatRemainder>>>9)*0x537);
    const format=((8<<10)|formatRemainder)^0x5412,bit=i=>((format>>>i)&1)!==0;
    for(let i=0;i<6;i++)set(8,i,bit(i));set(8,7,bit(6));set(8,8,bit(7));set(7,8,bit(8));
    for(let i=9;i<15;i++)set(14-i,8,bit(i));
    for(let i=0;i<8;i++)set(size-1-i,8,bit(i));for(let i=8;i<15;i++)set(8,size-15+i,bit(i));set(8,size-8,true);
    let index=0;
    for(let right=size-1;right>=1;right-=2){
      if(right===6)right=5;
      for(let vertical=0;vertical<size;vertical++){
        const y=((right+1)&2)===0?size-1-vertical:vertical;
        for(let j=0;j<2;j++){
          const x=right-j;if(reserved[y][x])continue;
          let dark=index<words.length*8&&((words[index>>>3]>>>(7-(index&7)))&1)!==0;
          if((x+y)%2===0)dark=!dark;cells[y][x]=dark;index++;
        }
      }
    }
    return cells;
  }
  function draw(container,text){
    const cells=matrix(text),ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 45 45');svg.setAttribute('aria-hidden','true');svg.setAttribute('shape-rendering','crispEdges');
    const background=document.createElementNS(ns,'rect');background.setAttribute('width','45');background.setAttribute('height','45');background.setAttribute('fill','#fff');svg.append(background);
    const path=document.createElementNS(ns,'path');let d='';
    cells.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)d+=`M${x+4} ${y+4}h1v1h-1z`;}));
    path.setAttribute('d',d);path.setAttribute('fill','#14251b');svg.append(path);container.replaceChildren(svg);
  }
  const api={matrix,draw};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GreenTrapQR=api;
})(typeof window==='undefined'?globalThis:window);
