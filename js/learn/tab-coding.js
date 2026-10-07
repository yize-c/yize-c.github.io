/* Learner Space · Coding tab (LeetCode, Python). Shared helpers come from js/learn/common.js (window.YCLearn). */
(function () {
  "use strict";

  var L = window.YCLearn;
  var el = L.el, nextId = L.nextId, data = L.data, problemList = L.problemList;

  function renderCoding(panel) {
    var c = data.leetcode.coding;
    panel.textContent = "";
    panel.appendChild(el("h2", { text: "Coding practice (Python)" }));
    panel.appendChild(el("p", { class: "section-intro", text: "My LeetCode list, grouped by topic. Each problem links to LeetCode, where you can read the full problem. The hints and key ideas are my own short notes, hidden until you open them." }));

    var catId = nextId("f"), diffId = nextId("f");
    var catSel = el("select", { id: catId }, [el("option", { value: "", text: "All categories" })].concat(
      c.categories.map(function (k) { return el("option", { value: k, text: k }); })));
    var diffSel = el("select", { id: diffId }, [
      el("option", { value: "", text: "All difficulties" }),
      el("option", { value: "Easy", text: "Easy" }),
      el("option", { value: "Medium", text: "Medium" })
    ]);
    var count = el("p", { class: "small muted", role: "status", "aria-live": "polite" });
    panel.appendChild(el("div", { class: "filters" }, [
      el("div", { class: "field" }, [el("label", { for: catId, text: "Category" }), catSel]),
      el("div", { class: "field" }, [el("label", { for: diffId, text: "Difficulty" }), diffSel])
    ]));
    panel.appendChild(count);
    var listWrap = el("div");
    panel.appendChild(listWrap);

    function draw() {
      listWrap.textContent = "";
      var shown = 0;
      c.categories.forEach(function (cat) {
        if (catSel.value && catSel.value !== cat) return;
        var items = c.problems.filter(function (p) {
          return p.category === cat && (!diffSel.value || p.difficulty === diffSel.value);
        });
        if (!items.length) return;
        shown += items.length;
        listWrap.appendChild(el("section", { class: "problem-group" }, [
          el("h3", { text: cat + " (" + items.length + ")" }),
          problemList(items, false)
        ]));
      });
      count.textContent = "Showing " + shown + " of " + c.problems.length + " problems.";
      if (!shown) listWrap.appendChild(el("p", { class: "muted", text: "No problems match these filters." }));
    }
    catSel.addEventListener("change", draw);
    diffSel.addEventListener("change", draw);
    draw();
  }

  L.tabs.coding = renderCoding;
})();
