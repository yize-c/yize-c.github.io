/* Two-stage intrusion detection demo.
   Simplified demo for learning, not the real system. All traffic below is
   made up: each event has a hidden "real" label (normal or attack), an
   "unusualness" score that Stage 1 looks at, and a verdict from a second,
   more careful check (Stage 2). */
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

  /* Small seeded random generator, so everyone sees the same made-up data. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var rand = mulberry32(2026);
  var ATTACKS = [4, 9, 15, 21, 22, 30, 36, 41, 47, 50, 55, 58];
  var events = [];
  for (var i = 0; i < 60; i++) {
    var attack = ATTACKS.indexOf(i) !== -1;
    var score;
    if (attack) {
      score = 35 + rand() * 65;
    } else {
      score = rand() * 55;
      if (rand() < 0.2) score += 15 + rand() * 25; /* some normal traffic looks odd */
    }
    /* Stage 2 is more careful but not perfect. */
    var stage2SaysAttack = attack ? rand() < 0.92 : rand() < 0.15;
    events.push({ attack: attack, score: Math.round(score), stage2: stage2SaysAttack });
  }
  var totalAttacks = ATTACKS.length;

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

  function update() {
    var strict = Number(slider.value);
    var threshold = 100 - strict;
    out.textContent = strict + " / 100 (flags anything with an unusualness score of " + threshold + " or more)";

    var s1 = { flagged: 0, caught: 0, falseAlarms: 0 };
    var s2 = { flagged: 0, caught: 0, falseAlarms: 0 };
    s1Grid.textContent = "";
    s2Grid.textContent = "";

    events.forEach(function (ev) {
      var f1 = ev.score >= threshold;
      var f2 = f1 && ev.stage2; /* Stage 2 only looks at what Stage 1 flagged */
      if (f1) { s1.flagged++; if (ev.attack) s1.caught++; else s1.falseAlarms++; }
      if (f2) { s2.flagged++; if (ev.attack) s2.caught++; else s2.falseAlarms++; }
      s1Grid.appendChild(dot(ev, f1));
      s2Grid.appendChild(dot(ev, f2));
    });

    stats(s1Stats, [
      ["Alerts raised", s1.flagged],
      ["Real attacks caught", s1.caught + " of " + totalAttacks],
      ["Missed attacks", totalAttacks - s1.caught],
      ["False alarms", s1.falseAlarms]
    ]);
    stats(s2Stats, [
      ["Alerts raised", s2.flagged],
      ["Real attacks caught", s2.caught + " of " + totalAttacks],
      ["Missed attacks", totalAttacks - s2.caught],
      ["False alarms", s2.falseAlarms]
    ]);

    summary.textContent =
      "With strictness " + strict + ": Stage 1 misses " + plural(totalAttacks - s1.caught, "attack") +
      " and raises " + plural(s1.falseAlarms, "false alarm") + ". After Stage 2's second look, " +
      plural(s2.falseAlarms, "false alarm") + " " + (s2.falseAlarms === 1 ? "is" : "are") + " left and " +
      plural(totalAttacks - s2.caught, "attack") + " " + (totalAttacks - s2.caught === 1 ? "is" : "are") + " missed.";
  }

  slider.addEventListener("input", update);
  update();
})();
