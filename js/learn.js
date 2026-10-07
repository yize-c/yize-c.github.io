/* Learner Space: loads the practice data, then switches between the tabs.
   Shared helpers: js/learn/common.js. Each tab: js/learn/tab-*.js. */
(function () {
  "use strict";

  var YC = window.YC;
  var L = window.YCLearn;
  var el = L.el, progress = L.progress, data = L.data, getJSON = L.getJSON, AREAS = L.AREAS;

  /* ---------- Tabs ---------- */
  /* An accessible tab bar (arrow keys, Home, End). Each panel is drawn the first time
     it opens (the study plan every time, so its bars are current). The open tab is
     remembered in the URL (#sql) and in the visitor's progress. */
  class TabSet {
    constructor(tabs, renderers, fallback) {
      var self = this;
      this.tabs = tabs;
      this.renderers = renderers;
      this.fallback = fallback;
      this.rendered = {};
      this.ready = false;
      tabs.forEach(function (t, i) {
        t.addEventListener("click", function () { self.select(TabSet.keyOf(t)); });
        t.addEventListener("keydown", function (e) {
          var j = null;
          if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
          else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
          else if (e.key === "Home") j = 0;
          else if (e.key === "End") j = tabs.length - 1;
          if (j !== null) {
            e.preventDefault();
            self.select(TabSet.keyOf(tabs[j]), true);
          }
        });
      });
      window.addEventListener("hashchange", function () {
        var h = location.hash.replace("#", "");
        if (self.renderers[h]) self.select(h);
      });
    }

    static keyOf(tab) { return tab.id.replace("tab-", ""); }
    static panel(key) { return document.getElementById("panel-" + key); }

    /* The tab from the URL, else the one the visitor last opened, else the first. */
    initial() {
      var h = location.hash.replace("#", "");
      if (this.renderers[h]) return h;
      if (this.renderers[progress.tab]) return progress.tab;
      return this.fallback;
    }

    select(key, focus) {
      if (!this.renderers[key]) key = this.fallback;
      this.tabs.forEach(function (t) {
        var on = TabSet.keyOf(t) === key;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        TabSet.panel(TabSet.keyOf(t)).hidden = !on;
        if (on && focus) t.focus();
        if (on && t.scrollIntoView) t.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
      progress.setTab(key);
      if (history.replaceState) history.replaceState(null, "", "#" + key);
      if (this.ready && (!this.rendered[key] || key === "plan")) {
        this.renderers[key](TabSet.panel(key));
        this.rendered[key] = true;
      }
    }

    /* Data has loaded: draw the open tab. */
    start() { this.ready = true; this.select(this.initial()); }

    /* Data failed to load: say so in every panel. */
    fail(message) {
      this.tabs.forEach(function (t) {
        var p = TabSet.panel(TabSet.keyOf(t));
        p.textContent = "";
        p.appendChild(el("p", { class: "notice error-box", text: message }));
      });
    }
  }

  /* ---------- Loading the practice data (data/*.json) ---------- */
  function loadData() {
    var files = [
      getJSON("data/leetcode.json"),
      getJSON("data/sql-exercises.json"),
      getJSON("data/go.json"),
      getJSON("data/bash-cheatsheet.json"),
      getJSON("data/my-progress.json"),
      getJSON("data/solutions.json")
    ].concat(AREAS.map(function (a) { return getJSON("data/concepts/" + a + ".json"); }));
    return Promise.all(files).then(function (r) {
      data.leetcode = r[0];
      data.sqlExercises = r[1];
      data.go = r[2];
      data.cheatsheet = r[3];
      data.mine = r[4];
      Object.assign(L.mine, r[4].items || {});
      data.solutions = r[5].solutions || {};
      data.concepts = {};
      AREAS.forEach(function (a, i) { data.concepts[a] = r[6 + i]; });
    });
  }

  /* ---------- Start ---------- */
  var tabSet = new TabSet(
    Array.prototype.slice.call(document.querySelectorAll("[role=tab]")),
    L.tabs,
    "coding"
  );
  if (!YC.storage.ok) document.getElementById("storage-warning").hidden = false;
  tabSet.select(tabSet.initial());
  loadData().then(function () { tabSet.start(); }).catch(function (err) {
    tabSet.fail("Couldn't load the practice data (" + err.message + "). If you opened this file directly from your computer, run a small local server instead; see the README.");
  });
})();
