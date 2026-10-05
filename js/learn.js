/* Learner Space: loads the practice lists from data/*.json and renders the tabs.
   "My progress" comes from data/my-progress.json (updated by hand).
   "Your progress" is the visitor's own, saved in localStorage when allowed. */
(function () {
  "use strict";

  /* ---------- Storage (visitor progress) ---------- */
  var STORE_KEY = "yc-learn-v1";
  var storageOK = (function () {
    try {
      localStorage.setItem("yc-test", "1");
      localStorage.removeItem("yc-test");
      return true;
    } catch (e) { return false; }
  })();

  var store = (function () {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var d = raw ? JSON.parse(raw) : {};
      return { done: d.done || {}, cards: d.cards || {}, tab: d.tab || "" };
    } catch (e) {
      return { done: {}, cards: {}, tab: "" };
    }
  })();

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* storage blocked */ }
  }

  function isDone(id) { return !!store.done[id]; }
  function setDone(id, on) {
    if (on) store.done[id] = true; else delete store.done[id];
    save();
  }

  /* ---------- Small DOM helper ---------- */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? "" : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function extLink(href, text, cls) {
    return el("a", { href: href, target: "_blank", rel: "noopener noreferrer", class: cls || null, text: text });
  }

  var uid = 0;
  function nextId(prefix) { uid++; return prefix + "-" + uid; }

  /* ---------- My progress ---------- */
  var mine = {};
  var STATUS = {
    "not started": { label: "Not started", cls: "status-not-started" },
    "in progress": { label: "In progress", cls: "status-in-progress" },
    "done": { label: "Done", cls: "status-done" }
  };

  function myStatusKey(id) {
    var s = String(mine[id] || "not started").toLowerCase();
    return STATUS[s] ? s : "not started";
  }

  function myBadge(id) {
    var s = STATUS[myStatusKey(id)];
    return el("span", { class: "badge status-badge " + s.cls, title: "My progress (updated by hand)" }, ["Me: " + s.label]);
  }

  function yourCheckbox(id, label, onChange) {
    var inputId = nextId("you");
    var input = el("input", { type: "checkbox", id: inputId });
    input.checked = isDone(id);
    input.addEventListener("change", function () {
      setDone(id, input.checked);
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

  function renderProblem(p, showCategory) {
    var sol = data.solutions[p.id];
    var solBody;
    if (sol && (sol.code || sol.url)) {
      solBody = el("div", null, [
        sol.code ? el("pre", null, [el("code", { text: sol.code })]) : null,
        sol.url ? el("p", null, [extLink(sol.url, "Open my solution file")]) : null
      ]);
    } else {
      solBody = el("p", { class: "muted", text: "Coming soon." });
    }

    return el("li", null, [
      el("article", { class: "card problem" }, [
        el("div", { class: "problem-head" }, [
          el("span", { class: "problem-title" }, [
            extLink(p.url, p.number + ". " + p.title),
            el("span", { class: "visually-hidden", text: " (opens LeetCode in a new tab)" })
          ]),
          difficultyBadge(p.difficulty),
          showCategory ? el("span", { class: "badge badge-muted", text: p.category }) : null
        ]),
        el("details", null, [el("summary", { text: "Hint" }), el("p", { text: p.hint })]),
        el("details", null, [el("summary", { text: "Key idea" }), el("p", { text: p.keyIdea })]),
        el("details", null, [el("summary", { text: "My solution" }), solBody]),
        el("div", { class: "problem-foot" }, [
          myBadge(p.id),
          yourCheckbox(p.id, "I solved it")
        ])
      ])
    ]);
  }

  function problemList(problems, showCategory) {
    return el("ul", { class: "problem-list" }, problems.map(function (p) { return renderProblem(p, showCategory); }));
  }

  /* ---------- Coding tab ---------- */
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

  /* ---------- SQL tab ---------- */
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
        el: el, isDone: isDone, setDone: setDone, myBadge: myBadge
      });
    } else {
      pgRoot.appendChild(el("p", { class: "error-box", text: "The SQL playground couldn't load." }));
    }
  }

  /* ---------- Bash tab ---------- */
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

  /* ---------- Go tab ---------- */
  function checkItem(item, titleNode) {
    var inputId = nextId("go");
    var input = el("input", { type: "checkbox", id: inputId, "aria-label": "I've done this: " + item.title });
    input.checked = isDone(item.id);
    input.addEventListener("change", function () { setDone(item.id, input.checked); });
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

  /* ---------- Concepts tab ---------- */
  var concept = { area: "networking", mode: "cards", index: {}, reviewOnly: false };

  function cardsFor(area) {
    var all = data.concepts[area].cards;
    if (!concept.reviewOnly) return all;
    return all.filter(function (c) { return store.cards[c.id] === "review"; });
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

    var state = store.cards[c.id];
    var gotBtn = el("button", { type: "button", class: "btn btn-small", "aria-pressed": state === "got" ? "true" : "false", text: "✓ Got it" });
    var revBtn = el("button", { type: "button", class: "btn btn-small", "aria-pressed": state === "review" ? "true" : "false", text: "↻ Review again" });
    function mark(v) {
      store.cards[c.id] = v;
      save();
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

  /* ---------- Study plan tab ---------- */
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
    panel.appendChild(el("p", { class: "section-intro", text: "An overview of every section. \"Me\" is my real progress, updated by hand." + updated + " \"You\" is your own progress in this browser." }));

    var card = el("div", { class: "card" });
    sections().forEach(function (s) {
      var myDone = 0, myProg = 0, yours = 0;
      s.ids.forEach(function (id) {
        var k = myStatusKey(id);
        if (k === "done") myDone++;
        else if (k === "in progress") myProg++;
        if (s.concept ? store.cards[id] === "got" : isDone(id)) yours++;
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
    panel.appendChild(el("div", { class: "grid grid-3" }, [
      certCard("CompTIA Security+", "CompTIA", "Preparing", "badge-warning", "To build a solid base in core security concepts."),
      certCard("AWS Certified Cloud Practitioner", "Amazon Web Services", "Preparing", "badge-warning", "To understand AWS basics, since my projects already use S3 and Terraform."),
      certCard("CISSP", "ISC2", "Long-term goal", "badge-purple badge-dashed", "A long-term goal for a career in security. CISSP requires several years of security work experience, so this is a goal for later in my career.")
    ]));
  }

  function certCard(name, org, status, cls, why) {
    return el("article", { class: "card" }, [
      el("p", null, [el("span", { class: "badge " + cls, text: status })]),
      el("h4", { text: name }),
      el("p", { class: "item-meta", text: org }),
      el("p", { class: "small", text: why })
    ]);
  }

  /* ---------- Tabs ---------- */
  var RENDER = { coding: renderCoding, sql: renderSql, bash: renderBash, go: renderGo, concepts: renderConcepts, plan: renderPlan };
  var rendered = {};
  var tabs = Array.prototype.slice.call(document.querySelectorAll("[role=tab]"));
  var ready = false;

  function keyOf(tab) { return tab.id.replace("tab-", ""); }

  function select(key, focus) {
    if (!RENDER[key]) key = "coding";
    tabs.forEach(function (t) {
      var on = keyOf(t) === key;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      document.getElementById("panel-" + keyOf(t)).hidden = !on;
      if (on && focus) t.focus();
      if (on && t.scrollIntoView) t.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    store.tab = key;
    save();
    if (history.replaceState) history.replaceState(null, "", "#" + key);
    if (ready && (!rendered[key] || key === "plan")) {
      RENDER[key](document.getElementById("panel-" + key));
      rendered[key] = true;
    }
  }

  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { select(keyOf(t)); });
    t.addEventListener("keydown", function (e) {
      var j = null;
      if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = tabs.length - 1;
      if (j !== null) {
        e.preventDefault();
        select(keyOf(tabs[j]), true);
      }
    });
  });

  function initialTab() {
    var h = location.hash.replace("#", "");
    if (RENDER[h]) return h;
    if (RENDER[store.tab]) return store.tab;
    return "coding";
  }

  window.addEventListener("hashchange", function () {
    var h = location.hash.replace("#", "");
    if (RENDER[h]) select(h);
  });

  if (!storageOK) document.getElementById("storage-warning").hidden = false;
  select(initialTab());

  var files = [
    getJSON("data/leetcode.json"),
    getJSON("data/sql-exercises.json"),
    getJSON("data/go.json"),
    getJSON("data/bash-cheatsheet.json"),
    getJSON("data/my-progress.json"),
    getJSON("data/solutions.json")
  ].concat(AREAS.map(function (a) { return getJSON("data/concepts/" + a + ".json"); }));

  Promise.all(files).then(function (r) {
    data.leetcode = r[0];
    data.sqlExercises = r[1];
    data.go = r[2];
    data.cheatsheet = r[3];
    data.mine = r[4];
    mine = r[4].items || {};
    data.solutions = r[5].solutions || {};
    data.concepts = {};
    AREAS.forEach(function (a, i) { data.concepts[a] = r[6 + i]; });
    ready = true;
    select(initialTab());
  }).catch(function (err) {
    tabs.forEach(function (t) {
      var p = document.getElementById("panel-" + keyOf(t));
      p.textContent = "";
      p.appendChild(el("p", { class: "notice error-box", text: "Couldn't load the practice data (" + err.message + "). If you opened this file directly from your computer, run a small local server instead; see the README." }));
    });
  });
})();
