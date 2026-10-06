// PostgreSQL password policy demo: password rules, lockout, unlock and 90-day expiry.
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../js/logic/pg-logic.js");

const START = new Date(2026, 9, 6, 9, 0, 0); // fixed demo clock, so dates are predictable
const GOOD = "Blue-Kite-2026!";
const text = (result) => result.lines.map((l) => l.text).join("\n");
function serverWithAlex() {
  const s = L.createServer(START);
  s.run(`CREATE ROLE alex LOGIN PASSWORD '${GOOD}';`);
  return s;
}

test("each password rule rejects what it should", () => {
  assert.match(L.checkPassword("alex", "Short-1!"), /too short/);
  assert.match(L.checkPassword("alex", "Alex-is-great-2026!"), /must not contain user name/);
  assert.match(L.checkPassword("alex", "lowercase-only-2026!"), /upper and lower case/);
  assert.match(L.checkPassword("alex", "UPPERCASE-ONLY-2026!"), /upper and lower case/);
  assert.match(L.checkPassword("alex", "No-Numbers-Here!"), /a number/);
  assert.match(L.checkPassword("alex", "NoSymbolsHere2026"), /a symbol/);
  assert.equal(L.checkPassword("alex", GOOD), null);
});

test("a weak password is refused and no role is created", () => {
  const s = L.createServer(START);
  const r = s.run("CREATE ROLE alex LOGIN PASSWORD 'alex2026';");
  assert.match(text(r), /^ERROR: +password is too short/);
  assert.equal(s.getRole("alex"), undefined);
});

test("a new role gets a VALID UNTIL date 90 days away", () => {
  const s = serverWithAlex();
  assert.equal(L.ymd(s.getRole("alex").validUntil), L.ymd(L.addDays(START, 90)));
  assert.equal(L.ymd(s.getRole("alex").validUntil), "2027-01-04");
});

test("a VALID UNTIL further than 90 days is shortened to 90 days", () => {
  const s = L.createServer(START);
  const r = s.run(`CREATE ROLE alex LOGIN PASSWORD '${GOOD}' VALID UNTIL '2030-01-01';`);
  assert.match(text(r), /policy shortens it/);
  assert.equal(L.ymd(s.getRole("alex").validUntil), "2027-01-04");
});

test("the account locks after 3 failed logins, even for the right password", () => {
  const s = serverWithAlex();
  assert.match(text(s.run("LOGIN alex 'wrong';")), /2 attempts left/);
  assert.match(text(s.run("LOGIN alex 'wrong';")), /1 attempt left/);
  assert.match(text(s.run("LOGIN alex 'wrong';")), /locked after 3 failed attempts/);
  assert.equal(s.getRole("alex").locked, true);
  assert.match(text(s.run(`LOGIN alex '${GOOD}';`)), /account "alex" is locked/);
});

test("a successful login resets the failure count", () => {
  const s = serverWithAlex();
  s.run("LOGIN alex 'wrong';");
  s.run("LOGIN alex 'wrong';");
  assert.equal(s.getRole("alex").failed, 2);
  assert.match(text(s.run(`LOGIN alex '${GOOD}';`)), /You are now connected/);
  assert.equal(s.getRole("alex").failed, 0);
  // two more failures are not enough to lock, because the count started again
  s.run("LOGIN alex 'wrong';");
  s.run("LOGIN alex 'wrong';");
  assert.equal(s.getRole("alex").locked, false);
});

test("an admin unlock clears the lock and the count", () => {
  const s = serverWithAlex();
  for (let i = 0; i < 3; i++) s.run("LOGIN alex 'wrong';");
  assert.match(text(s.run("SELECT demo_unlock('alex');")), /unlocked by an administrator/);
  assert.equal(s.getRole("alex").locked, false);
  assert.equal(s.getRole("alex").failed, 0);
  assert.match(text(s.run(`LOGIN alex '${GOOD}';`)), /You are now connected/);
});

test("the password expires after 90 days and a new one fixes it", () => {
  const s = serverWithAlex();
  s.run("\\advance 89 days");
  assert.match(text(s.run(`LOGIN alex '${GOOD}';`)), /You are now connected/);
  s.run("\\advance 2 days");
  const expired = text(s.run(`LOGIN alex '${GOOD}';`));
  assert.match(expired, /password authentication failed/);
  assert.match(expired, /has an expired password/);
  assert.match(text(s.run(`ALTER ROLE alex PASSWORD '${GOOD}';`)), /must be different/);
  assert.match(text(s.run("ALTER ROLE alex PASSWORD 'Green-Lake-2027?';")), /ALTER ROLE/);
  assert.match(text(s.run("LOGIN alex 'Green-Lake-2027?';")), /You are now connected/);
});

test("an unknown user gets the same message as a wrong password", () => {
  const s = serverWithAlex();
  const unknown = s.run("LOGIN nobody 'x';").lines[0].text;
  const wrong = s.run("LOGIN alex 'x';").lines[0].text;
  assert.equal(unknown.replace("nobody", "?"), wrong.replace("alex", "?"));
});

test("login_log records each attempt", () => {
  const s = serverWithAlex();
  s.run("LOGIN alex 'wrong';");
  s.run(`LOGIN alex '${GOOD}';`);
  const rows = s.logRows().data.map((r) => r[2]);
  assert.deepEqual(rows, ["failed (1/3)", "success"]);
});

test("unknown commands are reported, not run", () => {
  const r = L.createServer(START).run("DROP TABLE users;");
  assert.equal(r.understood, false);
  assert.match(text(r), /doesn't understand/);
});
