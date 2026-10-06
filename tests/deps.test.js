// Dependency scan demo: risk bands and "update a library, risk goes down".
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../js/logic/deps-logic.js");

test("risk levels follow the CVSS-style bands", () => {
  assert.equal(L.levelFor(10), "critical");
  assert.equal(L.levelFor(9.0), "critical");
  assert.equal(L.levelFor(8.9), "high");
  assert.equal(L.levelFor(7.0), "high");
  assert.equal(L.levelFor(6.9), "medium");
  assert.equal(L.levelFor(4.0), "medium");
  assert.equal(L.levelFor(3.9), "low");
  assert.equal(L.levelFor(0.1), "low");
  assert.equal(L.levelFor(0), "none");
});

test("versions compare part by part, not as text", () => {
  assert.ok(L.cmpVersion("1.10.0", "1.9.0") > 0);
  assert.ok(L.cmpVersion("0.9.0", "1.2.0") < 0);
  assert.equal(L.cmpVersion("2.0.0", "2.0"), 0);
});

test("the starting project has one problem in each band", () => {
  const scan = L.scanAll(L.startingLibs());
  assert.equal(scan.flagged, 5);
  assert.deepEqual(scan.counts, { critical: 1, high: 2, medium: 1, low: 1 });
});

test("updating a flagged library to its fixed version removes its risk", () => {
  const libs = L.startingLibs();
  const before = L.scanAll(libs);
  const i = libs.findIndex((l) => l.name === "web-forms");
  assert.equal(before.results[i].level, "critical");
  libs[i].version = before.results[i].fixedIn; // what the "Update to ..." button does
  const after = L.scanAll(libs);
  assert.equal(after.results[i].level, "none");
  assert.equal(after.counts.critical, 0);
  assert.equal(after.flagged, before.flagged - 1);
});

test("updating every flagged library leaves no known problems", () => {
  const libs = L.startingLibs();
  L.scanAll(libs).results.forEach((r, i) => { if (r.fixedIn) libs[i].version = r.fixedIn; });
  assert.equal(L.scanAll(libs).flagged, 0);
});

test("scanning does not change the starting list", () => {
  const a = L.startingLibs();
  a[0].version = "9.9.9";
  assert.equal(L.startingLibs()[0].version, "0.9.0");
});
