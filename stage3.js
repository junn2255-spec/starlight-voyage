(()=>{'use strict';if(new URLSearchParams(location.search).get('stage')!=='3')return;
const c=document.querySelector('#scene'),g=c.getContext('2d'),game=document.querySelector('#game');
game.dataset.state='explore';document.title='별빛 항해 · 미션 3';
for(const el of game.children)if(el!==c)el.hidden=true;
c.setAttribute('aria-label','사막의 별 탐험. 가고 싶은 바닥을 클릭하거나 터치하면 이동합니다.');c.style.touchAction='none';
const status=document.createElement('p');status.className='explore-status';status.setAttribute('role','status');status.textContent='가고 싶은 곳을 터치하세요';game.append(status);
const img={},W=5000,H=3142,player={x:1900,y:1750,dir:1},camera={x:1900,y:1650},objects=[];
let path=[],target=null,last=0,t=0,ready=false,steps=0;
let footContext=null,footBuffers=[],footLoading=null,lastFootDistance=-70,footIndex=0;
const footSources=new Set();
function unlockFootsteps(){
 if(!footContext){footContext=new(window.AudioContext||window.webkitAudioContext)();footLoading=Promise.all([1,2,3].map(async n=>footContext.decodeAudioData(await(await fetch('runtime/step'+n+'.mp3')).arrayBuffer()))).then(b=>{footBuffers=b}).catch(e=>console.warn('Footsteps unavailable',e))}
 footContext.resume().catch(()=>{});
}
function stopFootsteps(){for(const s of footSources){try{s.stop()}catch{}}footSources.clear()}
function updateFootsteps(){
 if(!path.length||document.hidden){stopFootsteps();lastFootDistance=steps-70;return}
 if(!footContext||footContext.state!=='running'||!footBuffers.length||steps-lastFootDistance<70)return;
 lastFootDistance=steps;const s=footContext.createBufferSource(),gain=footContext.createGain();s.buffer=footBuffers[footIndex++%3];s.playbackRate.value=.94+(footIndex%3)*.05;gain.gain.value=.42;s.connect(gain).connect(footContext.destination);s.start();footSources.add(s);s.onended=()=>{footSources.delete(s);s.disconnect();gain.disconnect()};
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFootsteps();if(footContext)footContext.suspend()}});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const HERO_HEIGHT=150,STONE_BLOCK_HEIGHT=HERO_HEIGHT*1.5;
const CAMERA_ZOOM=.85;
const landingPad={x:.265*W,y:.596*H,rx:.115*W,ry:.095*H};
function add(key,x,y,width,block=true){
 let px=x*W,py=y*H;
 if(key!=='ship'){
  // Expand the no-placement ellipse by each asset's ground footprint and a safety gap.
  const rx=landingPad.rx+width*.52+45,ry=landingPad.ry+width*.23+35;
  let dx=px-landingPad.x,dy=py-landingPad.y,n=Math.hypot(dx/rx,dy/ry);
  if(n<1){if(n<.01){dx=rx;dy=0;n=1}px=landingPad.x+dx/n*1.04;py=landingPad.y+dy/n*1.04}
 }
 objects.push({key,x:px,y:py,width,block})
}
// Same four regions as the approved map: emeralds NW, quarry NE, base SW, open land SE.
for(const [x,y,s]of [[.16,.20,230],[.21,.16,320],[.26,.12,400],[.3,.20,270],[.35,.21,310],[.39,.25,210],[.14,.27,220],[.22,.27,270],[.28,.26,220],[.34,.29,190],[.41,.29,160]])add('resource_0_'+(s>300?3:s>220?2:1),x,y,s*1.4);
for(const [x,y,s]of [[.67,.16,280],[.73,.2,320],[.79,.18,270],[.84,.24,250],[.70,.27,210],[.78,.29,220]])add('resource_2_0',x,y,s*1.6);
for(const[k,x,y,s]of [['building_0_0',.34,.43,540],['building_0_1',.18,.44,500],['building_0_2',.46,.53,440],['building_1_0',.12,.46,370],['building_1_1',.44,.65,400],['building_1_2',.54,.61,440]])add(k,x,y,s);
// The sprite includes transparent floor padding: align its wheel contact, not image bottom.
add('ship',.265,(landingPad.y+950*.13)/H,950);
// Freestanding large stones sit on level sandy ground; their footprints block walking.
for(const[x,y,w]of [[.53,.43,320],[.64,.39,290],[.74,.43,350],[.86,.58,320]])add('resource_2_0',x,y,w);
const boundary=[[.055,.36],[.12,.29],[.26,.28],[.33,.30],[.43,.26],[.5,.16],[.65,.15],[.77,.27],[.90,.29],[.975,.48],[.94,.76],[.54,.77],[.065,.69]];
function inside(x,y){let hit=false;for(let i=0,j=boundary.length-1;i<boundary.length;j=i++){let a=boundary[i],b=boundary[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
// Large rock faces painted into the world plate need collision too.
// Sand, pebbles and low plants are deliberately absent from these shapes.
const terrainWalls=[
 [[.06,.02],[.34,.02],[.36,.18],[.31,.25],[.24,.26],[.18,.23],[.10,.27],[.06,.20]],
 [[.06,.235],[.13,.235],[.23,.27],[.29,.28],[.32,.31],[.27,.345],[.18,.32],[.10,.30]],
 [[.33,.07],[.43,.12],[.49,.225],[.495,.29],[.48,.355],[.445,.36],[.412,.29],[.37,.25],[.355,.18]],
 [[.48,.035],[.585,.035],[.605,.13],[.565,.18],[.50,.15]],
 [[.625,.015],[.90,.02],[.95,.18],[.92,.275],[.855,.29],[.80,.25],[.74,.22],[.665,.225],[.62,.16]],
 [[.055,.68],[.18,.70],[.33,.715],[.48,.735],[.54,.77],[.54,.86],[.05,.86]],
 [[.56,.77],[.73,.76],[.88,.73],[.94,.69],[.99,.73],[.96,.88],[.55,.88]]
];
function inPolygon(x,y,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
function terrainBlocked(x,y){return terrainWalls.some(p=>[[0,0],[-24,0],[24,0],[0,-12],[0,12]].some(([dx,dy])=>inPolygon((x+dx)/W,(y+dy)/H,p)))}
function free(x,y){
 if(!inside(x/W,y/H)||terrainBlocked(x,y))return false;
 // Reserve the full visible asset area plus the hero's body, so neither walking
 // through an object nor disappearing behind its upper silhouette is possible.
 return !objects.some(o=>{if(!o.block)return false;const a=img[o.key],h=a?o.width*a.height/a.width:o.width;
  if(o.key.startsWith('resource_')&&h<STONE_BLOCK_HEIGHT)return false;
  return x>o.x-o.width/2-32&&x<o.x+o.width/2+32&&y>o.y-h-12&&y<o.y+HERO_HEIGHT+12;
 });
}
function clearSegment(a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/8));for(let i=0;i<=n;i++){const t=i/n;if(!free(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false}return true}
const CELL=35,COLS=Math.ceil(W/CELL),ROWS=Math.ceil(H/CELL);
function cell(x,y){return {x:clamp(Math.floor(x/CELL),0,COLS-1),y:clamp(Math.floor(y/CELL),0,ROWS-1)}}
function center(n){return {x:(n.x+.5)*CELL,y:(n.y+.5)*CELL}}
function route(x,y){
 const start=cell(player.x,player.y),want=cell(x,y);let end=null,best=Infinity;
 for(let yy=0;yy<ROWS;yy++)for(let xx=0;xx<COLS;xx++){const p=center({x:xx,y:yy}),d=(p.x-x)**2+(p.y-y)**2;if(d<best&&free(p.x,p.y)){end={x:xx,y:yy};best=d}}
 if(!end)return;const id=n=>n.y*COLS+n.x,goal=id(end),open=[start],cost=new Map([[id(start),0]]),prev=new Map(),closed=new Set();
 while(open.length){open.sort((a,b)=>(cost.get(id(a))+Math.hypot(a.x-end.x,a.y-end.y))-(cost.get(id(b))+Math.hypot(b.x-end.x,b.y-end.y)));const n=open.shift(),nid=id(n);if(closed.has(nid))continue;if(nid===goal){const result=[];let at=goal;while(at!==id(start)){result.push(center({x:at%COLS,y:Math.floor(at/COLS)}));at=prev.get(at);if(at===undefined)return}path=result.reverse();const exact=free(x,y)&&Math.hypot(x-center(end).x,y-center(end).y)<CELL?{x,y}:center(end);const endPoint=path[path.length-1]||player;if(clearSegment(endPoint,exact))path.push(exact);target={...(path[path.length-1]||endPoint),start:t};status.textContent='이동 중';return}closed.add(nid);
 for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const z={x:n.x+dx,y:n.y+dy},p=center(z);if(z.x<0||z.y<0||z.x>=COLS||z.y>=ROWS||!free(p.x,p.y))continue;if(dx&&dy&&(!free((n.x+dx+.5)*CELL,(n.y+.5)*CELL)||!free((n.x+.5)*CELL,(n.y+dy+.5)*CELL)))continue;if(!clearSegment(center(n),p))continue;const value=cost.get(nid)+Math.hypot(dx,dy),zid=id(z);if(value<(cost.get(zid)??Infinity)){cost.set(zid,value);prev.set(zid,nid);open.push(z)}}
 }
 status.textContent='길이 연결된 바닥을 터치하세요';
}
c.addEventListener('pointerdown',e=>{if(!ready||!window.GAME_START?.started)return;unlockFootsteps();const r=c.getBoundingClientRect(),sx=(e.clientX-r.left)*1600/r.width,sy=(e.clientY-r.top)*900/r.height;if(sy<175)return;route((sx-800)/CAMERA_ZOOM+camera.x,(sy-450)/CAMERA_ZOOM+camera.y)});
function draw(key,x,y,w,h){const a=img[key];if(a)g.drawImage(a,x,y,w,h??w*a.height/a.width)}
function render(dt){t+=dt;if(path.length){let budget=250*dt;while(path.length&&budget>0){const p=path[0],dx=p.x-player.x,dy=p.y-player.y,d=Math.hypot(dx,dy);if(d<.5){path.shift();continue}const angle=Math.atan2(dx,dy);player.dir=(Math.round(angle/(Math.PI/4))+8)%8;const amount=Math.min(budget,d),nx=player.x+dx/d*amount,ny=player.y+dy/d*amount;if(!clearSegment(player,{x:nx,y:ny})){path=[];status.textContent='바위를 피해 이동해 주세요';break}player.x=nx;player.y=ny;budget-=amount;steps+=amount;if(amount===d)path.shift()}if(!path.length){status.textContent='가고 싶은 곳을 터치하세요';target.arrived=t}}
 updateFootsteps();camera.x=clamp(player.x,800/CAMERA_ZOOM,W-800/CAMERA_ZOOM);camera.y=clamp(player.y-100/CAMERA_ZOOM,450/CAMERA_ZOOM,H-450/CAMERA_ZOOM);
 game.dataset.playerX=player.x.toFixed(1);game.dataset.playerY=player.y.toFixed(1);game.dataset.moving=String(path.length>0);
 g.clearRect(0,0,1600,900);g.save();g.translate(800,450);g.scale(CAMERA_ZOOM,CAMERA_ZOOM);g.translate(-camera.x,-camera.y);draw('world',0,0,W,H);
 if(target){const alpha=target.arrived?clamp(1-(t-target.arrived)/1,0,1):.65;g.save();g.globalAlpha=alpha;for(let i=0;i<3;i++){const phase=((t-target.start)*.75+i/3)%1;g.strokeStyle='#b3ffff';g.fillStyle='rgba(50,225,255,.10)';g.lineWidth=3;g.beginPath();g.ellipse(target.x,target.y,18+phase*32,8+phase*14,0,0,Math.PI*2);g.fill();g.stroke()}g.restore()}
 const sorted=[...objects,{hero:true,y:player.y}].sort((a,b)=>a.y-b.y);for(const o of sorted){if(o.hero){const dir=player.dir;const idle='idle_'+Math.floor(dir/4)+'_'+dir%4;const frame=path.length?'walk_'+dir+'_'+Math.floor(steps/24)%8:idle;const a=img[frame];if(a){const h=150,w=h*a.width/a.height;draw(frame,player.x-w/2,player.y-h,w,h)}}else{const a=img[o.key],h=o.width*a.height/a.width;draw(o.key,o.x-o.width/2,o.y-h,o.width,h)}}g.restore();
 // Approved enlarged top UI is layout-only: counters do not change and controls are inactive.
 draw('ui_mission',20,16,500,190);draw('ui_resources',625,18,550,115);draw('ui_pause',1380,16,88,88);draw('ui_settings',1480,16,88,88);
 g.font='800 31px Stage3Paperlogy';g.fillStyle='#a1fbff';g.fillText('미션 3',145,64);g.fillStyle='white';g.font='800 27px Stage3Paperlogy';g.fillText('에메랄드 10개 모으기',145,103);g.font='800 24px Stage3Paperlogy';g.fillText('0 / 10',420,171);
 g.font='800 31px Stage3Paperlogy';for(const[x,s]of [[748,'0'],[931,'0'],[1110,'120']])g.fillText(s,x,89);
}
function tick(now){const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(ready&&!document.hidden)render(window.GAME_START?.started?dt:0);requestAnimationFrame(tick)}
Promise.all([document.fonts.load('800 24px Stage3Paperlogy'),...Object.entries(window.STAGE3_ASSETS).map(([key,url])=>new Promise((resolve,reject)=>{const a=new Image();a.onload=()=>{img[key]=a;resolve()};a.onerror=()=>reject(Error(key));a.src=url}))]).then(()=>{ready=true;window.dispatchEvent(new Event('game-ready'));status.textContent='가고 싶은 곳을 터치하세요'}).catch(e=>{status.textContent='이미지를 불러오지 못했어요';console.error(e)});requestAnimationFrame(tick);
})();


