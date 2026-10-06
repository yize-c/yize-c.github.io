/* PostgreSQL password policy demo: the logic only (no page code), so it can be tested.
   Works in the browser as window.PgLogic and in Node with require().
   A pretend server: it understands a few psql-style commands and returns the
   lines a database administrator would see. Nothing talks to a real database.
   The password rules are example rules chosen for the demo. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PgLogic = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAX_FAILED = 3;
  var EXPIRY_DAYS = 90;

  /* ---------- Date helpers and the fake password hash ---------- */
  function today() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 9, 0, 0);
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function ymd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function hm(d) { return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

  /* A short fake hash, so the table never shows a real password. */
  function fakeHash(pw) {
    var h = 2166136261;
    for (var i = 0; i < pw.length; i++) { h ^= pw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return "SCRAM-SHA-256$4096:" + (h >>> 0).toString(16).padStart(8, "0") + "…";
  }


  /* ---------- The password rules (example rules for the demo) ----------
     Returns an error message, or null when the password is accepted. */
  function checkPassword(user, pw) {
    if (pw.length < 12) return "password is too short (demo rule: at least 12 characters)";
    if (pw.toLowerCase().indexOf(user.toLowerCase()) !== -1) return "password must not contain user name";
    if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) {
      return "password must contain upper and lower case letters, a number and a symbol";
    }
    return null;
  }


  /* A psql-style text table, used for SELECT * FROM ... output. */
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

  /* ---------- One pretend server: roles, login log and a demo clock ----------
     run(command) returns { understood, lines }, where each line is
     { text, cls } and cls is one of "ok", "err", "notice", "out". */
  function createServer(startDate) {
    var roles = {};
    var log = [];
    var clock = startDate ? new Date(startDate.getTime()) : today();
    var out = [];
    function say(text, cls) { out.push({ text: text, cls: cls }); }
    function tick() { clock = new Date(clock.getTime() + 60000); }

    /* The 90-day rule: work out VALID UNTIL, never more than 90 days from now. */
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

    /* Every login attempt gets a row in login_log (only the last 50 are kept). */
    function logRow(user, result) {
      log.push({ time: ymd(clock) + " " + hm(clock), user: user, result: result });
      if (log.length > 50) log.shift();
    }

    /* ---------- The commands this demo understands ----------
       Each one is a pattern (regular expression) and what to do when it matches. */
    var COMMANDS = [
      {
        re: /^create\s+role\s+(\w+)(?:\s+(?:with\s+)?login)?\s+password\s+'([^']*)'(?:\s+valid\s+until\s+'([^']*)')?\s*;?$/i,
        run: function (m) {
          var name = m[1].toLowerCase(), pw = m[2];
          if (roles[name]) { say("ERROR:  role \"" + name + "\" already exists", "err"); return; }
          var bad = checkPassword(name, pw);
          if (bad) { say("ERROR:  " + bad, "err"); return; }
          var exp = expiryFrom(m[3]);
          if (exp.error) { say("ERROR:  " + exp.error, "err"); return; }
          roles[name] = { pw: pw, hash: fakeHash(pw), validUntil: exp.date, failed: 0, locked: false };
          say("CREATE ROLE", "ok");
          if (exp.note) say("NOTICE:  " + exp.note, "notice");
          say("NOTICE:  password for \"" + name + "\" expires on " + ymd(exp.date), "notice");
        }
      },
      {
        re: /^alter\s+role\s+(\w+)\s+(?:with\s+)?password\s+'([^']*)'(?:\s+valid\s+until\s+'([^']*)')?\s*;?$/i,
        run: function (m) {
          var name = m[1].toLowerCase(), pw = m[2], r = roles[name];
          if (!r) { say("ERROR:  role \"" + name + "\" does not exist", "err"); return; }
          var bad = checkPassword(name, pw);
          if (bad) { say("ERROR:  " + bad, "err"); return; }
          if (pw === r.pw) { say("ERROR:  new password must be different from the old one", "err"); return; }
          var exp = expiryFrom(m[3]);
          if (exp.error) { say("ERROR:  " + exp.error, "err"); return; }
          r.pw = pw; r.hash = fakeHash(pw); r.validUntil = exp.date;
          say("ALTER ROLE", "ok");
          if (exp.note) say("NOTICE:  " + exp.note, "notice");
          say("NOTICE:  password for \"" + name + "\" now expires on " + ymd(exp.date), "notice");
        }
      },
      {
        re: /^login\s+(\w+)\s+'([^']*)'\s*;?$/i,
        run: function (m) {
          var name = m[1].toLowerCase(), pw = m[2], r = roles[name];
          tick();
          /* Same message for a wrong password and an unknown user, so attackers can't tell which. */
          if (!r) { say("FATAL:  password authentication failed for user \"" + name + "\"", "err"); logRow(name, "failed (no such role)"); return; }
          if (r.locked) { say("FATAL:  account \"" + name + "\" is locked", "err"); logRow(name, "rejected (locked)"); return; }
          if (pw !== r.pw) {
            r.failed++;
            say("FATAL:  password authentication failed for user \"" + name + "\"", "err");
            if (r.failed >= MAX_FAILED) {
              r.locked = true;
              logRow(name, "failed → locked");
              say("WARNING:  account \"" + name + "\" locked after " + MAX_FAILED + " failed attempts", "notice");
            } else {
              logRow(name, "failed (" + r.failed + "/" + MAX_FAILED + ")");
              say("NOTICE:  " + (MAX_FAILED - r.failed) + " attempt" + (MAX_FAILED - r.failed === 1 ? "" : "s") + " left before the account is locked", "notice");
            }
            return;
          }
          if (r.validUntil && clock >= r.validUntil) {
            say("FATAL:  password authentication failed for user \"" + name + "\"", "err");
            say("LOG:    (server log) User \"" + name + "\" has an expired password.", "notice");
            logRow(name, "failed (expired)");
            return;
          }
          r.failed = 0;
          logRow(name, "success");
          say("You are now connected to database \"postgres\" as user \"" + name + "\".", "ok");
        }
      },
      {
        re: /^select\s+demo_unlock\s*\(\s*'(\w+)'\s*\)\s*;?$/i,
        run: function (m) {
          var name = m[1].toLowerCase(), r = roles[name];
          if (!r) { say("ERROR:  role \"" + name + "\" does not exist", "err"); return; }
          r.locked = false; r.failed = 0;
          say(" demo_unlock\n-------------\n t\n(1 row)", "ok");
          say("NOTICE:  account \"" + name + "\" unlocked by an administrator", "notice");
        }
      },
      {
        re: /^drop\s+role\s+(\w+)\s*;?$/i,
        run: function (m) {
          var name = m[1].toLowerCase();
          if (!roles[name]) { say("ERROR:  role \"" + name + "\" does not exist", "err"); return; }
          delete roles[name];
          say("DROP ROLE", "ok");
        }
      },
      {
        re: /^select\s+\*\s+from\s+(demo_roles|login_log)\s*;?$/i,
        run: function (m) {
          var t = m[1].toLowerCase();
          var rows = t === "demo_roles" ? roleRows() : logRows();
          say(textTable(rows.cols, rows.data), "out");
        }
      },
      {
        re: /^\\advance\s+(\d{1,3})\s*days?\s*$/i,
        run: function (m) {
          clock = addDays(clock, Number(m[1]));
          say("(demo clock moved forward " + m[1] + " days, it is now " + ymd(clock) + ")", "notice");
        }
      },
      {
        re: /^(\\\?|help)\s*;?$/i,
        run: function () {
          say([
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

    /* Rows for the two tables shown beside the console. */
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

    function run(cmd) {
      cmd = cmd.trim();
      out = [];
      for (var i = 0; i < COMMANDS.length; i++) {
        var m = COMMANDS[i].re.exec(cmd);
        if (m) { COMMANDS[i].run(m); return { understood: true, lines: out }; }
      }
      return { understood: false, lines: [{ text: "ERROR:  this demo doesn't understand that command. Type help, or use the buttons below.", cls: "err" }] };
    }

    return {
      run: run,
      roleRows: roleRows,
      logRows: logRows,
      getClock: function () { return clock; },
      getRole: function (name) { return roles[name]; }
    };
  }

  return {
    MAX_FAILED: MAX_FAILED,
    EXPIRY_DAYS: EXPIRY_DAYS,
    checkPassword: checkPassword,
    textTable: textTable,
    ymd: ymd,
    addDays: addDays,
    createServer: createServer
  };
});
