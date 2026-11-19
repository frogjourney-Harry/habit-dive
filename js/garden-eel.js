// Original pixel art: approved whitetip reef shark and garden-eel family.
const REEF_SHARK_ART={};
function pixelDraft(w,h,palette,paint){
 const rows=Array.from({length:h},()=>Array(w).fill('.'));
 const dot=(x,y,c)=>{if(x>=0&&y>=0&&x<w&&y<h)rows[y][x]=c};
 const line=(x0,y0,x1,y1,c)=>{const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));for(let i=0;i<=n;i++)dot(Math.round(x0+(x1-x0)*i/Math.max(1,n)),Math.round(y0+(y1-y0)*i/Math.max(1,n)),c)};
 const poly=(p,c)=>{for(let y=0;y<h;y++)for(let x=0;x<w;x++){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [a,b]=p[i],[d,e]=p[j];if((b>y)!=(e>y)&&x<(d-a)*(y-b)/(e-b)+a)inside=!inside}if(inside)dot(x,y,c)}p.forEach((q,i)=>line(q[0],q[1],p[(i+1)%p.length][0],p[(i+1)%p.length][1],c))};
 paint({dot,line,poly,rows});
 // One source-pixel contour shared with the established art families.
 const copy=rows.map(r=>r.slice());for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(copy[y][x]!=='.'&&[[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy])=>!copy[y+dy]||!copy[y+dy][x+dx]||copy[y+dy][x+dx]==='.'))rows[y][x]='k';
 return {rows:rows.map(r=>r.join('')),palette};
}

function trimCreatureArt(art) {
 const points=[];art.rows.forEach((r,y)=>[...r].forEach((ch,x)=>{if(ch!=='.')points.push([x,y])}));
 const left=Math.min(...points.map(p=>p[0])),right=Math.max(...points.map(p=>p[0]));
 const top=Math.min(...points.map(p=>p[1])),bottom=Math.max(...points.map(p=>p[1]));
 return {...art,rows:art.rows.slice(top,bottom+1).map(r=>r.slice(left,right+1))};
}
function gardenEelArt(stage) {
 const h=[41,62,69][stage-1],rows=Array.from({length:h},()=>Array(7).fill('.'));
 const palette={k:'#1a1c2c',d:'#121827',b:stage===3?'#f58b28':'#f5f3e9',l:stage===3?'#ffba64':'#ffffff',s:stage===3?'#d56820':'#c4ccc5',w:'#fff6e9'};
 ['..kkk..','.kllbk.','.kbdbk.','.kbbbk.','..kbbkk'].forEach((r,y)=>rows[y]=[...r]);
 for(let y=5;y<h;y++){
  rows[y][1]='k';rows[y][2]='s';rows[y][3]='b';rows[y][4]='b';rows[y][5]='k';
  if(stage===3&&y%14<4)for(let col=2;col<=4;col++)rows[y][col]='w';
  if(stage!==3&&y%8===2)rows[y][4]='d';
  if(stage!==3&&[14,15,32,33,44,45].includes(y))rows[y][3]=rows[y][4]='d';
 }
 return {rows:rows.map(r=>r.join('')),palette};
}
// Keep the legacy ID so existing pets, names, releases and feed counts remain valid.
Object.assign(CR.moray,{name:'花園鰻',alias:'斑點花園鰻',fact:'住在自己的沙洞裡，點身體會縮回沙中，再慢慢探頭。'});
MORPH.moray.n='橘帶花園鰻';

const gardenEase=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)};
function gardenEelPose(f,now,floor) {
 const source=f.s,scale=f.h/source.height;
 const visible=f.hideAt==null?1:now<f.hideUntil?f.hideFrom*(1-gardenEase((now-f.hideAt)/420)):gardenEase((now-f.hideUntil)/1700);
 const seconds=now/1000,lean=Math.sin(seconds*.72+f.ph-.35)*3.4+Math.sin(seconds*.31+f.ph)*.6;
 const shift=scale*(lean+(f.reach||0)),hidden=(f.h+8*scale)*(1-visible),base=f.x+f.w/2;
 return {visible,scale,shift,hidden,base,head:{x:base+shift+scale,y:floor-f.h+hidden+2*scale}};
}
function hideGardenEel(f,now,floor) {
 const pose=gardenEelPose(f,now,floor);f.hideFrom=pose.visible;f.hideAt=now;f.hideUntil=now+2500;f.foodTarget=null;
}
function drawGardenEel(ctx,f,now,floor,width,rp) {
 const p=gardenEelPose(f,now,floor),src=f.s;
 ctx.save();ctx.beginPath();ctx.rect(0,0,width,floor);ctx.clip();
 for(let row=0;row<src.height;row++){
  const u=1-row/(src.height-1),left=p.base-src.width*p.scale/2+p.shift*u*u;
  const top=floor-f.h+row*p.scale+p.hidden;
  const y=rp(top),next=rp(top+p.scale);
  ctx.drawImage(src,0,row,src.width,1,rp(left),y,rp(src.width*p.scale),Math.max(next-y,1/16));
 }
 ctx.restore();ctx.fillStyle='#343d3d';ctx.fillRect(rp(p.base-2.5),floor,5,1);ctx.fillStyle='#928366';ctx.fillRect(rp(p.base-3),floor+1,6,1);
}
for(const stage of [1,2,3]){
 const sharkPalette={k:'#1a1c2c',d:'#121827',b:stage===3?'#c6cdd4':'#7d8997',l:stage===3?'#e8ecf0':'#a8b5c2',s:stage===3?'#929eac':'#53677f',w:'#e8edf1'};
 REEF_SHARK_ART['shark:'+stage]=pixelDraft(56,24,sharkPalette,({poly,line,dot})=>{
  // Slender reef-shark profile, blunt snout and two distinct dorsal fins.
  poly([[2,1],[7,4],[10,9],[16,10],[37,9],[46,10],[53,13],[54,15],[49,17],[35,18],[17,17],[10,15],[6,21],[5,19],[7,13],[5,9]],'s');
  poly([[14,10],[26,9],[29,2],[32,4],[32,10],[40,10],[42,7],[44,11],[49,12],[53,14],[50,17],[36,18],[17,16],[10,14]],'b');
  poly([[14,14],[32,14],[48,15],[53,14],[50,17],[36,18],[17,16]],'w');
  poly([[18,10],[26,9],[29,4],[29,11],[41,11],[46,12],[31,12]],'l');
  poly([[31,15],[36,16],[30,22],[28,21]],'s');
  line(29,3,30,4,'w');line(3,2,5,3,'w');line(42,8,43,9,'w');
  line(40,12,39,14,'s');line(38,12,37,14,'s');line(36,12,35,14,'s');dot(47,12,'d');line(49,15,52,15,'d');
 });

}

for(const st of [1,2,3]){
 CREATURE_ART['shark:'+st]=trimCreatureArt(REEF_SHARK_ART['shark:'+st]);
 CREATURE_ART['moray:'+st]=trimCreatureArt(gardenEelArt(st));
}
