/* Two-stage intrusion detection demo: the page part.
   Simplified demo for learning, not the real system. The made-up traffic and
   the counting are in js/logic/ids-logic.js. */
(function () {
  "use strict";

  var slider = document.getElementById("ids-strict");
  if (!slider) return;
  var out = document.getElementById("ids-strict-out");
  var s1Grid = document.getElementById("ids-stage1");
  var s2Grid = document.getElementById("ids-stage2");
  var s1Stats = document.getElementById("ids-stats1");
  var s2Stats = document.getElementById("ids-stats2");
  var summary = document.getElementById("ids-summary");

  /* The made-up events and the two-stage counting live in js/logic/ids-logic.js
     so they can be tested; this file only draws the dots and numbers. */
  var L = window.IdsLogic;
  var events = L.makeEvents();

  /* ---------- Drawing helpers ---------- */
  function dot(ev, flagged) {
    var d = document.createElement("span");
    d.className = "dot" + (ev.attack ? " attack" : "") + (flagged ? " flagged" : "");
    return d;
  }

  function stats(listEl, rows) {
    listEl.textContent = "";
    rows.forEach(function (r) {
      var li = document.createElement("li");
      var label = document.createElement("span");
      label.textContent = r[0];
      var val = document.createElement("strong");
      val.textContent = r[1];
      li.appendChild(label);
      li.appendChild(val);
      listEl.appendChild(li);
    });
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  /* ---------- Redraw everything when the slider moves ---------- */
  function update() {
    var strict = Number(slider.value);
    var run = L.runStages(events, strict);
    var s1 = run.stage1, s2 = run.stage2, totalAttacks = run.totalAttacks;
    out.textContent = strict + " / 100 (flags anything with an unusualness score of " + run.threshold + " or more)";

    s1Grid.textContent = "";
    s2Grid.textContent = "";
    events.forEach(function (ev, i) {
      s1Grid.appendChild(dot(ev, run.marks[i].stage1));
      s2Grid.appendChild(dot(ev, run.marks[i].stage2)); /* Stage 2 only looks at what Stage 1 flagged */
    });

    stats(s1Stats, [
      ["Alerts raised", s1.flagged],
      ["Real attacks caught", s1.caught + " of " + totalAttacks],
      ["Missed attacks", s1.missed],
      ["False alarms", s1.falseAlarms]
    ]);
    stats(s2Stats, [
      ["Alerts raised", s2.flagged],
      ["Real attacks caught", s2.caught + " of " + totalAttacks],
      ["Missed attacks", s2.missed],
      ["False alarms", s2.falseAlarms]
    ]);

    summary.textContent =
      "With strictness " + strict + ": Stage 1 misses " + plural(s1.missed, "attack") +
      " and raises " + plural(s1.falseAlarms, "false alarm") + ". After Stage 2's second look, " +
      plural(s2.falseAlarms, "false alarm") + " " + (s2.falseAlarms === 1 ? "is" : "are") + " left and " +
      plural(s2.missed, "attack") + " " + (s2.missed === 1 ? "is" : "are") + " missed.";
  }

  slider.addEventListener("input", update);
  update();
})();
