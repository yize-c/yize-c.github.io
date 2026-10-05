/* Shared behaviour for every page: theme toggle, mobile menu,
   and a neutral placeholder for screenshots that are not there yet. */
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

  /* ---- Screenshot placeholders ---- */
  function toPlaceholder(img) {
    var box = document.createElement("div");
    box.className = "img-placeholder";
    box.setAttribute("role", "img");
    box.setAttribute("aria-label", img.getAttribute("alt") || "Screenshot coming soon");
    box.textContent = "Screenshot coming soon";
    img.replaceWith(box);
  }

  document.querySelectorAll("img[data-fallback]").forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) {
      toPlaceholder(img);
    } else {
      img.addEventListener("error", function () { toPlaceholder(img); });
    }
  });
})();
