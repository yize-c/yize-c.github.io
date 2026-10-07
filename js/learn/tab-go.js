/* Learner Space · Go tab (basics, re-solves, small tools). Shared helpers come from js/learn/common.js (window.YCLearn). */
(function () {
  "use strict";

  var L = window.YCLearn;
  var el = L.el, extLink = L.extLink, nextId = L.nextId, progress = L.progress, data = L.data;
  var AREAS = L.AREAS, myStatusKey = L.myStatusKey, myBadge = L.myBadge, yourCheckbox = L.yourCheckbox;
  var difficultyBadge = L.difficultyBadge, problemList = L.problemList;

  function checkItem(item, titleNode) {
    var inputId = nextId("go");
    var input = el("input", { type: "checkbox", id: inputId, "aria-label": "I've done this: " + item.title });
    input.checked = progress.isDone(item.id);
    input.addEventListener("change", function () { progress.setDone(item.id, input.checked); });
    return el("li", null, [
      el("div", { class: "card check-item" }, [
        input,
        el("div", { class: "ci-body" }, [
          el("div", { class: "ci-title" }, [titleNode || el("label", { for: inputId, text: item.title })]),
          el("p", { class: "ci-note", text: item.note }),
          el("p", { class: "ci-note" }, [myBadge(item.id)])
        ])
      ])
    ]);
  }

  function renderGo(panel) {
    var g = data.go;
    panel.textContent = "";
    panel.appendChild(el("h2", { text: "Go practice" }));
    panel.appendChild(el("p", { class: "section-intro", text: g.why }));
    panel.appendChild(el("p", { class: "small muted", text: "Tick a box when you've done an item yourself. Your ticks are saved only in this browser." }));

    panel.appendChild(el("h3", { text: "Basics" }));
    panel.appendChild(el("ul", { class: "checklist" }, g.basics.map(function (i) { return checkItem(i); })));

    panel.appendChild(el("h3", { class: "explainer-section", text: "Re-solve in Go" }));
    panel.appendChild(el("ul", { class: "checklist" }, g.resolve.map(function (i) {
      var t = el("span", null, [
        extLink(i.url, i.number + ". " + i.title),
        el("span", { class: "visually-hidden", text: " (opens LeetCode in a new tab)" })
      ]);
      return checkItem(i, t);
    })));

    panel.appendChild(el("h3", { class: "explainer-section", text: "Small tools to build" }));
    panel.appendChild(el("ul", { class: "checklist" }, g.tools.map(function (i) { return checkItem(i); })));
  }

  L.tabs.go = renderGo;
})();
