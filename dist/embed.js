(() => {
  "use strict";
  if (window.PageBreaker?.version) return;

  const sourceScript = document.currentScript;
  const settings = {
    launcher: sourceScript?.dataset.pagebreakerLauncher !== "false",
    autoStart: sourceScript?.dataset.pagebreakerAutostart === "true" || new URLSearchParams(location.search).get("pagebreaker") === "1",
  };
  const Z = 2147483646;
  let launcherHost = null;
  let game = null;

  const CSS = `
    :host{all:initial;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff}
    *{box-sizing:border-box}
    button{font:inherit}
    .launcher{position:fixed;z-index:${Z};right:22px;bottom:22px;display:flex;align-items:center;gap:9px;border:1px solid color-mix(in srgb,var(--pb-fg) 24%,transparent);border-radius:999px;padding:12px 16px;background:color-mix(in srgb,var(--pb-bg) 88%,transparent);color:var(--pb-fg);box-shadow:0 12px 45px rgba(0,0,0,.24);backdrop-filter:blur(14px);cursor:pointer;font-weight:750;font-size:13px;line-height:1;transition:transform .18s ease,box-shadow .18s ease}
    .launcher:hover{transform:translateY(-2px);box-shadow:0 16px 50px rgba(0,0,0,.32)}
    .launcher:focus-visible,.control:focus-visible{outline:3px solid var(--pb-ball);outline-offset:3px}
    .dot{width:12px;height:12px;border-radius:50%;background:var(--pb-ball);box-shadow:0 0 16px color-mix(in srgb,var(--pb-ball) 75%,transparent)}
    .overlay{position:fixed;z-index:${Z};inset:0;overflow:hidden;touch-action:none;cursor:none}
    canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
    .shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom,color-mix(in srgb,var(--pb-bg) 72%,transparent),transparent 18%,transparent 76%,color-mix(in srgb,var(--pb-bg) 42%,transparent))}
    .hud{position:absolute;top:0;left:0;right:0;height:74px;padding:17px 22px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;color:var(--pb-fg);pointer-events:none;text-shadow:0 2px 16px color-mix(in srgb,var(--pb-bg) 80%,transparent)}
    .brand{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:850;line-height:.88;letter-spacing:-.02em}.brand i{width:13px;height:13px;border-radius:50%;background:var(--pb-ball);box-shadow:0 0 14px var(--pb-ball)}
    .stats{display:flex;gap:15px;align-items:center;font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace}.stats b{height:14px;width:1px;background:color-mix(in srgb,var(--pb-fg) 24%,transparent)}
    .lives{justify-self:end;display:flex;gap:6px}.life{width:9px;height:9px;border-radius:50%;border:1px solid var(--pb-ball);background:var(--pb-ball)}.life.lost{background:transparent;opacity:.4}
    .controls{position:absolute;right:18px;bottom:16px;display:flex;align-items:center;gap:7px;cursor:auto}
    .control{border:1px solid color-mix(in srgb,var(--pb-fg) 25%,transparent);border-radius:999px;padding:9px 12px;background:color-mix(in srgb,var(--pb-bg) 75%,transparent);color:var(--pb-fg);backdrop-filter:blur(12px);cursor:pointer;font:600 10px ui-monospace,SFMono-Regular,Menlo,monospace}
    .hint{position:absolute;left:18px;bottom:18px;color:color-mix(in srgb,var(--pb-fg) 62%,transparent);font:500 10px ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none}
    .message{position:absolute;left:50%;top:47%;translate:-50% -50%;color:var(--pb-fg);font-size:clamp(34px,6vw,76px);font-weight:850;letter-spacing:-.065em;text-align:center;text-shadow:0 5px 30px color-mix(in srgb,var(--pb-bg) 85%,transparent);pointer-events:none;opacity:0;transition:opacity .18s ease,transform .18s ease}.message.show{opacity:1;transform:scale(1)}
    .power{position:absolute;left:50%;bottom:22px;translate:-50% 0;display:flex;align-items:center;gap:9px;color:var(--pb-ball);opacity:0;font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace;transition:opacity .2s}.power.on{opacity:1}.track{width:90px;height:3px;background:color-mix(in srgb,var(--pb-fg) 18%,transparent)}.track i{display:block;width:100%;height:100%;background:var(--pb-ball);transform-origin:left}
    .end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:25px;text-align:center;background:color-mix(in srgb,var(--pb-bg) 72%,transparent);backdrop-filter:blur(12px);color:var(--pb-fg);cursor:auto}.end[hidden]{display:none}.end p{margin:0 0 13px;color:var(--pb-ball);font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em}.end h2{margin:0 0 25px;font-size:clamp(48px,8vw,100px);line-height:.84;letter-spacing:-.075em}.end h2 em{color:var(--pb-ball);font-style:normal}.end .again{border:0;border-radius:999px;padding:15px 23px;background:var(--pb-ball);color:var(--pb-bg);font-weight:850;cursor:pointer}
    @media(max-width:640px){.hud{padding:14px}.stats{gap:8px;font-size:9px}.hint{display:none}.controls{right:12px;bottom:12px}.control{padding:10px}.brand{font-size:10px}}
    @media(prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}
  `;

  function sheet(root) {
    try {
      const styleSheet = new CSSStyleSheet();
      styleSheet.replaceSync(CSS);
      root.adoptedStyleSheets = [styleSheet];
    } catch {
      const style = document.createElement("style");
      style.textContent = CSS;
      root.append(style);
    }
  }

  function parseColor(value) {
    if (!value || value === "transparent") return null;
    const match = value.match(/[\d.]+/g);
    if (!match || match.length < 3) return null;
    const [r, g, b, a = 1] = match.map(Number);
    return a === 0 ? null : { r, g, b };
  }

  function luminance(color) {
    const channels = [color.r, color.g, color.b].map((value) => {
      const channel = value / 255;
      return channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  }

  function colorText(color) { return `rgb(${color.r} ${color.g} ${color.b})`; }
  function contrast(a, b) { const l1 = luminance(a); const l2 = luminance(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); }

  function detectTheme() {
    const bodyStyle = getComputedStyle(document.body);
    const htmlStyle = getComputedStyle(document.documentElement);
    const bg = parseColor(bodyStyle.backgroundColor) || parseColor(htmlStyle.backgroundColor) || (matchMedia("(prefers-color-scheme:dark)").matches ? { r: 10, g: 11, b: 16 } : { r: 250, g: 250, b: 248 });
    const dark = luminance(bg) < .38;
    const candidates = [];
    document.querySelectorAll("a,button,h1,h2,h3,[class*='accent'],[class*='primary']").forEach((element) => {
      if (candidates.length > 70) return;
      const computed = getComputedStyle(element);
      [computed.color, computed.backgroundColor, computed.borderColor].forEach((value) => {
        const color = parseColor(value);
        if (!color) return;
        const chroma = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
        if (chroma > 65 && contrast(color, bg) > 2.2) candidates.push({ color, score: chroma * contrast(color, bg) });
      });
    });
    candidates.sort((a, b) => b.score - a.score);
    const accent = candidates[0]?.color;
    return {
      dark,
      bg: colorText(bg),
      fg: dark ? "#ffffff" : "#111218",
      ball: dark ? "#eaff38" : (accent ? colorText(accent) : "#654cff"),
      accent: accent ? colorText(accent) : (dark ? "#765cff" : "#654cff"),
    };
  }

  function makeHost(className, theme) {
    const host = document.createElement("div");
    host.dataset.pagebreakerUi = "true";
    host.style.setProperty("--pb-bg", theme.bg);
    host.style.setProperty("--pb-fg", theme.fg);
    host.style.setProperty("--pb-ball", theme.ball);
    host.style.setProperty("--pb-accent", theme.accent);
    host.className = className;
    document.documentElement.append(host);
    const root = host.attachShadow({ mode: "open" });
    sheet(root);
    return { host, root };
  }

  function createLauncher() {
    if (launcherHost || !settings.launcher) return;
    const theme = detectTheme();
    const { host, root } = makeHost("pagebreaker-launcher-host", theme);
    launcherHost = host;
    host.style.cssText += `;position:fixed;z-index:${Z};inset:0;pointer-events:none`;
    root.innerHTML += `<button class="launcher" type="button"><span class="dot"></span>Play Page Breaker</button>`;
    const button = root.querySelector("button");
    button.style.pointerEvents = "auto";
    button.addEventListener("click", start);
  }

  function visibleTargets() {
    const preferred = "h1,h2,h3,h4,p,blockquote,img,video,figure,button,[role='button'],input,textarea,select,li,article,nav,header,footer,[data-pagebreaker-brick]";
    const candidates = [...document.querySelectorAll(preferred)].filter((element) => {
      if (element.closest("[data-pagebreaker-ui]")) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width >= 48 && rect.height >= 18 && rect.bottom > 74 && rect.top < innerHeight - 80 && rect.right > 0 && rect.left < innerWidth && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > .05;
    });
    const sorted = candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const aPriority = a.hasAttribute("data-pagebreaker-brick") ? -1 : 0;
      const bPriority = b.hasAttribute("data-pagebreaker-brick") ? -1 : 0;
      return aPriority - bPriority || ar.width * ar.height - br.width * br.height;
    });
    const selected = [];
    for (const element of sorted) {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const overlaps = selected.some((chosen) => {
        const other = chosen.getBoundingClientRect();
        return centerX > other.left && centerX < other.right && centerY > other.top && centerY < other.bottom;
      });
      if (!overlaps) selected.push(element);
      if (selected.length >= 30) break;
    }
    return selected;
  }

  function start() {
    if (game) return;
    const elements = visibleTargets();
    if (elements.length < 3) return;
    game = createGame(elements, detectTheme());
  }

  function createGame(elements, theme) {
    launcherHost && (launcherHost.style.display = "none");
    const { host, root } = makeHost("pagebreaker-game-host", theme);
    host.style.cssText += `;position:fixed;z-index:${Z};inset:0`;
    root.innerHTML += `
      <div class="overlay">
        <canvas aria-label="Page Breaker game"></canvas><div class="shade"></div>
        <header class="hud"><div class="brand"><i></i><span>PAGE<br>BREAKER</span></div><div class="stats"><span data-score>000000</span><b></b><span data-progress>0% CLEARED</span></div><div class="lives" data-lives></div></header>
        <div class="message" data-message></div>
        <div class="power" data-power>MULTIBALL <span class="track"><i data-timer></i></span></div>
        <div class="hint">MOUSE / TOUCH / ← → TO MOVE · SPACE TO PAUSE</div>
        <div class="controls"><button class="control" data-sound type="button">SOUND ON</button><button class="control" data-exit type="button">EXIT</button></div>
        <section class="end" data-end hidden><p data-end-kicker>PAGE CLEARED</p><h2 data-end-title>Nothing left<br><em>but pixels.</em></h2><button class="again" data-again type="button">Break it again</button></section>
      </div>`;

    const canvas = root.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const overlay = root.querySelector(".overlay");
    const scoreEl = root.querySelector("[data-score]");
    const progressEl = root.querySelector("[data-progress]");
    const livesEl = root.querySelector("[data-lives]");
    const messageEl = root.querySelector("[data-message]");
    const powerEl = root.querySelector("[data-power]");
    const timerEl = root.querySelector("[data-timer]");
    const endEl = root.querySelector("[data-end]");
    const originals = new Map();
    const state = { running:true, paused:false, over:false, score:0, lives:3, destroyed:0, total:elements.length, last:performance.now(), multiUntil:0, sound:true, launchAt:performance.now()+850, raf:0 };
    const keys = { left:false, right:false };
    let width = innerWidth;
    let height = innerHeight;
    let dpr = 1;
    let balls = [];
    let bricks = [];
    let drops = [];
    let particles = [];
    let audio = null;
    const paddle = { x:width/2-64, targetX:width/2-64, y:height-60, width:128, height:13 };
    const oldOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    elements.forEach((element) => originals.set(element, { opacity:element.style.opacity, filter:element.style.filter, transform:element.style.transform, transition:element.style.transition, pointerEvents:element.style.pointerEvents }));

    function ensureAudio() {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    }
    function beep(frequency, duration=.045, type="sine", volume=.025) {
      if (!state.sound) return;
      ensureAudio();
      const oscillator=audio.createOscillator(), gain=audio.createGain();
      oscillator.type=type; oscillator.frequency.value=frequency; gain.gain.value=volume; gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration); oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime+duration);
    }
    function ball(x=width/2,y=paddle.y-18,angle=-Math.PI*.64) {
      const speed=Math.max(350,Math.min(510,width*.38));
      return { x,y,r:width<640?7:8,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,trail:[] };
    }
    function buildBricks() {
      bricks=elements.map((element,index)=>{ const rect=element.getBoundingClientRect(),old=bricks.find((item)=>item.element===element); const hp=rect.width*rect.height>90000?3:rect.width*rect.height>25000?2:1; return { element,x:rect.left,y:rect.top,w:rect.width,h:rect.height,hp:old?.hp??hp,max:hp,alive:old?.alive??true,color:index%3===0?theme.ball:index%3===1?theme.accent:theme.fg }; });
    }
    function resize() { dpr=Math.min(devicePixelRatio||1,2); width=innerWidth; height=innerHeight; canvas.width=width*dpr; canvas.height=height*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); paddle.width=Math.max(90,Math.min(142,width*.13)); paddle.y=height-60; paddle.x=Math.min(paddle.x,width-paddle.width); paddle.targetX=paddle.x; buildBricks(); }
    function hud() { scoreEl.textContent=String(state.score).padStart(6,"0"); progressEl.textContent=`${Math.round(state.destroyed/Math.max(1,state.total)*100)}% CLEARED`; livesEl.innerHTML=""; for(let i=0;i<3;i++){const dot=document.createElement("span");dot.className=`life${i>=state.lives?" lost":""}`;livesEl.append(dot);} }
    function announce(text,duration=700){ messageEl.textContent=text; messageEl.classList.add("show"); clearTimeout(announce.timer); announce.timer=setTimeout(()=>messageEl.classList.remove("show"),duration); }
    function collides(circle,rect){ const x=Math.max(rect.x,Math.min(circle.x,rect.x+rect.w)),y=Math.max(rect.y,Math.min(circle.y,rect.y+rect.h)),dx=circle.x-x,dy=circle.y-y;return dx*dx+dy*dy<=circle.r*circle.r; }
    function bounce(b,rect){ const d=[Math.abs(b.x+b.r-rect.x),Math.abs(b.x-b.r-(rect.x+rect.w)),Math.abs(b.y+b.r-rect.y),Math.abs(b.y-b.r-(rect.y+rect.h))],m=Math.min(...d);if(m===d[0]){b.x=rect.x-b.r;b.vx=-Math.abs(b.vx)}else if(m===d[1]){b.x=rect.x+rect.w+b.r;b.vx=Math.abs(b.vx)}else if(m===d[2]){b.y=rect.y-b.r;b.vy=-Math.abs(b.vy)}else{b.y=rect.y+rect.h+b.r;b.vy=Math.abs(b.vy)} }
    function burst(x,y,color,count){ for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=60+Math.random()*240;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.4+Math.random()*.45,size:2+Math.random()*4,color});} }
    function hit(brick,b){ bounce(b,brick);brick.hp--;state.score+=25;burst(b.x,b.y,brick.color,7);brick.element.style.transition="opacity .2s ease,filter .12s ease,transform .12s ease";brick.element.style.filter="brightness(1.8)";brick.element.style.transform="scale(.985)";setTimeout(()=>{if(brick.alive){brick.element.style.filter=originals.get(brick.element).filter;brick.element.style.transform=originals.get(brick.element).transform}},90);beep(220+Math.random()*100,.035,"square");if(brick.hp<=0){brick.alive=false;state.destroyed++;state.score+=100*brick.max;brick.element.style.opacity="0";brick.element.style.pointerEvents="none";burst(b.x,b.y,brick.color,20);if(Math.random()<.34&&!drops.some(d=>d.active))drops.push({x:b.x,y:b.y,w:44,h:23,vy:130,active:true});beep(110,.1,"sawtooth",.04);if(state.destroyed>=state.total)finish(true)}hud(); }
    function activateMulti(now){const source=balls[0]||ball(),speed=Math.hypot(source.vx,source.vy),base=Math.atan2(source.vy,source.vx);balls=[-.38,0,.38].map(offset=>{const next=ball(source.x,source.y,base+offset);next.vx=Math.cos(base+offset)*speed;next.vy=Math.sin(base+offset)*speed;return next});state.multiUntil=now+12000;powerEl.classList.add("on");state.score+=500;announce("MULTIBALL ×3",1000);beep(520,.16,"triangle",.05);hud();}
    function lose(){state.lives--;hud();beep(75,.28,"sawtooth",.05);if(state.lives<=0)return finish(false);announce(`${state.lives} ${state.lives===1?"LIFE":"LIVES"} LEFT`,900);state.multiUntil=0;powerEl.classList.remove("on");balls=[ball(paddle.x+paddle.width/2,paddle.y-18,-Math.PI*(.28+Math.random()*.44))];}
    function finish(won){state.over=true;state.running=false;root.querySelector("[data-end-kicker]").textContent=won?"PAGE CLEARED":"OUT OF BOUNDS";root.querySelector("[data-end-title]").innerHTML=won?"Nothing left<br><em>but pixels.</em>":"The page<br><em>survived.</em>";endEl.hidden=false;beep(won?660:90,.45,won?"triangle":"sawtooth",.055);}
    function update(dt,now){if(!state.running||state.paused||now<state.launchAt)return;if(keys.left)paddle.targetX-=760*dt;if(keys.right)paddle.targetX+=760*dt;paddle.targetX=Math.max(0,Math.min(width-paddle.width,paddle.targetX));paddle.x+=(paddle.targetX-paddle.x)*Math.min(1,dt*16);if(state.multiUntil){const remaining=Math.max(0,state.multiUntil-now);timerEl.style.transform=`scaleX(${remaining/12000})`;if(!remaining){balls=[balls[0]].filter(Boolean);state.multiUntil=0;powerEl.classList.remove("on");announce("BACK TO ONE")}}
      for(const b of balls){b.trail.unshift({x:b.x,y:b.y});if(b.trail.length>8)b.trail.pop();b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x-b.r<=0){b.x=b.r;b.vx=Math.abs(b.vx)}if(b.x+b.r>=width){b.x=width-b.r;b.vx=-Math.abs(b.vx)}if(b.y-b.r<=0){b.y=b.r;b.vy=Math.abs(b.vy)}if(b.vy>0&&collides(b,{x:paddle.x,y:paddle.y,w:paddle.width,h:paddle.height})){const impact=(b.x-(paddle.x+paddle.width/2))/(paddle.width/2),speed=Math.min(670,Math.hypot(b.vx,b.vy)*1.016),angle=impact*1.05-Math.PI/2;b.vx=Math.cos(angle)*speed;b.vy=Math.sin(angle)*speed;b.y=paddle.y-b.r-1;burst(b.x,paddle.y,theme.ball,5);beep(270)}for(const brick of bricks){if(brick.alive&&collides(b,brick)){hit(brick,b);break}}}
      balls=balls.filter(b=>b.y-b.r<height+22);if(!balls.length&&!state.over)lose();for(const drop of drops){if(!drop.active)continue;drop.y+=drop.vy*dt;if(collides({x:drop.x,y:drop.y,r:drop.w/2},{x:paddle.x,y:paddle.y,w:paddle.width,h:paddle.height})){drop.active=false;activateMulti(now)}else if(drop.y>height+30)drop.active=false}for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=260*dt;p.life-=dt}particles=particles.filter(p=>p.life>0);
    }
    function roundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
    function draw(now){ctx.clearRect(0,0,width,height);for(const brick of bricks){if(!brick.alive)continue;ctx.globalAlpha=.22+(brick.max-brick.hp)*.15;ctx.strokeStyle=brick.color;ctx.lineWidth=1;ctx.strokeRect(brick.x+.5,brick.y+.5,Math.max(0,brick.w-1),Math.max(0,brick.h-1))}ctx.globalAlpha=1;for(const b of balls){b.trail.forEach((p,i)=>{ctx.globalAlpha=(1-i/b.trail.length)*.13;ctx.fillStyle=theme.ball;ctx.beginPath();ctx.arc(p.x,p.y,b.r*(1-i*.06),0,Math.PI*2);ctx.fill()});ctx.globalAlpha=1;ctx.shadowColor=theme.ball;ctx.shadowBlur=22;ctx.fillStyle=theme.ball;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}ctx.fillStyle=theme.fg;ctx.shadowColor=theme.fg;ctx.shadowBlur=14;roundRect(paddle.x,paddle.y,paddle.width,paddle.height,paddle.height/2);ctx.fill();ctx.shadowBlur=0;for(const drop of drops){if(!drop.active)continue;ctx.fillStyle=theme.accent;roundRect(drop.x-drop.w/2,drop.y-drop.h/2,drop.w,drop.h,12);ctx.fill();ctx.fillStyle="#fff";ctx.font="700 11px ui-monospace,monospace";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("×3",drop.x,drop.y+1)}for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*1.8);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size)}ctx.globalAlpha=1;if(now<state.launchAt){messageEl.textContent="BREAK THE PAGE";messageEl.classList.add("show")}else if(messageEl.textContent==="BREAK THE PAGE"){messageEl.classList.remove("show")}}
    function frame(now){const dt=Math.min(.025,Math.max(0,(now-state.last)/1000));state.last=now;update(dt,now);draw(now);state.raf=requestAnimationFrame(frame);}
    function move(x){paddle.targetX=Math.max(0,Math.min(width-paddle.width,x-paddle.width/2));}
    function keyDown(event){if(["ArrowLeft","ArrowRight"," "].includes(event.key))event.preventDefault();if(event.key==="ArrowLeft"||event.key.toLowerCase()==="a")keys.left=true;if(event.key==="ArrowRight"||event.key.toLowerCase()==="d")keys.right=true;if(event.key===" "&&!state.over){state.paused=!state.paused;announce(state.paused?"PAUSED":"GO")}}
    function keyUp(event){if(event.key==="ArrowLeft"||event.key.toLowerCase()==="a")keys.left=false;if(event.key==="ArrowRight"||event.key.toLowerCase()==="d")keys.right=false;}
    function cleanup(){cancelAnimationFrame(state.raf);document.documentElement.style.overflow=oldOverflow;elements.forEach(element=>{const original=originals.get(element);Object.assign(element.style,original)});removeEventListener("resize",resize);removeEventListener("keydown",keyDown);removeEventListener("keyup",keyUp);host.remove();game=null;if(launcherHost)launcherHost.style.display="";}
    function restart(){elements.forEach(element=>{const original=originals.get(element);Object.assign(element.style,original)});state.running=true;state.paused=false;state.over=false;state.score=0;state.lives=3;state.destroyed=0;state.multiUntil=0;state.launchAt=performance.now()+650;drops=[];particles=[];bricks=[];buildBricks();balls=[ball()];endEl.hidden=true;powerEl.classList.remove("on");hud();}
    overlay.addEventListener("pointermove",event=>move(event.clientX));
    addEventListener("keydown",keyDown,{passive:false});addEventListener("keyup",keyUp);addEventListener("resize",resize);
    root.querySelector("[data-exit]").addEventListener("click",cleanup);
    root.querySelector("[data-sound]").addEventListener("click",event=>{state.sound=!state.sound;event.currentTarget.textContent=state.sound?"SOUND ON":"SOUND OFF";if(state.sound)beep(320)});
    root.querySelector("[data-again]").addEventListener("click",restart);
    resize();balls=[ball()];hud();announce("BREAK THE PAGE",850);state.raf=requestAnimationFrame(frame);
    return { destroy:cleanup, restart };
  }

  window.PageBreaker = { version:"1.0.0", start, destroy:() => game?.destroy() };
  if (settings.launcher) createLauncher();
  if (settings.autoStart) addEventListener("load", () => setTimeout(start, 350), { once:true });
})();
