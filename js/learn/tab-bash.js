/* Learner Space · Bash tab (LeetCode list + cheat sheet). Shared helpers come from js/learn/common.js (window.YCLearn). */
(function () {
  "use strict";

  var L = window.YCLearn;
  var el = L.el, data = L.data, problemList = L.problemList;

  function renderBash(panel) {
    panel.textContent = "";
    panel.appendChild(el("h2", { text: "Bash practice" }));
    panel.appendChild(el("h3", { text: "LeetCode Bash list" }));
    panel.appendChild(problemList(data.leetcode.bash.problems, false));

    panel.appendChild(el("h3", { class: "explainer-section", text: "Cheat sheet: Linux commands" }));
    panel.appendChild(el("p", { class: "muted", text: data.cheatsheet._about }));
    panel.appendChild(el("div", { class: "cheat" }, data.cheatsheet.commands.map(function (c) {
      return el("article", { class: "card" }, [
        el("h4", { text: c.name }),
        el("p", { class: "small", text: c.what }),
        el("pre", null, [el("code", { text: c.examples.join("\n") })])
      ]);
    })));
  }

  L.tabs.bash = renderBash;
})();
