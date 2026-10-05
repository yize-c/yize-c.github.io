/* Password policy demo.
   Simplified demo for learning, not the real tool. Nothing here talks to a
   database; the rules below are example rules chosen for the demo. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 1. Strength checker ---------- */
  var USERNAME = "alex";
  var pwInput = $("pg-new");
  var ruleList = $("pg-rules");
  var ruleSummary = $("pg-rule-summary");
  var showBox = $("pg-show");

  var RULES = [
    { text: "At least 12 characters", test: function (p) { return p.length >= 12; } },
    { text: "At least one uppercase letter (A–Z)", test: function (p) { return /[A-Z]/.test(p); } },
    { text: "At least one lowercase letter (a–z)", test: function (p) { return /[a-z]/.test(p); } },
    { text: "At least one number (0–9)", test: function (p) { return /[0-9]/.test(p); } },
    { text: "At least one symbol (like ! ? # -)", test: function (p) { return /[^A-Za-z0-9]/.test(p); } },
    { text: "Does not contain the username \"" + USERNAME + "\"", test: function (p) { return p.length > 0 && p.toLowerCase().indexOf(USERNAME) === -1; } }
  ];

  function checkRules() {
    var p = pwInput.value;
    var passed = 0;
    ruleList.textContent = "";
    RULES.forEach(function (r) {
      var ok = r.test(p);
      if (ok) passed++;
      var li = document.createElement("li");
      li.className = ok ? "pass" : "fail";
      var mark = document.createElement("span");
      mark.className = "mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = ok ? "✓" : "✗";
      var txt = document.createElement("span");
      txt.textContent = r.text;
      var sr = document.createElement("span");
      sr.className = "visually-hidden";
      sr.textContent = ok ? " (passed)" : " (not yet)";
      li.appendChild(mark);
      li.appendChild(txt);
      li.appendChild(sr);
      ruleList.appendChild(li);
    });
    if (!p) {
      ruleSummary.className = "status-line";
      ruleSummary.textContent = "Type a password to see which rules it passes.";
    } else if (passed === RULES.length) {
      ruleSummary.className = "status-line ok";
      ruleSummary.textContent = "All " + RULES.length + " rules passed. This password would be accepted.";
    } else {
      ruleSummary.className = "status-line bad";
      ruleSummary.textContent = passed + " of " + RULES.length + " rules passed. This password would be rejected.";
    }
  }

  if (pwInput) {
    pwInput.addEventListener("input", checkRules);
    showBox.addEventListener("change", function () {
      pwInput.type = showBox.checked ? "text" : "password";
    });
    checkRules();
  }

  /* ---------- 2. Lockout after 3 wrong passwords ---------- */
  var CORRECT = "Blue-Kite-2026";
  var MAX = 3;
  var form = $("pg-login");
  var loginPw = $("pg-login-pw");
  var loginBtn = $("pg-login-btn");
  var loginMsg = $("pg-login-msg");
  var bars = $("pg-attempts");
  var resetBtn = $("pg-reset");
  var failures = 0;
  var locked = false;

  function renderBars() {
    bars.textContent = "";
    for (var i = 0; i < MAX; i++) {
      var s = document.createElement("span");
      if (i < failures) s.className = "used";
      bars.appendChild(s);
    }
    bars.setAttribute("aria-label", (MAX - failures) + " of " + MAX + " attempts left");
  }

  function resetLogin() {
    failures = 0;
    locked = false;
    loginPw.disabled = false;
    loginBtn.disabled = false;
    loginPw.value = "";
    loginMsg.className = "status-line";
    loginMsg.textContent = "You have " + MAX + " attempts.";
    renderBars();
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (locked) return;
      if (loginPw.value === CORRECT) {
        failures = 0;
        loginMsg.className = "status-line ok";
        loginMsg.textContent = "Logged in. The wrong-password counter goes back to 0 after a successful login.";
      } else {
        failures++;
        if (failures >= MAX) {
          locked = true;
          loginPw.disabled = true;
          loginBtn.disabled = true;
          loginMsg.className = "status-line bad";
          loginMsg.textContent = "Account locked after " + MAX + " wrong passwords. Even the right password won't work now. " +
            "In a real system, an administrator unlocks it, or it unlocks after a waiting period. " +
            "This stops someone from guessing passwords over and over.";
        } else {
          loginMsg.className = "status-line warn";
          loginMsg.textContent = "Wrong password. " + (MAX - failures) + " attempt" + (MAX - failures === 1 ? "" : "s") + " left before the account is locked.";
        }
      }
      loginPw.value = "";
      renderBars();
    });
    resetBtn.addEventListener("click", function () { resetLogin(); loginPw.focus(); });
    resetLogin();
  }

  /* ---------- 3. Expiry after 90 days ---------- */
  var DAYS = 90;
  var dateInput = $("pg-changed");
  var expOut = $("pg-expiry");
  var calWrap = $("pg-cal");
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function toInputValue(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function parseInput(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function buildCalendar(expiry, today) {
    var y = expiry.getFullYear(), m = expiry.getMonth();
    var table = document.createElement("table");
    table.className = "mini-cal";
    var cap = document.createElement("caption");
    cap.textContent = MONTHS[m] + " " + y;
    table.appendChild(cap);
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    [["Sun", "Su"], ["Mon", "Mo"], ["Tue", "Tu"], ["Wed", "We"], ["Thu", "Th"], ["Fri", "Fr"], ["Sat", "Sa"]].forEach(function (d) {
      var th = document.createElement("th");
      th.scope = "col";
      var abbr = document.createElement("abbr");
      abbr.title = d[0];
      abbr.textContent = d[1];
      th.appendChild(abbr);
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    var first = new Date(y, m, 1).getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var row = document.createElement("tr");
    for (var i = 0; i < first; i++) row.appendChild(document.createElement("td"));
    for (var d = 1; d <= days; d++) {
      var td = document.createElement("td");
      td.textContent = d;
      var date = new Date(y, m, d);
      if (sameDay(date, expiry)) {
        td.className = "expiry";
        td.setAttribute("aria-label", d + " — password expires");
      } else if (sameDay(date, today)) {
        td.className = "today";
        td.setAttribute("aria-label", d + " — today");
      }
      row.appendChild(td);
      if ((first + d) % 7 === 0) {
        tbody.appendChild(row);
        row = document.createElement("tr");
      }
    }
    if (row.children.length) {
      while (row.children.length < 7) row.appendChild(document.createElement("td"));
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    calWrap.textContent = "";
    calWrap.appendChild(table);
  }

  function updateExpiry() {
    var changed = parseInput(dateInput.value);
    if (!changed) {
      expOut.textContent = "Pick a date to see when the password expires.";
      calWrap.textContent = "";
      return;
    }
    var expiry = new Date(changed.getFullYear(), changed.getMonth(), changed.getDate() + DAYS);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var left = Math.round((expiry - today) / 86400000);
    var fmt = expiry.toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    var when;
    if (left > 0) when = "That's " + left + " day" + (left === 1 ? "" : "s") + " from today.";
    else if (left === 0) when = "That's today, so the password must be changed now.";
    else when = "That was " + (-left) + " day" + (left === -1 ? "" : "s") + " ago, so this password has already expired and must be changed at the next login.";
    expOut.textContent = "The password expires on " + fmt + " (" + DAYS + " days later). " + when;
    buildCalendar(expiry, today);
  }

  if (dateInput) {
    dateInput.value = toInputValue(new Date());
    dateInput.addEventListener("input", updateExpiry);
    dateInput.addEventListener("change", updateExpiry);
    updateExpiry();
  }
})();
