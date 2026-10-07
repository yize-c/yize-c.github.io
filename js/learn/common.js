/* Learner Space: what every tab shares (window.YCLearn).
   The data comes from data/*.json, which scripts/sync_interview_prep.py builds from
   github.com/yize-c/interview-prep (the README is the single source of truth).
   "My progress" is mine, from that README; "Your progress" is the visitor's own,
   saved in localStorage when allowed. Each tab lives in js/learn/tab-*.js and
   js/learn.js switches between them. */
(function () {
  "use strict";

  /* Shared helpers (DOM building, safe storage, visitor progress) are in js/core/ui.js. */
  var YC = window.YC;
  var el = YC.el, extLink = YC.extLink, nextId = YC.nextId;
  var progress = new YC.VisitorProgress("yc-learn-v1");

  /* ---------- My progress ---------- */
  var mine = {};
  var STATUS = {
    "not started": { label: "Not started", cls: "status-not-started" },
    "in progress": { label: "In progress", cls: "status-in-progress" },
    "done": { label: "Done", cls: "status-done" }
  };

  /* "Me" badge (from data/my-progress.json) and "You" checkbox (from localStorage). */
  function myStatusKey(id) {
    var s = String(mine[id] || "not started").toLowerCase();
    return STATUS[s] ? s : "not started";
  }

  function myBadge(id) {
    var s = STATUS[myStatusKey(id)];
    return el("span", { class: "badge status-badge " + s.cls, title: "My progress (from my interview-prep repo)" }, ["Me: " + s.label]);
  }

  function yourCheckbox(id, label, onChange) {
    var inputId = nextId("you");
    var input = el("input", { type: "checkbox", id: inputId });
    input.checked = progress.isDone(id);
    input.addEventListener("change", function () {
      progress.setDone(id, input.checked);
      if (onChange) onChange(input.checked);
    });
    return el("span", { class: "check-row" }, [input, el("label", { for: inputId, text: label })]);
  }

  /* ---------- Data loading ---------- */
  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " (" + r.status + ")");
      return r.json();
    });
  }

  var AREAS = ["networking", "linux", "testing", "devops", "security"];
  var data = {};

  /* ---------- Problem list (LeetCode) ---------- */
  function difficultyBadge(d) {
    return el("span", { class: "badge diff-" + d.toLowerCase() }, [d]);
  }

  /* One compact row per problem: number, title, difficulty, my status, and "I solved it".
     Clicking the row (or pressing Enter on its title) opens the hint, key idea and solution. */
  function solutionBody(sol) {
    if (!sol || !(sol.code || sol.url)) return el("p", { class: "muted", text: "Coming soon." });
    return el("div", null, [
      sol.code ? el("pre", null, [el("code", { text: sol.code })]) : null,
      sol.url ? el("p", null, [extLink(sol.url, "Open my solution file")]) : null
    ]);
  }

  function renderProblem(p, showCategory) {
    var panelId = nextId("prob");
    var toggle = el("button", { type: "button", class: "prow-toggle", "aria-expanded": "false", "aria-controls": panelId }, [
      el("span", { class: "prow-caret", "aria-hidden": "true", text: "▸" }),
      el("span", { class: "prow-title", text: p.number + ". " + p.title })
    ]);
    var panel = el("div", { class: "prow-panel", id: panelId, hidden: true }, [
      el("p", null, [extLink(p.url, "Open on LeetCode ↗"), el("span", { class: "visually-hidden", text: " (opens in a new tab)" })]),
      el("h4", { text: "Hint" }), el("p", { text: p.hint }),
      el("h4", { text: "Key idea" }), el("p", { text: p.keyIdea }),
      el("h4", { text: "My solution" }), solutionBody(data.solutions[p.id])
    ]);
    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      row.classList.toggle("open", open);
    }
    toggle.addEventListener("click", function () { setOpen(panel.hidden); });

    var row = el("div", { class: "prow" }, [
      toggle,
      el("span", { class: "prow-meta" }, [
        difficultyBadge(p.difficulty),
        showCategory ? el("span", { class: "badge badge-muted", text: p.category }) : null,
        myBadge(p.id),
        yourCheckbox(p.id, "I solved it")
      ])
    ]);
    /* The whole row is clickable, except the checkbox and its label. */
    row.addEventListener("click", function (e) {
      if (e.target.closest(".prow-toggle, input, label, a")) return;
      setOpen(panel.hidden);
    });

    return el("li", { class: "prow-item" }, [row, panel]);
  }

  function problemList(problems, showCategory) {
    return el("ul", { class: "problem-list prow-list" }, problems.map(function (p) { return renderProblem(p, showCategory); }));
  }

  window.YCLearn = {
    el: el, extLink: extLink, nextId: nextId, progress: progress,
    data: data, mine: mine, AREAS: AREAS,
    myStatusKey: myStatusKey, myBadge: myBadge, getJSON: getJSON, problemList: problemList,
    tabs: {}
  };
})();
