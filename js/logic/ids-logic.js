/* Two-stage intrusion detection demo: the logic only (no page code), so it can be tested.
   Works in the browser as window.IdsLogic and in Node with require().
   All traffic is made up: each event has a hidden "real" label (normal or attack),
   an "unusualness" score that Stage 1 looks at, and a verdict from a second,
   more careful check (Stage 2). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.IdsLogic = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Small seeded random generator, so everyone sees the same made-up data. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var SEED = 2026;
  var ATTACKS = [4, 9, 15, 21, 22, 30, 36, 41, 47, 50, 55, 58];

  /* Build the 60 made-up events. Same seed, same events, every time. */
  function makeEvents() {
    var rand = mulberry32(SEED);
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
    return events;
  }

  /* Run both stages at one strictness (0–100). Stage 1 flags anything with a
     score of (100 − strictness) or more; Stage 2 only re-checks what Stage 1 flagged. */
  function runStages(events, strictness) {
    var threshold = 100 - strictness;
    var s1 = { flagged: 0, caught: 0, falseAlarms: 0 };
    var s2 = { flagged: 0, caught: 0, falseAlarms: 0 };
    var marks = events.map(function (ev) {
      var f1 = ev.score >= threshold;
      var f2 = f1 && ev.stage2;
      if (f1) { s1.flagged++; if (ev.attack) s1.caught++; else s1.falseAlarms++; }
      if (f2) { s2.flagged++; if (ev.attack) s2.caught++; else s2.falseAlarms++; }
      return { stage1: f1, stage2: f2 };
    });
    var totalAttacks = events.filter(function (ev) { return ev.attack; }).length;
    s1.missed = totalAttacks - s1.caught;
    s2.missed = totalAttacks - s2.caught;
    return { threshold: threshold, totalAttacks: totalAttacks, stage1: s1, stage2: s2, marks: marks };
  }

  return { makeEvents: makeEvents, runStages: runStages, ATTACKS: ATTACKS };
});
