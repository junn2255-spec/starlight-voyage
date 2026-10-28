/* Stage 01 v2 — asset UI, Paperlogy ExtraBold, deterministic flight choreography. */
(()=>{'use strict';if(new URLSearchParams(location.search).get('stage')==='3')return;
const $=s=>document.querySelector(s), canvas=$('#scene'), ctx=canvas.getContext('2d');
const A=window.GAME_ASSETS, images={}, buffers={};
A.images.bg_city.url='runtime/atmosphere/bg_city_clean.webp';
A.images.boarding_city_v2.url='runtime/atmosphere/bg_boarding_clean.webp';
const rearArt=window.ASCENT_ART;
for(const[name,url]of Object.entries(rearArt.assets))A.images[name]={url};
A.images.city_mist={url:'runtime/atmosphere/city_mist.webp'};
A.images.billow_cloud={url:'runtime/atmosphere/billow_cloud.webp'};
A.images.waterfall_flow={url:'runtime/atmosphere/waterfall_flow.svg'};
A.images.waterfall_foam={url:'runtime/atmosphere/waterfall_foam.svg'};
A.images.window_glint={url:'runtime/atmosphere/window_glow.svg'};
A.images.glass_sweep={url:'runtime/atmosphere/glass_sweep.svg'};
A.audio.launch_roar={url:'runtime/v2/launch_roar.mp3'};
A.audio.ascent_roar={url:'runtime/v2/ascent_roar.mp3'};
A.audio.flyby_near={url:'runtime/v2/flyby_near.mp3'};
A.audio.flyby_far={url:'runtime/v2/flyby_far.mp3'};
A.images.planet_ground={url:'runtime/stage02/landing_ground.webp'};
A.images.landing_dust={url:'runtime/stage02/landing_dust.webp'};
for(const name of ['descent','touchdown','door_open','desert_wind'])A.audio[name]={url:'runtime/stage02/'+name+'.mp3'};
A.audio.descent={url:'runtime/stage02/descent_heavy.mp3'};
const isPlanet=()=>state.startsWith('planet_');
let planetTime=0;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t, smooth=t=>t*t*(3-2*t), DEG=Math.PI/180;
let state='loading',elapsed=0,time=0,last=0,paused=false,muted=false,ready=false;
let ac,master,audioReady,loops=[],active=new Set(),particles=[],emitClock=0,stepIndex=-1;
let lastFlyby=-10;
const music=new Audio(A.audio.music.url);music.id='bgm';music.hidden=true;music.loop=true;music.volume=.32;music.preload='auto';document.body.append(music);
const narration=[
 {start:3.0,end:6.6,text:'3050년, 지구.\n오늘은 나의 첫 우주여행 날!'},
 {start:6.9,end:10.5,text:'어떤 별에서\n새로운 친구를 만나게 될까?'},
 {start:10.8,end:14.4,text:'이제 우주선에 올라\n나만의 모험을 시작하자!'}
];
const dialogue={planet_settle:'첫번째 별에 도착했습니다.',planet_open:'첫번째 별에 도착했습니다.',planet_reveal:'첫번째 별에 도착했습니다.',planet_ready:'첫번째 별에 도착했습니다.',boarding:'별빛 탑승장에 도착했어요',walking:'',vanish:'',closing:'탑승 완료. 문이 닫힙니다.',ignition:'엔진 점화! 지구를 떠날 준비 완료!',departure:'안녕, 지구!',ascent:'',space:'나의 우주여행이 시작됐다!'};
const fleet=Array.from({length:8},(_,i)=>({type:i%3===1?'aircraft_butterfly':'aircraft_fish',start:[20,270,510,740,970,1200,1390,130][i],y:[55,185,100,270,45,205,320,350][i],w:[290,160,230,145,360,200,165,260][i],speed:[180,115,150,105,215,145,125,190][i]}));
function assetButton(id,name,label){$(id+' img').src='runtime/v2/'+name+'.svg';$(id).setAttribute('aria-label',label)}
function musicAttempt(){if(!window.GAME_START?.started||muted||paused||!ready)return;music.play().then(()=>{$('#audioHint').hidden=true}).catch(()=>{if(!muted&&!paused)$('#audioHint').hidden=false})}
function play(name,volume=1,loop=false){if(!window.GAME_START?.started||!ac||!buffers[name]||paused)return null;const s=ac.createBufferSource(),g=ac.createGain();s.buffer=buffers[name];s.loop=loop;g.gain.value=volume;s.connect(g).connect(master);s.start();active.add(s);s.onended=()=>active.delete(s);return s}
function playFlyby(aircraft){
 if(!ac||ac.state!=='running'||paused||muted)return;
 const near=aircraft.w>=230,buffer=buffers[near?'flyby_near':'flyby_far'];if(!buffer)return;
 const source=ac.createBufferSource(),gain=ac.createGain(),pan=ac.createStereoPanner(),now=ac.currentTime;
 const duration=near?1.8:1.3,volume=near?.19:.075;
 source.buffer=buffer;source.playbackRate.setValueAtTime(near?1.15:1.35,now);source.playbackRate.exponentialRampToValueAtTime(near?.85:1.05,now+duration);
 gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume,now+duration*.3);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
 pan.pan.setValueAtTime(-.85,now);pan.pan.linearRampToValueAtTime(.85,now+duration);
 source.connect(gain).connect(pan).connect(master);source.start();source.stop(now+duration);
 active.add(source);source.onended=()=>{active.delete(source);source.disconnect();gain.disconnect();pan.disconnect()};
}
function updateFlybys(){
 const audible=['city','fade','boarding','walking','vanish','closing'].includes(state);
 for(const aircraft of fleet){
  const center=((aircraft.start+time*aircraft.speed+aircraft.w)%(1600+aircraft.w))-aircraft.w/2;
  if(audible&&aircraft.previousCenter!==undefined&&aircraft.previousCenter<470&&center>=470&&time-lastFlyby>1.35){playFlyby(aircraft);lastFlyby=time}
  aircraft.previousCenter=center;
 }
}
function stopAllEffects(){for(const source of active){try{source.stop()}catch{}}active.clear();loops=[]}
function stopLoops(){loops.forEach(s=>{try{s.stop()}catch{}});loops=[]}
function startLoops(){stopLoops();if(isPlanet()){const wind=play('desert_wind',.18,true);if(wind)loops.push(wind);if(state==='planet_descent'){const descent=play('descent',.66);if(descent)loops.push(descent)}return;}if(!['city','fade','boarding','walking','vanish','closing','ignition'].includes(state))return;for(const[n,v]of[['wind',.09],['hum',.07]]){const s=play(n,v,true);if(s)loops.push(s)}}
function unlockAudio(){
 if(!ac){ac=new(window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=muted?0:1;master.connect(ac.destination);
 audioReady=Promise.all(Object.entries(A.audio).filter(([n])=>n!=='music').map(async([n,m])=>{try{buffers[n]=await ac.decodeAudioData(await(await fetch(m.url)).arrayBuffer())}catch(e){console.warn('Audio load failed',n)}})).then(()=>{if(state==='planet_descent'){elapsed=0;planetTime=0}startLoops()})}
 if(!paused)ac.resume().catch(()=>{});musicAttempt();return audioReady;
}
function setMuted(v){muted=v;if(master)master.gain.value=v?0:1;music.muted=v;assetButton('#sound',v?'sound_off':'sound_on',v?'소리 켜기':'소리 끄기');if(v)$('#audioHint').hidden=true;else unlockAudio()}
function setPause(v){if(!ready)return;paused=v;$('#paused').hidden=!v;assetButton('#pause',v?'resume':'pause',v?'계속하기':'일시정지');if(v){music.pause();if(ac)ac.suspend().catch(()=>{})}else{if(ac)ac.resume().catch(()=>{});musicAttempt()}last=performance.now()}
let cabinFrame=null;
window.addEventListener('message',e=>{
 if(!cabinFrame||e.origin!==location.origin||e.source!==cabinFrame.contentWindow)return;
 if(e.data?.type==='cabin-ready'){requestAnimationFrame(()=>{cabinFrame.style.opacity='1'})}
 if(e.data?.type==='cabin-finished'){cabinFrame.remove();cabinFrame=null;canvas.style.opacity='1';enter('planet_descent')}
});
function enter(next){
 if(next==='cabin'){
  state='cabin_transition';$('#game').dataset.state=state;stopAllEffects();music.pause();
  for(const id of ['#dialogue','#progress','#audioHint'])$(id).hidden=true;
  const frame=document.createElement('iframe');cabinFrame=frame;frame.title='우주선 조종석 비행';frame.allow='autoplay';
  frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;z-index:12;opacity:0;transition:opacity 1.2s ease-in-out;background:transparent';
  frame.src='cabin.html?sequence=1&embedded=1';$('#game').append(frame);return;
 }
 if(next==='explore'){
  state='explore_embedded';$('#game').dataset.state=state;stopAllEffects();music.pause();
  const frame=document.createElement('iframe');frame.title='미션 3 · 사막의 별 탐험';frame.allow='autoplay; fullscreen';frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;z-index:12;background:#06121f';frame.src='?stage=3&embedded=1';$('#game').append(frame);return;
 }
 state=next;elapsed=0;stepIndex=-1;$('#game').dataset.state=next;$('#action').disabled=true;$('#intro').hidden=true;$('#guide').hidden=true;$('#end').hidden=next!=='complete';$('#dialogue').hidden=!dialogue[next];$('#dialogue p').textContent=dialogue[next]||'';
 $('#arrival').hidden=true;$('#planetReplay').hidden=next!=='planet_ready';
 if(next==='planet_descent'){stopAllEffects();planetTime=0;particles=[];music.volume=.2;startLoops();musicAttempt()}
 if(next==='planet_settle'){startLoops();play('touchdown',.65)}
 if(next==='planet_open')play('door_open',.5);
 if(next==='arrival'){stopLoops();particles=[];$('#paused').hidden=true;$('#audioHint').hidden=true;return}
 const chapter=next==='city'?0:['fade','boarding','walking','vanish','closing'].includes(next)?1:2;$('#progress').src='runtime/v2/progress'+chapter+'.svg';$('#progress').alt=['도시 감상','우주선 탑승','우주로 출발'][chapter];
 if(next==='city'){particles=[];music.volume=.32;startLoops();musicAttempt()}
 if(next==='closing')play('door',.55);
 if(next==='ignition')play('engine',.52);
 if(next==='departure'){stopLoops();music.volume=.19;play('launch_roar',.7)}
 if(next==='ascent'){particles=[];music.volume=.17;play('ascent_roar',.72)}
 if(next==='space'){particles=[];music.volume=.3;play('arrival',.5)}
}
function advance(){if(!ready||paused||state!=='city'||elapsed<14.6)return;unlockAudio();play('click',.5);enter('fade')}
window.addEventListener('game-audio-prime',()=>unlockAudio());
window.addEventListener('game-start',()=>{paused=false;$('#paused').hidden=true;last=performance.now();unlockAudio();startLoops();musicAttempt()});
$('#action').onclick=advance;$('#sound').onclick=()=>setMuted(!muted);$('#pause').onclick=()=>setPause(!paused);$('#resume').onclick=()=>setPause(false);$('#audioHint').onclick=()=>unlockAudio();
$('#replay').onclick=()=>{active.forEach(s=>{try{s.stop()}catch{}});active.clear();music.currentTime=0;enter('city')};
$('#planetReplay').onclick=()=>{unlockAudio();enter('planet_descent')};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{}};
// A first touch anywhere unlocks audio without skipping the intro or forcing a second tap.
document.addEventListener('pointerdown',e=>{if(!ready||e.target.closest('#sound')||e.target.closest('#pause')||paused)return;unlockAudio()},{passive:true});
document.addEventListener('keydown',e=>{if(e.repeat)return;if(e.code==='Escape'){setPause(!paused);return}if(['Enter','Space'].includes(e.code)){if(!paused)unlockAudio();if(e.target.tagName!=='BUTTON'){e.preventDefault();advance()}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready)setPause(true)});
function img(n,x,y,w,h,alpha=1){if(!images[n])return;ctx.globalAlpha=clamp(alpha);ctx.drawImage(images[n],x,y,w,h);ctx.globalAlpha=1}
function background(n,alpha=1){img(n,0,0,1600,900,alpha)}
function boy(n,x,feet,scale=.85,alpha=1){img(n,x-192*scale,feet-448*scale,384*scale,512*scale,alpha)}
// Measured at the exposed outlet lips of each sprite, in ship-local coordinates.
const enginePorts={ignition:[[218,-118,26],[282,-49,39]],flight:[[220,-108,26],[286,-31,39]]};
function engineJet(x,y,power,phase,nozzleRadius){
 // A broad nozzle feeds a long, fading jet; smoke follows independently.
 const pulse=1+Math.sin(time*35+phase)*.07+Math.sin(time*61+phase)*.035;
 const length=(170+power*230)*pulse, radius=nozzleRadius;
 ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation='lighter';
 const halo=ctx.createRadialGradient(4,0,0,4,0,radius*1.8);
 halo.addColorStop(0,'rgba(190,245,255,.5)');halo.addColorStop(.35,'rgba(56,188,255,.2)');halo.addColorStop(1,'rgba(20,120,255,0)');
 ctx.fillStyle=halo;ctx.fillRect(4-radius*1.8,-radius*1.8,radius*3.6,radius*3.6);
 for(let layer=0;layer<3;layer++){
  const len=length*(1-layer*.19),r=radius*(1-layer*.27);
  const gradient=ctx.createLinearGradient(0,0,len,0);
  gradient.addColorStop(0,layer===2?'rgba(246,255,255,.8)':'rgba(114,221,255,.42)');
  gradient.addColorStop(.3,'rgba(76,182,255,.27)');gradient.addColorStop(.7,'rgba(43,151,255,.09)');gradient.addColorStop(1,'rgba(35,119,255,0)');
  ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(-24,-r*.92);ctx.lineTo(0,-r);
  ctx.bezierCurveTo(len*.19,-r*1.2,len*.66,-r*.6,len,Math.sin(time*29+phase)*4);
  ctx.bezierCurveTo(len*.66,r*.6,len*.19,r*1.2,0,r);ctx.lineTo(-24,r*.92);ctx.closePath();ctx.fill();
 }
 ctx.restore();
}
function shipPose(mode,cx,cy,scale=1,angle=0,flip=false,thrust=0){
 ctx.save();ctx.translate(cx,cy);ctx.rotate(angle*DEG);ctx.scale(flip?-scale:scale,scale);
 const ports=enginePorts[mode]||enginePorts.flight;
 if(thrust)ports.forEach(([x,y,r],i)=>engineJet(x,y,thrust*(i?.98:.8),i*2.2+1.2,r));
 img('ship_'+mode,-512,-358,1024,716);
 if(thrust){
  // Composite a short collar over the lip, bridging the sprite's opaque edge.
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const[x,y,r]of ports)engineCollar(x,y,r);
  ctx.restore();
 }
 canopyReflection();ctx.restore();
}
function engineCollar(x,y,r){
 const bridge=ctx.createLinearGradient(x-9,0,x+55,0);
 bridge.addColorStop(0,'rgba(139,233,255,.1)');bridge.addColorStop(.22,'rgba(208,250,255,.65)');bridge.addColorStop(1,'rgba(64,174,255,0)');
 ctx.fillStyle=bridge;ctx.beginPath();ctx.ellipse(x+20,y,35,r*.9,0,0,Math.PI*2);ctx.fill();
}
function rearShip(pose){
 const[w,h]=rearArt.size;
 ctx.save();ctx.translate(pose.cx,pose.cy);ctx.rotate(pose.angle*DEG);ctx.scale(pose.scale,pose.scale);
 for(const[x,y,r]of rearArt.ports){ctx.save();ctx.translate(x,y);ctx.rotate(rearArt.exhaustAngle*DEG);engineJet(0,0,pose.thrust,2.2+x*.01,r);ctx.restore()}
 img('rear_ship',-w/2,-h/2,w,h);
 ctx.save();ctx.globalCompositeOperation='lighter';
 for(const[x,y,r]of rearArt.ports){ctx.save();ctx.translate(x,y);ctx.rotate(rearArt.exhaustAngle*DEG);engineCollar(0,0,r*.92);ctx.restore()}
 ctx.restore();
 const phase=(time%9)/1.8;
 if(phase<1){
  ctx.save();ctx.beginPath();ctx.moveTo(70,-174);ctx.bezierCurveTo(140,-260,270,-280,370,-205);ctx.bezierCurveTo(430,-130,290,-95,170,-132);ctx.closePath();ctx.clip();
  img('glass_sweep',mix(0,440,phase),-300,135,240,Math.sin(phase*Math.PI)*.18);ctx.restore();
 }
 ctx.restore();
}
function canopyReflection(){
 const phase=(time%8)/1.6;if(phase>1)return;
 ctx.save();ctx.beginPath();ctx.moveTo(-250,10);ctx.bezierCurveTo(-190,-90,-100,-143,-30,-123);ctx.bezierCurveTo(70,-102,24,-25,-100,38);ctx.closePath();ctx.clip();
 img('glass_sweep',mix(-390,90,phase),-180,160,255,Math.sin(phase*Math.PI)*.24);ctx.restore();
}
const glassPanels={
 city:[[[859,102],[879,66],[894,102],[890,253],[866,253]],[[747,158],[760,127],[770,157],[769,246],[748,246]],[[985,116],[995,90],[1004,119],[1002,260],[986,260]],[[643,210],[651,184],[660,210],[658,262],[645,262]],[[1090,466],[1097,448],[1106,467],[1104,509],[1092,509]]],
 boarding:[[[800,86],[815,46],[830,86],[828,209],[803,209]],[[684,99],[695,73],[706,102],[705,203],[687,203]],[[929,85],[938,56],[948,88],[946,223],[931,223]],[[618,177],[626,150],[635,177],[634,221],[619,221]],[[938,337],[948,320],[959,337],[958,385],[940,385]]]
};
function glassReflections(boarding){
 ctx.save();ctx.scale(1.25,1.25);
 glassPanels[boarding?'boarding':'city'].forEach((poly,index)=>{
  const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys);
  ctx.save();ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
  ctx.globalCompositeOperation='lighter';
  for(let y=top+6,row=0;y<bottom;y+=11,row++){
   const glow=Math.pow(Math.max(0,Math.sin(time*.7+index*1.9+row*.55)),8);
   ctx.fillStyle=`rgba(122,242,255,${.035+glow*.25})`;ctx.fillRect(left+3,y,right-left-6,3);
  }
  const phase=((time+index*2.1)%10)/2.6;
  if(phase<1)img('glass_sweep',left-35+phase*(right-left+70),top-20,45,bottom-top+40,Math.sin(phase*Math.PI)*.28);
  ctx.restore();
  const sparkle=Math.pow(Math.max(0,Math.sin(time*.62+index*2.4)),22);
  img('window_glint',(left+right)/2-13,top+(bottom-top)*.42-17,26,34,sparkle*.72);
 });ctx.restore();
}
function driftingClouds(boarding){
 const ratio=images.billow_cloud?images.billow_cloud.height/images.billow_cloud.width:.6;
 const lanes=boarding?[[80,140,380,9,.2],[620,280,450,15,.25],[1090,350,420,11,.27],[-210,450,500,20,.22]]:[[40,125,380,9,.18],[680,285,450,14,.23],[1090,400,440,11,.27],[-300,490,530,19,.21]];
 lanes.forEach(([start,y,w,speed,alpha],i)=>{
  const x=((start+time*speed+w*1.6)%(1600+w*1.6))-w*1.6;
  const breath=Math.sin(time*.24+i*1.6),other=Math.sin(time*.19+i*2.4);
  const width=w*(1+breath*.065),height=width*ratio*(1+other*.04);
  img('billow_cloud',x+(w-width)/2,y+other*11,width,height,alpha);
  img('billow_cloud',x+w*.46+other*9,y+w*ratio*.25-breath*8,w*(.62+other*.045),w*ratio*(.58+breath*.04),alpha*.72);
  img('city_mist',x-w*.1,y+height*.52,w*1.55,w*.39,alpha*.38);
 });
}
// Coordinates follow the visible waterfall beds in the original 1280×720 plates.
const waterfallZones={city:[[368,347,365,396,9,15],[806,371,806,468,19,26],[923,365,932,425,21,30],[1023,412,1025,478,13,19],[850,589,856,626,11,16],[347,211,348,245,8,12],[659,324,661,365,8,13]],boarding:[[561,282,553,345,33,45],[231,425,239,459,19,25],[761,320,765,388,26,35],[860,423,851,514,43,56],[743,468,735,514,20,28],[251,172,252,218,12,20],[1047,251,1048,285,9,13]]};
function flowingWaterfalls(boarding){
 ctx.save();ctx.scale(1.25,1.25);
 waterfallZones[boarding?'boarding':'city'].forEach(([x,y,endX,endY,topWidth,bottomWidth],index)=>{
  const height=endY-y,width=Math.max(topWidth,bottomWidth)*1.3;
  ctx.save();ctx.beginPath();ctx.moveTo(x-topWidth/2,y);ctx.lineTo(x+topWidth/2,y);ctx.lineTo(endX+bottomWidth/2,endY);ctx.lineTo(endX-bottomWidth/2,endY);ctx.closePath();ctx.clip();
  const tileHeight=74+index%3*11,offset=(time*(66+index*7))%tileHeight;
  for(let row=-tileHeight+offset;row<height;row+=tileHeight){const center=mix(x,endX,clamp((row+tileHeight/2)/height));img('waterfall_flow',center-width/2,y+row,width,tileHeight,.63)}
  for(let i=0;i<8;i++){
   const t=(time*(.65+index*.06)+i*.137)%1,center=mix(x,endX,t),spread=mix(topWidth,bottomWidth,t);
   ctx.strokeStyle=`rgba(239,254,255,${.14+Math.sin(i*2.7)**2*.2})`;ctx.lineWidth=.6;
   const px=center+Math.sin(i*3.71)*spread*.38,py=y+t*height;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+.25,py+4+height*.06);ctx.stroke();
  }
  ctx.restore();
  const foamWidth=bottomWidth*(2.3+Math.sin(time*1.2+index)*.1);
  img('waterfall_foam',endX-foamWidth/2,endY-foamWidth*.18,foamWidth,foamWidth*.5,.16);
 });ctx.restore();
}
function cityAir(boarding=false){flowingWaterfalls(boarding);glassReflections(boarding);driftingClouds(boarding);for(const f of fleet){const x=((f.start+time*f.speed+f.w)%(1600+f.w))-f.w;img(f.type,x,f.y,f.w,f.w*.75,.96)}}
function drawCity(){background('bg_city');cityAir();shipPose('open',280,632,.62);boy(time%4<.12?'gesture_blink':'gesture',425,835,.6);const g=ctx.createLinearGradient(0,0,0,900);g.addColorStop(0,'#06253e10');g.addColorStop(1,'#05203d22');ctx.fillStyle=g;ctx.fillRect(0,0,1600,900)}
function flightPose(){
 if(state==='departure'){const p=clamp(elapsed/4.3),travel=1850*p*p;return{cx:1056-travel,cy:600-travel*Math.tan(5*DEG),scale:.95,angle:5,flip:false,thrust:1.15}}
 if(state==='ascent'){const p=clamp(elapsed/6.8),travel=2130*p;return{cx:-230+travel,cy:700-travel*Math.tan(15*DEG),scale:mix(.98,.28,smooth(p)),angle:0,flip:false,rear:true,exhaustAngle:rearArt.exhaustAngle,thrust:1.35}}
 return{cx:1056+Math.sin(time*52)*1.6,cy:600+Math.cos(time*47)*1.3,scale:.95,angle:0,flip:false,thrust:clamp(elapsed/2)*.75};
}
function nozzleWorld(p,x,y){const fx=p.flip?-x:x,a=p.angle*DEG;return{x:p.cx+p.scale*(fx*Math.cos(a)-y*Math.sin(a)),y:p.cy+p.scale*(fx*Math.sin(a)+y*Math.cos(a))}}
function exhaustSprite(smoke){
 const sprite=document.createElement('canvas');sprite.width=sprite.height=96;const c=sprite.getContext('2d');
 const g=c.createRadialGradient(48,48,0,48,48,46);
 if(smoke){g.addColorStop(0,'rgba(218,229,237,.32)');g.addColorStop(.4,'rgba(184,202,216,.2)');g.addColorStop(1,'rgba(150,179,200,0)')}
 else{g.addColorStop(0,'rgba(237,253,255,.75)');g.addColorStop(.2,'rgba(105,218,255,.4)');g.addColorStop(.55,'rgba(43,157,255,.12)');g.addColorStop(1,'rgba(30,120,255,0)')}
 c.fillStyle=g;c.fillRect(0,0,96,96);return sprite;
}
const smokeSprite=exhaustSprite(true),fireSprite=exhaustSprite(false);
function updateParticles(dt){
 if(['ignition','departure','ascent'].includes(state)){
  const pose=flightPose(),a=(pose.angle+(pose.exhaustAngle||0))*DEG,dir=pose.flip?-1:1,dx=dir*Math.cos(a),dy=dir*Math.sin(a);
  emitClock+=dt;
  while(emitClock>1/65){emitClock-=1/65;
   for(const[x,y,radius]of (pose.rear?rearArt.ports:enginePorts[state==='ignition'?'ignition':'flight'])){
    const q=nozzleWorld(pose,x,y),scale=pose.scale;q.x+=dx*6*scale;q.y+=dy*6*scale;
    for(const smoke of [false,true,true]){
     const speed=(smoke?120:350)*scale,spread=(Math.random()-.5)*(smoke?115:40)*scale;
     const radial=(Math.random()-.5)*(smoke?3.2:2)*radius*scale;
     const trailOffset=smoke?(55+Math.random()*180)*scale:0;
     particles.push({x:q.x+dx*trailOffset-dy*radial,y:q.y+dy*trailOffset+dx*radial,vx:dx*speed-dy*spread,vy:dy*speed+dx*spread,age:0,
      life:smoke?1.05+Math.random()*.8:.2+Math.random()*.18,
      size:(smoke?28+Math.random()*28:9+Math.random()*10)*scale,scale,smoke});
    }
   }
  }
 }
 for(const p of particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.size+=dt*(p.smoke?80:12)*p.scale;if(p.smoke)p.vy-=dt*12}
 particles=particles.filter(p=>p.age<p.life&&p.x>-500&&p.x<2200);if(particles.length>560)particles.splice(0,particles.length-560);
}
function drawParticles(){
 ctx.save();
 for(const smoke of [true,false]){
  ctx.globalCompositeOperation=smoke?'source-over':'lighter';
  for(const p of particles){if(p.smoke!==smoke)continue;const t=p.age/p.life;
   ctx.globalAlpha=(1-t)*(smoke?Math.min(1,t*6)*.65:.62);
   ctx.drawImage(smoke?smokeSprite:fireSprite,p.x-p.size,p.y-p.size,p.size*2,p.size*2);
  }
 }
 ctx.restore();
}
function drawBoard(){background('boarding_city_v2');cityAir(true);drawParticles();const moving=['ignition','departure'].includes(state);const p=moving?flightPose():{cx:1056,cy:600,scale:.95,angle:0,flip:false,thrust:0};let mode='open';if(state==='closing')mode=elapsed<1.5?'closing':'closed';if(state==='ignition')mode='ignition';if(state==='departure')mode='flight';
 img('ground_shadow',650,719,780,170,state==='departure'?1-clamp(elapsed/1.5):.65);shipPose(mode,p.cx,p.cy,p.scale,p.angle,p.flip,p.thrust);
 if(['boarding','fade'].includes(state))boy(time%4<.14?'gesture_blink':'gesture',475,850);
 if(state==='walking'){const t=clamp(elapsed/3.8);boy('walk_'+String(Math.floor(elapsed*8)%8+1).padStart(2,'0'),mix(475,1115,t),850)}
 if(state==='vanish')boy('gesture',1115,850,.85,1-smooth(clamp(elapsed/1.05)));
 img('foreground_flowers',-130,740,440,300);img('foreground_flowers',1450,760,350,260,.9);
 if(state==='departure'&&elapsed>4.05){ctx.fillStyle=`rgba(231,248,255,${clamp((elapsed-4.05)/.25)})`;ctx.fillRect(0,0,1600,900)}
}
function drawAscent(){const p=clamp(elapsed/6.8);img('bg_ascent',-20-p*20,-20+p*12,1640,923);background('bg_space',smooth(clamp((p-.68)/.3)));drawParticles();
 for(let i=0;i<3;i++){const x=(i*670-time*55)%2100-300,y=(i*240+p*780)%1300-220;img('city_mist',x,y,1000,305,(1-p)*.3)}
 rearShip(flightPose());
 if(p<.1){ctx.fillStyle=`rgba(231,248,255,${1-p/.1})`;ctx.fillRect(0,0,1600,900)}
}
function drawSpace(){background('bg_space');for(let i=0;i<40;i++){ctx.fillStyle=`rgba(255,245,216,${.35+Math.sin(time*2+i)*.25})`;ctx.beginPath();ctx.arc(i*137.5%1600,i*73%620,1.5+i%3,0,Math.PI*2);ctx.fill()}rearShip({cx:1270,cy:270,scale:.2,angle:0,thrust:.6})}
// Stage 2 uses the very same aligned ship sprites and hatch as Earth boarding.
function planetDust(front){
 const descent=state==='planet_descent',age=planetTime;
 const power=.75*(descent?smooth(clamp((elapsed-1.8)/3.7)):Math.pow(clamp(1-(age-6)/5),1.4));
 if(power<=0)return;
 ctx.save();
 for(let i=0;i<36;i++){
  const t=(age*.24+i*.137)%1,a=i*2.39996,r=90+t*430;
  const x=500+Math.cos(a)*r*.95,y=500+Math.sin(a)*r*.26;
  if((y>500)!==front)continue;
  const breathe=1+Math.sin(age*2.4+i)*.09;
  const w=(80+t*150)*breathe,h=w*(.82+Math.sin(age*1.8+i)*.08);
  const rise=Math.sin(t*Math.PI)*55;
  ctx.save();ctx.filter='grayscale(1) brightness(1.55)';
  img('landing_dust',x-w*1.45,y-h-rise,w*2.9,h*2,power*(1-t*.65)*.6);
  ctx.restore();
  for(let puff=0;puff<3;puff++){
   const px=x+(puff-1)*w*.52,py=y-rise-h*(.14+Math.sin(age*2+i+puff)*.12);
   const pr=w*(.38+puff*.07),cloud=ctx.createRadialGradient(px,py,0,px,py,pr);
   cloud.addColorStop(0,`rgba(255,255,255,${power*(1-t*.7)*.27})`);cloud.addColorStop(.6,`rgba(233,240,245,${power*(1-t*.7)*.16})`);cloud.addColorStop(1,'rgba(233,240,245,0)');
   ctx.fillStyle=cloud;ctx.fillRect(px-pr,py-pr,pr*2,pr*2);
  }
  const g=ctx.createRadialGradient(x,y,0,x,y,w);
  g.addColorStop(0,`rgba(255,255,255,${power*(1-t)*.24})`);g.addColorStop(.5,`rgba(237,244,248,${power*(1-t)*.13})`);g.addColorStop(1,'rgba(237,244,248,0)');
  ctx.save();ctx.translate(x,y);ctx.scale(1,h/w);ctx.translate(-x,-y);ctx.fillStyle=g;ctx.fillRect(x-w,y-w,w*2,w*2);ctx.restore();
 }
 ctx.restore();
}
function landingJet(x,y,ground,power){
 if(power<=0||ground<=y)return;
 const length=Math.min(ground-y,180),pulse=1+Math.sin(planetTime*34)*.06;
 ctx.save();ctx.globalCompositeOperation='lighter';
 // Overlapping soft radial wisps avoid a hard spotlight-shaped edge.
 for(let i=0;i<9;i++){
  const t=i/8,py=y+t*length,r=(13+t*19)*pulse;
  ctx.save();ctx.translate(x+Math.sin(planetTime*21+i)*t*2,py);ctx.scale(1,1.65);
  const g=ctx.createRadialGradient(0,0,0,0,0,r);
  g.addColorStop(0,`rgba(215,253,255,${power*(1-t)*.32})`);
  g.addColorStop(.3,`rgba(93,222,255,${power*(1-t)*.24})`);g.addColorStop(1,'rgba(45,175,255,0)');
  ctx.fillStyle=g;ctx.fillRect(-r,-r,r*2,r*2);ctx.restore();
 }
 ctx.restore();
}
const hatchFinal=document.createElement('canvas');hatchFinal.width=1024;hatchFinal.height=716;
const hatchFinalCtx=hatchFinal.getContext('2d');
function openingShip(cy){
 // Reverse the original three door poses; additive interpolation keeps the hull solid.
 const first=elapsed<1.5,p=smooth(clamp((first?elapsed:elapsed-1.5)/1.5)),f=hatchFinalCtx;
 const from=images[first?'ship_closed':'ship_closing'],to=images[first?'ship_closing':'ship_open'];
 f.clearRect(0,0,1024,716);f.globalCompositeOperation='source-over';f.globalAlpha=1-p;
 f.drawImage(from,0,first?0:8*(1-p),1024,716);
 f.globalCompositeOperation='lighter';f.globalAlpha=p;f.drawImage(to,0,first?8*p:0,1024,716);
 f.globalAlpha=1;f.globalCompositeOperation='source-over';
 ctx.drawImage(hatchFinal,500-512*.66,cy-358*.66,1024*.66,716*.66);
}
function drawPlanet(){
 background('planet_ground');
 const descending=state==='planet_descent',p=clamp(elapsed/6),height=descending?880*Math.pow(1-p,3):0;
 const cy=351.5-height,scale=.66;
 const shadowScale=descending?mix(.38,1,1-height/880):1;
 img('ground_shadow',500-273*shadowScale,500-48*shadowScale,546*shadowScale,96*shadowScale,descending?mix(.08,.58,1-height/880):.58);
 // Wheel-contact ellipses remain fixed on the pad when the craft has landed.
 const contact=clamp(1-height/65);
 for(const [x,y,rx,ry] of [[292,499,36,12],[613,457,34,11]]){
  ctx.save();ctx.translate(x,y);ctx.scale(1,ry/rx);const g=ctx.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,`rgba(24,17,14,${contact*.95})`);g.addColorStop(.45,`rgba(24,17,14,${contact*.72})`);g.addColorStop(1,'rgba(24,17,14,0)');ctx.fillStyle=g;ctx.fillRect(-rx,-rx,rx*2,rx*2);ctx.restore();
 }
 planetDust(false);
 if(descending){const thrust=clamp((elapsed-.3)/.5)*clamp((6-elapsed)/.35);landingJet(381,cy+102,500,thrust);landingJet(592,cy+89,500,thrust)}
 if(state==='planet_open')openingShip(cy);
 else shipPose(['planet_reveal','planet_walk','planet_ready'].includes(state)?'open':'closed',500,cy,scale);
 const heroAlpha=state==='planet_reveal'?smooth(clamp(elapsed/2)):['planet_walk','planet_ready'].includes(state)?1:0;
 const walking=state==='planet_walk',walkP=walking?clamp(elapsed/1.65):state==='planet_ready'?1:0;
 if(heroAlpha>0){
  const x=820+walkP*125,y=755+walkP*12;
  boy(walking?'walk_'+String(Math.floor(elapsed/1.65*12)%8+1).padStart(2,'0'):time%5<.12?'gesture_blink':'gesture',x,y,1.04,heroAlpha);
 }
 planetDust(true);
 if(descending&&elapsed<.7){ctx.fillStyle=`rgba(5,16,27,${1-elapsed/.7})`;ctx.fillRect(0,0,1600,900)}
}
function introUI(){if(state!=='city')return;$('#intro').hidden=elapsed>=2.9;$('#intro').style.opacity=String(Math.min(clamp(elapsed/.6),clamp((2.9-elapsed)/.5)));const card=narration.find(c=>elapsed>=c.start&&elapsed<c.end);$('#guide').hidden=!card;if(card){const p=Math.min(clamp((elapsed-card.start)/.45),clamp((card.end-elapsed)/.45));$('#guideText').textContent=card.text;$('#guide').style.opacity=String(p);$('#guide').style.transform=`translateY(${(1-p)*18}px)`}$('#action').disabled=elapsed<14.6}
function update(dt){if(state==='arrival')return;time+=dt;elapsed+=dt;if(isPlanet())planetTime+=dt;const durations={fade:1.4,boarding:2.2,walking:3.8,vanish:1.05,closing:3.2,ignition:4,departure:4.3,ascent:6.8,space:2.5,planet_descent:6,planet_settle:2,planet_open:3,planet_reveal:2,planet_walk:1.65,planet_ready:2.5};const next={fade:'boarding',boarding:'walking',walking:'vanish',vanish:'closing',closing:'ignition',ignition:'departure',departure:'ascent',ascent:'cabin',space:'cabin',planet_descent:'planet_settle',planet_settle:'planet_open',planet_open:'planet_reveal',planet_reveal:'planet_walk',planet_walk:'planet_ready',planet_ready:'explore'};
 if(durations[state]&&elapsed>=durations[state])enter(next[state]);
 if(state==='planet_walk'){const index=Math.min(2,Math.floor(elapsed/.55));if(index!==stepIndex){stepIndex=index;play('step'+(index+1),.45)}}
 if(state==='walking'){const index=Math.floor(elapsed/.4);if(index!==stepIndex){stepIndex=index;play('step'+(index%3+1),.36)}}
 if(state==='vanish'&&stepIndex<0){stepIndex=0;play('metal1',.3)}
 updateParticles(dt);updateFlybys();introUI();
}
function tick(now){const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(['cabin_transition','explore_embedded'].includes(state)){requestAnimationFrame(tick);return}if(ready&&!paused&&window.GAME_START?.started)update(dt);if(['cabin_transition','explore_embedded'].includes(state)){requestAnimationFrame(tick);return}ctx.clearRect(0,0,1600,900);
 if(isPlanet())drawPlanet();else if(state==='arrival'){}else if(['loading','city'].includes(state)||state==='fade'&&elapsed<.7)drawCity();else if(state==='ascent')drawAscent();else if(['space','complete'].includes(state))drawSpace();else drawBoard();
 if(state==='fade'){ctx.fillStyle=`rgba(4,15,27,${elapsed<.7?elapsed/.7:1-(elapsed-.7)/.7})`;ctx.fillRect(0,0,1600,900)}requestAnimationFrame(tick)
}
let loaded=0;
const used=Object.entries(A.images).filter(([n])=>!n.startsWith('button_')&&!['board_step','board_enter'].includes(n));
Promise.all([document.fonts.load('800 24px Paperlogy'),...used.map(([n,m])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[n]=im;$('#loading b').textContent=Math.round(++loaded/used.length*100)+'%';resolve()};im.onerror=()=>reject(new Error(n));im.src=m.url}))]).then(()=>{ready=true;$('#loading').hidden=true;enter(new URLSearchParams(location.search).get('stage')==='2'?'planet_descent':'city');window.dispatchEvent(new Event('game-ready'))}).catch(e=>{$('#loading b').textContent='이미지를 불러오지 못했어요. 새로고침해 주세요.';console.error(e)});
requestAnimationFrame(tick);
})();










