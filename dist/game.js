(() => {
  "use strict";

  const canvas = document.querySelector("#game-canvas");
  const ctx = canvas.getContext("2d");
  const introPanel = document.querySelector("#intro-panel");
  const endPanel = document.querySelector("#end-panel");
  const startButton = document.querySelector("#start-button");
  const restartButton = document.querySelector("#restart-button");
  const scoreEl = document.querySelector("#score");
  const progressEl = document.querySelector("#progress");
  const livesEl = document.querySelector("#lives");
  const messageEl = document.querySelector("#game-message");
  const soundButton = document.querySelector("#sound-button");
  const powerTimer = document.querySelector("#power-timer");
  const timerFill = document.querySelector("#timer-fill");
  const finalScore = document.querySelector("#final-score");
  const endKicker = document.querySelector("#end-kicker");
  const endTitle = document.querySelector("#end-title");
  const targets = [...document.querySelectorAll(".breaker-target")];

  const COLORS = ["#dfff00", "#7b61ff", "#2f66ff", "#f3f1e8"];
  const state = {
    started: false,
    paused: false,
    over: false,
    score: 0,
    lives: 3,
    destroyed: 0,
    total: 0,
    lastTime: 0,
    shake: 0,
    sound: true,
    multiballUntil: 0,
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let audioContext = null;
  let balls = [];
  let bricks = [];
  let particles = [];
  let drops = [];
  const paddle = { x: 0, y: 0, width: 128, height: 14, targetX: 0, speed: 950 };
  const keys = { left: false, right: false };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paddle.y = height - 62;
    paddle.width = Math.max(92, Math.min(144, width * 0.12));
    paddle.x = Math.min(Math.max(0, paddle.x), width - paddle.width);
    paddle.targetX = paddle.x;
    buildBricks();
  }

  function buildBricks() {
    bricks = targets.map((element, index) => {
      const rect = element.getBoundingClientRect();
      const existing = bricks.find((brick) => brick.element === element);
      const hp = Number(element.dataset.hp || 1);
      return {
        element,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        maxHp: hp,
        hp: existing ? existing.hp : hp,
        alive: existing ? existing.alive : true,
        points: Number(element.dataset.points || 100),
        color: COLORS[index % COLORS.length],
      };
    });
    state.total = bricks.length;
  }

  function makeBall(x = width / 2, y = paddle.y - 18, angle = -Math.PI / 3) {
    const speed = Math.max(360, Math.min(520, width * 0.37));
    return { x, y, radius: width < 720 ? 7 : 8, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, trail: [] };
  }

  function resetGame() {
    state.started = false;
    state.paused = false;
    state.over = false;
    state.score = 0;
    state.lives = 3;
    state.destroyed = 0;
    state.multiballUntil = 0;
    particles = [];
    drops = [];
    targets.forEach((target) => target.classList.remove("target-hit", "target-destroyed"));
    buildBricks();
    bricks.forEach((brick) => { brick.hp = brick.maxHp; brick.alive = true; });
    paddle.x = (width - paddle.width) / 2;
    paddle.targetX = paddle.x;
    balls = [makeBall()];
    endPanel.hidden = true;
    introPanel.hidden = false;
    updateHud();
  }

  function startGame() {
    ensureAudio();
    introPanel.hidden = true;
    endPanel.hidden = true;
    state.started = true;
    state.paused = false;
    state.lastTime = performance.now();
    balls = [makeBall(paddle.x + paddle.width / 2, paddle.y - 18, -Math.PI * (0.28 + Math.random() * 0.44))];
    announce("BREAK THE PAGE");
  }

  function updateHud() {
    scoreEl.textContent = String(state.score).padStart(6, "0");
    progressEl.textContent = `${Math.round((state.destroyed / Math.max(1, state.total)) * 100)}% CLEARED`;
    livesEl.innerHTML = "";
    for (let i = 0; i < 3; i += 1) {
      const life = document.createElement("span");
      life.className = `life${i >= state.lives ? " lost" : ""}`;
      livesEl.append(life);
    }
  }

  function ensureAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
  }

  function beep(frequency, duration = 0.05, type = "sine", volume = 0.035) {
    if (!state.sound || !audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function announce(text) {
    messageEl.textContent = text;
    messageEl.classList.remove("show");
    void messageEl.offsetWidth;
    messageEl.classList.add("show");
  }

  function circleRect(ball, rect) {
    const closestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.height));
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    return dx * dx + dy * dy <= ball.radius * ball.radius;
  }

  function bounceFromRect(ball, rect) {
    const left = Math.abs(ball.x + ball.radius - rect.x);
    const right = Math.abs(ball.x - ball.radius - (rect.x + rect.width));
    const top = Math.abs(ball.y + ball.radius - rect.y);
    const bottom = Math.abs(ball.y - ball.radius - (rect.y + rect.height));
    const min = Math.min(left, right, top, bottom);
    if (min === left) { ball.x = rect.x - ball.radius; ball.vx = -Math.abs(ball.vx); }
    else if (min === right) { ball.x = rect.x + rect.width + ball.radius; ball.vx = Math.abs(ball.vx); }
    else if (min === top) { ball.y = rect.y - ball.radius; ball.vy = -Math.abs(ball.vy); }
    else { ball.y = rect.y + rect.height + ball.radius; ball.vy = Math.abs(ball.vy); }
  }

  function hitBrick(brick, ball) {
    bounceFromRect(ball, brick);
    brick.hp -= 1;
    state.score += 25;
    brick.element.classList.add("target-hit");
    setTimeout(() => brick.element.classList.remove("target-hit"), 95);
    spawnParticles(ball.x, ball.y, brick.color, 8);
    beep(210 + Math.random() * 90, .04, "square", .025);

    if (brick.hp <= 0) {
      brick.alive = false;
      state.destroyed += 1;
      state.score += brick.points;
      state.shake = 5;
      brick.element.classList.add("target-destroyed");
      spawnParticles(ball.x, ball.y, brick.color, 22);
      if (Math.random() < 0.34 && !drops.some((drop) => drop.active)) spawnDrop(ball.x, ball.y);
      beep(110, .11, "sawtooth", .04);
      if (state.destroyed >= state.total) finish(true);
    }
    updateHud();
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 250;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .45 + Math.random() * .45, size: 2 + Math.random() * 5, color });
    }
  }

  function spawnDrop(x, y) {
    drops.push({ x, y, width: 46, height: 24, vy: 132, active: true, spin: 0 });
  }

  function activateMultiball(now) {
    const source = balls[0] || makeBall();
    const speed = Math.hypot(source.vx, source.vy);
    const base = Math.atan2(source.vy, source.vx);
    balls = [-0.38, 0, 0.38].map((offset) => ({ ...makeBall(source.x, source.y, base + offset), vx: Math.cos(base + offset) * speed, vy: Math.sin(base + offset) * speed }));
    state.multiballUntil = now + 12000;
    powerTimer.classList.add("active");
    powerTimer.setAttribute("aria-hidden", "false");
    state.score += 500;
    announce("MULTIBALL ×3");
    beep(520, .18, "triangle", .055);
    updateHud();
  }

  function endMultiball() {
    if (balls.length > 1) balls = [balls[0]];
    state.multiballUntil = 0;
    powerTimer.classList.remove("active");
    powerTimer.setAttribute("aria-hidden", "true");
    announce("BACK TO ONE");
  }

  function update(dt, now) {
    if (!state.started || state.paused || state.over) return;

    if (keys.left) paddle.targetX -= paddle.speed * dt;
    if (keys.right) paddle.targetX += paddle.speed * dt;
    paddle.targetX = Math.max(0, Math.min(width - paddle.width, paddle.targetX));
    paddle.x += (paddle.targetX - paddle.x) * Math.min(1, dt * 16);

    if (state.multiballUntil) {
      const remaining = Math.max(0, state.multiballUntil - now);
      timerFill.style.transform = `scaleX(${remaining / 12000})`;
      if (remaining <= 0) endMultiball();
    }

    for (const ball of balls) {
      ball.trail.unshift({ x: ball.x, y: ball.y });
      if (ball.trail.length > 9) ball.trail.pop();
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x - ball.radius <= 0) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); beep(160); }
      if (ball.x + ball.radius >= width) { ball.x = width - ball.radius; ball.vx = -Math.abs(ball.vx); beep(160); }
      if (ball.y - ball.radius <= 0) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); beep(180); }

      if (ball.vy > 0 && circleRect(ball, paddle)) {
        const impact = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
        const speed = Math.min(680, Math.hypot(ball.vx, ball.vy) * 1.018);
        const angle = impact * 1.08 - Math.PI / 2;
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
        ball.y = paddle.y - ball.radius - 1;
        spawnParticles(ball.x, paddle.y, "#dfff00", 6);
        beep(265, .045, "square");
      }

      for (const brick of bricks) {
        if (brick.alive && circleRect(ball, brick)) {
          hitBrick(brick, ball);
          break;
        }
      }
    }

    balls = balls.filter((ball) => ball.y - ball.radius < height + 24);
    if (!balls.length && !state.over) loseLife();

    for (const drop of drops) {
      if (!drop.active) continue;
      drop.y += drop.vy * dt;
      drop.spin += dt * 4;
      if (circleRect({ x: drop.x, y: drop.y, radius: drop.width / 2 }, paddle)) {
        drop.active = false;
        activateMultiball(now);
      } else if (drop.y > height + 40) drop.active = false;
    }

    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 280 * dt;
      particle.life -= dt;
    }
    particles = particles.filter((particle) => particle.life > 0);
    state.shake *= .82;
  }

  function loseLife() {
    state.lives -= 1;
    updateHud();
    beep(76, .32, "sawtooth", .055);
    if (state.lives <= 0) {
      finish(false);
      return;
    }
    announce(`${state.lives} ${state.lives === 1 ? "LIFE" : "LIVES"} LEFT`);
    state.multiballUntil = 0;
    powerTimer.classList.remove("active");
    balls = [makeBall(paddle.x + paddle.width / 2, paddle.y - 20, -Math.PI * (0.3 + Math.random() * .4))];
  }

  function finish(won) {
    state.over = true;
    state.started = false;
    finalScore.textContent = `Final score ${String(state.score).padStart(6, "0")}`;
    endKicker.textContent = won ? "PAGE CLEARED" : "OUT OF BOUNDS";
    endTitle.innerHTML = won ? "Nothing left<br><em>but pixels.</em>" : "The page<br><em>survived.</em>";
    endPanel.hidden = false;
    beep(won ? 660 : 92, .5, won ? "triangle" : "sawtooth", .06);
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (state.shake > .25) ctx.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);

    for (const brick of bricks) {
      if (!brick.alive || !state.started) continue;
      ctx.strokeStyle = brick.color;
      ctx.globalAlpha = .18 + (brick.maxHp - brick.hp) * .12;
      ctx.lineWidth = 1;
      ctx.strokeRect(brick.x + .5, brick.y + .5, Math.max(0, brick.width - 1), Math.max(0, brick.height - 1));
      if (brick.hp < brick.maxHp) {
        ctx.beginPath();
        ctx.moveTo(brick.x + brick.width * .2, brick.y + brick.height * .1);
        ctx.lineTo(brick.x + brick.width * .52, brick.y + brick.height * .55);
        ctx.lineTo(brick.x + brick.width * .42, brick.y + brick.height * .92);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    for (const ball of balls) {
      ball.trail.forEach((point, index) => {
        ctx.beginPath();
        ctx.fillStyle = `rgba(223,255,0,${(1 - index / ball.trail.length) * .16})`;
        ctx.arc(point.x, point.y, ball.radius * (1 - index * .055), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowColor = "#dfff00";
      ctx.shadowBlur = 22;
      ctx.fillStyle = "#dfff00";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.shadowColor = "rgba(123,97,255,.75)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#f3f1e8";
    roundedRect(ctx, paddle.x, paddle.y, paddle.width, paddle.height, paddle.height / 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    for (const drop of drops) {
      if (!drop.active) continue;
      ctx.save();
      ctx.translate(drop.x, drop.y);
      ctx.rotate(Math.sin(drop.spin) * .12);
      ctx.fillStyle = "#7b61ff";
      roundedRect(ctx, -drop.width / 2, -drop.height / 2, drop.width, drop.height, 12);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 11px DM Mono";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("×3", 0, 1);
      ctx.restore();
    }

    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life * 1.7);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function roundedRect(context, x, y, w, h, r) {
    context.beginPath();
    context.roundRect(x, y, w, h, r);
  }

  function loop(now) {
    const dt = Math.min(.025, Math.max(0, (now - (state.lastTime || now)) / 1000));
    state.lastTime = now;
    update(dt, now);
    draw();
    requestAnimationFrame(loop);
  }

  function movePaddle(clientX) {
    paddle.targetX = Math.max(0, Math.min(width - paddle.width, clientX - paddle.width / 2));
  }

  window.addEventListener("pointermove", (event) => movePaddle(event.clientX));
  window.addEventListener("pointerdown", (event) => {
    if (state.started && !state.paused) movePaddle(event.clientX);
  });
  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.left = true;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.right = true;
    if (event.key === " " && state.started) {
      state.paused = !state.paused;
      announce(state.paused ? "PAUSED" : "GO");
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.left = false;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.right = false;
  });
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.started) state.paused = true;
  });

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", () => { resetGame(); startGame(); });
  soundButton.addEventListener("click", () => {
    state.sound = !state.sound;
    soundButton.textContent = state.sound ? "SOUND ON" : "SOUND OFF";
    soundButton.setAttribute("aria-pressed", String(state.sound));
    if (state.sound) { ensureAudio(); beep(320); }
  });

  resize();
  resetGame();
  requestAnimationFrame(loop);
})();
