(()=>{'use strict';const c=document.querySelector('#view'),g=c.getContext('2d'),$=s=>document.querySelector(s),art={},base='우주선내부_장면시안/에셋검토/',audioBase='우주선내부_장면시안/소리에셋/';let t=0,last=0,paused=false,ready=false,started=false,muted=false,ac,buffers={},sources=new Set(),nextWhoosh=1,nextBeep=3;
const assets={frame:'06_주인공의자실내_통합.webp',space:'../은하우주_에셋/05_은하우주_통이미지.webp'};
const sequence=new URLSearchParams(location.search).get('sequence')==='1';const embedded=window.parent!==window;let sequenceElapsed=0,leaving=false;
const music=new Audio(audioBase+'cabin_bgm_immediate.mp3');music.preload='auto';music.loop=true;music.volume=.3;music.load();
const random=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n)};
// Independent placement and phase avoid the old correlated spiral pattern.
// Every star stays on one fixed straight ray for its entire pass.
const stars=Array.from({length:180},(_,i)=>{const a=random(i+1)*Math.PI*2,r=.65+random(i+3109)*.35;return {angle:a,originX:Math.cos(a)*r*165,originY:Math.sin(a)*r*85,phase:random(i+417),speed:.48+random(i+833)*.55,length:90+random(i+1297)*290,near:i%4===0}});
function play(key,volume,loop=false){if(!ac||muted||!buffers[key])return;const s=ac.createBufferSource(),v=ac.createGain();s.buffer=buffers[key];s.loop=loop;v.gain.value=volume;s.connect(v).connect(ac.destination);s.start();sources.add(s);s.onended=()=>sources.delete(s)}
function stop(){for(const s of sources)try{s.stop()}catch{}sources.clear()}
async function begin(){if(!ready)return;music.play().catch(()=>{});if(!ac){ac=new(window.AudioContext||window.webkitAudioContext)();await ac.resume();await Promise.all(['cabin_hum','star_pass_1','star_pass_2','star_pass_3','console_beep'].map(async k=>{buffers[k]=await ac.decodeAudioData(await(await fetch(audioBase+k+'.mp3')).arrayBuffer())}))}else await ac.resume();started=true;muted=false;$('#start').hidden=true;$('#sound').textContent='소리 끄기';$('#sound').setAttribute('aria-label','소리 끄기');$('#status').hidden=true;stop();play('cabin_hum',.18,true);nextWhoosh=t+1;nextBeep=t+3}
$('#start').onclick=begin;$('#sound').onclick=()=>{if(!started||muted){begin()}else{muted=true;music.pause();stop();$('#sound').textContent='소리 켜기';$('#sound').setAttribute('aria-label','소리 켜기')}};
function pause(v){paused=v;$('#pause').textContent=v?'계속하기':'일시정지';if(v)music.pause();else if(started&&!muted)music.play().catch(()=>{});if(ac){if(v)ac.suspend();else ac.resume()}last=performance.now()}
$('#pause').onclick=()=>pause(!paused);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true)});
function image(key,x,y,w,h){const a=art[key];if(a)g.drawImage(a,x,y,w,h)}
function render(){
 const zoom=1+2.2*(1-Math.exp(-t*.045/2.2));g.save();g.translate(1180,280);g.scale(zoom,zoom);g.translate(-1180,-280);image('space',0,0,1600,900);g.restore();
 // Star trails expand away from a single vanishing point, behind the transparent window.
 g.save();g.globalCompositeOperation='screen';const vx=1180,vy=280;
 for(const s of stars){const p=(s.phase+t*s.speed)%1,r=45+Math.pow(p,1.2)*1800,dx=Math.cos(s.angle),dy=Math.sin(s.angle)*.65,x=vx+s.originX+dx*r,y=vy+s.originY+dy*r,len=Math.min(r*.65,s.length*(s.near?1.6:1)*(.3+p*2));const opacity=Math.min(1,p/.09,(1-p)/.12);const grad=g.createLinearGradient(x-dx*len,y-dy*len,x,y);grad.addColorStop(0,'rgba(88,185,255,0)');grad.addColorStop(1,`rgba(239,253,255,${opacity*(.5+p*.5)})`);g.strokeStyle=grad;g.lineWidth=s.near?3+p*14:1+p*3;g.shadowColor=s.near?'#71dfff':'#257ecb';g.shadowBlur=s.near?12:3;g.beginPath();g.moveTo(x-dx*len,y-dy*len);g.lineTo(x,y);g.stroke()}g.restore();
 g.save();g.translate(800+Math.sin(t*8.1)*1.6,450+Math.sin(t*11.7)*1.1);g.rotate(Math.sin(t*1.8)*.0018);g.scale(1.012,1.012);image('frame',-800,-450,1600,900);g.restore();
 // Soft illumination pulses on the existing dashboard screens without covering their detail.
 g.save();g.globalCompositeOperation='screen';for(const [x,y,r]of [[1020,600,85],[820,560,55],[1320,640,50]]){const a=.035+(.5+.5*Math.sin(t*1.8+x))*.045,glow=g.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,`rgba(72,230,255,${a})`);glow.addColorStop(1,'rgba(72,230,255,0)');g.fillStyle=glow;g.fillRect(x-r,y-r,r*2,r*2)}g.restore();
}
function tick(now){const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(ready){if(!paused){t+=dt;if(sequence){sequenceElapsed+=dt;if(sequenceElapsed>=7&&!leaving){leaving=true;music.pause();stop();if(embedded)window.parent.postMessage({type:'cabin-finished'},location.origin);else location.replace('./?stage=2');return}}if(started&&!muted){if(t>nextWhoosh){play('star_pass_'+(1+Math.floor(t*7)%3),.2+Math.sin(t)*.035);nextWhoosh=t+.6+(Math.sin(t*3)+1)*.12}if(t>nextBeep){play('console_beep',.10);nextBeep=t+7.4}}}render();if(sequence&&!embedded&&sequenceElapsed<1){g.fillStyle='rgba(3,11,23,'+(1-sequenceElapsed)+')';g.fillRect(0,0,1600,900)}}requestAnimationFrame(tick)}
Promise.all(Object.entries(assets).map(([k,file])=>new Promise((resolve,reject)=>{const a=new Image();a.onload=()=>{art[k]=a;resolve()};a.onerror=()=>reject(Error(k));a.src=base+file}))).then(()=>{ready=true;t=0;sequenceElapsed=0;if(embedded){render();window.parent.postMessage({type:'cabin-ready'},location.origin)}$('#status').hidden=true;if(sequence){$('#start').hidden=true;begin().catch(()=>{})}else music.play().catch(()=>{})}).catch(e=>{$('#status').textContent='장면을 불러오지 못했어요. 새로고침해 주세요.';console.error(e)});requestAnimationFrame(tick);
})();










