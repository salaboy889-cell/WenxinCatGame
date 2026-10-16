const colors={bg:'#161121',card:'#241b32',border:'#3b2b48',text:'#f8edf7',muted:'#ac9aba',pink:'#efacd0',mint:'#9fdfca'};
// 品种图分包加载状态（game.json subpackages.breeds）
let _breedsLoaded=false,_breedsLoading=false;
function ensureBreedsPkg(onDone){
  if(_breedsLoaded){onDone&&onDone(true);return;}
  if(!wx.loadSubpackage){_breedsLoaded=true;onDone&&onDone(true);return;}
  if(_breedsLoading)return;
  _breedsLoading=true;
  wx.loadSubpackage({name:'breeds',
    success:()=>{_breedsLoaded=true;_breedsLoading=false;onDone&&onDone(true);},
    fail:()=>{_breedsLoading=false;onDone&&onDone(false);}});
}
class UI{
 constructor(canvas,width,height){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.w=width;this.h=height;this.hits=[];this.images={};this.scroll=0;this.contentBottom=0;this.imageRevision=0;this.wrapCache=new Map();this.dynamicCats=[];this.content=false;}
 begin(){this.hits=[];const c=this.ctx;c.clearRect(0,0,this.w,this.h);c.fillStyle=colors.bg;c.fillRect(0,0,this.w,this.h);}
 text(value,x,y,size=14,color=colors.text,align='left'){if(!this.visible(0,y,this.w,size*1.7))return;const c=this.ctx;c.font=`${size}px sans-serif`;c.fillStyle=color;c.textAlign=align;c.textBaseline='top';c.fillText(String(value),x,y);}
 layout(value,width,size){const text=String(value||''),key=size+'|'+width+'|'+text;let rows=this.wrapCache.get(key);if(rows)return rows;const c=this.ctx;c.font=`${size}px sans-serif`;rows=[];let row='';for(const ch of text){if(ch==='\n'||c.measureText(row+ch).width>width){rows.push(row);row=ch==='\n'?'':ch;}else row+=ch;}if(row)rows.push(row);if(this.wrapCache.size>=640)this.wrapCache.delete(this.wrapCache.keys().next().value);this.wrapCache.set(key,rows);return rows;}
 wrap(value,x,y,width,size=13,color=colors.muted){const rows=this.layout(value,width,size);rows.forEach((row,i)=>this.text(row,x,y+i*size*1.65,size,color));return y+rows.length*size*1.65;}
 visible(x,y,w,h){const top=this.content?y-this.scroll:y;return x+w>=0&&x<=this.w&&top+h>=(this.content?70:0)&&top<=(this.content?this.h-62:this.h);}
 ensureImage(src){if(!src)return null;
  // 品种图在分包中：未加载完成时先触发加载，返回null显示"加载中"，分包就绪后自动重绘
  if(src.indexOf('/assets/breeds/')===0&&!_breedsLoaded){
    ensureBreedsPkg(ok=>{if(ok){for(const k of Object.keys(this.images)){if(k.indexOf('/assets/breeds/')===0)delete this.images[k];}this.imageRevision++;}});
    return null;}
  let im=this.images[src];if(!im){im=wx.createImage();this.images[src]=im;im.onload=()=>{im.ready=true;this.imageRevision++;};im.onerror=()=>{im.failed=true;this.imageRevision++;};im.src=src.replace(/^\//,'');}return im;}

 box(x,y,w,h,fill=colors.card,r=16){if(!this.visible(x,y,w,h))return;const c=this.ctx;c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();c.fillStyle=fill;c.fill();}
 hit(x,y,w,h,action,fixed=false){this.hits.push({x,y:fixed?y:y-this.scroll,w,h,action,fixed,clip:this.hitClip&&{...this.hitClip}});}
 button(label,x,y,w,action,primary=false,h=36){this.box(x,y,w,h,primary?colors.pink:'#393047',Math.min(11,h/3));if(!primary)this.stroke(x,y,w,h,'#524363',Math.min(11,h/3));this.text(label,x+w/2,y+(h-14)/2,14,primary?'#35223a':colors.text,'center');if(action)this.hit(x,y,w,h,action);}
 bar(x,y,w,value){this.box(x,y,w,6,'#58415d',3);if(value>0)this.box(x,y,Math.max(6,w*Math.min(1,value)),6,colors.mint,3);}
 image(src,x,y,w,h){if(!this.visible(x,y,w,h))return;const im=this.ensureImage(src);if(im&&im.ready)this.ctx.drawImage(im,x,y,w,h);}
 cat(cat,x,y,size,state='idle',time=0,face=1,motion=null){if(!cat||!this.visible(x,y,size,size))return;if(this.captureCats){this.ensureImage(cat.breedSprite||cat.sprite);this.dynamicCats.push({cat,x,y:y-(this.content?this.scroll:0),size,state,face,motion});return;}this.paintCat(cat,x,y,size,state,time,face);}
 paintCat(cat,x,y,size,state='idle',time=0,face=1){if(!cat||!this.visible(x,y,size,size))return;const im=this.ensureImage(cat.breedSprite||cat.sprite);if(!im||!im.ready){this.text(im&&im.failed?'图片重试中…':'图片加载中…',x+size/2,y+size*.65,Math.min(10,size/9),colors.muted,'center');return;}if(cat.breedSprite){this.paintBreedCat(cat,im,x,y,size,state,time,face);return;}const c=this.ctx,frame=state==='idle'?(Math.floor(time/600)%8<6?0:1):Math.floor(time/(state==='walk'?180:300))%4,row=cat.sleeping?3:state==='walk'?1:state==='feed'?2:state==='pet'?3:0,col=cat.sleeping?2+Math.floor(time/800)%2:state==='pet'?Math.floor(time/300)%2:frame,s=im.width/4;c.save();if(face<0){c.translate(x+size,y);c.scale(-1,1);x=0;y=0;}c.drawImage(im,col*s,row*s,s,s,x,y,size,size);c.restore();}
 paintBreedCat(cat,im,x,y,size,state,time,face){const c=this.ctx,breath=Math.sin(time/(cat.sleeping?950:720))*(cat.sleeping?.004:.007),step=state==='walk'?Math.sin(time/160)*1.4:0;c.save();c.translate(x+size/2,y+size);c.scale(face<0?-1:1,1+breath);c.drawImage(im,-size/2,-size+step,size,size);
 if(['bow','scarf','flower'].includes(cat.outfit)){const neckX=cat.sleeping?size*.13:0,neckY=-size*(cat.sleeping?.22:.48),r=size*.038;c.translate(neckX,neckY);c.fillStyle=cat.outfit==='scarf'?'#acb9df':'#efa9cd';
 if(cat.outfit==='scarf'){c.beginPath();c.ellipse(0,0,size*.095,r,0,0,Math.PI*2);c.fill();c.fillRect(size*.04,0,r,size*.1);}
 else if(cat.outfit==='flower'){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;c.beginPath();c.ellipse(Math.cos(a)*r,Math.sin(a)*r,r*.8,r*.8,0,0,Math.PI*2);c.fill();}c.fillStyle='#f7d68e';c.beginPath();c.ellipse(0,0,r*.6,r*.6,0,0,Math.PI*2);c.fill();}
 else {for(const sign of [-1,1]){c.beginPath();c.moveTo(0,0);c.lineTo(sign*r*2,-r);c.lineTo(sign*r*2,r);c.closePath();c.fill();}c.beginPath();c.ellipse(0,0,r*.6,r*.6,0,0,Math.PI*2);c.fill();}}
 c.restore();}
 stroke(x,y,w,h,color=colors.border,r=14){if(!this.visible(x,y,w,h))return;const c=this.ctx;c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();c.strokeStyle=color;c.lineWidth=1;c.stroke();}
 line(x,y,w){if(!this.visible(x,y,w,1))return;this.ctx.fillStyle='#413047';this.ctx.fillRect(x,y,w,1);}
 ellipse(x,y,rx,ry,color){if(!this.visible(x-rx,y-ry,rx*2,ry*2))return;const c=this.ctx;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();}
 lines(value,width,size=13){return Math.max(1,this.layout(value,width,size).length);}
 pill(label,x,y,w,action,fill='#3b2c48',color='#d7c5e5',h=27,size=11){this.box(x,y,w,h,fill,h/2);this.text(label,x+w/2,y+(h-size)/2,size,color,'center');if(action)this.hit(x,y,w,h,action);}
 imageCover(src,x,y,w,h,r=15){if(!this.visible(x,y,w,h))return;const im=this.ensureImage(src);if(!im||!im.ready)return;const c=this.ctx;c.save();c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();c.clip();const scale=Math.max(w/im.width,h/im.height),sw=w/scale,sh=h/scale;c.drawImage(im,(im.width-sw)/2,(im.height-sh)/2,sw,sh,x,y,w,h);c.restore();}
 find(x,y){for(let i=this.hits.length-1;i>=0;i--){const b=this.hits[i];if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h&&(!b.clip||x>=b.clip.x&&x<=b.clip.x+b.clip.w&&y>=b.clip.y&&y<=b.clip.y+b.clip.h)&&(b.fixed||y>=96&&y<=this.h-62))return b.action;}return null;}
}
module.exports={UI,colors};
