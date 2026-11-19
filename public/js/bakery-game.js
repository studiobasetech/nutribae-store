/* ==========================================================================
   NutriBae Run — the "Play To Win" game.
   Art comes from the NutriBae pixel scene (assets/game/): the runner girl,
   cherry trees, city, grass platforms and NutriBae jars.
   Tap / Space to jump (tap again in the air for a double jump).
   Collect NutriBae jars, grab hearts and shakers, dodge the sweets & weights.
   window.NB_BakeryGame.start(container, { onStart, onEnd(score) })
   ========================================================================== */
(function () {
  const A = "assets/game/";
  const VH = 470;                 // logical height = the scene at half size
  const GROUND_Y = 397;           // top of the grass
  const ART = 0.5;                // scene pixels → logical units

  const FILES = {
    girl: "girl.png", tree: "tree.png", platform: "platform.png", mid: "mid.jpg", ground: "ground.jpg",
    sky: "sky.png", cloud1: "cloud1.png", cloud2: "cloud2.png", heart: "heart.png", shaker: "shaker.png",
    dumbbell: "dumbbell.png", cake: "cake.png", logo: "logo.png",
    "jar-vanilla": "jar-vanilla.png", "jar-chocolate": "jar-chocolate.png", "jar-strawberry": "jar-strawberry.png",
    "jar-cotton": "jar-cotton.png", "jar-hydration": "jar-hydration.png", "jar-probiotic": "jar-probiotic.png",
  };
  const JARS = [
    { key: "jar-vanilla", pts: 50, name: "Protein" }, { key: "jar-chocolate", pts: 50, name: "Protein" },
    { key: "jar-strawberry", pts: 30, name: "Energy" }, { key: "jar-cotton", pts: 30, name: "Energy" },
    { key: "jar-hydration", pts: 30, name: "Hydration" }, { key: "jar-probiotic", pts: 20, name: "Probiotic" },
  ];
  let IMG = null;
  function loadArt() {
    if (IMG) return Promise.resolve(IMG);
    const out = {};
    return Promise.all(Object.entries(FILES).map(([k, f]) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { out[k] = im; res(); };
      im.onerror = () => res();
      im.src = A + f;
    }))).then(() => (IMG = out));
  }

  function start(container, { onStart, onEnd } = {}) {
    container.innerHTML = `
      <div class="sm rn" tabindex="0" aria-label="NutriBae Run game">
        <canvas class="rn-canvas"></canvas>
        <div class="sm-overlay rn-intro" data-sm-intro>
          <img class="rn-title" src="${A}logo.png" alt="NutriBae" width="290" height="87">
          <p class="rn-run">RUN</p>
          <p class="sm-sub">Help her run through the park: collect NutriBae jars and dodge the sweets!</p>
          <ul class="rn-legend">
            <li><img src="${A}jar-vanilla.png" alt=""><span>NutriBae jars <b>+20 to +50</b></span></li>
            <li><img src="${A}shaker.png" alt=""><span>Shaker <b>+100</b> · <img class="rn-mini" src="${A}heart.png" alt=""> extra life</span></li>
            <li><img src="${A}cake.png" alt=""><span>Cake, donuts &amp; weights cost a heart</span></li>
          </ul>
          <button class="btn" type="button" data-sm-go>Loading…</button>
          <p class="bk-game__hint sm-hint">Tap or press Space to jump · tap twice for a double jump</p>
        </div>
      </div>`;
    const root = container.querySelector(".rn");
    const cv = root.querySelector("canvas");
    const g = cv.getContext("2d");
    let VW = 600, scale = 1, dpr = 1;

    function resize() {
      const w = root.clientWidth, h = root.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + "px"; cv.style.height = h + "px";
      scale = (h * dpr) / VH;
      VW = (w * dpr) / scale;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
    }
    resize();
    window.addEventListener("resize", resize);

    /* ---------- state ---------- */
    const GIRL_S = 0.42;
    const P = { x: 0, y: 0, vy: 0, w: 238 * GIRL_S, h: 304 * GIRL_S, onGround: true, jumps: 0, hurt: 0, t: 0 };
    let items = [], plats = [], fx = [], dust = [], dist = 0, speed = 260, score = 0, hearts = 3, running = false, finished = false;
    let raf = 0, last = 0, spawnT = 0, platT = 0, startedAt = 0, elapsed = 0;

    function reset() {
      P.x = Math.max(30, VW * 0.12); P.y = GROUND_Y - P.h; P.vy = 0; P.onGround = true; P.jumps = 0; P.hurt = 0;
      items = []; plats = []; fx = []; dust = []; dist = 0; speed = 260; score = 0; hearts = 3; spawnT = 1.0; platT = 2.4; elapsed = 0;
    }
    function jump() {
      if (!running) return;
      if (P.onGround || P.jumps < 2) { P.vy = P.jumps === 0 ? -720 : -620; P.jumps += 1; P.onGround = false; }
    }

    const size = (im, s) => ({ w: im.width * s, h: im.height * s });
    function addJar(x, yBottom) {
      const j = JARS[Math.floor(Math.random() * JARS.length)];
      const im = IMG[j.key]; const sz = size(im, 0.32);
      items.push({ type: "jar", im, x, y: yBottom - sz.h, w: sz.w, h: sz.h, pts: j.pts, label: j.name, bob: Math.random() * 6 });
    }
    function spawnThing() {
      const x = VW + 30, r = Math.random();
      if (r < 0.4) {
        const pick = Math.random();
        const im = pick < 0.4 ? IMG.cake : pick < 0.75 ? IMG.dumbbell : null;
        if (im) { const sz = size(im, im === IMG.cake ? 0.42 : 0.46); items.push({ type: "bad", im, x, y: GROUND_Y - sz.h + 4, w: sz.w, h: sz.h }); }
        else items.push({ type: "bad", donut: true, x, y: GROUND_Y - 44, w: 44, h: 44 });
      } else if (r < 0.88) {
        addJar(x, Math.random() < 0.5 ? GROUND_Y - 30 : GROUND_Y - 190);
      } else if (r < 0.95) {
        const sz = size(IMG.shaker, 0.36); items.push({ type: "shaker", im: IMG.shaker, x, y: GROUND_Y - 250, w: sz.w, h: sz.h, pts: 100, bob: 1 });
      } else {
        const sz = size(IMG.heart, 0.45); items.push({ type: "heart", im: IMG.heart, x, y: GROUND_Y - 210, w: sz.w, h: sz.h, bob: 2 });
      }
    }
    function spawnPlatform() {
      const im = IMG.platform, s = 0.55, w = im.width * s, top = GROUND_Y - (115 + Math.random() * 60);
      plats.push({ x: VW + 40, y: top, w, h: im.height * s, s });
      addJar(VW + 40 + w / 2 - 28, top + 8 * s - 4);
      if (Math.random() < 0.3) { const sz = size(IMG.cake, 0.36); items.push({ type: "bad", im: IMG.cake, x: VW + 40 + w - sz.w - 12, y: top + 8 * s - sz.h + 4, w: sz.w, h: sz.h }); }
    }
    const overlap = (a, b, mx, my) => a.x + mx < b.x + b.w && a.x + a.w - mx > b.x && a.y + my < b.y + b.h && a.y + a.h - my > b.y;

    function step(dt) {
      elapsed += dt;
      speed = Math.min(600, 260 + elapsed * 7);
      dist += speed * dt;
      const prevBottom = P.y + P.h;
      P.vy += 1800 * dt; P.y += P.vy * dt; P.onGround = false;
      if (P.y + P.h >= GROUND_Y) { P.y = GROUND_Y - P.h; P.vy = 0; P.onGround = true; P.jumps = 0; }
      for (const pl of plats) {
        const top = pl.y + 8 * pl.s;
        if (P.vy >= 0 && prevBottom <= top + 4 && P.y + P.h >= top && P.x + P.w * 0.7 > pl.x && P.x + P.w * 0.3 < pl.x + pl.w) {
          P.y = top - P.h; P.vy = 0; P.onGround = true; P.jumps = 0;
        }
      }
      if (P.hurt > 0) P.hurt -= dt;
      P.t += dt;
      if (P.onGround && Math.random() < dt * 10) dust.push({ x: P.x + P.w * 0.25, y: P.y + P.h - 4, t: 0.4 });
      for (const o of [...items, ...plats]) o.x -= speed * dt;
      for (const d of dust) { d.t -= dt; d.x -= speed * dt * 0.6; }
      for (const f of fx) { f.t -= dt; f.y -= 50 * dt; }
      items = items.filter((o) => o.x + o.w > -40 && !o.gone);
      plats = plats.filter((o) => o.x + o.w > -40);
      dust = dust.filter((d) => d.t > 0); fx = fx.filter((f) => f.t > 0);
      spawnT -= dt; platT -= dt;
      if (spawnT <= 0) { spawnThing(); spawnT = Math.max(0.5, 1.3 - elapsed * 0.012) * (0.7 + Math.random() * 0.6); }
      if (platT <= 0) { spawnPlatform(); platT = 3.2 + Math.random() * 3; }
      const body = { x: P.x, y: P.y, w: P.w, h: P.h };
      for (const o of items) {
        const by = o.bob != null ? Math.sin((elapsed + o.bob) * 4) * 4 : 0;
        const box = { x: o.x, y: o.y + by, w: o.w, h: o.h };
        if (o.type === "bad") {
          if (P.hurt <= 0 && overlap(body, box, P.w * 0.3, P.h * 0.12)) {
            o.gone = true; hearts -= 1; P.hurt = 1.4;
            fx.push({ x: P.x + P.w / 2, y: P.y, t: 0.9, text: "−♥", bad: true });
            if (navigator.vibrate) navigator.vibrate(80);
            if (hearts <= 0) { running = false; setTimeout(finish, 600); }
          }
        } else if (overlap(body, box, P.w * 0.15, 4)) {
          o.gone = true;
          if (o.type === "heart") { hearts = Math.min(5, hearts + 1); fx.push({ x: o.x, y: o.y, t: 0.9, text: "+♥" }); }
          else { score += o.pts; fx.push({ x: o.x, y: o.y, t: 0.9, text: `+${o.pts}` }); }
          if (navigator.vibrate) navigator.vibrate(15);
        }
      }
      score += dt * 3;
    }

    /* ---------- drawing ---------- */
    function tile(im, y, h, par, mirror = true) {
      if (!im) return;
      const w = im.width * (h / im.height);
      const off = (dist * par) % (w * 2);
      for (let x = -off, i = 0; x < VW; x += w, i++) {
        if (mirror && i % 2) { g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(im, 0, 0, w, h); g.restore(); }
        else g.drawImage(im, x, y, w, h);
      }
    }
    function drawBg() {
      // sky from the scene, then the city + trees strip, cherry trees, ground
      if (IMG.sky) g.drawImage(IMG.sky, 0, 0, VW, IMG.sky.height * ART + 2);
      g.fillStyle = "#E9C9EE"; g.fillRect(0, IMG.sky ? IMG.sky.height * ART : 0, VW, VH);
      const c1 = IMG.cloud1, c2 = IMG.cloud2;
      if (c1) { const w = c1.width * ART, x = VW - ((dist * 0.06) % (VW + w + 200)); g.drawImage(c1, x, 70, w, c1.height * ART); }
      if (c2) { const w = c2.width * ART, x = VW - (((dist * 0.05) + VW * 0.6) % (VW + w + 200)); g.drawImage(c2, x, 40, w, c2.height * ART); }
      tile(IMG.mid, 150, (794 - 300) * ART, 0.2);
      if (IMG.tree) {
        const w = IMG.tree.width * ART * 1.05, h = IMG.tree.height * ART * 1.05, gap = 620;
        const off = (dist * 0.55) % gap;
        for (let x = -off - 40; x < VW + w; x += gap) g.drawImage(IMG.tree, x, GROUND_Y - h + 18, w, h);
      }
      tile(IMG.ground, GROUND_Y - 3, 149 * ART, 1);
    }
    function drawPlat(pl) {
      const im = IMG.platform, s = pl.s;
      // pillar down to the ground (stretch the bottom slice of the pillar)
      const top = pl.y + pl.h - 2;
      if (top < GROUND_Y) g.drawImage(im, 115, im.height - 3, 77, 3, pl.x + 115 * s, top, 77 * s, GROUND_Y - top + 2);
      g.drawImage(im, pl.x, pl.y, pl.w, pl.h);
    }
    function sparkle(x, y, t) {
      const s = 3 + (Math.sin(t * 6) + 1) * 2;
      g.fillStyle = "#FFF8CF"; g.fillRect(x - s, y - 1, s * 2, 2); g.fillRect(x - 1, y - s, 2, s * 2);
    }
    function drawDonut(o) {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      g.fillStyle = "#C98A5A"; g.beginPath(); g.arc(cx, cy + 2, o.w / 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#FF8FB8"; g.beginPath(); g.arc(cx, cy, o.w / 2 - 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#FFF4FA"; g.beginPath(); g.arc(cx, cy, o.w / 6, 0, Math.PI * 2); g.fill();
      ["#7FC8F0", "#FFD34D", "#fff", "#7FC8F0"].forEach((c, i) => { g.fillStyle = c; g.fillRect(cx - 12 + i * 7, cy - 12 + (i % 2) * 18, 4, 2); });
    }
    function drawGirl() {
      if (!IMG.girl) return;
      if (P.hurt > 0 && Math.floor(P.hurt * 12) % 2) return;
      const bob = P.onGround ? Math.abs(Math.sin(P.t * 16)) * -5 : 0;
      g.save();
      g.translate(P.x + P.w / 2, P.y + P.h + bob);
      if (!P.onGround) g.rotate(P.vy < 0 ? -0.08 : 0.05);
      else g.scale(1, 1 - Math.abs(Math.sin(P.t * 16)) * 0.03);
      g.drawImage(IMG.girl, -P.w / 2, -P.h, P.w, P.h);
      g.restore();
    }
    function drawHUD() {
      if (IMG.heart) for (let i = 0; i < Math.max(3, hearts); i++) { g.globalAlpha = i < hearts ? 1 : 0.28; g.drawImage(IMG.heart, 14 + i * 40, 14, 36, 32); }
      g.globalAlpha = 1;
      const txt = String(Math.floor(score)).padStart(4, "0");
      g.font = "16px 'Press Start 2P', monospace";
      const tw = g.measureText(txt).width, w = tw + 60, x = VW - w - 14;
      g.fillStyle = "#F7A8CF"; roundRect(x - 4, 10, w + 8, 44, 12); g.fill();
      g.fillStyle = "#6E4A80"; roundRect(x, 14, w, 36, 9); g.fill();
      g.fillStyle = "#FFD34D"; g.font = "24px sans-serif"; g.fillText("★", x + 10, 41);
      g.fillStyle = "#fff"; g.font = "16px 'Press Start 2P', monospace"; g.fillText(txt, x + 42, 41);
    }
    function roundRect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

    function draw() {
      if (!IMG) return;
      drawBg();
      plats.forEach(drawPlat);
      for (const o of items) {
        const by = o.bob != null ? Math.sin((elapsed + o.bob) * 4) * 4 : 0;
        if (o.type === "jar" || o.type === "shaker") {
          const glow = g.createRadialGradient(o.x + o.w / 2, o.y + o.h / 2 + by, 2, o.x + o.w / 2, o.y + o.h / 2 + by, o.w * 0.9);
          glow.addColorStop(0, "rgba(255,248,210,.85)"); glow.addColorStop(1, "rgba(255,248,210,0)");
          g.fillStyle = glow; g.fillRect(o.x - o.w * 0.5, o.y - o.h * 0.5 + by, o.w * 2, o.h * 2);
          sparkle(o.x - 6, o.y + 6 + by, elapsed); sparkle(o.x + o.w + 6, o.y + o.h * 0.4 + by, elapsed + 1.3);
        }
        if (o.donut) drawDonut(o); else g.drawImage(o.im, o.x, o.y + by, o.w, o.h);
      }
      for (const d of dust) { g.globalAlpha = d.t / 0.4 * 0.6; g.fillStyle = "#fff"; g.fillRect(d.x, d.y - (0.4 - d.t) * 20, 6, 6); }
      g.globalAlpha = 1;
      drawGirl();
      g.font = "14px 'Press Start 2P', monospace";
      for (const f of fx) { g.globalAlpha = Math.min(1, f.t / 0.5); g.fillStyle = f.bad ? "#6E4A80" : "#fff"; g.strokeStyle = f.bad ? "#fff" : "#E46FA9"; g.lineWidth = 4; g.strokeText(f.text, f.x, f.y); g.fillText(f.text, f.x, f.y); }
      g.globalAlpha = 1;
      drawHUD();
    }

    function frame(now) {
      const dt = Math.min(0.034, (now - last) / 1000); last = now;
      if (running) step(dt);
      draw();
      if (!finished) raf = requestAnimationFrame(frame);
    }

    /* ---------- input ---------- */
    cv.addEventListener("pointerdown", (e) => { if (running) { e.preventDefault(); jump(); } });
    const kd = (e) => { if (running && (e.code === "Space" || e.key === "ArrowUp" || e.key === "w")) { e.preventDefault(); jump(); } };
    window.addEventListener("keydown", kd);

    async function finish() {
      if (finished) return;
      running = false;
      const wait = Math.max(0, 21000 - (Date.now() - startedAt));
      if (wait) {
        root.insertAdjacentHTML("beforeend", `<div class="sm-overlay" data-sm-wait><p class="rn-run">GAME OVER</p><p class="sm-sub">Counting your points…</p></div>`);
        await new Promise((r) => setTimeout(r, wait));
        const w = root.querySelector("[data-sm-wait]"); if (w) w.remove();
      }
      finished = true;
      cleanup();
      onEnd && onEnd(Math.floor(score));
    }
    function cleanup() { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("keydown", kd); }

    const go = root.querySelector("[data-sm-go]");
    go.disabled = true;
    loadArt().then(() => {
      reset();
      last = performance.now();
      raf = requestAnimationFrame(frame);
      if (!go.dataset.blocked) { go.disabled = false; go.textContent = "Start running!"; }
    });
    go.addEventListener("click", async () => {
      go.disabled = true;
      try { if (onStart) await onStart(); } catch (err) {
        go.disabled = false;
        root.querySelector(".sm-hint").textContent = err.message || "Couldn’t start the game.";
        return;
      }
      root.querySelector("[data-sm-intro]").remove();
      reset(); running = true; startedAt = Date.now();
      root.focus({ preventScroll: true });
    });
    return { stop: cleanup };
  }

  window.NB_BakeryGame = { start };
})();
