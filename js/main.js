/* Shared behaviour for every page: theme toggle, the swimming duck in the nav,
   the card sheen, bubbles, and "…more" for long text on phones. */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---- Theme toggle ---- */
  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function updateToggle(btn) {
    var next = currentTheme() === "dark" ? "light" : "dark";
    btn.setAttribute("aria-label", "Switch to " + next + " mode");
    btn.setAttribute("title", "Switch to " + next + " mode");
  }

  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    updateToggle(btn);
    btn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("yc-theme", next); } catch (e) { /* storage blocked */ }
      updateToggle(btn);
    });
  });

  /* Follow the system setting live, unless the visitor picked a theme. */
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onChange = function (e) {
      var saved = null;
      try { saved = localStorage.getItem("yc-theme"); } catch (err) { /* ignore */ }
      if (saved) return;
      root.setAttribute("data-theme", e.matches ? "dark" : "light");
      document.querySelectorAll(".theme-toggle").forEach(updateToggle);
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
  }

  /* ---- Swimming duck: swims right as you scroll down, left as you scroll up ---- */
  var pond = document.querySelector(".pond");
  var duck = pond && pond.querySelector(".duck-link");
  if (duck) {
    var lastY = window.scrollY;
    var lastX = 0;
    var ticking = false;
    /* Swimming pushes the water (js/water.js) and throws a few droplets behind the duck. */
    var wake = function (dir) {
      if (window.YCWater) window.YCWater.wake(dir);
    };
    var place = function () {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      var lane = Math.max(0, pond.clientWidth - duck.offsetWidth);
      var x = lane * progress;
      duck.style.setProperty("--x", x.toFixed(1) + "px");
      if (Math.abs(x - lastX) > 2) wake(x > lastX ? 1 : -1);
      lastX = x;
      var y = window.scrollY;
      if (y < lastY - 1) duck.classList.add("face-left");
      else if (y > lastY + 1) duck.classList.remove("face-left");
      lastY = y;
    };
    var schedule = function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(place); }
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
    place();

    /* Quack and splash each time the pointer (or keyboard focus, or a tap) reaches the duck. */
    var quack = function () {
      if (window.YCWater) window.YCWater.quack();
      duck.classList.remove("quacking");
      void duck.offsetWidth; /* restart the animation */
      duck.classList.add("quacking");
    };
    duck.addEventListener("mouseenter", quack);
    duck.addEventListener("focus", quack);
    duck.addEventListener("touchstart", quack, { passive: true });
    duck.addEventListener("animationend", function (e) {
      if (e.animationName === "quack-bubble") duck.classList.remove("quacking");
    });
  }

  /* ---- Cloth-like sheen that follows the pointer over cards ---- */
  var SHEEN = ".card, .tl-card, .hobbies li";
  if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
    document.addEventListener("pointermove", function (e) {
      var el = e.target.closest ? e.target.closest(SHEEN) : null;
      while (el) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left) + "px");
        el.style.setProperty("--my", (e.clientY - r.top) + "px");
        el = el.parentElement ? el.parentElement.closest(SHEEN) : null;
      }
    }, { passive: true });
  }


  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- A few bubbles drifting up in the underwater background ---- */
  var sea = document.querySelector(".underwater");
  if (sea && !reduceMotion) {
    for (var b = 0; b < 7; b++) {
      var bub = document.createElement("span");
      bub.className = "bubble";
      bub.style.setProperty("--bx", (Math.random() * 100).toFixed(1) + "%");
      bub.style.setProperty("--bs", (4 + Math.random() * 7).toFixed(1) + "px");
      bub.style.setProperty("--bd", (18 + Math.random() * 16).toFixed(1) + "s");
      bub.style.setProperty("--bdelay", (-Math.random() * 34).toFixed(1) + "s");
      sea.appendChild(bub);
    }
  }

  /* ---- Bubbles: tap empty space for one bubble; press and hold for a stream ---- */
  var INTERACTIVE = "a, button, input, select, textarea, label, summary, details, [role=tab], .term, pre, code, table, .duck-link, .nav-links";
  function bubbleAt(x, y, small) {
    var c = document.createElement("span");
    c.className = "click-bubble";
    c.setAttribute("aria-hidden", "true");
    var size = small ? 5 + Math.random() * 7 : 10 + Math.random() * 8;
    c.style.left = (x + (Math.random() - 0.5) * (small ? 10 : 2)).toFixed(0) + "px";
    c.style.top = y.toFixed(0) + "px";
    c.style.setProperty("--bs", size.toFixed(1) + "px");
    /* Bigger bubbles rise a little faster, like real ones. */
    c.style.setProperty("--bd", (2.6 - size / 18 + Math.random() * 0.4).toFixed(2) + "s");
    c.style.setProperty("--bdx", ((Math.random() - 0.5) * 30).toFixed(0) + "px");
    c.style.setProperty("--bdy", (-160 - Math.random() * 120).toFixed(0) + "px");
    c.addEventListener("animationend", function (e) { if (e.animationName === "click-rise") c.remove(); });
    document.body.appendChild(c);
  }
  if (!reduceMotion) {
    var press = null;
    var endPress = function () {
      if (!press) return;
      clearTimeout(press.holdTimer);
      clearInterval(press.stream);
      if (!press.moved && !press.streaming) bubbleAt(press.x, press.y, false);
      press = null;
    };
    document.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || (e.target.closest && e.target.closest(INTERACTIVE))) return;
      press = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, streaming: false };
      var p = press;
      p.holdTimer = setTimeout(function () {
        if (press !== p || p.moved) return;
        p.streaming = true;
        bubbleAt(p.x, p.y, false);
        p.stream = setInterval(function () { bubbleAt(p.x, p.y, true); }, 120);
      }, 380);
    });
    document.addEventListener("pointermove", function (e) {
      if (!press) return;
      if (press.streaming) { press.x = e.clientX; press.y = e.clientY; return; }
      if (Math.abs(e.clientX - press.sx) > 8 || Math.abs(e.clientY - press.sy) > 8) {
        press.moved = true;
        endPress();
      }
    });
    document.addEventListener("pointerup", endPress);
    document.addEventListener("pointercancel", function () { if (press) press.moved = true; endPress(); });
    window.addEventListener("blur", function () { if (press) press.moved = true; endPress(); });
    document.addEventListener("contextmenu", function (e) { if (press && press.streaming) e.preventDefault(); });
  }

  /* ---- Phones: long text shows the first lines, then "…" and a "more" button ---- */
  var CLAMP = [
    [".project-body .detail", 3],
    ["#about .card > p", 4],
    ["#experience .compact-list .card > p:not(.item-meta)", 3],
    [".explainer-section > p:not(.small):not(.status-line):not(.demo-notice):not(.breadcrumb)", 4]
  ];
  var phone = window.matchMedia ? window.matchMedia("(max-width: 600px)") : null;
  var clampId = 0;

  function unclampAll() {
    document.querySelectorAll(".more-btn").forEach(function (btn) { btn.remove(); });
    document.querySelectorAll(".clamped, [data-clampable]").forEach(function (el) {
      el.classList.remove("clamped");
      el.removeAttribute("data-clampable");
      el.style.removeProperty("--clamp-lines");
    });
  }

  function applyClamps() {
    unclampAll();
    if (!phone || !phone.matches) return;
    CLAMP.forEach(function (rule) {
      document.querySelectorAll(rule[0]).forEach(function (el) {
        var lh = parseFloat(getComputedStyle(el).lineHeight) || 28;
        if (el.scrollHeight <= lh * (rule[1] + 0.5)) return;
        if (!el.id) { clampId++; el.id = "more-" + clampId; }
        el.setAttribute("data-clampable", "");
        el.style.setProperty("--clamp-lines", rule[1]);
        el.classList.add("clamped");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "more-btn";
        btn.textContent = "more";
        btn.setAttribute("aria-expanded", "false");
        btn.setAttribute("aria-controls", el.id);
        btn.addEventListener("click", function () {
          var open = el.classList.toggle("clamped") === false;
          btn.textContent = open ? "less" : "more";
          btn.setAttribute("aria-expanded", open ? "true" : "false");
        });
        el.insertAdjacentElement("afterend", btn);
      });
    });
  }

  applyClamps();
  if (phone) {
    if (phone.addEventListener) phone.addEventListener("change", applyClamps);
    window.addEventListener("load", applyClamps);
  }
})();
