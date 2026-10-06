/* Shared behaviour for every page, one small class per feature:
   ThemeToggle, SwimmingDuck, CardSheen, Bubbles and ReadMore ("…more" on phones).
   Shared helpers (safe storage, building elements) are in js/core/ui.js. */
(function () {
  "use strict";

  var YC = window.YC;
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Theme toggle: light/dark, remembered, follows the system until picked ---------- */
  class ThemeToggle {
    constructor(buttons) {
      var self = this;
      this.buttons = buttons;
      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var next = self.current() === "dark" ? "light" : "dark";
          root.setAttribute("data-theme", next);
          YC.storage.set("yc-theme", next);
          self.updateLabels();
        });
      });
      this.updateLabels();
      /* Follow the system setting live, unless the visitor picked a theme. */
      if (window.matchMedia) {
        var mq = window.matchMedia("(prefers-color-scheme: dark)");
        if (mq.addEventListener) mq.addEventListener("change", function (e) {
          if (YC.storage.get("yc-theme")) return;
          root.setAttribute("data-theme", e.matches ? "dark" : "light");
          self.updateLabels();
        });
      }
    }
    current() { return root.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
    updateLabels() {
      var next = this.current() === "dark" ? "light" : "dark";
      this.buttons.forEach(function (btn) {
        btn.setAttribute("aria-label", "Switch to " + next + " mode");
        btn.setAttribute("title", "Switch to " + next + " mode");
      });
    }
  }

  /* ---------- Swimming duck: swims right as you scroll down, left as you scroll up,
     pushes the water (js/water.js) and quacks when the pointer reaches it ---------- */
  class SwimmingDuck {
    constructor(pond, duck) {
      var self = this;
      this.pond = pond;
      this.duck = duck;
      this.lastY = window.scrollY;
      this.lastX = 0;
      this.ticking = false;
      var schedule = function () {
        if (!self.ticking) { self.ticking = true; window.requestAnimationFrame(function () { self.place(); }); }
      };
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
      this.place();

      var quack = function () { self.quack(); };
      duck.addEventListener("mouseenter", quack);
      duck.addEventListener("focus", quack);
      duck.addEventListener("touchstart", quack, { passive: true });
      duck.addEventListener("animationend", function (e) {
        if (e.animationName === "quack-bubble") duck.classList.remove("quacking");
      });
    }

    place() {
      this.ticking = false;
      var duck = this.duck;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      var lane = Math.max(0, this.pond.clientWidth - duck.offsetWidth);
      var x = lane * progress;
      duck.style.setProperty("--x", x.toFixed(1) + "px");
      /* Swimming pushes the water and throws a few droplets behind the duck. */
      if (Math.abs(x - this.lastX) > 2 && window.YCWater) window.YCWater.wake(x > this.lastX ? 1 : -1);
      this.lastX = x;
      var y = window.scrollY;
      if (y < this.lastY - 1) duck.classList.add("face-left");
      else if (y > this.lastY + 1) duck.classList.remove("face-left");
      this.lastY = y;
    }

    quack() {
      if (window.YCWater) window.YCWater.quack();
      this.duck.classList.remove("quacking");
      void this.duck.offsetWidth; /* restart the animation */
      this.duck.classList.add("quacking");
    }
  }

  /* ---------- Cloth-like sheen that follows the pointer over cards ---------- */
  class CardSheen {
    constructor(selector) {
      document.addEventListener("pointermove", function (e) {
        var el = e.target.closest ? e.target.closest(selector) : null;
        while (el) {
          var r = el.getBoundingClientRect();
          el.style.setProperty("--mx", (e.clientX - r.left) + "px");
          el.style.setProperty("--my", (e.clientY - r.top) + "px");
          el = el.parentElement ? el.parentElement.closest(selector) : null;
        }
      }, { passive: true });
    }
  }

  /* ---------- Bubbles: a few drift up in the background; tap empty space for one,
     hold the mouse or finger down for a stream. They rise to the water surface
     in the top bar and pop there, never above it. ---------- */
  var INTERACTIVE = "a, button, input, select, textarea, label, summary, details, [role=tab], .term, pre, code, table, .duck-link, .nav-links, .pg-console";

  class Bubbles {
    constructor(sea, waterCanvas) {
      this.waterCanvas = waterCanvas;
      this.layerEl = null;
      this.press = null;
      if (sea) this.ambient(sea);
      this.listen();
    }

    ambient(sea) {
      for (var b = 0; b < 7; b++) {
        var bub = YC.el("span", { class: "bubble" });
        bub.style.setProperty("--bx", (2 + Math.random() * 92).toFixed(1) + "%");
        bub.style.setProperty("--bs", (4 + Math.random() * 7).toFixed(1) + "px");
        bub.style.setProperty("--bd", (18 + Math.random() * 16).toFixed(1) + "s");
        bub.style.setProperty("--bdelay", (-Math.random() * 34).toFixed(1) + "s");
        sea.appendChild(bub);
      }
    }

    /* The water line, a few px below the resting surface so even a wave trough stays above it. */
    surfaceY() {
      return this.waterCanvas ? this.waterCanvas.getBoundingClientRect().top + 22 : 0;
    }

    /* Bubbles live in a layer that starts at the water line and clips anything above it. */
    layer() {
      if (!this.layerEl) {
        this.layerEl = YC.el("div", { class: "bubble-layer", "aria-hidden": "true" });
        document.body.appendChild(this.layerEl);
      }
      this.layerEl.style.top = this.surfaceY().toFixed(0) + "px";
      return this.layerEl;
    }

    bubbleAt(x, y, small) {
      var top = this.surfaceY();
      var size = small ? 5 + Math.random() * 6 : 9 + Math.random() * 7;
      if (y < top + size) return; /* clicking above the water makes no bubble */
      var c = YC.el("span", { class: "click-bubble" });
      var dist = y - top;
      /* Bigger bubbles rise a little faster, like real ones. */
      var speed = 110 + size * 6 + Math.random() * 30;
      c.style.left = (x + (Math.random() - 0.5) * (small ? 8 : 2)).toFixed(0) + "px";
      c.style.top = (y - top).toFixed(0) + "px";
      c.style.setProperty("--bs", size.toFixed(1) + "px");
      c.style.setProperty("--bd", Math.max(0.6, dist / speed).toFixed(2) + "s");
      c.style.setProperty("--bdx", ((Math.random() - 0.5) * 24).toFixed(0) + "px");
      /* Stop with the bubble's top touching the water line, then pop. */
      c.style.setProperty("--bdy", (-(dist - size / 2)).toFixed(0) + "px");
      c.addEventListener("animationend", function (e) {
        if (e.animationName !== "click-rise") return;
        var r = c.getBoundingClientRect();
        if (window.YCWater && window.YCWater.pop) window.YCWater.pop(r.left + r.width / 2, size);
        c.remove();
      });
      this.layer().appendChild(c);
    }

    endPress() {
      if (!this.press) return;
      clearTimeout(this.press.holdTimer);
      clearInterval(this.press.stream);
      this.press = null;
    }

    listen() {
      var self = this;
      var end = function () { self.endPress(); };
      document.addEventListener("pointerdown", function (e) {
        if (e.button !== 0 || (e.target.closest && e.target.closest(INTERACTIVE))) return;
        self.endPress();
        var p = self.press = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, touch: e.pointerType !== "mouse" };
        self.bubbleAt(p.x, p.y, false);
        p.holdTimer = setTimeout(function () {
          if (self.press !== p) return;
          p.stream = setInterval(function () {
            var sel = window.getSelection && window.getSelection();
            if (sel && String(sel).length) { self.endPress(); return; }
            self.bubbleAt(p.x, p.y, true);
          }, 110);
        }, 260);
      });
      document.addEventListener("pointermove", function (e) {
        var p = self.press;
        if (!p) return;
        /* A moving finger means scrolling, so stop. A moving mouse just moves the stream. */
        if (p.touch && (Math.abs(e.clientX - p.sx) > 8 || Math.abs(e.clientY - p.sy) > 8)) { self.endPress(); return; }
        p.x = e.clientX; p.y = e.clientY;
      });
      document.addEventListener("pointerup", end);
      document.addEventListener("pointercancel", end);
      window.addEventListener("blur", end);
      document.addEventListener("contextmenu", function (e) { if (self.press && self.press.stream) e.preventDefault(); });
    }
  }

  /* ---------- "more" / "less" button, shared by both kinds of folding below ---------- */
  class MoreButton {
    constructor(controls, onToggle, extraClass) {
      var self = this;
      this.open = false;
      this.el = YC.el("button", {
        type: "button", class: "more-btn" + (extraClass ? " " + extraClass : ""), text: "more",
        "aria-expanded": "false", "aria-controls": controls
      });
      this.el.addEventListener("click", function () {
        self.open = !self.open;
        self.el.textContent = self.open ? "less" : "more";
        self.el.setAttribute("aria-expanded", self.open ? "true" : "false");
        onToggle(self.open);
      });
    }
  }

  /* ---------- Phones: long text shows the first lines, then "…" and a "more" button.
     The About card instead shows its first paragraph and one "more" for the rest. ---------- */
  class ReadMore {
    constructor(rules) {
      var self = this;
      this.rules = rules;
      this.clampId = 0;
      this.phone = window.matchMedia ? window.matchMedia("(max-width: 600px)") : null;
      var update = function () { self.foldAbout(); self.applyClamps(); };
      update();
      if (this.phone) {
        if (this.phone.addEventListener) this.phone.addEventListener("change", update);
        window.addEventListener("load", function () { self.applyClamps(); });
      }
    }

    isPhone() { return !!(this.phone && this.phone.matches); }

    /* Recomputed when the screen size changes, so desktop never keeps a clamp. */
    unclampAll() {
      document.querySelectorAll(".more-btn:not(.about-more)").forEach(function (btn) { btn.remove(); });
      document.querySelectorAll(".clamped, [data-clampable]").forEach(function (el) {
        el.classList.remove("clamped");
        el.removeAttribute("data-clampable");
        el.style.removeProperty("--clamp-lines");
      });
    }

    applyClamps() {
      var self = this;
      this.unclampAll();
      if (!this.isPhone()) return;
      this.rules.forEach(function (rule) {
        document.querySelectorAll(rule[0]).forEach(function (el) {
          var lh = parseFloat(getComputedStyle(el).lineHeight) || 28;
          /* Only fold text when at least four more lines are hidden; folding away
             a line or two is not worth a tap. */
          if (el.scrollHeight <= lh * (rule[1] + 3.5)) return;
          if (!el.id) { self.clampId++; el.id = "more-" + self.clampId; }
          el.setAttribute("data-clampable", "");
          el.style.setProperty("--clamp-lines", rule[1]);
          el.classList.add("clamped");
          var btn = new MoreButton(el.id, function (open) { el.classList.toggle("clamped", !open); });
          el.insertAdjacentElement("afterend", btn.el);
        });
      });
    }

    foldAbout() {
      var card = document.querySelector("#about .card");
      if (!card) return;
      var rest = [].slice.call(card.querySelectorAll(":scope > p")).slice(1);
      var existing = card.querySelector(".about-more");
      if (!this.isPhone() || !rest.length) {
        rest.forEach(function (p) { p.hidden = false; });
        if (existing) existing.remove();
        return;
      }
      if (existing) return;
      rest.forEach(function (p, i) { p.hidden = true; if (!p.id) p.id = "about-more-" + i; });
      var btn = new MoreButton(rest.map(function (p) { return p.id; }).join(" "), function (open) {
        rest.forEach(function (p) { p.hidden = !open; });
        card.appendChild(btn.el);
      }, "about-more");
      card.appendChild(btn.el);
    }
  }

  /* ---------- Start everything this page has ---------- */
  new ThemeToggle([].slice.call(document.querySelectorAll(".theme-toggle")));
  var pond = document.querySelector(".pond");
  var duck = pond && pond.querySelector(".duck-link");
  if (duck) new SwimmingDuck(pond, duck);
  if (window.matchMedia && window.matchMedia("(hover: hover)").matches) new CardSheen(".card, .tl-card, .hobbies li");
  if (!reduceMotion) new Bubbles(document.querySelector(".underwater"), document.querySelector("canvas.water"));
  new ReadMore([
    [".project-body .detail", 3],
    ["#experience .compact-list .card > p:not(.item-meta)", 3],
    [".explainer-section > p:not(.small):not(.status-line):not(.demo-notice):not(.breadcrumb)", 4]
  ]);
})();
