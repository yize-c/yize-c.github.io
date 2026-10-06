/* Water along the top bar: a small 2D physics simulation drawn on a canvas.
   The surface is a row of springs. Each one is pulled back to rest and also
   tugs on its neighbours, so a push in one place travels outward as a wave and
   slowly calms down. A few slow sine waves keep the water gently moving.
   The duck bobs on the real surface height, pushes the water when it swims,
   and throws droplets that fall back in. Inspired by Evan Wallace's WebGL Water. */
(function () {
  "use strict";

  var canvas = document.querySelector("canvas.water");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var duck = document.querySelector(".duck-link");
  var duckImg = duck ? duck.querySelector(".duck-img") : null;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var SPACING = 5;      /* px between springs */
  var REST = 16;        /* resting surface height, px from the top of the canvas */
  var TENSION = 0.025;  /* pull back to rest */
  var DAMPING = 0.02;   /* how quickly motion dies down */
  var SPREAD = 0.24;    /* how much each spring pulls its neighbours */

  var W = 0, H = 0, dpr = 1;
  var cols = [];
  var drops = [];
  var t = 0;
  var colors = null;
  var running = false;
  var lastTime = 0;
  var tiltNow = 0;

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    colors = {
      sea: cs.getPropertyValue("--sea").trim().split(/\s+/).join(","),
      surf: cs.getPropertyValue("--sea-surface").trim().split(/\s+/).join(","),
      a: parseFloat(cs.getPropertyValue("--sea-a")) || 0.18
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.ceil(W / SPACING) + 2;
    while (cols.length < n) cols.push({ h: 0, v: 0 });
    cols.length = n;
    if (!running) draw();
  }

  /* Slow background swell, so the water is never perfectly still. */
  function swell(x) {
    return Math.sin(x * 0.021 + t * 1.1) * 2.0 +
           Math.sin(x * 0.047 - t * 1.7) * 1.0 +
           Math.sin(x * 0.11 + t * 2.6) * 0.35;
  }

  function surfaceAt(x) {
    var i = x / SPACING, i0 = Math.floor(i), f = i - i0;
    var a = cols[Math.max(0, Math.min(cols.length - 1, i0))];
    var b = cols[Math.max(0, Math.min(cols.length - 1, i0 + 1))];
    return REST + (a ? a.h * (1 - f) + b.h * f : 0) + swell(x);
  }

  function disturb(x, force) {
    var c = Math.round(x / SPACING);
    for (var k = -3; k <= 3; k++) {
      var col = cols[c + k];
      if (col) col.v += force * (1 - Math.abs(k) / 4);
    }
  }

  function splash(x, dir, count, power) {
    if (drops.length > 60) return;
    for (var i = 0; i < count; i++) {
      drops.push({
        x: x + (Math.random() - 0.5) * 8,
        y: surfaceAt(x) - 1,
        vx: dir * (0.4 + Math.random() * 1.6) + (Math.random() - 0.5) * 0.8,
        vy: -(1.2 + Math.random() * 2.2) * power,
        r: 0.7 + Math.random() * 1.5
      });
    }
    disturb(x, 1.4 * power);
  }

  var MAX_H = 12, MAX_V = 4;
  function clamp(v, m) { return v > m ? m : v < -m ? -m : v; }

  function step(dt) {
    var i, n = cols.length;
    for (i = 0; i < n; i++) {
      var c = cols[i];
      c.v = clamp(c.v + (-TENSION * c.h - DAMPING * c.v) * dt, MAX_V);
      c.h = clamp(c.h + c.v * dt, MAX_H);
      if (c.h !== c.h || c.v !== c.v) { c.h = 0; c.v = 0; } /* NaN guard */
    }
    var left = new Array(n), right = new Array(n);
    for (var pass = 0; pass < 4; pass++) {
      for (i = 0; i < n; i++) {
        left[i] = i > 0 ? SPREAD * (cols[i].h - cols[i - 1].h) * dt : 0;
        right[i] = i < n - 1 ? SPREAD * (cols[i].h - cols[i + 1].h) * dt : 0;
      }
      for (i = 0; i < n; i++) {
        if (i > 0) { cols[i - 1].v += left[i]; cols[i - 1].h += left[i]; }
        if (i < n - 1) { cols[i + 1].v += right[i]; cols[i + 1].h += right[i]; }
      }
    }
    for (i = drops.length - 1; i >= 0; i--) {
      var d = drops[i];
      d.vy += 0.16 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.vy > 0 && d.y >= surfaceAt(d.x)) {
        disturb(d.x, 0.25 + d.r * 0.15);
        drops.splice(i, 1);
      } else if (d.x < -10 || d.x > W + 10) {
        drops.splice(i, 1);
      }
    }
  }

  function tracePath(offsetY, scale) {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (var x = 0; x <= W + SPACING; x += SPACING) {
      var y = REST + offsetY + (surfaceAt(x) - REST) * scale;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
  }

  function strokeSurface(offsetY, scale, style, width) {
    ctx.beginPath();
    for (var x = 0; x <= W + SPACING; x += SPACING) {
      var y = REST + offsetY + (surfaceAt(x) - REST) * scale;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function draw() {
    if (!colors) readColors();
    var sea = colors.sea, surf = colors.surf, a = colors.a;
    ctx.clearRect(0, 0, W, H);

    /* Far water: a softer, slower layer behind for depth. */
    var t0 = t;
    t = t0 * 0.6 + 7;
    tracePath(-4, 0.7);
    var back = ctx.createLinearGradient(0, REST - 8, 0, H);
    back.addColorStop(0, "rgba(" + surf + ",0.35)");
    back.addColorStop(0.55, "rgba(" + sea + "," + (a * 0.6) + ")");
    /* Fades out at the bottom, so only the near layer sets the bottom edge colour. */
    back.addColorStop(1, "rgba(" + sea + ",0)");
    ctx.fillStyle = back;
    ctx.fill();
    t = t0;

    /* Near water: clear and light at the surface, deeper blue below,
       ending in exactly the colour the underwater background starts with. */
    tracePath(0, 1);
    var g = ctx.createLinearGradient(0, REST - 6, 0, H);
    g.addColorStop(0, "rgba(" + surf + ",0.5)");
    g.addColorStop(0.18, "rgba(" + surf + ",0.42)");
    g.addColorStop(0.35, "rgba(" + sea + "," + Math.min(0.6, a * 2.6) + ")");
    g.addColorStop(0.55, "rgba(" + sea + "," + Math.min(0.5, a * 2) + ")");
    g.addColorStop(0.78, "rgba(" + sea + "," + Math.min(0.4, a * 1.45) + ")");
    g.addColorStop(1, "rgba(" + sea + "," + a + ")");
    ctx.fillStyle = g;
    ctx.fill();

    /* Light on the surface: a bright crest line and a faint second reflection. */
    strokeSurface(0, 1, "rgba(255,255,255,0.85)", 1.3);
    strokeSurface(3, 0.8, "rgba(255,255,255,0.18)", 2);

    drawDuckOnWater();

    /* Droplets */
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(235,246,255,0.95)";
      ctx.fill();
      ctx.strokeStyle = "rgba(" + sea + ",0.6)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }

  /* The duck's reflection (mirrored at the waterline, broken up by the waves)
     and a thin ring of foam where it meets the water. */
  function drawDuckOnWater() {
    if (!duckImg || !duckImg.complete || !duckImg.naturalWidth) return;
    var c = canvas.getBoundingClientRect();
    var r = duckImg.getBoundingClientRect();
    var dx = r.left - c.left, dy = r.top - c.top, dw = r.width, dh = r.height;
    if (dx + dw < 0 || dx > W) return;
    var cx = dx + dw / 2;
    var wl = surfaceAt(cx);                       /* waterline under the duck */
    var above = wl - dy;                          /* visible height of the duck */
    if (above <= 4) return;
    var faceLeft = duck.classList.contains("face-left");
    var sx = duckImg.naturalWidth / dw, sy = duckImg.naturalHeight / dh;
    var reflH = Math.min(above * 0.7, H - wl);

    ctx.save();
    if (faceLeft) { ctx.translate(2 * cx, 0); ctx.scale(-1, 1); }
    for (var d = 0; d < reflH; d += 2) {
      var srcY = (above - d - 2) * sy;
      if (srcY < 0) break;
      var wobble = Math.sin(d * 0.35 + t * 5) * (0.5 + d * 0.08);
      ctx.globalAlpha = 0.26 * (1 - d / reflH);
      ctx.drawImage(duckImg, 0, srcY, duckImg.naturalWidth, 2 * sy, dx + wobble, wl + d, dw, 2);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    /* Shade just under the duck, then a light foam line hugging its sides. */
    ctx.beginPath();
    ctx.ellipse(cx, wl + 2, dw * 0.42, 3.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(" + colors.sea + ",0.22)";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, wl, dw * 0.46, 2.4, 0, 0.15, Math.PI - 0.15);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function duckCenterX() {
    if (!duck) return null;
    var r = duck.getBoundingClientRect(), c = canvas.getBoundingClientRect();
    return r.left + r.width / 2 - c.left;
  }

  function frame(now) {
    if (!running) return;
    /* Fixed small steps keep the springs stable even when frames are dropped
       (for example while dragging the scrollbar quickly). */
    var elapsed = lastTime ? Math.min(4, (now - lastTime) / 16.67) : 1;
    lastTime = now;
    t += elapsed / 60;
    while (elapsed > 0) {
      step(Math.min(1, elapsed));
      elapsed -= 1;
    }
    draw();
    var x = duckCenterX();
    if (x !== null) {
      var bob = clamp(surfaceAt(x) - REST, 10);
      duck.style.setProperty("--bob", bob.toFixed(2) + "px");
      /* Lean with the wave under the duck (mirrored when it faces left). */
      var slope = (surfaceAt(x + 12) - surfaceAt(x - 12)) / 24;
      var tilt = Math.max(-12, Math.min(12, Math.atan(slope) * 57.3 * 1.3));
      if (duck.classList.contains("face-left")) tilt = -tilt;
      tiltNow += (tilt - tiltNow) * 0.15;
      duck.style.setProperty("--tilt", tiltNow.toFixed(2) + "deg");
    }
    requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    lastTime = 0;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  readColors();
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize", resize);

  /* Re-read colours when the theme changes. */
  new MutationObserver(function () { readColors(); if (!running) draw(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });
  start();

  /* Used by the duck in main.js */
  var lastSplash = 0;
  var lastWake = 0;
  window.YCWater = {
    wake: function (dir) {
      var x = duckCenterX();
      if (x === null || reduceMotion) return;
      var now0 = performance.now();
      if (now0 - lastWake < 40) return;
      lastWake = now0;
      disturb(x - dir * 20, 0.6);
      var now = performance.now();
      if (now - lastSplash > 140) {
        lastSplash = now;
        splash(x - dir * 24, -dir, 3, 0.8);
      }
    },
    /* A bubble reaching the surface: a small ring of waves where it pops. */
    pop: function (clientX, size) {
      if (reduceMotion) return;
      var x = clientX - canvas.getBoundingClientRect().left;
      disturb(x, 0.4 + (size || 8) * 0.06);
      if ((size || 0) > 11) splash(x, 0, 1, 0.45);
    },
    quack: function () {
      var x = duckCenterX();
      if (x === null || reduceMotion) return;
      splash(x - 18, -1, 6, 1.1);
      splash(x + 18, 1, 6, 1.1);
    }
  };
})();
