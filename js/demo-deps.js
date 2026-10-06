/* Dependency scan demo: the page part.
   Simplified demo for learning: the libraries and "known problems" are made up
   (see js/logic/deps-logic.js). The real tool queries the OSV database instead. */
(function () {
  "use strict";

  var listEl = document.getElementById("dep-list");
  var statusEl = document.getElementById("dep-status");
  var summaryEl = document.getElementById("dep-summary");
  var scanBtn = document.getElementById("dep-scan");
  var resetBtn = document.getElementById("dep-reset");
  if (!listEl) return;

  /* The logic (recall list, version compare, risk bands) lives in
     js/logic/deps-logic.js so it can be tested; this file only draws the page. */
  var L = window.DepsLogic;
  var LEVEL_LABEL = L.LEVEL_LABEL;
  var libs, results;

  /* ---------- Drawing the list ---------- */
  function reset() {
    libs = L.startingLibs();
    results = null;
    render();
    statusEl.className = "status-line explainer-section";
    statusEl.textContent = "Not scanned yet. Press Scan to check the libraries.";
    summaryEl.textContent = "";
  }

  function render() {
    listEl.textContent = "";
    libs.forEach(function (lib, i) {
      var li = document.createElement("li");
      li.className = "card problem";

      var head = document.createElement("div");
      head.className = "problem-head";
      var title = document.createElement("span");
      title.className = "problem-title mono";
      title.textContent = lib.name + " " + lib.version;
      head.appendChild(title);

      var r = results && results[i];
      var badge = document.createElement("span");
      if (!r) {
        badge.className = "badge badge-muted";
        badge.textContent = results ? "Changed · scan again" : "Not scanned";
      } else {
        badge.className = "badge risk risk-" + r.level;
        badge.textContent = r.level === "none" ? "OK" : LEVEL_LABEL[r.level] + " · " + r.score.toFixed(1);
      }
      head.appendChild(badge);
      li.appendChild(head);

      if (r) {
        var why = document.createElement("p");
        why.className = "small muted";
        why.textContent = r.reason;
        li.appendChild(why);
        if (r.fixedIn) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn btn-small";
          btn.textContent = "Update to " + r.fixedIn;
          btn.setAttribute("aria-label", "Update " + lib.name + " to version " + r.fixedIn);
          btn.addEventListener("click", function () { update(i, r.fixedIn); });
          li.appendChild(btn);
        }
      }
      listEl.appendChild(li);
    });
  }

  /* ---------- Buttons: update one library, scan all ---------- */
  function update(i, version) {
    libs[i].version = version;
    if (results) results[i] = null;
    render();
    statusEl.className = "status-line explainer-section warn";
    statusEl.textContent = "Updated " + libs[i].name + " to " + version + ". Press Scan again to see the new result.";
    var next = listEl.querySelectorAll("li")[i];
    if (next) {
      next.setAttribute("tabindex", "-1");
      next.focus();
    }
  }

  function scan() {
    var scanResult = L.scanAll(libs);
    results = scanResult.results;
    render();
    var counts = scanResult.counts;
    var flagged = scanResult.flagged;

    if (flagged === 0) {
      statusEl.className = "status-line explainer-section ok";
      statusEl.textContent = "Scan finished: no known problems found in these " + libs.length + " libraries.";
    } else {
      statusEl.className = "status-line explainer-section bad";
      statusEl.textContent = "Scan finished: " + flagged + " of " + libs.length + " libraries have known problems. Try updating them, then scan again.";
    }

    summaryEl.textContent = "";
    ["critical", "high", "medium", "low"].forEach(function (lvl) {
      var b = document.createElement("span");
      b.className = "badge risk risk-" + lvl;
      b.textContent = LEVEL_LABEL[lvl] + ": " + counts[lvl];
      summaryEl.appendChild(b);
    });
  }

  scanBtn.addEventListener("click", scan);
  resetBtn.addEventListener("click", reset);
  reset();
})();
