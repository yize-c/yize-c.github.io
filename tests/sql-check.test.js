// SQL playground: the result checker, plus every exercise's own solution.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { compare, norm } = require("../js/logic/sql-check.js");

const res = (columns, values) => ({ columns, values });
const want = res(["name", "year"], [["Dev", 4], ["Ben", 3], ["Ana", 2]]);

test("a correct answer is accepted, even with different column names", () => {
  assert.equal(compare(res(["n", "y"], [["Dev", 4], ["Ben", 3], ["Ana", 2]]), want, true).ok, true);
});

test("wrong row order is rejected when order matters", () => {
  const r = compare(res(["name", "year"], [["Ana", 2], ["Ben", 3], ["Dev", 4]]), want, true);
  assert.equal(r.ok, false);
  assert.match(r.msg, /different order/);
});

test("row order does not matter when the exercise is unordered", () => {
  assert.equal(compare(res(["name", "year"], [["Ana", 2], ["Dev", 4], ["Ben", 3]]), want, false).ok, true);
});

test("wrong columns, row counts, values and empty results are explained", () => {
  assert.match(compare(res(["name"], [["Dev"], ["Ben"], ["Ana"]]), want, false).msg, /1 column/);
  assert.match(compare(res(["name", "year"], [["Dev", 4]]), want, false).msg, /1 row/);
  assert.match(compare(res(["name", "year"], [["Dev", 4], ["Ben", 3], ["Ana", 9]]), want, false).msg, /values are different/);
  assert.match(compare(res([], []), want, false).msg, /didn't return any rows/);
});

test("NULL and number formats are compared sensibly", () => {
  assert.equal(norm(null), "NULL");
  assert.equal(norm(78), norm(78.0));
  assert.equal(norm(0.1 + 0.2), norm(0.3));
});

// Runs each exercise's solution on the sample database with the vendored sql.js,
// so a broken solution or setup is caught before visitors see it.
test("every exercise's solution runs and passes its own check", async () => {
  const initSqlJs = require("../vendor/sql.js/sql-wasm.js");
  const SQL = await initSqlJs({ locateFile: (f) => path.join(__dirname, "..", "vendor", "sql.js", f) });
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "sql-exercises.json"), "utf8"));
  for (const ex of data.exercises) {
    const db = new SQL.Database();
    db.run(data.setup.join("\n"));
    const out = db.exec(ex.solution);
    db.close();
    assert.ok(out.length > 0 && out[out.length - 1].values.length > 0, `${ex.id} returned no rows`);
    const result = out[out.length - 1];
    assert.equal(compare(result, result, ex.ordered).ok, true, ex.id);
    if (ex.ordered && result.values.length > 1) {
      const reversed = res(result.columns, result.values.slice().reverse());
      assert.equal(compare(reversed, result, true).ok, false, `${ex.id}: reversed order should fail`);
    }
  }
});
