/* PostgreSQL password policy demo: the page part (a pretend psql console).
   Simplified demo for learning, not the real tool. It shows the three rules from
   the proof of concept (stronger passwords, lockout after 3 wrong passwords,
   90-day expiry) the way a database administrator would see them: as SQL
   commands, errors, and table rows. The logic is in js/logic/pg-logic.js. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var term = $("pg-term");
  var form = $("pg-form");
  var input = $("pg-cmd");
  var stepsEl = $("pg-steps");
  var rolesEl = $("pg-roles");
  var logEl = $("pg-log");
  var clockEl = $("pg-clock");
  var resetBtn = $("pg-reset");
  if (!term || !form) return;

  /* The rules, the pretend server and its tables live in js/logic/pg-logic.js
     so they can be tested; this file only draws the console and tables. */
  var L = window.PgLogic;
  var server, history = [], histPos = 0;

  /* ---------- Console output ---------- */
  function print(text, cls) {
    var line = document.createElement("div");
    line.className = "pg-line" + (cls ? " pg-" + cls : "");
    line.textContent = text;
    term.appendChild(line);
    while (term.children.length > 220) term.removeChild(term.firstChild);
    term.scrollTop = term.scrollHeight;
  }

  /* HTML tables beside the console, always up to date */
  function htmlTable(target, rows, caption) {
    target.textContent = "";
    var table = document.createElement("table");
    var cap = document.createElement("caption");
    cap.className = "visually-hidden";
    cap.textContent = caption;
    table.appendChild(cap);
    var thead = document.createElement("thead"), tr = document.createElement("tr");
    rows.cols.forEach(function (c) { var th = document.createElement("th"); th.scope = "col"; th.textContent = c; tr.appendChild(th); });
    thead.appendChild(tr); table.appendChild(thead);
    var tbody = document.createElement("tbody");
    if (!rows.data.length) {
      var etr = document.createElement("tr"), td = document.createElement("td");
      td.colSpan = rows.cols.length; td.className = "null"; td.textContent = "(0 rows)";
      etr.appendChild(td); tbody.appendChild(etr);
    }
    rows.data.forEach(function (r) {
      var rtr = document.createElement("tr");
      r.forEach(function (v, i) {
        var td = document.createElement("td");
        td.textContent = v;
        if (rows.cols[i] === "locked" && v === "t") td.className = "pg-bad";
        if (rows.cols[i] === "result") td.className = v.indexOf("success") === 0 ? "pg-good" : "pg-bad";
        rtr.appendChild(td);
      });
      tbody.appendChild(rtr);
    });
    table.appendChild(tbody);
    target.appendChild(table);
  }

  /* ---------- Keep the tables and the clock in step with the server ---------- */
  function refresh() {
    htmlTable(rolesEl, server.roleRows(), "Table demo_roles");
    htmlTable(logEl, server.logRows(), "Table login_log");
    clockEl.textContent = L.ymd(server.getClock());
    renderSteps();
  }

  /* Run one command: echo it, print what the server answers, update the tables. */
  function run(cmd) {
    cmd = cmd.trim();
    if (!cmd) return;
    history.push(cmd); histPos = history.length;
    print("postgres=# " + cmd, "cmd");
    var result = server.run(cmd);
    result.lines.forEach(function (line) { print(line.text, line.cls); });
    if (result.understood) refresh();
  }

  /* ---------- guided steps ---------- */
  var STRONG = "Blue-Kite-2026!";
  var NEWPW = "Green-Lake-2027?";
  /* The step buttons just type a command for you; step 3 runs it three times. */
  function steps() {
    return [
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
  }
  function renderSteps() {
    if (stepsEl.childElementCount) return;
    steps().forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-small";
      b.textContent = s[0];
      b.title = s[1];
      b.addEventListener("click", function () {
        for (var i = 0; i < (s[2] || 1); i++) run(s[1]);
        input.value = "";
      });
      stepsEl.appendChild(b);
    });
  }

  /* ---------- Start over ---------- */
  function reset() {
    server = L.createServer();
    term.textContent = "";
    print("psql (demo) — a pretend PostgreSQL server with the password policy turned on.", "notice");
    print("Type help to see the commands, or press the numbered buttons in order.", "notice");
    refresh();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    run(input.value);
    input.value = "";
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp" && histPos > 0) { histPos--; input.value = history[histPos]; e.preventDefault(); }
    else if (e.key === "ArrowDown") {
      if (histPos < history.length - 1) { histPos++; input.value = history[histPos]; } else { histPos = history.length; input.value = ""; }
      e.preventDefault();
    }
  });
  resetBtn.addEventListener("click", function () { reset(); input.focus(); });
  reset();
})();
