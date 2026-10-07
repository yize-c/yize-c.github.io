/* Water along the top bar: a small 2D physics simulation drawn on a canvas.
   Three classes, each with one job:
     SpringSurface  the physics: a row of springs (waves) plus droplets
     WaterView      the drawing: water, surface line, ripple rings, the duck's reflection
     Water          the controller: animation loop, duck bobbing, and the window.YCWater
                    API that main.js uses (wake, pop, quack)
   The surface is a row of springs. Each one is pulled back to rest and also tugs on
   its neighbours, so a push in one place travels outward as a wave and slowly calms
   down. A few slow sine waves keep the water gently moving. Inspired by Evan Wallace's
   WebGL Water. */
(function () {
  "use strict";

  var SPACING = 5;      /* px between springs */
  var REST = 16;        /* resting surface height, px from the top of the canvas */
  var TENSION = 0.025;  /* pull back to rest */
  var DAMPING = 0.02;   /* how quickly motion dies down */
  var SPREAD = 0.24;    /* how much each spring pulls its neighbours */
  var MAX_H = 12, MAX_V = 4;

  function clamp(v, m) { return v > m ? m : v < -m ? -m : v; }

  /* ---------- Physics ---------- */
  class SpringSurface {
    constructor() {
      this.cols = [];
      this.drops = [];
      this.t = 0;
    }

    resize(width) {
      var n = Math.ceil(width / SPACING) + 2;
      while (this.cols.length < n) this.cols.push({ h: 0, v: 0 });
      this.cols.length = n;
      this.width = width;
    }

    /* Slow background swell, so the water is never perfectly still. */
    swell(x) {
      var t = this.t;
      return Math.sin(x * 0.021 + t * 1.1) * 2.0 +
             Math.sin(x * 0.047 - t * 1.7) * 1.0 +
             Math.sin(x * 0.11 + t * 2.6) * 0.35;
    }

    /* Surface height at x (px from the top of the canvas). */
    at(x) {
      var cols = this.cols;
      var i = x / SPACING, i0 = Math.floor(i), f = i - i0;
      var a = cols[Math.max(0, Math.min(cols.length - 1, i0))];
      var b = cols[Math.max(0, Math.min(cols.length - 1, i0 + 1))];
      return REST + (a ? a.h * (1 - f) + b.h * f : 0) + this.swell(x);
    }

    /* Push the water down (or up) around x. */
    disturb(x, force) {
      var c = Math.round(x / SPACING);
      for (var k = -3; k <= 3; k++) {
        var col = this.cols[c + k];
        if (col) col.v += force * (1 - Math.abs(k) / 4);
      }
    }

    /* Throw droplets up from x; dir is -1 (left), 0 or 1 (right). */
    splash(x, dir, count, power) {
      if (this.drops.length > 60) return;
      for (var i = 0; i < count; i++) {
        this.drops.push({
          x: x + (Math.random() - 0.5) * 8,
          y: this.at(x) - 1,
          vx: dir * (0.4 + Math.random() * 1.6) + (Math.random() - 0.5) * 0.8,
          vy: -(1.2 + Math.random() * 2.2) * power,
          r: 0.7 + Math.random() * 1.5
        });
      }
      this.disturb(x, 1.4 * power);
    }

    /* One step: springs pull back to rest, neighbours pull on each other
       (that is what makes waves travel), droplets fall back in. */
    step(dt) {
      var cols = this.cols, n = cols.length, i;
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
      for (i = this.drops.length - 1; i >= 0; i--) {
        var d = this.drops[i];
        d.vy += 0.16 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.vy > 0 && d.y >= this.at(d.x)) {
          this.disturb(d.x, 0.25 + d.r * 0.15);
          this.drops.splice(i, 1);
        } else if (d.x < -10 || d.x > this.width + 10) {
          this.drops.splice(i, 1);
        }
      }
    }
  }

  /* ---------- Drawing ---------- */
  class WaterView {
    constructor(canvas, surface, duck) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.surface = surface;
      this.duck = duck;
      this.duckImg = duck ? duck.querySelector(".duck-img") : null;
      this.rings = [];
      this.W = 0; this.H = 0;
      this.readColors();
    }

    /* Colours come from the CSS theme (light or dark). */
    readColors() {
      var cs = getComputedStyle(document.documentElement);
      this.colors = {
        sea: cs.getPropertyValue("--sea").trim().split(/\s+/).join(","),
        surf: cs.getPropertyValue("--sea-surface").trim().split(/\s+/).join(","),
        a: parseFloat(cs.getPropertyValue("--sea-a")) || 0.18
      };
    }

    resize() {
      var canvas = this.canvas;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = canvas.clientWidth;
      this.H = canvas.clientHeight;
      canvas.width = Math.round(this.W * dpr);
      canvas.height = Math.round(this.H * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* Trace the surface; closed = filled down to the bottom of the canvas. */
    surfacePath(offsetY, closed) {
      var ctx = this.ctx, s = this.surface;
      ctx.beginPath();
      if (closed) ctx.moveTo(0, this.H);
      for (var x = 0; x <= this.W + SPACING; x += SPACING) {
        var y = s.at(x) + offsetY;
        if (x === 0 && !closed) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      if (closed) { ctx.lineTo(this.W, this.H); ctx.closePath(); }
    }

    draw() {
      var ctx = this.ctx, c = this.colors, sea = c.sea;
      ctx.clearRect(0, 0, this.W, this.H);

      /* Calm, see-through water: a light tint at the surface that deepens to
         exactly the colour the underwater background starts with. */
      this.surfacePath(0, true);
      var g = ctx.createLinearGradient(0, REST - 4, 0, this.H);
      g.addColorStop(0, "rgba(" + c.surf + ",0.22)");
      g.addColorStop(0.45, "rgba(" + sea + "," + (c.a * 0.75) + ")");
      g.addColorStop(1, "rgba(" + sea + "," + c.a + ")");
      ctx.fillStyle = g;
      ctx.fill();

      /* One thin surface line, with a faint highlight just under it. */
      this.stroke(0, "rgba(" + sea + ",0.55)");
      this.stroke(1.5, "rgba(255,255,255,0.45)");

      this.drawRings();
      this.drawDuck();

      this.surface.drops.forEach(function (d) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(235,246,255,0.95)";
        ctx.fill();
        ctx.strokeStyle = "rgba(" + sea + ",0.6)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
      });
    }

    stroke(offsetY, style) {
      this.surfacePath(offsetY, false);
      this.ctx.strokeStyle = style;
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }

    /* Moving the pointer over the water leaves flat ripple rings. */
    addRing(x) { this.rings.push({ x: x, r: 3, a: 0.55 }); }

    drawRings() {
      var ctx = this.ctx, s = this.surface, sea = this.colors.sea;
      for (var i = this.rings.length - 1; i >= 0; i--) {
        var r = this.rings[i];
        r.r += 0.7; r.a -= 0.014;
        if (r.a <= 0) { this.rings.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.ellipse(r.x, s.at(r.x) + 6 + r.r * 0.12, r.r, r.r * 0.22, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(" + sea + "," + r.a.toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    /* The duck's reflection, mirrored at the waterline and broken up by the waves,
       and a soft shadow where it sits in the water. */
    drawDuck() {
      var img = this.duckImg, ctx = this.ctx, s = this.surface;
      if (!img || !img.complete || !img.naturalWidth) return;
      var c = this.canvas.getBoundingClientRect();
      var r = img.getBoundingClientRect();
      var dx = r.left - c.left, dy = r.top - c.top, dw = r.width, dh = r.height;
      if (dx + dw < 0 || dx > this.W) return;
      var cx = dx + dw / 2;
      var wl = s.at(cx);                            /* waterline under the duck */
      var above = wl - dy;                          /* visible height of the duck */
      if (above <= 4) return;
      var sy = img.naturalHeight / dh;
      var reflH = Math.min(above * 0.7, this.H - wl);

      ctx.save();
      if (this.duck.classList.contains("face-left")) { ctx.translate(2 * cx, 0); ctx.scale(-1, 1); }
      for (var d = 0; d < reflH; d += 2) {
        var srcY = (above - d - 2) * sy;
        if (srcY < 0) break;
        var wobble = Math.sin(d * 0.45 - s.t * 4.2) * (0.6 + d * 0.12) + Math.sin(d * 0.12 + s.t * 1.8) * 0.8;
        ctx.globalAlpha = 0.3 * Math.pow(1 - d / reflH, 1.6);
        ctx.drawImage(img, 0, srcY, img.naturalWidth, 2 * sy, dx + wobble, wl + d, dw, 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.ellipse(cx, wl + 1.5, dw * 0.4, 2.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + this.colors.sea + ",0.18)";
      ctx.fill();
    }
  }

  /* ---------- Controller: animation loop, duck bobbing, API for main.js ---------- */
  class Water {
    constructor(canvas, duck, reduceMotion) {
      var self = this;
      this.canvas = canvas;
      this.duck = duck;
      this.reduceMotion = reduceMotion;
      this.surface = new SpringSurface();
      this.view = new WaterView(canvas, this.surface, duck);
      this.running = false;
      this.lastTime = 0;
      this.tiltNow = 0;
      this.lastSplash = 0;
      this.lastWake = 0;
      this.lastRing = 0;

      var resize = function () { self.resize(); };
      resize();
      if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
      else window.addEventListener("resize", resize);
      /* Re-read colours when the theme changes. */
      new MutationObserver(function () { self.view.readColors(); if (!self.running) self.view.draw(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) self.stop(); else self.start();
      });
      this.listenForPointer();
      this.start();
    }

    resize() {
      this.view.resize();
      this.surface.resize(this.view.W);
      if (!this.running) this.view.draw();
    }

    listenForPointer() {
      var self = this, nav = this.canvas.parentElement;
      if (!nav || this.reduceMotion) return;
      nav.addEventListener("pointermove", function (e) {
        var c = self.canvas.getBoundingClientRect();
        var x = e.clientX - c.left, y = e.clientY - c.top;
        if (y < REST || y > self.view.H || e.timeStamp - self.lastRing < 150 || self.view.rings.length > 8) return;
        self.lastRing = e.timeStamp;
        self.view.addRing(x);
        self.surface.disturb(x, 0.25);
      });
    }

    duckCenterX() {
      if (!this.duck) return null;
      var r = this.duck.getBoundingClientRect(), c = this.canvas.getBoundingClientRect();
      return r.left + r.width / 2 - c.left;
    }

    frame(now) {
      if (!this.running) return;
      var self = this, s = this.surface;
      /* Fixed small steps keep the springs stable even when frames are dropped
         (for example while dragging the scrollbar quickly). */
      var elapsed = this.lastTime ? Math.min(4, (now - this.lastTime) / 16.67) : 1;
      this.lastTime = now;
      s.t += elapsed / 60;
      while (elapsed > 0) {
        s.step(Math.min(1, elapsed));
        elapsed -= 1;
      }
      this.view.draw();
      this.bobDuck();
      requestAnimationFrame(function (t) { self.frame(t); });
    }

    /* The duck rides the real surface height and leans with the wave under it. */
    bobDuck() {
      var x = this.duckCenterX(), s = this.surface, duck = this.duck;
      if (x === null) return;
      duck.style.setProperty("--bob", clamp(s.at(x) - REST, 10).toFixed(2) + "px");
      var slope = (s.at(x + 12) - s.at(x - 12)) / 24;
      var tilt = Math.max(-12, Math.min(12, Math.atan(slope) * 57.3 * 1.3));
      if (duck.classList.contains("face-left")) tilt = -tilt;
      this.tiltNow += (tilt - this.tiltNow) * 0.15;
      duck.style.setProperty("--tilt", this.tiltNow.toFixed(2) + "deg");
    }

    start() {
      var self = this;
      if (this.running || this.reduceMotion) return;
      this.running = true;
      this.lastTime = 0;
      requestAnimationFrame(function (t) { self.frame(t); });
    }
    stop() { this.running = false; }

    /* ---------- Used by main.js ---------- */
    /* The duck swims: push the water behind it and throw a few droplets. */
    wake(dir) {
      var x = this.duckCenterX();
      if (x === null || this.reduceMotion) return;
      var now = performance.now();
      if (now - this.lastWake < 40) return;
      this.lastWake = now;
      this.surface.disturb(x - dir * 20, 0.6);
      if (now - this.lastSplash > 140) {
        this.lastSplash = now;
        this.surface.splash(x - dir * 24, -dir, 3, 0.8);
      }
    }

    /* A bubble reaching the surface: a small ring of waves where it pops. */
    pop(clientX, size) {
      if (this.reduceMotion) return;
      var x = clientX - this.canvas.getBoundingClientRect().left;
      this.surface.disturb(x, 0.4 + (size || 8) * 0.06);
      if ((size || 0) > 11) this.surface.splash(x, 0, 1, 0.45);
    }

    quack() {
      var x = this.duckCenterX();
      if (x === null || this.reduceMotion) return;
      this.surface.splash(x - 18, -1, 6, 1.1);
      this.surface.splash(x + 18, 1, 6, 1.1);
    }
  }

  var canvas = document.querySelector("canvas.water");
  if (!canvas || !canvas.getContext) return;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.YCWater = new Water(canvas, document.querySelector(".duck-link"), reduceMotion);
})();
