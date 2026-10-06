// Learner Space: every JSON file in data/ has the fields the page code expects.
// If you add a practice question with a typo or a missing field, this fails in CI
// instead of breaking the page for visitors.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DATA = path.join(__dirname, "..", "data");
const load = (rel) => JSON.parse(fs.readFileSync(path.join(DATA, rel), "utf8"));
const isText = (v) => typeof v === "string" && v.trim().length > 0;
const allIds = new Set();
function hasText(item, fields, where) {
  for (const f of fields) assert.ok(isText(item[f]), `${where}: "${f}" must be non-empty text`);
}
function uniqueId(item, where) {
  assert.ok(isText(item.id), `${where}: missing id`);
  assert.ok(!allIds.has(item.id), `${where}: id "${item.id}" is used twice`);
  allIds.add(item.id);
}

test("every file in data/ is valid JSON", () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".json") ? [path.join(dir, e.name)] : []);
  for (const file of walk(DATA)) assert.doesNotThrow(() => JSON.parse(fs.readFileSync(file, "utf8")), file);
});

test("leetcode.json: every problem has a number, title, difficulty, link, hint and key idea", () => {
  const lc = load("leetcode.json");
  assert.ok(Array.isArray(lc.coding.categories) && lc.coding.categories.length > 0);
  for (const list of ["coding", "sql", "bash"]) {
    assert.ok(lc[list].problems.length > 0, `${list} list is empty`);
    for (const p of lc[list].problems) {
      const where = `leetcode.json ${list} ${p.id}`;
      uniqueId(p, where);
      assert.ok(Number.isInteger(p.number) && p.number > 0, `${where}: number`);
      hasText(p, ["title", "hint", "keyIdea", "category"], where);
      assert.ok(["Easy", "Medium", "Hard"].includes(p.difficulty), `${where}: difficulty "${p.difficulty}"`);
      assert.match(p.url, /^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/$/, `${where}: link`);
      if (list === "coding") assert.ok(lc.coding.categories.includes(p.category), `${where}: unknown category "${p.category}"`);
    }
  }
});

test("sql-exercises.json: setup and every exercise are complete", () => {
  const sql = load("sql-exercises.json");
  assert.ok(Array.isArray(sql.setup) && sql.setup.length > 0);
  for (const ex of sql.exercises) {
    const where = `sql-exercises.json ${ex.id}`;
    uniqueId(ex, where);
    hasText(ex, ["topic", "question", "hint", "solution"], where);
    assert.ok(["Easy", "Medium"].includes(ex.difficulty), `${where}: difficulty`);
    assert.ok(Array.isArray(ex.tables) && ex.tables.length > 0, `${where}: tables`);
    for (const t of ex.tables) assert.ok(sql.setup.join("\n").includes(`CREATE TABLE ${t} `), `${where}: table "${t}" is not in setup`);
    assert.equal(typeof ex.ordered, "boolean", `${where}: ordered must be true or false`);
  }
});

test("go.json: basics, re-solve and tools lists are complete", () => {
  const go = load("go.json");
  hasText(go, ["why"], "go.json");
  for (const list of ["basics", "resolve", "tools"]) {
    for (const item of go[list]) {
      const where = `go.json ${list} ${item.id}`;
      uniqueId(item, where);
      hasText(item, ["title", "note"], where);
      if (list === "resolve") {
        assert.ok(Number.isInteger(item.number), `${where}: number`);
        assert.match(item.url, /^https:\/\/leetcode\.com\/problems\//, `${where}: link`);
      }
    }
  }
});

test("bash-cheatsheet.json: every command has a name, a description and examples", () => {
  for (const c of load("bash-cheatsheet.json").commands) {
    hasText(c, ["name", "what"], `bash-cheatsheet.json ${c.name}`);
    assert.ok(Array.isArray(c.examples) && c.examples.length > 0, `${c.name}: examples`);
  }
});

test("concepts/*.json: every card has its texts and a valid quiz", () => {
  for (const area of ["networking", "linux", "testing", "devops", "security"]) {
    const file = load(`concepts/${area}.json`);
    assert.equal(file.area, area);
    hasText(file, ["title"], `concepts/${area}.json`);
    for (const card of file.cards) {
      const where = `concepts/${area}.json ${card.id}`;
      uniqueId(card, where);
      hasText(card, ["topic", "question", "hint", "answer", "explanation"], where);
      const q = card.quiz;
      hasText(q, ["question", "why"], `${where} quiz`);
      assert.ok(Array.isArray(q.options) && q.options.length >= 2, `${where}: needs at least 2 options`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${where}: answer must point to an option`);
    }
  }
});

test("my-progress.json: only allowed statuses, and only ids that exist", () => {
  const mine = load("my-progress.json");
  for (const [id, status] of Object.entries(mine.items)) {
    assert.ok(["Not started", "In progress", "Done"].includes(status), `${id}: status "${status}"`);
    assert.ok(allIds.has(id), `my-progress.json: "${id}" is not a practice item`);
  }
});

test("solutions.json: every solution belongs to a problem and has code or a link", () => {
  const { solutions } = load("solutions.json");
  for (const [id, sol] of Object.entries(solutions)) {
    assert.ok(allIds.has(id), `solutions.json: "${id}" is not a practice item`);
    assert.ok(isText(sol.code) || isText(sol.url), `solutions.json ${id}: needs code or url`);
  }
});
