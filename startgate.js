(()=>{'use strict';
const embedded=window.parent!==window;
const gate=window.GAME_START={started:embedded};
if(embedded)return;
const overlay=document.createElement('section');overlay.id='launchGate';overlay.setAttribute('aria-label','게임 시작');
overlay.innerHTML='<div><h1>별빛 항해</h1><p>가로 화면으로 우주여행을 시작하세요</p><button id="launchFullscreen">전체화면으로 시작</button><p id="launchMessage" role="status">화면이 준비되면 시작할 수 있어요</p><button id="launchFallback" hidden>일반 화면으로 시작</button></div>';
const style=document.createElement('style');style.textContent='#launchGate{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 38%,#11516de8,#030e23f5);font:800 18px Stage3Paperlogy,Paperlogy,sans-serif;color:white;text-align:center;padding:24px}#launchGate>div{max-width:640px}#launchGate h1{font-size:clamp(32px,6vw,64px);color:#fff4ce;text-shadow:0 0 24px #1bccff;margin:0 0 18px}#launchGate p{line-height:1.7;font-size:clamp(14px,2.5vw,19px)}#launchGate button{display:block;margin:20px auto;padding:16px 28px;border:2px solid #a7f9ff;border-radius:28px;background:linear-gradient(#dcffff,#6eddeb);color:#06445e;font:inherit;cursor:pointer;min-height:56px;box-shadow:0 0 25px #29cde875}#launchGate button:disabled{opacity:.55;cursor:wait}#launchGate #launchMessage{max-width:500px;color:#c5eaf5;font-size:14px}#launchGate #launchFallback{background:#112d43;color:white;box-shadow:none;padding:10px 20px;font-size:14px}';
document.head.append(style);document.body.append(overlay);
const button=document.querySelector('#launchFullscreen'),message=document.querySelector('#launchMessage'),fallback=document.querySelector('#launchFallback');
button.disabled=true;
window.addEventListener('game-ready',()=>{button.disabled=false;message.textContent='전체화면 전환과 함께 음악과 게임이 시작돼요'},{once:true});
function start(){if(gate.started)return;gate.started=true;overlay.remove();window.dispatchEvent(new Event('game-start'));}
button.onclick=async()=>{
 // Resume the audio context within this actual user gesture, without playing yet.
 window.dispatchEvent(new Event('game-audio-prime'));button.disabled=true;
 const target=document.documentElement,request=target.requestFullscreen||target.webkitRequestFullscreen;
 try{
  if(!document.fullscreenElement&&!document.webkitFullscreenElement){if(!request)throw Error('unsupported');await request.call(target)}
  if(!document.fullscreenElement&&!document.webkitFullscreenElement)throw Error('not-fullscreen');
  if(screen.orientation?.lock)screen.orientation.lock('landscape').catch(()=>{});
  start();
 }catch{button.disabled=false;message.textContent='이 브라우저에서는 전체화면 전환을 지원하지 않거나 허용하지 않았어요. Chrome·삼성 인터넷에서 다시 열거나 일반 화면으로 시작할 수 있어요.';fallback.hidden=false}
};
fallback.onclick=()=>{window.dispatchEvent(new Event('game-audio-prime'));start()};
})();
