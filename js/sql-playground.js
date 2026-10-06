/* SQL playground for the Learner Space.
   Uses sql.js (SQLite compiled to WebAssembly), saved locally in vendor/sql.js/.
   Each run starts from a fresh copy of the sample database, so nothing a
   visitor types can break the next exercise. */
(function () {
  "use strict";

  /* Builds the whole playground inside `root` once sql.js has loaded. */
  function mount(root, data, api) {
    var el = api.el;
    var SQL = null;
    var exercises = data.exercises;
    var setupSql = data.setup.join("\n");
    var current = 0;
    var drafts = {};

    root.textContent = "";
    var loading = el("p", { class: "loading", role: "status", text: "Loading the SQL engine…" });
    root.appendChild(loading);

    if (typeof window.initSqlJs !== "function") {
      loading.className = "error-box";
      loading.textContent = "The SQL engine (sql.js) couldn't load, so the playground isn't available right now.";
      return;
    }

    window.initSqlJs({ locateFile: function (f) { return "vendor/sql.js/" + f; } }).then(function (lib) {
      SQL = lib;
      root.removeChild(loading);
      build();
    }).catch(function (e) {
      loading.className = "error-box";
      loading.textContent = "The SQL engine couldn't start: " + e.message;
    });

    /* ---------- Running SQL on a fresh copy of the sample data ---------- */
    function freshDb() {
      var db = new SQL.Database();
      db.run(setupSql);
      return db;
    }

    /* Run SQL and return the last result set: { columns, values }. */
    function runLast(db, sql) {
      var res = db.exec(sql);
      if (!res.length) return { columns: [], values: [] };
      return res[res.length - 1];
    }

    /* ---------- Showing a result as an HTML table ---------- */
    function cell(v) {
      if (v === null) return el("td", { class: "null", text: "NULL" });
      return el("td", { text: String(v) });
    }

    function table(result, caption) {
      if (!result.columns.length) return el("p", { class: "muted", text: "The query ran, but it didn't return any rows." });
      var t = el("table", null, [
        caption ? el("caption", { class: "visually-hidden", text: caption }) : null,
        el("thead", null, [el("tr", null, result.columns.map(function (c) { return el("th", { scope: "col", text: c }); }))]),
        el("tbody", null, result.values.map(function (row) { return el("tr", null, row.map(cell)); }))
      ]);
      return el("div", { class: "table-wrap" }, [t]);
    }

    /* Checking a result against the expected one is in js/logic/sql-check.js
       (tested in tests/sql-check.test.js). */
    var compare = window.SqlCheck.compare;

    /* ---------- UI ---------- */
    var listButtons = [];
    var picker, header, question, hintWrap, tablesWrap, editor, status, output, expectedWrap, solutionWrap;

    function build() {
      var layout = el("div", { class: "sql-layout" });

      /* Exercise list (desktop) */
      var listWrap = el("nav", { class: "ex-list-wrap card", "aria-label": "SQL exercises" });
      var topics = [];
      exercises.forEach(function (x) { if (topics.indexOf(x.topic) === -1) topics.push(x.topic); });
      topics.forEach(function (t) {
        listWrap.appendChild(el("h4", { text: t }));
        var ul = el("ul", { class: "ex-list" });
        exercises.forEach(function (x, i) {
          if (x.topic !== t) return;
          var mark = el("span", { class: "solved-mark", "aria-hidden": "true", text: api.isDone(x.id) ? "✓" : "" });
          var btn = el("button", { type: "button" }, [
            el("span", { text: (i + 1) + ". " + x.difficulty }),
            mark
          ]);
          btn.setAttribute("aria-label", "Exercise " + (i + 1) + ", " + t + ", " + x.difficulty + (api.isDone(x.id) ? ", solved" : ""));
          btn.addEventListener("click", function () { show(i, true); });
          listButtons[i] = { btn: btn, mark: mark, topic: t };
          ul.appendChild(el("li", null, [btn]));
        });
        listWrap.appendChild(ul);
      });

      /* Exercise picker (phone) */
      var pickId = "sql-picker";
      picker = el("select", { id: pickId }, exercises.map(function (x, i) {
        return el("option", { value: String(i), text: (i + 1) + ". " + x.topic + " (" + x.difficulty + ")" });
      }));
      picker.addEventListener("change", function () { show(Number(picker.value), false); });

      var main = el("div", { class: "card" });
      main.appendChild(el("div", { class: "field ex-picker" }, [el("label", { for: pickId, text: "Exercise" }), picker]));
      header = el("p", { class: "fc-topic mono" });
      question = el("h4", { class: "fc-question", tabindex: "-1" });
      hintWrap = el("div");
      tablesWrap = el("div", { class: "sample-tables explainer-section" });
      var edId = "sql-editor";
      editor = el("textarea", { id: edId, rows: "6", spellcheck: "false", autocapitalize: "off", autocomplete: "off", "aria-describedby": "sql-editor-help" });
      editor.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
      });
      editor.addEventListener("input", function () { drafts[current] = editor.value; });
      status = el("p", { class: "status-line", role: "status", "aria-live": "polite" });
      output = el("div", { class: "explainer-section" });
      expectedWrap = el("div");
      solutionWrap = el("div");

      main.appendChild(header);
      main.appendChild(question);
      main.appendChild(hintWrap);
      main.appendChild(tablesWrap);
      main.appendChild(el("div", { class: "field explainer-section" }, [
        el("label", { for: edId, text: "Your SQL" }),
        editor,
        el("span", { id: "sql-editor-help", class: "small muted", text: "Press Run, or Ctrl+Enter (⌘+Enter on Mac). Each run uses a fresh copy of the sample data." })
      ]));
      main.appendChild(el("div", { class: "btn-row" }, [
        el("button", { type: "button", class: "btn btn-primary", text: "Run", onclick: run }),
        el("button", { type: "button", class: "btn", text: "Show solution", onclick: showSolution }),
        el("button", { type: "button", class: "btn", text: "Clear", onclick: function () { editor.value = ""; drafts[current] = ""; editor.focus(); } })
      ]));
      main.appendChild(el("div", { class: "explainer-section" }, [status]));
      main.appendChild(output);
      main.appendChild(expectedWrap);
      main.appendChild(solutionWrap);
      main.appendChild(el("div", { class: "fc-nav explainer-section" }, [
        el("button", { type: "button", class: "btn btn-small", text: "← Previous", onclick: function () { show((current - 1 + exercises.length) % exercises.length, true); } }),
        el("button", { type: "button", class: "btn btn-small", text: "Next →", onclick: function () { show((current + 1) % exercises.length, true); } })
      ]));

      layout.appendChild(listWrap);
      layout.appendChild(main);
      root.appendChild(layout);
      show(0, false);
    }

    /* ---------- Switching exercises, running the visitor's query, showing the solution ---------- */
    function show(i, focus) {
      current = i;
      var x = exercises[i];
      listButtons.forEach(function (b, j) {
        if (j === i) b.btn.setAttribute("aria-current", "true");
        else b.btn.removeAttribute("aria-current");
      });
      picker.value = String(i);
      header.textContent = "Exercise " + (i + 1) + " of " + exercises.length + " · " + x.topic + " · " + x.difficulty;
      question.textContent = x.question;
      hintWrap.textContent = "";
      hintWrap.appendChild(el("details", null, [el("summary", { text: "Hint" }), el("p", { text: x.hint })]));
      hintWrap.appendChild(el("p", { class: "small" }, [api.myBadge(x.id)]));

      tablesWrap.textContent = "";
      var db = freshDb();
      x.tables.forEach(function (name) {
        var res = runLast(db, "SELECT * FROM " + name + ";");
        tablesWrap.appendChild(el("div", null, [el("h4", { text: "Table: " + name }), table(res, "Sample table " + name)]));
      });
      db.close();

      editor.value = drafts[i] !== undefined ? drafts[i] : "";
      editor.setAttribute("placeholder", "SELECT ...");
      status.className = "status-line";
      status.textContent = api.isDone(x.id) ? "You've solved this one before. Try it again if you like." : "Write a query, then press Run.";
      output.textContent = "";
      expectedWrap.textContent = "";
      solutionWrap.textContent = "";
      if (focus) question.focus();
    }

    function run() {
      var x = exercises[current];
      var sql = editor.value.trim();
      output.textContent = "";
      expectedWrap.textContent = "";
      if (!sql) {
        status.className = "status-line warn";
        status.textContent = "The editor is empty. Write a query first.";
        return;
      }
      var got, want;
      var db = freshDb();
      try {
        got = runLast(db, sql);
      } catch (e) {
        status.className = "status-line bad";
        status.textContent = "SQL error: " + e.message;
        db.close();
        return;
      }
      db.close();
      var db2 = freshDb();
      want = runLast(db2, x.solution);
      db2.close();

      output.appendChild(el("h4", { class: "small mono", text: "Your result" }));
      output.appendChild(table(got, "Your result"));

      var verdict = compare(got, want, x.ordered);
      if (verdict.ok) {
        status.className = "status-line ok";
        status.textContent = "Correct! Your result matches the expected result.";
        api.setDone(x.id, true);
        var b = listButtons[current];
        if (b) {
          b.mark.textContent = "✓";
          b.btn.setAttribute("aria-label", "Exercise " + (current + 1) + ", " + b.topic + ", " + x.difficulty + ", solved");
        }
      } else {
        status.className = "status-line bad";
        status.textContent = "Not quite yet. " + verdict.msg;
        expectedWrap.appendChild(el("details", { class: "explainer-section" }, [
          el("summary", { text: "Show the expected result" }),
          table(want, "Expected result")
        ]));
      }
    }

    function showSolution() {
      var x = exercises[current];
      solutionWrap.textContent = "";
      solutionWrap.appendChild(el("div", { class: "explainer-section" }, [
        el("h4", { class: "small mono", text: "One possible solution" }),
        el("pre", null, [el("code", { text: x.solution })]),
        el("p", { class: "small muted", text: "Other queries can be correct too. Only the result is compared." + (x.ordered ? " For this one, the row order matters." : " Row order doesn't matter here.") })
      ]));
    }
  }

  window.SqlPlayground = { mount: mount };
})();
