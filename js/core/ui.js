/* Shared building blocks for every page, so each script doesn't write its own copy.
   Everything lives on one global object, window.YC:
     YC.storage          localStorage that never throws (it can be blocked)
     YC.el / extLink     build DOM elements in one call
     YC.table            draw rows and columns as an accessible HTML table
     YC.setStatus        update a "status-line" message
     YC.VisitorProgress  the visitor's own saved progress (Learner Space) */
(function () {
  "use strict";

  /* ---------- Safe storage: every read and write is wrapped, so a blocked
     localStorage (private mode, strict settings) never breaks a page. ---------- */
  var storage = {
    ok: (function () {
      try {
        localStorage.setItem("yc-test", "1");
        localStorage.removeItem("yc-test");
        return true;
      } catch (e) { return false; }
    })(),
    get: function (key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* storage blocked */ }
    },
    getJSON: function (key) {
      try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
    }
  };

  /* ---------- Building elements ---------- */
  /* el("p", { class: "x", text: "Hi", onclick: fn }, [child, "text"]) */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? "" : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  /* External links always open in a new tab without giving that tab access to this page. */
  function extLink(href, text, cls) {
    return el("a", { href: href, target: "_blank", rel: "noopener noreferrer", class: cls || null, text: text });
  }

  /* Unique ids for label/aria links between generated elements. */
  var uid = 0;
  function nextId(prefix) { uid++; return prefix + "-" + uid; }

  /* ---------- Tables ---------- */
  /* opts: caption (read by screen readers), empty (text for no rows, or false for none),
     cell(value, column) → { text, class } to style special values. */
  function table(columns, rows, opts) {
    opts = opts || {};
    var cell = opts.cell || function (v) { return { text: String(v) }; };
    var body = rows.length ? rows.map(function (r) {
      return el("tr", null, r.map(function (v, i) {
        var c = cell(v, columns[i]);
        return el("td", { class: c.class || null, text: c.text });
      }));
    }) : opts.empty === false ? [] : [el("tr", null, [el("td", { colspan: String(columns.length), class: "null", text: opts.empty || "(0 rows)" })])];
    return el("table", null, [
      opts.caption ? el("caption", { class: "visually-hidden", text: opts.caption }) : null,
      el("thead", null, [el("tr", null, columns.map(function (c) { return el("th", { scope: "col", text: c }); }))]),
      el("tbody", null, body)
    ]);
  }

  /* ---------- Status messages ---------- */
  /* kind is "", "ok", "warn" or "bad"; base keeps any extra classes the line already uses. */
  function setStatus(node, kind, text, base) {
    node.className = (base || "status-line") + (kind ? " " + kind : "");
    node.textContent = text;
  }

  /* ---------- The visitor's own progress (Learner Space) ---------- */
  class VisitorProgress {
    constructor(key) {
      this.key = key;
      var d = storage.getJSON(key);
      this.done = d.done || {};
      this.cards = d.cards || {};
      this.tab = d.tab || "";
    }
    save() {
      storage.set(this.key, JSON.stringify({ done: this.done, cards: this.cards, tab: this.tab }));
    }
    isDone(id) { return !!this.done[id]; }
    setDone(id, on) {
      if (on) this.done[id] = true; else delete this.done[id];
      this.save();
    }
    card(id) { return this.cards[id]; }
    setCard(id, value) { this.cards[id] = value; this.save(); }
    setTab(key) { this.tab = key; this.save(); }
  }

  window.YC = {
    storage: storage,
    el: el,
    extLink: extLink,
    nextId: nextId,
    table: table,
    setStatus: setStatus,
    VisitorProgress: VisitorProgress
  };
})();
