/* PostgreSQL password policy demo: a pretend psql console.
   Simplified demo for learning, not the real tool. Nothing here talks to a real
   database. It shows the three rules from the proof of concept (stronger
   passwords, lockout after 3 wrong passwords, 90-day expiry) the way a database
   administrator would see them: as SQL commands, errors, and table rows.
   The password rules below are example rules chosen for this demo. */
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

  var MAX_FAILED = 3;
  var EXPIRY_DAYS = 90;
  var roles, log, clock, history = [], histPos = 0;

  /* ---------- helpers ---------- */
  function today() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 9, 0, 0);
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function ymd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function hm(d) { return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function tick() { clock = new Date(clock.getTime() + 60000); }

  /* A short fake hash, so the table never shows a real password. */
  function fakeHash(pw) {
    var h = 2166136261;
    for (var i = 0; i < pw.length; i++) { h ^= pw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return "SCRAM-SHA-256$4096:" + (h >>> 0).toString(16).padStart(8, "0") + "…";
  }

  function print(text, cls) {
    var line = document.createElement("div");
    line.className = "pg-line" + (cls ? " pg-" + cls : "");
    line.textContent = text;
    term.appendChild(line);
    while (term.children.length > 220) term.removeChild(term.firstChild);
    term.scrollTop = term.scrollHeight;
  }

  /* ---------- the password rules (example rules for the demo) ---------- */
  function checkPassword(user, pw) {
    if (pw.length < 12) return "password is too short (demo rule: at least 12 characters)";
    if (pw.toLowerCase().indexOf(user.toLowerCase()) !== -1) return "password must not contain user name";
    if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) {
      return "password must contain upper and lower case letters, a number and a symbol";
    }
    return null;
  }

  function expiryFrom(requested) {
    var max = addDays(clock, EXPIRY_DAYS);
    if (!requested) return { date: max, note: "no VALID UNTIL given; the policy sets it to " + EXPIRY_DAYS + " days from now" };
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(requested.trim());
    if (!m) return { error: "invalid input syntax for type timestamp: \"" + requested + "\"" };
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 9, 0, 0);
    if (d > max) return { date: max, note: "VALID UNTIL is more than " + EXPIRY_DAYS + " days away; the policy shortens it" };
    if (d <= clock) return { error: "VALID UNTIL must be in the future" };
    return { date: d };
  }

  function logRow(user, result) {
    log.push({ time: ymd(clock) + " " + hm(clock), user: user, result: result });
    if (log.length > 50) log.shift();
  }

  /* ---------- commands ---------- */
  var COMMANDS = [
    {
      re: /^create\s+role\s+(\w+)(?:\s+(?:with\s+)?login)?\s+password\s+'([^']*)'(?:\s+valid\s+until\s+'([^']*)')?\s*;?$/i,
      run: function (m) {
        var name = m[1].toLowerCase(), pw = m[2];
        if (roles[name]) { print("ERROR:  role \"" + name + "\" already exists", "err"); return; }
        var bad = checkPassword(name, pw);
        if (bad) { print("ERROR:  " + bad, "err"); return; }
        var exp = expiryFrom(m[3]);
        if (exp.error) { print("ERROR:  " + exp.error, "err"); return; }
        roles[name] = { pw: pw, hash: fakeHash(pw), validUntil: exp.date, failed: 0, locked: false };
        print("CREATE ROLE", "ok");
        if (exp.note) print("NOTICE:  " + exp.note, "notice");
        print("NOTICE:  password for \"" + name + "\" expires on " + ymd(exp.date), "notice");
      }
    },
    {
      re: /^alter\s+role\s+(\w+)\s+(?:with\s+)?password\s+'([^']*)'(?:\s+valid\s+until\s+'([^']*)')?\s*;?$/i,
      run: function (m) {
        var name = m[1].toLowerCase(), pw = m[2], r = roles[name];
        if (!r) { print("ERROR:  role \"" + name + "\" does not exist", "err"); return; }
        var bad = checkPassword(name, pw);
        if (bad) { print("ERROR:  " + bad, "err"); return; }
        if (pw === r.pw) { print("ERROR:  new password must be different from the old one", "err"); return; }
        var exp = expiryFrom(m[3]);
        if (exp.error) { print("ERROR:  " + exp.error, "err"); return; }
        r.pw = pw; r.hash = fakeHash(pw); r.validUntil = exp.date;
        print("ALTER ROLE", "ok");
        if (exp.note) print("NOTICE:  " + exp.note, "notice");
        print("NOTICE:  password for \"" + name + "\" now expires on " + ymd(exp.date), "notice");
      }
    },
    {
      re: /^login\s+(\w+)\s+'([^']*)'\s*;?$/i,
      run: function (m) {
        var name = m[1].toLowerCase(), pw = m[2], r = roles[name];
        tick();
        /* Same message for a wrong password and an unknown user, so attackers can't tell which. */
        if (!r) { print("FATAL:  password authentication failed for user \"" + name + "\"", "err"); logRow(name, "failed (no such role)"); return; }
        if (r.locked) { print("FATAL:  account \"" + name + "\" is locked", "err"); logRow(name, "rejected (locked)"); return; }
        if (pw !== r.pw) {
          r.failed++;
          print("FATAL:  password authentication failed for user \"" + name + "\"", "err");
          if (r.failed >= MAX_FAILED) {
            r.locked = true;
            logRow(name, "failed → locked");
            print("WARNING:  account \"" + name + "\" locked after " + MAX_FAILED + " failed attempts", "notice");
          } else {
            logRow(name, "failed (" + r.failed + "/" + MAX_FAILED + ")");
            print("NOTICE:  " + (MAX_FAILED - r.failed) + " attempt" + (MAX_FAILED - r.failed === 1 ? "" : "s") + " left before the account is locked", "notice");
          }
          return;
        }
        if (r.validUntil && clock >= r.validUntil) {
          print("FATAL:  password authentication failed for user \"" + name + "\"", "err");
          print("LOG:    (server log) User \"" + name + "\" has an expired password.", "notice");
          logRow(name, "failed (expired)");
          return;
        }
        r.failed = 0;
        logRow(name, "success");
        print("You are now connected to database \"postgres\" as user \"" + name + "\".", "ok");
      }
    },
    {
      re: /^select\s+demo_unlock\s*\(\s*'(\w+)'\s*\)\s*;?$/i,
      run: function (m) {
        var name = m[1].toLowerCase(), r = roles[name];
        if (!r) { print("ERROR:  role \"" + name + "\" does not exist", "err"); return; }
        r.locked = false; r.failed = 0;
        print(" demo_unlock\n-------------\n t\n(1 row)", "ok");
        print("NOTICE:  account \"" + name + "\" unlocked by an administrator", "notice");
      }
    },
    {
      re: /^drop\s+role\s+(\w+)\s*;?$/i,
      run: function (m) {
        var name = m[1].toLowerCase();
        if (!roles[name]) { print("ERROR:  role \"" + name + "\" does not exist", "err"); return; }
        delete roles[name];
        print("DROP ROLE", "ok");
      }
    },
    {
      re: /^select\s+\*\s+from\s+(demo_roles|login_log)\s*;?$/i,
      run: function (m) {
        var t = m[1].toLowerCase();
        var rows = t === "demo_roles" ? roleRows() : logRows();
        print(textTable(rows.cols, rows.data), "out");
      }
    },
    {
      re: /^\\advance\s+(\d{1,3})\s*days?\s*$/i,
      run: function (m) {
        clock = addDays(clock, Number(m[1]));
        print("(demo clock moved forward " + m[1] + " days, it is now " + ymd(clock) + ")", "notice");
      }
    },
    {
      re: /^(\\\?|help)\s*;?$/i,
      run: function () {
        print([
          "Commands this demo understands:",
          "  CREATE ROLE name LOGIN PASSWORD '...' [VALID UNTIL 'YYYY-MM-DD'];",
          "  ALTER ROLE name PASSWORD '...' [VALID UNTIL 'YYYY-MM-DD'];",
          "  LOGIN name '...';            (demo shortcut for connecting as a user)",
          "  SELECT demo_unlock('name');  (an administrator unlocks an account)",
          "  SELECT * FROM demo_roles;    SELECT * FROM login_log;",
          "  DROP ROLE name;",
          "  \\advance N days              (move the demo clock forward)"
        ].join("\n"), "out");
      }
    }
  ];

  function roleRows() {
    var data = Object.keys(roles).map(function (n) {
      var r = roles[n];
      return [n, r.hash, r.validUntil ? ymd(r.validUntil) : "", String(r.failed), r.locked ? "t" : "f"];
    });
    return { cols: ["rolname", "password", "valid_until", "failed_logins", "locked"], data: data };
  }
  function logRows() {
    return { cols: ["time", "rolname", "result"], data: log.slice(-8).map(function (l) { return [l.time, l.user, l.result]; }) };
  }

  /* psql-style text table */
  function textTable(cols, data) {
    var w = cols.map(function (c, i) {
      return Math.max(c.length, data.reduce(function (m, r) { return Math.max(m, r[i].length); }, 0));
    });
    function row(cells) { return " " + cells.map(function (c, i) { return c.padEnd(w[i]); }).join(" | "); }
    var out = [row(cols), "-" + w.map(function (n) { return "-".repeat(n); }).join("-+-") + "-"];
    data.forEach(function (r) { out.push(row(r)); });
    out.push("(" + data.length + " row" + (data.length === 1 ? "" : "s") + ")");
    return out.join("\n");
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

  function refresh() {
    htmlTable(rolesEl, roleRows(), "Table demo_roles");
    htmlTable(logEl, logRows(), "Table login_log");
    clockEl.textContent = ymd(clock);
    renderSteps();
  }

  function run(cmd) {
    cmd = cmd.trim();
    if (!cmd) return;
    history.push(cmd); histPos = history.length;
    print("postgres=# " + cmd, "cmd");
    for (var i = 0; i < COMMANDS.length; i++) {
      var m = COMMANDS[i].re.exec(cmd);
      if (m) { COMMANDS[i].run(m); refresh(); return; }
    }
    print("ERROR:  this demo doesn't understand that command. Type help, or use the buttons below.", "err");
  }

  /* ---------- guided steps ---------- */
  var STRONG = "Blue-Kite-2026!";
  var NEWPW = "Green-Lake-2027?";
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

  function reset() {
    roles = {};
    log = [];
    clock = today();
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
