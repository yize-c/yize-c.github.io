/* Shared behaviour for every page: theme toggle, mobile menu, the swimming
   duck in the nav, and the card sheen. */
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

  /* ---- Mobile menu ---- */
  var menuBtn = document.querySelector(".menu-toggle");
  var links = document.getElementById("nav-links");
  if (menuBtn && links) {
    var setOpen = function (open) {
      links.classList.toggle("open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    };
    menuBtn.addEventListener("click", function () {
      setOpen(menuBtn.getAttribute("aria-expanded") !== "true");
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        menuBtn.focus();
      }
    });
  }

  /* ---- Swimming duck: swims right as you scroll down, left as you scroll up ---- */
  var pond = document.querySelector(".pond");
  var duck = pond && pond.querySelector(".duck-link");
  if (duck) {
    var lastY = window.scrollY;
    var ticking = false;
    var place = function () {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      var lane = Math.max(0, pond.clientWidth - duck.offsetWidth);
      duck.style.setProperty("--x", (lane * progress).toFixed(1) + "px");
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

})();
