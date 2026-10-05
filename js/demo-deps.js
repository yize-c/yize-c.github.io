/* Dependency scan demo.
   Simplified demo for learning: the libraries and "known problems" below are
   made up. The real tool queries the OSV database instead. */
(function () {
  "use strict";

  var listEl = document.getElementById("dep-list");
  var statusEl = document.getElementById("dep-status");
  var summaryEl = document.getElementById("dep-summary");
  var scanBtn = document.getElementById("dep-scan");
  var resetBtn = document.getElementById("dep-reset");
  if (!listEl) return;

  /* A tiny, made-up "recall list". Each entry says: versions below `fixedIn`
     have this problem. Scores use the same 0–10 bands as CVSS. */
  var KNOWN_PROBLEMS = {
    "web-forms": { fixedIn: "1.2.0", score: 9.6, reason: "Can let an attacker run their own script in a visitor's browser (XSS)." },
    "zip-helper": { fixedIn: "1.5.3", score: 8.1, reason: "Can write files outside the target folder when unzipping a crafted file." },
    "pretty-dates": { fixedIn: "2.0.0", score: 7.5, reason: "Very long input makes it run for minutes, which could slow a server down." },
    "log-writer": { fixedIn: "4.0.1", score: 5.3, reason: "In some settings it writes passwords into the log file." },
    "math-tools": { fixedIn: "1.1.2", score: 3.1, reason: "Gives wrong answers for some very large numbers." }
  };

  var START = [
    { name: "web-forms", version: "0.9.0" },
    { name: "tiny-parser", version: "3.4.1" },
    { name: "zip-helper", version: "1.5.0" },
    { name: "pretty-dates", version: "1.0.2" },
    { name: "color-print", version: "2.1.0" },
    { name: "log-writer", version: "4.0.0" },
    { name: "math-tools", version: "1.1.0" }
  ];

  var libs, results;

  function cmpVersion(a, b) {
    var pa = a.split(".").map(Number), pb = b.split(".").map(Number);
    for (var i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
    }
    return 0;
  }

  function levelFor(score) {
    if (score >= 9) return "critical";
    if (score >= 7) return "high";
    if (score >= 4) return "medium";
    if (score > 0) return "low";
    return "none";
  }

  var LEVEL_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low", none: "No known problems" };

  function check(lib) {
    var p = KNOWN_PROBLEMS[lib.name];
    if (p && cmpVersion(lib.version, p.fixedIn) < 0) {
      return { level: levelFor(p.score), score: p.score, reason: p.reason, fixedIn: p.fixedIn };
    }
    return { level: "none", score: 0, reason: p ? "Fixed in this version." : "Not on the known-problems list.", fixedIn: null };
  }

  function reset() {
    libs = START.map(function (l) { return { name: l.name, version: l.version }; });
    results = null;
    render();
    statusEl.className = "status-line";
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

  function update(i, version) {
    libs[i].version = version;
    if (results) results[i] = null;
    render();
    statusEl.className = "status-line warn";
    statusEl.textContent = "Updated " + libs[i].name + " to " + version + ". Press Scan again to see the new result.";
    var next = listEl.querySelectorAll("li")[i];
    if (next) {
      next.setAttribute("tabindex", "-1");
      next.focus();
    }
  }

  function scan() {
    results = libs.map(check);
    render();
    var counts = { critical: 0, high: 0, medium: 0, low: 0 };
    results.forEach(function (r) { if (r.level !== "none") counts[r.level]++; });
    var flagged = counts.critical + counts.high + counts.medium + counts.low;

    if (flagged === 0) {
      statusEl.className = "status-line ok";
      statusEl.textContent = "Scan finished: no known problems found in these " + libs.length + " libraries.";
    } else {
      statusEl.className = "status-line bad";
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
