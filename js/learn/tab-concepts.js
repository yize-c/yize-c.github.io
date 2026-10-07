/* Learner Space · Concepts tab (flashcards and quiz). Shared helpers come from js/learn/common.js (window.YCLearn). */
(function () {
  "use strict";

  var L = window.YCLearn;
  var el = L.el, extLink = L.extLink, nextId = L.nextId, progress = L.progress, data = L.data;
  var AREAS = L.AREAS, myStatusKey = L.myStatusKey, myBadge = L.myBadge, yourCheckbox = L.yourCheckbox;
  var difficultyBadge = L.difficultyBadge, problemList = L.problemList;

  var concept = { area: "networking", mode: "cards", index: {}, reviewOnly: false };

  /* Helpers: which cards to show (all, or only "Review again"), and a fair shuffle for quizzes. */
  function cardsFor(area) {
    var all = data.concepts[area].cards;
    if (!concept.reviewOnly) return all;
    return all.filter(function (c) { return progress.card(c.id) === "review"; });
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function renderConcepts(panel) {
    panel.textContent = "";
    panel.appendChild(el("h2", { text: "Concepts" }));
    panel.appendChild(el("p", { class: "section-intro", text: "Flashcards and short quizzes for the topics I'm studying. Each card has a hint, a short answer, and a plain-language explanation for beginners." }));

    var areaGroup = el("div", { class: "pill-group", role: "group", "aria-label": "Topic area" });
    AREAS.forEach(function (a) {
      areaGroup.appendChild(el("button", {
        type: "button", class: "pill", "aria-pressed": concept.area === a ? "true" : "false",
        text: data.concepts[a].title,
        onclick: function () { concept.area = a; renderConcepts(panel); }
      }));
    });
    var modeGroup = el("div", { class: "pill-group", role: "group", "aria-label": "Mode" });
    [["cards", "Flashcards"], ["quiz", "Quiz"]].forEach(function (m) {
      modeGroup.appendChild(el("button", {
        type: "button", class: "pill", "aria-pressed": concept.mode === m[0] ? "true" : "false",
        text: m[1],
        onclick: function () { concept.mode = m[0]; renderConcepts(panel); }
      }));
    });
    panel.appendChild(areaGroup);
    panel.appendChild(modeGroup);

    var body = el("div");
    panel.appendChild(body);
    if (concept.mode === "cards") renderFlashcards(body, panel);
    else renderQuiz(body);
  }

  function renderFlashcards(body, panel) {
    var area = concept.area;
    var reviewId = nextId("rev");
    var review = el("input", { type: "checkbox", id: reviewId });
    review.checked = concept.reviewOnly;
    review.addEventListener("change", function () {
      concept.reviewOnly = review.checked;
      concept.index[area] = 0;
      renderConcepts(panel);
      var again = document.getElementById(reviewId);
      if (again) again.focus();
    });
    body.appendChild(el("p", { class: "check-row" }, [review, el("label", { for: reviewId, text: "Only show cards I marked \"Review again\"" })]));

    var cards = cardsFor(area);
    if (!cards.length) {
      body.appendChild(el("p", { class: "status-line", text: "No cards marked \"Review again\" in this area. Nice work!" }));
      return;
    }
    var i = Math.min(concept.index[area] || 0, cards.length - 1);
    var c = cards[i];

    var live = el("div", { "aria-live": "polite" });
    var hintBox = el("div", { class: "fc-box", hidden: true }, [el("h4", { text: "Hint" }), el("p", { text: c.hint })]);
    var answerBox = el("div", { class: "fc-box", hidden: true }, [
      el("h4", { text: "Answer" }), el("p", { text: c.answer }),
      el("h4", { text: "In plain words" }), el("p", { text: c.explanation })
    ]);
    live.appendChild(hintBox);
    live.appendChild(answerBox);

    var hintBtn = el("button", { type: "button", class: "btn btn-small", "aria-expanded": "false", text: "Hint" });
    hintBtn.addEventListener("click", function () {
      var open = hintBox.hidden;
      hintBox.hidden = !open;
      hintBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    var ansBtn = el("button", { type: "button", class: "btn btn-small btn-primary", "aria-expanded": "false", text: "Show answer" });
    ansBtn.addEventListener("click", function () {
      var open = answerBox.hidden;
      answerBox.hidden = !open;
      ansBtn.setAttribute("aria-expanded", open ? "true" : "false");
      ansBtn.textContent = open ? "Hide answer" : "Show answer";
    });

    var state = progress.card(c.id);
    var gotBtn = el("button", { type: "button", class: "btn btn-small", "aria-pressed": state === "got" ? "true" : "false", text: "✓ Got it" });
    var revBtn = el("button", { type: "button", class: "btn btn-small", "aria-pressed": state === "review" ? "true" : "false", text: "↻ Review again" });
    function mark(v) {
      progress.setCard(c.id, v);
      gotBtn.setAttribute("aria-pressed", v === "got" ? "true" : "false");
      revBtn.setAttribute("aria-pressed", v === "review" ? "true" : "false");
      markMsg.textContent = v === "got" ? "Marked as \"Got it\"." : "Marked as \"Review again\".";
    }
    var markMsg = el("span", { class: "small muted", role: "status" });
    gotBtn.addEventListener("click", function () { mark("got"); });
    revBtn.addEventListener("click", function () { mark("review"); });

    function go(delta) {
      concept.index[area] = (i + delta + cards.length) % cards.length;
      renderConcepts(panel);
      var q = panel.querySelector(".fc-question");
      if (q) q.focus();
    }

    body.appendChild(el("article", { class: "card flashcard" }, [
      el("p", { class: "fc-topic" }, [data.concepts[area].title + " · " + c.topic + " · card " + (i + 1) + " of " + cards.length]),
      el("p", { class: "fc-question", tabindex: "-1", text: c.question }),
      el("div", { class: "btn-row" }, [hintBtn, ansBtn]),
      live,
      el("div", { class: "btn-row" }, [gotBtn, revBtn, markMsg]),
      el("div", { class: "fc-nav" }, [
        el("button", { type: "button", class: "btn btn-small", text: "← Previous", onclick: function () { go(-1); } }),
        myBadge(c.id),
        el("button", { type: "button", class: "btn btn-small", text: "Next →", onclick: function () { go(1); } })
      ])
    ]));
  }

  function renderQuiz(body) {
    var area = concept.area;
    var pool = data.concepts[area].cards.filter(function (c) { return c.quiz; });
    var picked = shuffle(pool).slice(0, Math.min(5, pool.length));

    var form = el("form", { class: "quiz", novalidate: true });
    var qName = nextId("q");
    picked.forEach(function (c, qi) {
      var name = qName + "-" + qi;
      var fb = el("p", { class: "feedback", "aria-live": "polite" });
      var fs = el("fieldset", null, [el("legend", { text: (qi + 1) + ". " + c.quiz.question })]);
      c.quiz.options.forEach(function (opt, oi) {
        var id = name + "-" + oi;
        fs.appendChild(el("div", { class: "option" }, [
          el("input", { type: "radio", name: name, id: id, value: String(oi) }),
          el("label", { for: id, text: opt })
        ]));
      });
      fs.appendChild(fb);
      form.appendChild(fs);
    });

    var result = el("p", { class: "status-line", role: "status", "aria-live": "polite", text: "Answer the questions, then press Check answers." });
    form.appendChild(el("div", { class: "btn-row" }, [
      el("button", { type: "submit", class: "btn btn-primary", text: "Check answers" }),
      el("button", { type: "button", class: "btn", text: "New quiz", onclick: function () {
        body.textContent = "";
        renderQuiz(body);
        var first = body.querySelector("input");
        if (first) first.focus();
      } })
    ]));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var score = 0;
      picked.forEach(function (c, qi) {
        var chosen = form.querySelector("input[name='" + qName + "-" + qi + "']:checked");
        var fb = form.querySelectorAll(".feedback")[qi];
        var right = c.quiz.options[c.quiz.answer];
        if (!chosen) {
          fb.className = "feedback status-line warn";
          fb.textContent = "No answer chosen. The answer is: " + right + ". " + c.quiz.why;
        } else if (Number(chosen.value) === c.quiz.answer) {
          score++;
          fb.className = "feedback status-line ok";
          fb.textContent = "Correct. " + c.quiz.why;
        } else {
          fb.className = "feedback status-line bad";
          fb.textContent = "Not quite. The answer is: " + right + ". " + c.quiz.why;
        }
      });
      result.className = "status-line " + (score === picked.length ? "ok" : "");
      result.textContent = "You got " + score + " of " + picked.length + ". Press New quiz for a different set of questions.";
    });

    body.appendChild(el("p", { class: "muted small", text: picked.length + " random questions from " + data.concepts[area].title + "." }));
    body.appendChild(form);
    body.appendChild(result);
  }

  L.tabs.concepts = renderConcepts;
})();
