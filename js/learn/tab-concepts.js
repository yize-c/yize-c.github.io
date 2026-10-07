/* Learner Space · Concepts tab (flashcards and quiz). Shared helpers come from js/learn/common.js (window.YCLearn). */
(function () {
  "use strict";

  var L = window.YCLearn;
  var el = L.el, nextId = L.nextId, progress = L.progress, data = L.data, AREAS = L.AREAS, myBadge = L.myBadge;

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

  /* "Only show cards I marked Review again": redraws the area and keeps focus on the box. */
  function reviewFilter(area, panel) {
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
    return el("p", { class: "check-row" }, [review, el("label", { for: reviewId, text: "Only show cards I marked \"Review again\"" })]);
  }

  /* A button that shows and hides `box`; the label changes to closedText/openText. */
  function revealButton(box, closedText, openText, cls) {
    var btn = el("button", { type: "button", class: cls, "aria-expanded": "false", text: closedText });
    btn.addEventListener("click", function () {
      var open = box.hidden;
      box.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? openText : closedText;
    });
    return btn;
  }

  /* "Got it" / "Review again" for one card, saved in the visitor's progress. */
  function markButtons(card) {
    var state = progress.card(card.id);
    var gotBtn = el("button", { type: "button", class: "btn btn-small", "aria-pressed": state === "got" ? "true" : "false", text: "✓ Got it" });
    var revBtn = el("button", { type: "button", class: "btn btn-small", "aria-pressed": state === "review" ? "true" : "false", text: "↻ Review again" });
    var markMsg = el("span", { class: "small muted", role: "status" });
    function mark(v) {
      progress.setCard(card.id, v);
      gotBtn.setAttribute("aria-pressed", v === "got" ? "true" : "false");
      revBtn.setAttribute("aria-pressed", v === "review" ? "true" : "false");
      markMsg.textContent = v === "got" ? "Marked as \"Got it\"." : "Marked as \"Review again\".";
    }
    gotBtn.addEventListener("click", function () { mark("got"); });
    revBtn.addEventListener("click", function () { mark("review"); });
    return el("div", { class: "btn-row" }, [gotBtn, revBtn, markMsg]);
  }

  function renderFlashcards(body, panel) {
    var area = concept.area;
    body.appendChild(reviewFilter(area, panel));

    var cards = cardsFor(area);
    if (!cards.length) {
      body.appendChild(el("p", { class: "status-line", text: "No cards marked \"Review again\" in this area. Nice work!" }));
      return;
    }
    var i = Math.min(concept.index[area] || 0, cards.length - 1);
    var c = cards[i];

    var hintBox = el("div", { class: "fc-box", hidden: true }, [el("h4", { text: "Hint" }), el("p", { text: c.hint })]);
    var answerBox = el("div", { class: "fc-box", hidden: true }, [
      el("h4", { text: "Answer" }), el("p", { text: c.answer }),
      el("h4", { text: "In plain words" }), el("p", { text: c.explanation })
    ]);

    function go(delta) {
      concept.index[area] = (i + delta + cards.length) % cards.length;
      renderConcepts(panel);
      var q = panel.querySelector(".fc-question");
      if (q) q.focus();
    }

    body.appendChild(el("article", { class: "card flashcard" }, [
      el("p", { class: "fc-topic" }, [data.concepts[area].title + " · " + c.topic + " · card " + (i + 1) + " of " + cards.length]),
      el("p", { class: "fc-question", tabindex: "-1", text: c.question }),
      el("div", { class: "btn-row" }, [
        revealButton(hintBox, "Hint", "Hint", "btn btn-small"),
        revealButton(answerBox, "Show answer", "Hide answer", "btn btn-small btn-primary")
      ]),
      el("div", { "aria-live": "polite" }, [hintBox, answerBox]),
      markButtons(c),
      el("div", { class: "fc-nav" }, [
        el("button", { type: "button", class: "btn btn-small", text: "← Previous", onclick: function () { go(-1); } }),
        myBadge(c.id),
        el("button", { type: "button", class: "btn btn-small", text: "Next →", onclick: function () { go(1); } })
      ])
    ]));
  }

  /* One multiple-choice question; its radio buttons share the name `name`. */
  function quizQuestion(c, number, name) {
    var fs = el("fieldset", null, [el("legend", { text: number + ". " + c.quiz.question })]);
    c.quiz.options.forEach(function (opt, oi) {
      var id = name + "-" + oi;
      fs.appendChild(el("div", { class: "option" }, [
        el("input", { type: "radio", name: name, id: id, value: String(oi) }),
        el("label", { for: id, text: opt })
      ]));
    });
    fs.appendChild(el("p", { class: "feedback", "aria-live": "polite" }));
    return fs;
  }

  /* Write feedback under each question and return the number of right answers. */
  function grade(form, picked, qName) {
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
    return score;
  }

  function renderQuiz(body) {
    var area = concept.area;
    var pool = data.concepts[area].cards.filter(function (c) { return c.quiz; });
    var picked = shuffle(pool).slice(0, Math.min(5, pool.length));

    var form = el("form", { class: "quiz", novalidate: true });
    var qName = nextId("q");
    picked.forEach(function (c, qi) { form.appendChild(quizQuestion(c, qi + 1, qName + "-" + qi)); });

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
      var score = grade(form, picked, qName);
      result.className = "status-line " + (score === picked.length ? "ok" : "");
      result.textContent = "You got " + score + " of " + picked.length + ". Press New quiz for a different set of questions.";
    });

    body.appendChild(el("p", { class: "muted small", text: picked.length + " random questions from " + data.concepts[area].title + "." }));
    body.appendChild(form);
    body.appendChild(result);
  }

  L.tabs.concepts = renderConcepts;
})();
