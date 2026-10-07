/* Learner Space · Study plan tab (progress bars and certificates). Shared helpers come from js/learn/common.js (window.YCLearn). */
(function () {
  "use strict";

  var L = window.YCLearn;
  var el = L.el, nextId = L.nextId, progress = L.progress, data = L.data, AREAS = L.AREAS, myStatusKey = L.myStatusKey;

  function sections() {
    var lc = data.leetcode, g = data.go;
    var list = [
      { name: "Coding (Python)", ids: lc.coding.problems.map(function (p) { return p.id; }) },
      { name: "SQL: LeetCode list", ids: lc.sql.problems.map(function (p) { return p.id; }) },
      { name: "SQL: playground", ids: data.sqlExercises.exercises.map(function (x) { return x.id; }) },
      { name: "Bash: LeetCode list", ids: lc.bash.problems.map(function (p) { return p.id; }) },
      { name: "Go: basics", ids: g.basics.map(function (x) { return x.id; }) },
      { name: "Go: re-solve", ids: g.resolve.map(function (x) { return x.id; }) },
      { name: "Go: small tools", ids: g.tools.map(function (x) { return x.id; }) }
    ];
    AREAS.forEach(function (a) {
      list.push({ name: "Concepts: " + data.concepts[a].title, ids: data.concepts[a].cards.map(function (c) { return c.id; }), concept: true });
    });
    return list;
  }

  /* One labelled <progress> bar. */
  function bar(label, value, max, cls) {
    var id = nextId("bar");
    return el("div", null, [
      el("div", { class: "bar-label" }, [el("span", { id: id, text: label }), el("span", { text: value + " / " + max })]),
      el("progress", { class: cls || null, max: String(max), value: String(value), "aria-labelledby": id })
    ]);
  }

  function renderPlan(panel) {
    panel.textContent = "";
    panel.appendChild(el("h2", { text: "Study plan" }));
    var updated = data.mine.updated ? " Last updated: " + data.mine.updated + "." : "";
    panel.appendChild(el("p", { class: "section-intro", text: "An overview of every section. \"Me\" is my real progress, synced from my interview-prep repo." + updated + " \"You\" is your own progress in this browser." }));

    var card = el("div", { class: "card" });
    sections().forEach(function (s) {
      var myDone = 0, myProg = 0, yours = 0;
      s.ids.forEach(function (id) {
        var k = myStatusKey(id);
        if (k === "done") myDone++;
        else if (k === "in progress") myProg++;
        if (s.concept ? progress.card(id) === "got" : progress.isDone(id)) yours++;
      });
      card.appendChild(el("div", { class: "progress-row" }, [
        el("div", { class: "progress-head" }, [
          el("strong", { text: s.name }),
          el("span", { class: "small muted", text: s.ids.length + " items" + (myProg ? " · " + myProg + " in progress for me" : "") })
        ]),
        bar("Me: done", myDone, s.ids.length),
        bar("You: done", yours, s.ids.length, "yours")
      ]));
    });
    panel.appendChild(card);

    panel.appendChild(el("h3", { class: "explainer-section", text: "Certificate goals" }));
    panel.appendChild(el("div", { class: "grid grid-3 equal-rows" }, [
      certCard("CompTIA Security+", "CompTIA", "Preparing", "badge-warning"),
      certCard("AWS Certified Cloud Practitioner", "Amazon Web Services", "Preparing", "badge-warning"),
      certCard("CISSP", "ISC2", "Long-term goal", "badge-purple badge-dashed")
    ]));
  }

  function certCard(name, org, status, cls) {
    return el("article", { class: "card" }, [
      el("p", null, [el("span", { class: "badge " + cls, text: status })]),
      el("h4", { text: name }),
      el("p", { class: "item-meta", text: org })
    ]);
  }

  L.tabs.plan = renderPlan;
})();
