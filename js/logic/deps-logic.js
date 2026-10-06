/* Dependency scan demo: the logic only (no page code), so it can be tested.
   Works in the browser as window.DepsLogic and in Node with require().
   The libraries and "known problems" are made up for the demo; the real tool
   asks the OSV database instead. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DepsLogic = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* A tiny, made-up "recall list". Each entry says: versions below `fixedIn`
     have this problem. Scores use the same 0–10 bands as CVSS. */
  var KNOWN_PROBLEMS = {
    "web-forms": { fixedIn: "1.2.0", score: 9.6, reason: "Can let an attacker run their own script in a visitor's browser (XSS)." },
    "zip-helper": { fixedIn: "1.5.3", score: 8.1, reason: "Can write files outside the target folder when unzipping a crafted file." },
    "pretty-dates": { fixedIn: "2.0.0", score: 7.5, reason: "Very long input makes it run for minutes, which could slow a server down." },
    "log-writer": { fixedIn: "4.0.1", score: 5.3, reason: "In some settings it writes passwords into the log file." },
    "math-tools": { fixedIn: "1.1.2", score: 3.1, reason: "Gives wrong answers for some very large numbers." }
  };

  /* The pretend project's libraries when the demo starts. */
  var START = [
    { name: "web-forms", version: "0.9.0" },
    { name: "tiny-parser", version: "3.4.1" },
    { name: "zip-helper", version: "1.5.0" },
    { name: "pretty-dates", version: "1.0.2" },
    { name: "color-print", version: "2.1.0" },
    { name: "log-writer", version: "4.0.0" },
    { name: "math-tools", version: "1.1.0" }
  ];

  var LEVEL_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low", none: "No known problems" };

  /* Compare "1.2.3"-style versions: negative if a < b, 0 if equal, positive if a > b. */
  function cmpVersion(a, b) {
    var pa = a.split(".").map(Number), pb = b.split(".").map(Number);
    for (var i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
    }
    return 0;
  }

  /* CVSS-style bands: Critical 9.0–10, High 7.0–8.9, Medium 4.0–6.9, Low 0.1–3.9. */
  function levelFor(score) {
    if (score >= 9) return "critical";
    if (score >= 7) return "high";
    if (score >= 4) return "medium";
    if (score > 0) return "low";
    return "none";
  }

  /* Check one library against the recall list. */
  function check(lib) {
    var p = KNOWN_PROBLEMS[lib.name];
    if (p && cmpVersion(lib.version, p.fixedIn) < 0) {
      return { level: levelFor(p.score), score: p.score, reason: p.reason, fixedIn: p.fixedIn };
    }
    return { level: "none", score: 0, reason: p ? "Fixed in this version." : "Not on the known-problems list.", fixedIn: null };
  }

  /* Check every library and count how many fall in each risk level. */
  function scanAll(libs) {
    var results = libs.map(check);
    var counts = { critical: 0, high: 0, medium: 0, low: 0 };
    results.forEach(function (r) { if (r.level !== "none") counts[r.level]++; });
    var flagged = counts.critical + counts.high + counts.medium + counts.low;
    return { results: results, counts: counts, flagged: flagged };
  }

  /* A fresh copy of the starting libraries, so the demo can be reset. */
  function startingLibs() {
    return START.map(function (l) { return { name: l.name, version: l.version }; });
  }

  return {
    KNOWN_PROBLEMS: KNOWN_PROBLEMS,
    LEVEL_LABEL: LEVEL_LABEL,
    cmpVersion: cmpVersion,
    levelFor: levelFor,
    check: check,
    scanAll: scanAll,
    startingLibs: startingLibs
  };
});
