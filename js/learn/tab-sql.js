/* Learner Space · SQL tab (LeetCode list + playground). Shared helpers come from js/learn/common.js (window.YCLearn). */
(function () {
  "use strict";

  var L = window.YCLearn;
  var el = L.el, progress = L.progress, data = L.data, myBadge = L.myBadge, problemList = L.problemList;

  function renderSql(panel) {
    panel.textContent = "";
    panel.appendChild(el("h2", { text: "SQL practice" }));
    panel.appendChild(el("p", { class: "section-intro", text: "Two parts: my LeetCode SQL list, and a playground with my own exercises that runs SQL right in your browser." }));

    var pgRoot = el("div");
    panel.appendChild(el("section", { class: "explainer-section", "aria-labelledby": "sql-pg-title" }, [
      el("h3", { id: "sql-pg-title", text: "SQL playground" }),
      el("p", { class: "muted", text: "A small sample database about students, courses, and enrollments. Pick an exercise, write a query, and press Run. Your result is compared with the expected result. Nothing is sent anywhere; it all runs on your device using sql.js (SQLite)." }),
      pgRoot
    ]));
    panel.appendChild(el("section", { class: "explainer-section", "aria-labelledby": "sql-lc-title" }, [
      el("h3", { id: "sql-lc-title", text: "LeetCode SQL list" }),
      problemList(data.leetcode.sql.problems, false)
    ]));

    if (window.SqlPlayground) {
      window.SqlPlayground.mount(pgRoot, data.sqlExercises, {
        progress: progress, myBadge: myBadge
      });
    } else {
      pgRoot.appendChild(el("p", { class: "error-box", text: "The SQL playground couldn't load." }));
    }
  }

  L.tabs.sql = renderSql;
})();
