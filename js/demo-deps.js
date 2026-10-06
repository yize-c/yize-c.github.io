/* Dependency scan demo: the page part.
   Simplified demo for learning: the libraries and "known problems" are made up
   (see js/logic/deps-logic.js). The real tool queries the OSV database instead. */
(function () {
  "use strict";

  var el = window.YC.el;
  var setStatus = window.YC.setStatus;
  /* The logic (recall list, version compare, risk bands) lives in
     js/logic/deps-logic.js so it can be tested; this file only draws the page. */
  var L = window.DepsLogic;
  var STATUS_BASE = "status-line explainer-section";

  class DependencyScanDemo {
    constructor(ids) {
      this.listEl = document.getElementById(ids.list);
      this.statusEl = document.getElementById(ids.status);
      this.summaryEl = document.getElementById(ids.summary);
      var self = this;
      document.getElementById(ids.scan).addEventListener("click", function () { self.scan(); });
      document.getElementById(ids.reset).addEventListener("click", function () { self.reset(); });
      this.reset();
    }

    /* ---------- Drawing the list ---------- */
    reset() {
      this.libs = L.startingLibs();
      this.results = null;
      this.render();
      setStatus(this.statusEl, "", "Not scanned yet. Press Scan to check the libraries.", STATUS_BASE);
      this.summaryEl.textContent = "";
    }

    render() {
      var self = this;
      this.listEl.textContent = "";
      this.libs.forEach(function (lib, i) { self.listEl.appendChild(self.row(lib, i)); });
    }

    /* One library: name and version, its risk badge, and (if fixable) an update button. */
    row(lib, i) {
      var self = this;
      var r = this.results && this.results[i];
      var badge = !r
        ? el("span", { class: "badge badge-muted", text: this.results ? "Changed · scan again" : "Not scanned" })
        : el("span", { class: "badge risk risk-" + r.level, text: r.level === "none" ? "OK" : L.LEVEL_LABEL[r.level] + " · " + r.score.toFixed(1) });
      return el("li", { class: "card problem" }, [
        el("div", { class: "problem-head" }, [el("span", { class: "problem-title mono", text: lib.name + " " + lib.version }), badge]),
        r ? el("p", { class: "small muted", text: r.reason }) : null,
        r && r.fixedIn ? el("button", {
          type: "button", class: "btn btn-small", text: "Update to " + r.fixedIn,
          "aria-label": "Update " + lib.name + " to version " + r.fixedIn,
          onclick: function () { self.update(i, r.fixedIn); }
        }) : null
      ]);
    }

    /* ---------- Buttons: update one library, scan all ---------- */
    update(i, version) {
      this.libs[i].version = version;
      if (this.results) this.results[i] = null;
      this.render();
      setStatus(this.statusEl, "warn", "Updated " + this.libs[i].name + " to " + version + ". Press Scan again to see the new result.", STATUS_BASE);
      var next = this.listEl.querySelectorAll("li")[i];
      if (next) {
        next.setAttribute("tabindex", "-1");
        next.focus();
      }
    }

    scan() {
      var scan = L.scanAll(this.libs);
      var n = this.libs.length;
      this.results = scan.results;
      this.render();
      if (scan.flagged === 0) setStatus(this.statusEl, "ok", "Scan finished: no known problems found in these " + n + " libraries.", STATUS_BASE);
      else setStatus(this.statusEl, "bad", "Scan finished: " + scan.flagged + " of " + n + " libraries have known problems. Try updating them, then scan again.", STATUS_BASE);

      var summary = this.summaryEl;
      summary.textContent = "";
      ["critical", "high", "medium", "low"].forEach(function (lvl) {
        summary.appendChild(el("span", { class: "badge risk risk-" + lvl, text: L.LEVEL_LABEL[lvl] + ": " + scan.counts[lvl] }));
      });
    }
  }

  if (document.getElementById("dep-list")) {
    new DependencyScanDemo({ list: "dep-list", status: "dep-status", summary: "dep-summary", scan: "dep-scan", reset: "dep-reset" });
  }
})();
