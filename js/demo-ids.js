/* Two-stage intrusion detection demo: the page part.
   Simplified demo for learning, not the real system. The made-up traffic and
   the counting are in js/logic/ids-logic.js. */
(function () {
  "use strict";

  var el = window.YC.el;
  /* The made-up events and the two-stage counting live in js/logic/ids-logic.js
     so they can be tested; this file only draws the dots and numbers. */
  var L = window.IdsLogic;

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  class IntrusionDetectionDemo {
    constructor(ids) {
      var $ = function (id) { return document.getElementById(id); };
      this.slider = $(ids.slider);
      this.out = $(ids.out);
      this.grids = [$(ids.grid1), $(ids.grid2)];
      this.statLists = [$(ids.stats1), $(ids.stats2)];
      this.summary = $(ids.summary);
      this.events = L.makeEvents();
      var self = this;
      this.slider.addEventListener("input", function () { self.update(); });
      this.update();
    }

    /* ---------- Drawing helpers ---------- */
    static dot(ev, flagged) {
      return el("span", { class: "dot" + (ev.attack ? " attack" : "") + (flagged ? " flagged" : "") });
    }

    static stats(listEl, s, totalAttacks) {
      listEl.textContent = "";
      [
        ["Alerts raised", s.flagged],
        ["Real attacks caught", s.caught + " of " + totalAttacks],
        ["Missed attacks", s.missed],
        ["False alarms", s.falseAlarms]
      ].forEach(function (r) {
        listEl.appendChild(el("li", null, [el("span", { text: r[0] }), el("strong", { text: String(r[1]) })]));
      });
    }

    /* ---------- Redraw everything when the slider moves ---------- */
    update() {
      var strict = Number(this.slider.value);
      var run = L.runStages(this.events, strict);
      var s1 = run.stage1, s2 = run.stage2;
      this.out.textContent = strict + " / 100 (flags anything with an unusualness score of " + run.threshold + " or more)";

      var grids = this.grids;
      grids.forEach(function (g) { g.textContent = ""; });
      this.events.forEach(function (ev, i) {
        grids[0].appendChild(IntrusionDetectionDemo.dot(ev, run.marks[i].stage1));
        grids[1].appendChild(IntrusionDetectionDemo.dot(ev, run.marks[i].stage2)); /* Stage 2 only looks at what Stage 1 flagged */
      });
      IntrusionDetectionDemo.stats(this.statLists[0], s1, run.totalAttacks);
      IntrusionDetectionDemo.stats(this.statLists[1], s2, run.totalAttacks);

      this.summary.textContent =
        "With strictness " + strict + ": Stage 1 misses " + plural(s1.missed, "attack") +
        " and raises " + plural(s1.falseAlarms, "false alarm") + ". After Stage 2's second look, " +
        plural(s2.falseAlarms, "false alarm") + " " + (s2.falseAlarms === 1 ? "is" : "are") + " left and " +
        plural(s2.missed, "attack") + " " + (s2.missed === 1 ? "is" : "are") + " missed.";
    }
  }

  if (document.getElementById("ids-strict")) {
    new IntrusionDetectionDemo({
      slider: "ids-strict", out: "ids-strict-out", grid1: "ids-stage1", grid2: "ids-stage2",
      stats1: "ids-stats1", stats2: "ids-stats2", summary: "ids-summary"
    });
  }
})();
