/* SQL playground: the result checker only (no page code), so it can be tested.
   Works in the browser as window.SqlCheck and in Node with require().
   A result looks like sql.js gives it: { columns: [...], values: [[...], ...] }.
   Column names are not compared, only values. Row order only matters when the
   exercise says so (ordered = true). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SqlCheck = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Turn one cell into comparable text. NULL stays visible; numbers are rounded
     so 78.0 and 78 (or tiny float noise) count as the same value. */
  function norm(v) {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(Math.round(v * 1e6) / 1e6);
    return String(v);
  }

  /* One text key per row, so whole rows can be compared and sorted. */
  function rowKeys(result) {
    return result.values.map(function (r) { return r.map(norm).join("␟"); });
  }

  /* Compare the visitor's result with the expected one and explain any difference. */
  function compare(got, want, ordered) {
    if (!got.columns.length && want.values.length) {
      return { ok: false, msg: "Your query didn't return any rows. Expected " + want.values.length + " row(s)." };
    }
    if (got.columns.length !== want.columns.length) {
      return { ok: false, msg: "Your result has " + got.columns.length + " column(s), but the expected result has " + want.columns.length + "." };
    }
    if (got.values.length !== want.values.length) {
      return { ok: false, msg: "Your result has " + got.values.length + " row(s), but the expected result has " + want.values.length + "." };
    }
    var a = rowKeys(got), b = rowKeys(want);
    if (ordered) {
      var same = a.every(function (k, i) { return k === b[i]; });
      if (same) return { ok: true };
      var sa = a.slice().sort().join("\n"), sb = b.slice().sort().join("\n");
      if (sa === sb) return { ok: false, msg: "You have the right rows, but in a different order. Check your ORDER BY." };
      return { ok: false, msg: "Same number of rows and columns, but some values are different." };
    }
    if (a.slice().sort().join("\n") === b.slice().sort().join("\n")) return { ok: true };
    return { ok: false, msg: "Same number of rows and columns, but some values are different." };
  }

  return { norm: norm, compare: compare };
});
