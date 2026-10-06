// Intrusion detection demo: the counts for the fixed made-up sample.
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../js/logic/ids-logic.js");

const events = L.makeEvents();

test("the made-up sample is the same every time", () => {
  assert.deepEqual(L.makeEvents(), events);
  assert.equal(events.length, 60);
  assert.equal(events.filter((e) => e.attack).length, 12);
});

// Expected numbers at a few strictness levels:
// [strictness, stage1 {flagged, caught, missed, falseAlarms}, stage2 {...}]
const CASES = [
  [10, { flagged: 3, caught: 3, missed: 9, falseAlarms: 0 }, { flagged: 2, caught: 2, missed: 10, falseAlarms: 0 }],
  [50, { flagged: 20, caught: 7, missed: 5, falseAlarms: 13 }, { flagged: 9, caught: 6, missed: 6, falseAlarms: 3 }],
  [60, { flagged: 37, caught: 12, missed: 0, falseAlarms: 25 }, { flagged: 16, caught: 11, missed: 1, falseAlarms: 5 }],
  [90, { flagged: 55, caught: 12, missed: 0, falseAlarms: 43 }, { flagged: 20, caught: 11, missed: 1, falseAlarms: 9 }],
];

for (const [strictness, s1, s2] of CASES) {
  test(`counts at strictness ${strictness}`, () => {
    const run = L.runStages(events, strictness);
    assert.equal(run.threshold, 100 - strictness);
    assert.deepEqual(run.stage1, s1);
    assert.deepEqual(run.stage2, s2);
  });
}

test("stage 2 only removes alerts; it never adds one", () => {
  for (let strict = 0; strict <= 100; strict += 5) {
    const run = L.runStages(events, strict);
    run.marks.forEach((m) => assert.ok(!m.stage2 || m.stage1));
    assert.ok(run.stage2.flagged <= run.stage1.flagged);
    assert.ok(run.stage2.caught <= run.stage1.caught);
  }
});

test("a stricter stage 1 never catches fewer attacks", () => {
  let prev = -1;
  for (let strict = 0; strict <= 100; strict += 5) {
    const caught = L.runStages(events, strict).stage1.caught;
    assert.ok(caught >= prev);
    prev = caught;
  }
});
