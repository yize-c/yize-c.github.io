/* PostgreSQL password policy demo: the page part (a pretend psql console).
   Simplified demo for learning, not the real tool. It shows the three rules from
   the proof of concept (stronger passwords, lockout after 3 wrong passwords,
   90-day expiry) the way a database administrator would see them: as SQL
   commands, errors, and table rows. The logic is in js/logic/pg-logic.js. */
(function () {
  "use strict";

  var el = window.YC.el;
  /* The rules, the pretend server and its tables live in js/logic/pg-logic.js
     so they can be tested; this file only draws the console and tables. */
  var L = window.PgLogic;

  var STRONG = "Blue-Kite-2026!";
  var NEWPW = "Green-Lake-2027?";
  /* Guided steps: each button types a command for you; step 3 runs it three times. */
  var STEPS = [
    ["1. Weak password", "CREATE ROLE alex LOGIN PASSWORD 'alex2026';"],
    ["2. Strong password", "CREATE ROLE alex LOGIN PASSWORD '" + STRONG + "';"],
    ["3. Wrong password ×3", "LOGIN alex 'not-my-password';", 3],
    ["4. Right password, but locked?", "LOGIN alex '" + STRONG + "';"],
    ["5. Admin unlocks", "SELECT demo_unlock('alex');"],
    ["6. Jump 91 days", "\\advance 91 days"],
    ["7. Log in after expiry", "LOGIN alex '" + STRONG + "';"],
    ["8. Set a new password", "ALTER ROLE alex PASSWORD '" + NEWPW + "';"],
    ["9. Log in again", "LOGIN alex '" + NEWPW + "';"],
    ["Show login_log", "SELECT * FROM login_log;"]
  ];

  /* Table cells that need colour: a locked role, and each login result. */
  function cellStyle(v, column) {
    if (column === "locked" && v === "t") return { text: v, class: "pg-bad" };
    if (column === "result") return { text: v, class: v.indexOf("success") === 0 ? "pg-good" : "pg-bad" };
    return { text: v };
  }

  class PsqlConsoleDemo {
    constructor(ids) {
      var $ = function (id) { return document.getElementById(id); };
      this.term = $(ids.term);
      this.input = $(ids.input);
      this.rolesEl = $(ids.roles);
      this.logEl = $(ids.log);
      this.clockEl = $(ids.clock);
      this.history = new CommandHistory();
      this.buildSteps($(ids.steps));
      this.bindEvents($(ids.form), $(ids.reset));
      this.reset();
    }

    /* ---------- Console output ---------- */
    print(text, cls) {
      var term = this.term;
      term.appendChild(el("div", { class: "pg-line" + (cls ? " pg-" + cls : ""), text: text }));
      while (term.children.length > 220) term.removeChild(term.firstChild);
      term.scrollTop = term.scrollHeight;
    }

    /* ---------- Keep the tables and the clock in step with the server ---------- */
    refresh() {
      var roles = this.server.roleRows(), log = this.server.logRows();
      this.rolesEl.textContent = "";
      this.rolesEl.appendChild(window.YC.table(roles.cols, roles.data, { caption: "Table demo_roles", cell: cellStyle }));
      this.logEl.textContent = "";
      this.logEl.appendChild(window.YC.table(log.cols, log.data, { caption: "Table login_log", cell: cellStyle }));
      this.clockEl.textContent = L.ymd(this.server.getClock());
    }

    /* Run one command: echo it, print what the server answers, update the tables. */
    run(cmd) {
      var self = this;
      cmd = cmd.trim();
      if (!cmd) return;
      this.history.add(cmd);
      this.print("postgres=# " + cmd, "cmd");
      var result = this.server.run(cmd);
      result.lines.forEach(function (line) { self.print(line.text, line.cls); });
      if (result.understood) this.refresh();
    }

    /* ---------- Guided step buttons, the form, and start over ---------- */
    buildSteps(stepsEl) {
      var self = this;
      STEPS.forEach(function (s) {
        stepsEl.appendChild(el("button", {
          type: "button", class: "btn btn-small", text: s[0], title: s[1],
          onclick: function () {
            for (var i = 0; i < (s[2] || 1); i++) self.run(s[1]);
            self.input.value = "";
          }
        }));
      });
    }

    bindEvents(form, resetBtn) {
      var self = this, input = this.input;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        self.run(input.value);
        input.value = "";
      });
      /* Arrow keys walk through earlier commands, like a real terminal. */
      input.addEventListener("keydown", function (e) {
        if (e.key === "ArrowUp" && self.history.canGoBack()) { input.value = self.history.back(); e.preventDefault(); }
        else if (e.key === "ArrowDown") { input.value = self.history.forward(); e.preventDefault(); }
      });
      resetBtn.addEventListener("click", function () { self.reset(); input.focus(); });
    }

    reset() {
      this.server = L.createServer();
      this.term.textContent = "";
      this.print("psql (demo) — a pretend PostgreSQL server with the password policy turned on.", "notice");
      this.print("Type help to see the commands, or press the numbered buttons in order.", "notice");
      this.refresh();
    }
  }

  /* Earlier commands, for the up and down arrow keys. */
  class CommandHistory {
    constructor() { this.items = []; this.pos = 0; }
    add(cmd) { this.items.push(cmd); this.pos = this.items.length; }
    canGoBack() { return this.pos > 0; }
    back() { this.pos--; return this.items[this.pos]; }
    forward() {
      if (this.pos < this.items.length - 1) { this.pos++; return this.items[this.pos]; }
      this.pos = this.items.length;
      return "";
    }
  }

  if (document.getElementById("pg-term") && document.getElementById("pg-form")) {
    new PsqlConsoleDemo({
      term: "pg-term", form: "pg-form", input: "pg-cmd", steps: "pg-steps",
      roles: "pg-roles", log: "pg-log", clock: "pg-clock", reset: "pg-reset"
    });
  }
})();
