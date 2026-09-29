(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const launcher = $("#launcher"), entryModal = $("#entry-modal"), loadingModal = $("#loading-modal"), form = $("#url-form"), input = $("#url-input"), errorEl = $("#error-message");
  const loadingHost = $("#loading-host"), loadingLabel = $("#loading-label"), loadingPercent = $("#loading-percent"), loadingFill = $("#loading-fill"), loadingDetail = $("#loading-detail");
  const stage = $("#game-stage"), frame = $("#site-frame"), canvas = $("#game-canvas"), ctx = canvas.getContext("2d");
  const trackerHost = $("#tracker-host"), trackerPercent = $("#tracker-percent"), trackerFill = $("#tracker-fill"), trackerCount = $("#tracker-count"), trackerDepth = $("#tracker-depth");
  const scoreEl = $("#score"), livesEl = $("#lives"), messageEl = $("#game-message"), scrollCue = $("#scroll-cue"), powerPanel = $("#power-panel"), powerFill = $("#power-fill");
  const endModal = $("#end-modal"), endHost = $("#end-host"), endKicker = $("#end-kicker"), endTitle = $("#end-title"), endScore = $("#end-score");
  const embedModal = $("#embed-modal"), embedCode = $("#embed-code"), embedCopy = $("#embed-copy");
  let audio = null, game = null, loadingTimer = null;

  for (let i = 0; i < 90; i += 1) {
    const brick = document.createElement("i");
    brick.className = "brick";
    $("#brick-field").append(brick);
  }

  function normalize(value) {
    const text = value.trim();
    if (!text) throw new Error("Enter a website address.");
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!url.hostname.includes(".") && url.hostname !== "localhost") throw new Error("Enter a complete website address.");
    url.hash = "";
    return url;
  }

  function ensureAudio() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  }

  function tone(frequency, duration = .05, type = "square", volume = .03, endFrequency = frequency) {
    if (!game?.sound && game) return;
    ensureAudio();
    const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now); oscillator.stop(now + duration);
  }

  function noise(duration = .08, volume = .035) {
    if (!game?.sound && game) return;
    ensureAudio();
    const length = Math.floor(audio.sampleRate * duration), buffer = audio.createBuffer(1, length, audio.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = audio.createBufferSource(), gain = audio.createGain();
    source.buffer = buffer; gain.gain.value = volume; source.connect(gain).connect(audio.destination); source.start();
  }

  function updateLoading(value, label, detail) {
    const amount = Math.max(0, Math.min(100, Math.round(value)));
    loadingPercent.textContent = `${amount}%`;
    loadingFill.style.width = `${amount}%`;
    if (label) loadingLabel.textContent = label;
    if (detail) loadingDetail.textContent = detail;
  }

  function startLoading(url) {
    ensureAudio();
    errorEl.textContent = "";
    entryModal.hidden = true;
    loadingModal.hidden = false;
    loadingHost.textContent = url.hostname.toUpperCase();
    let progress = 4;
    updateLoading(progress, "CONTACTING THE WEBSITE", "Opening a safe copy of the page…");
    clearInterval(loadingTimer);
    loadingTimer = setInterval(() => {
      progress = Math.min(88, progress + Math.max(1, (90 - progress) * .08));
      if (progress > 66) updateLoading(progress, "BUILDING THE LEVEL", "Turning page content into breakable targets…");
      else if (progress > 32) updateLoading(progress, "READING THE PAGE", "Mapping headings, images, cards and controls…");
      else updateLoading(progress);
    }, 180);
  }

  function sanitize(html, finalUrl) {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    $$("form", parsed).forEach((form) => form.replaceWith(...form.childNodes));
    $$("script,noscript,frame,object,embed,portal,meta[http-equiv],link[rel='modulepreload'],link[rel='preload'][as='script']", parsed).forEach((node) => node.remove());
    $$("*", parsed).forEach((element) => {
      [...element.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase(), value = attribute.value.trim().toLowerCase();
        if (name.startsWith("on") || name === "nonce" || name === "integrity" || name === "formaction" || ((name === "href" || name === "src" || name === "action") && value.startsWith("javascript:"))) element.removeAttribute(attribute.name);
      });
      element.removeAttribute("target");
      if (element.matches("input,textarea,select,button")) element.setAttribute("tabindex", "-1");
      if (element.matches("iframe")) { element.setAttribute("sandbox", ""); element.setAttribute("loading", "eager"); element.setAttribute("referrerpolicy", "no-referrer"); }
    });
    $$('img,source,video', parsed).forEach((element) => {
      const lazySource = element.getAttribute("data-src") || element.getAttribute("data-lazy-src") || element.getAttribute("data-original");
      const lazySet = element.getAttribute("data-srcset") || element.getAttribute("data-lazy-srcset");
      if (lazySource) element.setAttribute("src", lazySource);
      if (lazySet) element.setAttribute("srcset", lazySet);
      element.removeAttribute("loading");
      if (element.matches("video")) { element.setAttribute("preload", "auto"); element.setAttribute("playsinline", ""); }
    });
    $$('[data-bg],[data-background-image],[data-lazy-background]', parsed).forEach((element) => {
      const image = element.getAttribute("data-bg") || element.getAttribute("data-background-image") || element.getAttribute("data-lazy-background");
      if (image) element.style.backgroundImage = image.startsWith("url(") ? image : `url("${image.replaceAll('"', '%22')}")`;
    });
    $$("details", parsed).forEach((element) => element.setAttribute("open", ""));
    const base = parsed.createElement("base");
    base.href = finalUrl;
    parsed.head.prepend(base);
    const style = parsed.createElement("style");
    style.textContent = `html{scroll-behavior:auto!important}body{min-height:100vh!important}*{animation-play-state:paused!important}a,button,input,textarea,select{cursor:default!important}iframe{pointer-events:none!important}[data-pb-destroyed]{pointer-events:none!important}`;
    parsed.head.append(style);
    return `<!doctype html>${parsed.documentElement.outerHTML}`;
  }

  async function settlePageAssets(doc) {
    const waits = [];
    if (doc.fonts?.ready) waits.push(doc.fonts.ready.catch(() => {}));
    $$('img', doc).forEach((image) => {
      image.loading = "eager";
      if (image.decode) waits.push(image.decode().catch(() => {}));
    });
    $$('video,audio', doc).forEach((media) => { try { media.load(); } catch {} });
    await Promise.race([Promise.allSettled(waits), new Promise((resolve) => setTimeout(resolve, 6000))]);
  }

  async function loadWebsite(url) {
    startLoading(url);
    try {
      const response = await fetch(`/proxy?url=${encodeURIComponent(url.href)}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "The website could not be loaded.");
      }
      const html = await response.text(), finalUrl = response.headers.get("x-page-url") || url.href;
      updateLoading(94, "RENDERING THE PAGE", "Preparing the first section…");
      frame.srcdoc = sanitize(html, finalUrl);
      await new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
      updateLoading(97, "LOADING EVERY ASSET", "Waiting for fonts, images and media…");
      await settlePageAssets(frame.contentDocument);
      await new Promise((resolve) => setTimeout(resolve, 180));
      updateLoading(100, "LEVEL READY", "Every visible piece is now breakable.");
      clearInterval(loadingTimer);
      await new Promise((resolve) => setTimeout(resolve, 260));
      beginGame(new URL(finalUrl));
    } catch (error) {
      clearInterval(loadingTimer);
      loadingModal.hidden = true;
      entryModal.hidden = false;
      errorEl.textContent = error.message || "This website could not be loaded.";
      input.focus();
      tone(120, .25, "sawtooth", .035, 65);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try { loadWebsite(normalize(input.value)); }
    catch (error) { errorEl.textContent = error.message; input.focus(); }
  });
  $$('[data-demo]').forEach((button) => button.addEventListener("click", () => { input.value = button.dataset.demo; form.requestSubmit(); }));
  $("#embed-open").addEventListener("click", () => {
    embedCode.value = `<iframe src="${location.origin}" title="Page Breaker" allow="autoplay" style="width:100%;height:720px;border:0"></iframe>`;
    entryModal.hidden = true; embedModal.hidden = false; embedCode.focus(); embedCode.select();
  });
  $("#embed-close").addEventListener("click", () => { embedModal.hidden = true; entryModal.hidden = false; });
  embedCopy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(embedCode.value); }
    catch { embedCode.focus(); embedCode.select(); document.execCommand("copy"); }
    embedCopy.textContent = "COPIED"; tone(540, .12, "triangle", .04, 740); setTimeout(() => { embedCopy.textContent = "COPY CODE"; }, 1100);
  });

  const presetUrl = new URLSearchParams(location.search).get("url");
  if (presetUrl) { input.value = presetUrl; try { loadWebsite(normalize(presetUrl)); } catch (error) { errorEl.textContent = error.message; } }

  function beginGame(url) {
    const doc = frame.contentDocument, win = frame.contentWindow;
    if (!doc?.body) throw new Error("The page did not render.");
    launcher.hidden = true; stage.hidden = false; loadingModal.hidden = true;
    trackerHost.textContent = url.hostname.toUpperCase(); endHost.textContent = url.hostname.toUpperCase();
    doc.addEventListener("click", (event) => event.preventDefault(), true);
    doc.addEventListener("submit", (event) => event.preventDefault(), true);
    const theme = detectTheme(doc);
    game = createGame(doc, win, url, theme);
  }

  function parseColor(value) {
    const numbers = value?.match(/[\d.]+/g);
    if (!numbers || numbers.length < 3) return null;
    const [r, g, b, a = 1] = numbers.map(Number);
    return { r, g, b, a };
  }
  function luminance({ r, g, b }) {
    const c = [r, g, b].map((v) => { const x = v / 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  }
  function detectTheme(doc) {
    const view = doc.defaultView || window;
    const raw = parseColor(view.getComputedStyle(doc.body).backgroundColor) || parseColor(view.getComputedStyle(doc.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    const bg = raw.a < 1 ? composite(raw, { r: 255, g: 255, b: 255, a: 1 }) : raw;
    const dark = luminance(bg) < .38;
    return { dark, ball: dark ? "#f4ff38" : "#5367ff", paddle: dark ? "#ffffff" : "#13151a" };
  }

  function composite(top, bottom) {
    const alpha = top.a + bottom.a * (1 - top.a);
    if (!alpha) return { r: 255, g: 255, b: 255, a: 1 };
    return { r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / alpha, g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / alpha, b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / alpha, a: alpha };
  }

  function backgroundAt(doc, win, x, y) {
    let element = doc.elementFromPoint(Math.max(0, Math.min(win.innerWidth - 1, x)), Math.max(0, Math.min(win.innerHeight - 1, y)));
    const layers = [];
    while (element && element.nodeType === 1) { const color = parseColor(win.getComputedStyle(element).backgroundColor); if (color?.a) layers.unshift(color); element = element.parentElement; }
    let result = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers) result = composite(layer, result);
    return result;
  }

  function contrastColor(background) {
    const l = luminance(background);
    const blackContrast = (l + .05) / .05, whiteContrast = 1.05 / (l + .05);
    return whiteContrast >= blackContrast ? "#ffffff" : "#090a0e";
  }

  function createGame(doc, win, url, theme) {
    const state = { running: true, paused: false, over: false, sound: true, score: 0, lives: 3, destroyed: 0, last: performance.now(), launchAt: performance.now() + 900, multiUntil: 0, scrollLevel: 1, advanceTimer: null, raf: 0 };
    const keys = { left: false, right: false };
    const paddle = { x: innerWidth / 2 - 64, targetX: innerWidth / 2 - 64, y: innerHeight - 48, width: 128, height: 13 };
    let width = innerWidth, height = innerHeight, dpr = 1, balls = [], particles = [], debris = [], drops = [], bricks = [], visible = [], scrollQueued = false, paddleColor = theme.paddle;

    function exposeTextFragments() {
      const walker = doc.createTreeWalker(doc.body, doc.defaultView.NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode, parent = node.parentElement;
        if (!parent || !node.nodeValue.trim() || parent.closest("script,style,noscript,svg,canvas,textarea,option,.pb-text-fragment") || parent.namespaceURI !== "http://www.w3.org/1999/xhtml") continue;
        nodes.push(node);
      }
      for (const node of nodes) {
        const wrapper = doc.createElement("span");
        wrapper.className = "pb-text-fragment";
        wrapper.style.setProperty("display", "inline", "important");
        wrapper.style.setProperty("box-decoration-break", "clone");
        wrapper.style.setProperty("-webkit-box-decoration-break", "clone");
        node.parentNode.replaceChild(wrapper, node); wrapper.append(node);
      }
    }

    function isPainted(style) {
      const background = parseColor(style.backgroundColor);
      return Boolean(background?.a || style.backgroundImage !== "none" || style.boxShadow !== "none" || style.filter !== "none" || style.content && style.content !== "none" && style.content !== "normal");
    }

    function borderTargets(element, style, rect, existing) {
      if (existing || rect.width < 8 || rect.height < 1) return [];
      const sides = ["top", "right", "bottom", "left"];
      return sides.flatMap((side) => {
        const cap = side[0].toUpperCase() + side.slice(1), size = parseFloat(style[`border${cap}Width`]) || 0;
        if (size < .75 || style[`border${cap}Style`] === "none" || parseColor(style[`border${cap}Color`])?.a === 0) return [];
        return [{ element, kind: `border-${side}`, thickness: Math.max(1, size), borderColor: style[`border${cap}Color`] }];
      });
    }

    function targetRect(brick) {
      const rect = brick.element.getBoundingClientRect();
      if (brick.kind === "border-top") return { x: rect.left, y: rect.top, w: rect.width, h: brick.thickness };
      if (brick.kind === "border-bottom") return { x: rect.left, y: rect.bottom - brick.thickness, w: rect.width, h: brick.thickness };
      if (brick.kind === "border-left") return { x: rect.left, y: rect.top, w: brick.thickness, h: rect.height };
      if (brick.kind === "border-right") return { x: rect.right - brick.thickness, y: rect.top, w: brick.thickness, h: rect.height };
      return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    }

    function indexPage() {
      exposeTextFragments();
      const explicit = "img,picture,video,audio,iframe,svg,canvas,hr,button,input,textarea,select,progress,meter,summary,a,[role='img'],[role='button'],[data-pagebreaker-brick],.pb-text-fragment";
      const records = [];
      $$("body *", doc).forEach((element) => {
        if (element.closest("script,style,noscript") || element.matches("br,source,track,wbr")) return;
        const rect = element.getBoundingClientRect(), style = win.getComputedStyle(element);
        if (rect.width < .75 || rect.height < .75 || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < .02) return;
        const pseudoBefore = win.getComputedStyle(element, "::before"), pseudoAfter = win.getComputedStyle(element, "::after");
        const pseudoPainted = [pseudoBefore, pseudoAfter].some((pseudo) => pseudo.content !== "none" && pseudo.content !== "normal" && (pseudo.content !== '""' || isPainted(pseudo)));
        const atomic = element.matches(explicit) || (!element.children.length && (isPainted(style) || element.textContent.trim() || pseudoPainted));
        if (atomic) records.push({ element, kind: "element" });
        records.push(...borderTargets(element, style, rect, atomic));
      });
      const depth = (element) => { let count = 0; while (element?.parentElement) { count += 1; element = element.parentElement; } return count; };
      records.sort((a, b) => depth(b.element) - depth(a.element));
      bricks = records.map((record, index) => {
        const rect = targetRect(record), area = rect.w * rect.h, color = record.borderColor || (index % 3 === 0 ? theme.ball : index % 3 === 1 ? "#ff7138" : "#6670ff");
        const hp = record.kind === "element" && area > 100000 ? 3 : record.kind === "element" && area > 32000 ? 2 : 1;
        return { ...record, index, hp, maxHp: hp, alive: true, original: record.element.style.cssText, rect: null, color };
      });
      updateVisible(); updateHud();
    }

    function updateVisible() {
      visible = [];
      for (const brick of bricks) {
        if (!brick.alive) continue;
        const rect = targetRect(brick);
        if (rect.y + rect.h > 0 && rect.y < height && rect.x + rect.w > 0 && rect.x < width) {
          brick.rect = rect;
          visible.push(brick);
        }
      }
      state.scrollLevel = Math.max(1, Math.floor(win.scrollY / Math.max(1, height * .78)) + 1);
      trackerDepth.textContent = `LEVEL ${state.scrollLevel}`;
      if (state.running && !state.over && visible.length === 0 && bricks.some((brick) => brick.alive)) queueNextSection();
    }

    function queueNextSection() {
      if (scrollQueued) return;
      scrollQueued = true; scrollCue.classList.add("show");
      clearTimeout(state.advanceTimer);
      state.advanceTimer = setTimeout(() => {
        const next = bricks.find((brick) => brick.alive);
        if (next) next.element.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        setTimeout(() => { scrollQueued = false; scrollCue.classList.remove("show"); updateVisible(); }, reduceMotion ? 40 : 480);
      }, 650);
    }

    function updateHud() {
      const total = bricks.length, percent = total ? Math.round(state.destroyed / total * 100) : 0;
      trackerPercent.textContent = `${percent}%`; trackerFill.style.width = `${percent}%`; trackerCount.textContent = `${state.destroyed} / ${total}`;
      scoreEl.textContent = String(state.score).padStart(6, "0"); livesEl.innerHTML = "";
      for (let i = 0; i < 3; i += 1) { const dot = document.createElement("i"); dot.className = `life${i >= state.lives ? " lost" : ""}`; livesEl.append(dot); }
    }

    function resize() {
      width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paddle.width = Math.max(92, Math.min(144, width * .12)); paddle.y = height - 48; paddle.x = Math.min(paddle.x, width - paddle.width); paddle.targetX = paddle.x; updateVisible();
    }
    function makeBall(x = width / 2, y = paddle.y - 18, angle = -Math.PI * .64) { const speed = Math.max(360, Math.min(530, width * .38)); return { x, y, r: width < 640 ? 7 : 8, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, trail: [] }; }
    function announce(text, duration = 750) { messageEl.textContent = text; messageEl.classList.add("show"); clearTimeout(announce.timer); announce.timer = setTimeout(() => messageEl.classList.remove("show"), duration); }
    function collide(ball, rect) { const x = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w)), y = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h)), dx = ball.x - x, dy = ball.y - y; return dx * dx + dy * dy <= ball.r * ball.r; }
    function bounce(ball, rect) { const d = [Math.abs(ball.x + ball.r - rect.x), Math.abs(ball.x - ball.r - rect.x - rect.w), Math.abs(ball.y + ball.r - rect.y), Math.abs(ball.y - ball.r - rect.y - rect.h)], m = Math.min(...d); if (m === d[0]) { ball.x = rect.x - ball.r; ball.vx = -Math.abs(ball.vx); } else if (m === d[1]) { ball.x = rect.x + rect.w + ball.r; ball.vx = Math.abs(ball.vx); } else if (m === d[2]) { ball.y = rect.y - ball.r; ball.vy = -Math.abs(ball.vy); } else { ball.y = rect.y + rect.h + ball.r; ball.vy = Math.abs(ball.vy); } }
    function burst(x, y, color, count, force = 1) { for (let i = 0; i < count; i += 1) { const angle = Math.random() * Math.PI * 2, speed = (70 + Math.random() * 250) * force; particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .5 + Math.random() * .55, size: 2 + Math.random() * 6, color, rotation: Math.random() * Math.PI }); } }

    function hitBrick(brick, ball) {
      bounce(ball, brick.rect); brick.hp -= 1; state.score += 25; burst(ball.x, ball.y, brick.color, 8); tone(245 + Math.random() * 90, .045, "square", .026); noise(.035, .018);
      if (brick.kind === "element" && brick.element.animate && !reduceMotion) brick.element.animate([{ transform: "translate3d(0,0,0) rotate(0)", filter: "brightness(1)" }, { transform: `translate3d(${ball.vx > 0 ? 5 : -5}px,-2px,0) rotate(${ball.vx > 0 ? 1 : -1}deg)`, filter: "brightness(1.8)" }, { transform: "translate3d(0,0,0) rotate(0)", filter: "brightness(1)" }], { duration: 120, easing: "cubic-bezier(.23,1,.32,1)" });
      if (brick.hp <= 0) destroyBrick(brick, ball); else { brick.element.style.outline = `1px solid ${brick.color}`; brick.element.style.outlineOffset = "2px"; }
      updateHud();
    }

    function destroyBrick(brick, ball) {
      brick.alive = false; state.destroyed += 1; state.score += brick.maxHp * 125; brick.element.dataset.pbDestroyed = "true";
      if (brick.kind === "element") {
        for (const nested of bricks) if (nested.alive && nested.element !== brick.element && brick.element.contains(nested.element)) { nested.alive = false; state.destroyed += 1; state.score += nested.maxHp * 125; }
      }
      const direction = ball.vx >= 0 ? 1 : -1, fall = Math.min(260, 120 + brick.rect.h), rotation = direction * (8 + Math.random() * 15);
      debris.push({ x: brick.rect.x, y: brick.rect.y, w: Math.max(2, brick.rect.w), h: Math.max(2, brick.rect.h), color: brick.color, vx: direction * (45 + Math.random() * 70), vy: 35 + Math.random() * 45, rotation: 0, vr: direction * (2.5 + Math.random() * 3), life: reduceMotion ? .18 : .7 });
      if (brick.kind === "element") {
        const animation = brick.element.animate?.([{ transform: "translate3d(0,0,0) rotate(0deg)", opacity: 1 }, { transform: `translate3d(${direction * (30 + Math.random() * 45)}px,${fall}px,0) rotate(${rotation}deg)`, opacity: 0 }], { duration: reduceMotion ? 180 : 620, easing: "cubic-bezier(.23,1,.32,1)", fill: "forwards" });
        if (animation) animation.onfinish = () => { brick.element.style.visibility = "hidden"; }; else brick.element.style.visibility = "hidden";
      } else {
        const side = brick.kind.split("-")[1], cap = side[0].toUpperCase() + side.slice(1);
        brick.element.style[`border${cap}Color`] = "transparent";
      }
      burst(ball.x, ball.y, brick.color, 24, 1.15); tone(130, .11, "sawtooth", .04, 82); noise(.11, .05);
      if (Math.random() < .32 && !drops.some((drop) => drop.active)) drops.push({ x: ball.x, y: ball.y, w: 46, h: 24, vy: 135, active: true });
      if (state.destroyed >= bricks.length) finish(true); else setTimeout(updateVisible, 650);
    }

    function paddleHit(ball) { const impact = (ball.x - paddle.x - paddle.width / 2) / (paddle.width / 2), speed = Math.min(690, Math.hypot(ball.vx, ball.vy) * 1.016), angle = impact * 1.08 - Math.PI / 2; ball.vx = Math.cos(angle) * speed; ball.vy = Math.sin(angle) * speed; ball.y = paddle.y - ball.r - 1; burst(ball.x, paddle.y, paddleColor, 6); tone(310, .055, "square", .035, 250); }
    function activateMulti(now) { const source = balls[0] || makeBall(), speed = Math.hypot(source.vx, source.vy), base = Math.atan2(source.vy, source.vx); balls = [-.38, 0, .38].map((offset) => { const next = makeBall(source.x, source.y, base + offset); next.vx = Math.cos(base + offset) * speed; next.vy = Math.sin(base + offset) * speed; return next; }); state.multiUntil = now + 12000; powerPanel.classList.add("on"); state.score += 500; announce("MULTIBALL ×3", 950); tone(520, .2, "triangle", .055, 780); updateHud(); }
    function loseBall() { state.lives -= 1; updateHud(); tone(220, .38, "sawtooth", .06, 65); noise(.18, .025); if (state.lives <= 0) return finish(false); announce(`${state.lives} ${state.lives === 1 ? "LIFE" : "LIVES"} LEFT`, 900); state.multiUntil = 0; powerPanel.classList.remove("on"); balls = [makeBall(paddle.x + paddle.width / 2, paddle.y - 18, -Math.PI * (.28 + Math.random() * .44))]; }
    function finish(won) { state.over = true; state.running = false; endKicker.textContent = won ? "WEBSITE DESTROYED" : "OUT OF BOUNDS"; endTitle.innerHTML = won ? "NOTHING LEFT<br>BUT PIXELS." : "THE PAGE<br>SURVIVED."; endScore.textContent = `FINAL SCORE ${String(state.score).padStart(6, "0")}`; endModal.hidden = false; tone(won ? 660 : 95, .48, won ? "triangle" : "sawtooth", .06, won ? 920 : 55); }

    function update(dt, now) {
      if (!state.running || state.paused || now < state.launchAt) return;
      if (keys.left) paddle.targetX -= 840 * dt; if (keys.right) paddle.targetX += 840 * dt;
      paddle.targetX = Math.max(0, Math.min(width - paddle.width, paddle.targetX)); paddle.x += (paddle.targetX - paddle.x) * Math.min(1, dt * 17);
      if (state.multiUntil) { const left = Math.max(0, state.multiUntil - now); powerFill.style.transform = `scaleX(${left / 12000})`; if (!left) { balls = [balls[0]].filter(Boolean); state.multiUntil = 0; powerPanel.classList.remove("on"); announce("BACK TO ONE"); } }
      const step = dt / 2;
      for (let pass = 0; pass < 2; pass += 1) for (const ball of balls) {
        if (pass === 0) { ball.trail.unshift({ x: ball.x, y: ball.y }); if (ball.trail.length > 9) ball.trail.pop(); }
        ball.x += ball.vx * step; ball.y += ball.vy * step;
        if (ball.x - ball.r <= 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); tone(170); }
        if (ball.x + ball.r >= width) { ball.x = width - ball.r; ball.vx = -Math.abs(ball.vx); tone(170); }
        if (ball.y - ball.r <= 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); tone(185); }
        if (ball.vy > 0 && collide(ball, { x: paddle.x, y: paddle.y, w: paddle.width, h: paddle.height })) paddleHit(ball);
        for (const brick of visible) if (brick.alive && brick.rect && collide(ball, brick.rect)) { hitBrick(brick, ball); break; }
      }
      balls = balls.filter((ball) => ball.y - ball.r < height + 24); if (!balls.length && !state.over) loseBall();
      for (const drop of drops) { if (!drop.active) continue; drop.y += drop.vy * dt; if (collide({ x: drop.x, y: drop.y, r: drop.w / 2 }, { x: paddle.x, y: paddle.y, w: paddle.width, h: paddle.height })) { drop.active = false; activateMulti(now); } else if (drop.y > height + 35) drop.active = false; }
      for (const particle of particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 310 * dt; particle.rotation += dt * 5; particle.life -= dt; }
      particles = particles.filter((particle) => particle.life > 0);
      for (const piece of debris) { piece.x += piece.vx * dt; piece.y += piece.vy * dt; piece.vy += 520 * dt; piece.rotation += piece.vr * dt; piece.life -= dt; }
      debris = debris.filter((piece) => piece.life > 0);
    }

    function draw(now) {
      ctx.clearRect(0, 0, width, height);
      const paddleSamples = [.2, .5, .8].map((ratio) => contrastColor(backgroundAt(doc, win, paddle.x + paddle.width * ratio, paddle.y + paddle.height / 2)));
      paddleColor = paddleSamples.filter((color) => color === "#ffffff").length >= 2 ? "#ffffff" : "#090a0e";
      for (const brick of visible) if (brick.alive && brick.rect) { ctx.globalAlpha = .2 + (brick.maxHp - brick.hp) * .13; ctx.strokeStyle = brick.color; ctx.lineWidth = 1; ctx.strokeRect(brick.rect.x + .5, brick.rect.y + .5, Math.max(0, brick.rect.w - 1), Math.max(0, brick.rect.h - 1)); }
      ctx.globalAlpha = 1;
      for (const ball of balls) { const color = contrastColor(backgroundAt(doc, win, ball.x, ball.y)), edge = color === "#ffffff" ? "#090a0e" : "#ffffff"; ball.trail.forEach((point, index) => { ctx.globalAlpha = (1 - index / ball.trail.length) * .16; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(point.x, point.y, ball.r * (1 - index * .055), 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1; ctx.shadowColor = edge; ctx.shadowBlur = 12; ctx.fillStyle = color; ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; }
      const paddleEdge = paddleColor === "#ffffff" ? "#090a0e" : "#ffffff"; ctx.fillStyle = paddleColor; ctx.strokeStyle = paddleEdge; ctx.lineWidth = 1.5; ctx.shadowColor = paddleEdge; ctx.shadowBlur = 10; ctx.beginPath(); ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, paddle.height / 2); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      for (const drop of drops) if (drop.active) { ctx.fillStyle = "#6558ff"; ctx.beginPath(); ctx.roundRect(drop.x - drop.w / 2, drop.y - drop.h / 2, drop.w, drop.h, 12); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "700 11px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("×3", drop.x, drop.y + 1); }
      for (const piece of debris) { ctx.save(); ctx.globalAlpha = Math.max(0, piece.life * 1.45); ctx.translate(piece.x + piece.w / 2, piece.y + piece.h / 2); ctx.rotate(piece.rotation); ctx.fillStyle = piece.color; ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, Math.min(piece.h, 12)); ctx.restore(); }
      for (const particle of particles) { ctx.save(); ctx.globalAlpha = Math.max(0, particle.life * 1.65); ctx.translate(particle.x, particle.y); ctx.rotate(particle.rotation); ctx.fillStyle = particle.color; ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size); ctx.restore(); }
      ctx.globalAlpha = 1;
      if (now < state.launchAt) { messageEl.textContent = "BREAK THE PAGE"; messageEl.classList.add("show"); } else if (messageEl.textContent === "BREAK THE PAGE") messageEl.classList.remove("show");
    }
    function frameLoop(now) { const dt = Math.min(.024, Math.max(0, (now - state.last) / 1000)); state.last = now; update(dt, now); draw(now); state.raf = requestAnimationFrame(frameLoop); }
    function move(x) { paddle.targetX = Math.max(0, Math.min(width - paddle.width, x - paddle.width / 2)); }
    function keyDown(event) { if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault(); if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.left = true; if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.right = true; if (event.key === " " && !state.over) togglePause(); }
    function keyUp(event) { if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.left = false; if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.right = false; }
    function togglePause() { state.paused = !state.paused; $("#pause-button").textContent = state.paused ? "RESUME" : "PAUSE"; announce(state.paused ? "PAUSED" : "GO"); }
    function cleanup(showLauncher = true) { cancelAnimationFrame(state.raf); clearTimeout(state.advanceTimer); removeEventListener("resize", resize); removeEventListener("keydown", keyDown); removeEventListener("keyup", keyUp); win.removeEventListener("scroll", scrollListener); win.removeEventListener("keydown", keyDown); win.removeEventListener("keyup", keyUp); stage.hidden = true; endModal.hidden = true; frame.srcdoc = ""; game = null; if (showLauncher) { launcher.hidden = false; entryModal.hidden = false; input.focus(); } }
    function restart() { cancelAnimationFrame(state.raf); bricks.forEach((brick) => { brick.element.getAnimations().forEach((animation) => animation.cancel()); brick.element.style.cssText = brick.original; delete brick.element.dataset.pbDestroyed; }); state.running = true; state.paused = false; state.over = false; state.score = 0; state.lives = 3; state.destroyed = 0; state.multiUntil = 0; state.launchAt = performance.now() + 750; state.last = performance.now(); particles = []; debris = []; drops = []; balls = [makeBall()]; endModal.hidden = true; powerPanel.classList.remove("on"); win.scrollTo(0, 0); indexPage(); state.raf = requestAnimationFrame(frameLoop); }

    const scrollListener = () => requestAnimationFrame(updateVisible);
    frame.contentDocument.addEventListener("pointermove", (event) => move(event.clientX));
    win.addEventListener("scroll", scrollListener, { passive: true }); win.addEventListener("keydown", keyDown, { passive: false }); win.addEventListener("keyup", keyUp);
    addEventListener("resize", resize); addEventListener("keydown", keyDown, { passive: false }); addEventListener("keyup", keyUp);
    $("#sound-button").onclick = () => { state.sound = !state.sound; $("#sound-button").textContent = state.sound ? "SOUND ON" : "SOUND OFF"; if (state.sound) tone(320); };
    $("#pause-button").onclick = togglePause; $("#exit-button").onclick = () => cleanup(true); $("#restart-button").onclick = restart; $("#new-site-button").onclick = () => cleanup(true);
    resize(); indexPage(); balls = [makeBall()]; announce("BREAK THE PAGE", 900); state.raf = requestAnimationFrame(frameLoop);
    return { get sound() { return state.sound; }, cleanup, restart };
  }
})();
