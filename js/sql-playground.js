/* SQL playground for the Learner Space.
   Uses sql.js (SQLite compiled to WebAssembly), saved locally in vendor/sql.js/.
   Each run starts from a fresh copy of the sample database, so nothing a
   visitor types can break the next exercise. */
(function () {
  "use strict";

  var el = window.YC.el;
  var setStatus = window.YC.setStatus;
  /* Checking a result against the expected one is in js/logic/sql-check.js
     (tested in tests/sql-check.test.js). */
  var compare = window.SqlCheck.compare;

  /* One playground: the exercise list, the editor and the results.
     `api` gives it the visitor's saved progress and the "Me" badge. */
  class SqlPlayground {
    constructor(root, data, api) {
      this.root = root;
      this.api = api;
      this.exercises = data.exercises;
      this.setupSql = data.setup.join("\n");
      this.current = 0;
      this.drafts = {};
      this.listButtons = [];
      this.SQL = null;
    }

    /* Load sql.js, then build the page. */
    load() {
      var self = this;
      this.root.textContent = "";
      var loading = el("p", { class: "loading", role: "status", text: "Loading the SQL engine…" });
      this.root.appendChild(loading);
      if (typeof window.initSqlJs !== "function") {
        loading.className = "error-box";
        loading.textContent = "The SQL engine (sql.js) couldn't load, so the playground isn't available right now.";
        return;
      }
      window.initSqlJs({ locateFile: function (f) { return "vendor/sql.js/" + f; } }).then(function (lib) {
        self.SQL = lib;
        self.root.removeChild(loading);
        self.build();
      }).catch(function (e) {
        loading.className = "error-box";
        loading.textContent = "The SQL engine couldn't start: " + e.message;
      });
    }

    /* ---------- Running SQL on a fresh copy of the sample data ---------- */
    freshDb() {
      var db = new this.SQL.Database();
      db.run(this.setupSql);
      return db;
    }

    /* Run SQL on a fresh database and return the last result set: { columns, values }. */
    query(sql) {
      var db = this.freshDb();
      try {
        var res = db.exec(sql);
        return res.length ? res[res.length - 1] : { columns: [], values: [] };
      } finally {
        db.close();
      }
    }

    /* A result as an HTML table (NULL shown as NULL). */
    static resultTable(result, caption) {
      if (!result.columns.length) return el("p", { class: "muted", text: "The query ran, but it didn't return any rows." });
      return el("div", { class: "table-wrap" }, [window.YC.table(result.columns, result.values, {
        caption: caption,
        empty: false,
        cell: function (v) { return v === null ? { text: "NULL", class: "null" } : { text: String(v) }; }
      })]);
    }

    /* ---------- Building the page ---------- */
    build() {
      var self = this;
      var layout = el("div", { class: "sql-layout" });
      layout.appendChild(this.buildList());

      /* Exercise picker (phone) */
      var pickId = "sql-picker";
      this.picker = el("select", { id: pickId }, this.exercises.map(function (x, i) {
        return el("option", { value: String(i), text: (i + 1) + ". " + x.topic + " (" + x.difficulty + ")" });
      }));
      this.picker.addEventListener("change", function () { self.show(Number(self.picker.value), false); });

      this.header = el("p", { class: "fc-topic mono" });
      this.question = el("h4", { class: "fc-question", tabindex: "-1" });
      this.hintWrap = el("div");
      this.tablesWrap = el("div", { class: "sample-tables explainer-section" });
      this.status = el("p", { class: "status-line", role: "status", "aria-live": "polite" });
      this.output = el("div", { class: "explainer-section" });
      this.expectedWrap = el("div");
      this.solutionWrap = el("div");

      layout.appendChild(el("div", { class: "card" }, [
        el("div", { class: "field ex-picker" }, [el("label", { for: pickId, text: "Exercise" }), this.picker]),
        this.header, this.question, this.hintWrap, this.tablesWrap,
        this.buildEditor(),
        this.buildButtons(),
        el("div", { class: "explainer-section" }, [this.status]),
        this.output, this.expectedWrap, this.solutionWrap,
        this.buildNav()
      ]));
      this.root.appendChild(layout);
      this.show(0, false);
    }

    /* The SQL editor: Ctrl/Cmd+Enter runs it, and each exercise keeps its own draft. */
    buildEditor() {
      var self = this, edId = "sql-editor";
      this.editor = el("textarea", { id: edId, rows: "6", spellcheck: "false", autocapitalize: "off", autocomplete: "off", "aria-describedby": "sql-editor-help" });
      this.editor.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); self.run(); }
      });
      this.editor.addEventListener("input", function () { self.drafts[self.current] = self.editor.value; });
      return el("div", { class: "field explainer-section" }, [
        el("label", { for: edId, text: "Your SQL" }),
        this.editor,
        el("span", { id: "sql-editor-help", class: "small muted", text: "Press Run, or Ctrl+Enter (⌘+Enter on Mac). Each run uses a fresh copy of the sample data." })
      ]);
    }

    buildButtons() {
      var self = this;
      return el("div", { class: "btn-row" }, [
        el("button", { type: "button", class: "btn btn-primary", text: "Run", onclick: function () { self.run(); } }),
        el("button", { type: "button", class: "btn", text: "Show solution", onclick: function () { self.showSolution(); } }),
        el("button", { type: "button", class: "btn", text: "Clear", onclick: function () { self.editor.value = ""; self.drafts[self.current] = ""; self.editor.focus(); } })
      ]);
    }

    buildNav() {
      var self = this, n = this.exercises.length;
      return el("div", { class: "fc-nav explainer-section" }, [
        el("button", { type: "button", class: "btn btn-small", text: "← Previous", onclick: function () { self.show((self.current - 1 + n) % n, true); } }),
        el("button", { type: "button", class: "btn btn-small", text: "Next →", onclick: function () { self.show((self.current + 1) % n, true); } })
      ]);
    }

    /* Exercise list grouped by topic (desktop). */
    buildList() {
      var self = this, api = this.api;
      var listWrap = el("nav", { class: "ex-list-wrap card", "aria-label": "SQL exercises" });
      var topics = [];
      this.exercises.forEach(function (x) { if (topics.indexOf(x.topic) === -1) topics.push(x.topic); });
      topics.forEach(function (t) {
        listWrap.appendChild(el("h4", { text: t }));
        var ul = el("ul", { class: "ex-list" });
        self.exercises.forEach(function (x, i) {
          if (x.topic !== t) return;
          var solved = api.progress.isDone(x.id);
          var mark = el("span", { class: "solved-mark", "aria-hidden": "true", text: solved ? "✓" : "" });
          var btn = el("button", { type: "button", "aria-label": self.label(i, t, x, solved), onclick: function () { self.show(i, true); } }, [
            el("span", { text: (i + 1) + ". " + x.difficulty }),
            mark
          ]);
          self.listButtons[i] = { btn: btn, mark: mark, topic: t };
          ul.appendChild(el("li", null, [btn]));
        });
        listWrap.appendChild(ul);
      });
      return listWrap;
    }

    label(i, topic, x, solved) {
      return "Exercise " + (i + 1) + ", " + topic + ", " + x.difficulty + (solved ? ", solved" : "");
    }

    /* ---------- Switching exercises, running the visitor's query, showing the solution ---------- */
    show(i, focus) {
      var self = this, x = this.exercises[i], api = this.api;
      this.current = i;
      this.listButtons.forEach(function (b, j) {
        if (j === i) b.btn.setAttribute("aria-current", "true");
        else b.btn.removeAttribute("aria-current");
      });
      this.picker.value = String(i);
      this.header.textContent = "Exercise " + (i + 1) + " of " + this.exercises.length + " · " + x.topic + " · " + x.difficulty;
      this.question.textContent = x.question;
      this.hintWrap.textContent = "";
      this.hintWrap.appendChild(el("details", null, [el("summary", { text: "Hint" }), el("p", { text: x.hint })]));
      this.hintWrap.appendChild(el("p", { class: "small" }, [api.myBadge(x.id)]));

      this.tablesWrap.textContent = "";
      x.tables.forEach(function (name) {
        var res = self.query("SELECT * FROM " + name + ";");
        self.tablesWrap.appendChild(el("div", null, [el("h4", { text: "Table: " + name }), SqlPlayground.resultTable(res, "Sample table " + name)]));
      });

      this.editor.value = this.drafts[i] !== undefined ? this.drafts[i] : "";
      this.editor.setAttribute("placeholder", "SELECT ...");
      setStatus(this.status, "", api.progress.isDone(x.id) ? "You've solved this one before. Try it again if you like." : "Write a query, then press Run.");
      this.output.textContent = "";
      this.expectedWrap.textContent = "";
      this.solutionWrap.textContent = "";
      if (focus) this.question.focus();
    }

    run() {
      var x = this.exercises[this.current];
      var sql = this.editor.value.trim();
      this.output.textContent = "";
      this.expectedWrap.textContent = "";
      if (!sql) {
        setStatus(this.status, "warn", "The editor is empty. Write a query first.");
        return;
      }
      var got;
      try {
        got = this.query(sql);
      } catch (e) {
        setStatus(this.status, "bad", "SQL error: " + e.message);
        return;
      }
      var want = this.query(x.solution);

      this.output.appendChild(el("h4", { class: "small mono", text: "Your result" }));
      this.output.appendChild(SqlPlayground.resultTable(got, "Your result"));

      var verdict = compare(got, want, x.ordered);
      if (verdict.ok) {
        setStatus(this.status, "ok", "Correct! Your result matches the expected result.");
        this.api.progress.setDone(x.id, true);
        var b = this.listButtons[this.current];
        if (b) {
          b.mark.textContent = "✓";
          b.btn.setAttribute("aria-label", this.label(this.current, b.topic, x, true));
        }
      } else {
        setStatus(this.status, "bad", "Not quite yet. " + verdict.msg);
        this.expectedWrap.appendChild(el("details", { class: "explainer-section" }, [
          el("summary", { text: "Show the expected result" }),
          SqlPlayground.resultTable(want, "Expected result")
        ]));
      }
    }

    showSolution() {
      var x = this.exercises[this.current];
      this.solutionWrap.textContent = "";
      this.solutionWrap.appendChild(el("div", { class: "explainer-section" }, [
        el("h4", { class: "small mono", text: "One possible solution" }),
        el("pre", null, [el("code", { text: x.solution })]),
        el("p", { class: "small muted", text: "Other queries can be correct too. Only the result is compared." + (x.ordered ? " For this one, the row order matters." : " Row order doesn't matter here.") })
      ]));
    }
  }

  window.SqlPlayground = {
    mount: function (root, data, api) { new SqlPlayground(root, data, api).load(); }
  };
})();
