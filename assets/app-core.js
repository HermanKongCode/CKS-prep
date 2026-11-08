/*
 * CKS PREP - app core.
 * Plain classic script (no modules). Provides: data access, persistent state,
 * DOM helpers, a delegated action handler, the drill grading engine, the search
 * index, the router/shell, and a dev self-test that validates the data files.
 *
 * Views live in app-views-learn.js and app-views-exam.js and register themselves
 * with App.registerTab(name, render).
 */
(function () {
  "use strict";

  var App = {};
  window.CKSApp = App;

  /* ---------------------------------------------------------------- data ---- */

  var DOMAINS = window.CKS_BLUEPRINT || [];
  var DOMAIN_BY_ID = {};
  DOMAINS.forEach(function (d) { DOMAIN_BY_ID[d.id] = d; });

  App.meta = function () { return window.CKS_META || {}; };
  App.domains = function () { return DOMAINS.slice(); };
  App.domain = function (id) { return DOMAIN_BY_ID[id] || null; };
  App.domainName = function (id) { return (DOMAIN_BY_ID[id] && DOMAIN_BY_ID[id].name) || id; };
  App.domainColor = function (id) { return (DOMAIN_BY_ID[id] && DOMAIN_BY_ID[id].color) || "#8b949e"; };

  App.learn = function () { return (window.CKS_LEARN || []).slice(); };
  App.quiz = function () { return (window.CKS_QUIZ || []).slice(); };
  App.drills = function () { return (window.CKS_DRILLS || []).slice(); };
  App.labs = function () { return (window.CKS_LABS || []).slice(); };
  App.cards = function () { return (window.CKS_CARDS || []).slice(); };
  App.tips = function () { return (window.CKS_EXAM_TIPS || []).slice(); };
  App.resources = function () { return (window.CKS_RESOURCES || []).slice(); };

  App.byId = function (list, id) {
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  };

  App.byDomain = function (list, domainId) {
    if (!domainId || domainId === "all") return list.slice();
    return list.filter(function (x) { return x && x.domain === domainId; });
  };

  /* Per-option note for a quiz question: inline option.why first, then the note bank files. */
  App.quizWhy = function (q, idx) {
    if (!q || !q.options || !q.options[idx]) return null;
    var inline = q.options[idx].why;
    if (typeof inline === "string" && inline) return inline;
    for (var n = 1; n <= 8; n++) {
      var part = window["CKS_QUIZ_WHY_" + n];
      if (part && part[q.id]) {
        var v = part[q.id][idx];
        if (typeof v === "string" && v) return v;
      }
    }
    return null;
  };

  App.difficultyRank = { "setup": 0, easy: 1, medium: 2, hard: 3 };

  /* Items related to a learn topic: labs, drills, quiz questions, cards. */
  App.related = function (topicId) {
    var out = { labs: [], drills: [], quiz: [], cards: [] };
    App.labs().forEach(function (l) {
      if ((l.related || []).indexOf(topicId) >= 0) out.labs.push(l);
    });
    App.drills().forEach(function (d) {
      if ((d.related || []).indexOf(topicId) >= 0) out.drills.push(d);
    });
    App.cards().forEach(function (c) {
      if ((c.related || []).indexOf(topicId) >= 0) out.cards.push(c);
    });
    var t = App.byId(App.learn(), topicId);
    if (t) {
      var tags = t.tags || [];
      App.quiz().forEach(function (q) {
        if (q.domain !== t.domain) return;
        var qt = q.tags || [];
        for (var i = 0; i < qt.length; i++) {
          if (tags.indexOf(qt[i]) >= 0) { out.quiz.push(q); return; }
        }
      });
      if (!out.quiz.length) out.quiz = App.quiz().filter(function (q) { return q.domain === t.domain; }).slice(0, 4);
      App.cards().forEach(function (c) {
        if (c.domain === t.domain && out.cards.length < 6) {
          var ct = c.tags || [];
          for (var i = 0; i < ct.length; i++) if (tags.indexOf(ct[i]) >= 0) { out.cards.push(c); break; }
        }
      });
    }
    return out;
  };

  /* ---------------------------------------------------------------- state --- */

  var STORE_KEY = "cks_prep_v1";
  var memoryOnly = false;

  function blankState() {
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      examDate: "",
      visited: {},
      topics: {},           /* topicId -> ISO timestamp when marked complete */
      labs: {},             /* labId -> { status: 'planned'|'doing'|'done', at: ISO } */
      drills: {},           /* drillId -> { attempts: n, solved: bool, last: ISO, lastPass: bool } */
      quiz: {},             /* questionId -> { attempts: n, correct: bool, last: ISO } */
      cards: {},            /* cardId -> { seen: n, known: ISO|null, unsure: ISO|null } */
      mock: { attempts: [] } /* { at, minutes, pass, total, perDomain, knowledge, hands } */
    };
  }

  function load() {
    var raw = null;
    try { raw = window.localStorage.getItem(STORE_KEY); } catch (e) { memoryOnly = true; }
    if (!raw) return blankState();
    try {
      var parsed = JSON.parse(raw);
      var base = blankState();
      /* shallow-merge so new collections added later get their default keys */
      Object.keys(base).forEach(function (k) {
        if (!(k in parsed)) parsed[k] = base[k];
        else if (k !== "version" && k !== "createdAt" && k !== "examDate" && typeof parsed[k] !== "object") parsed[k] = base[k];
      });
      if (!parsed.mock || !parsed.mock.attempts) parsed.mock = { attempts: [] };
      return parsed;
    } catch (e) {
      console.warn("CKS Prep: stored progress could not be read, starting fresh.", e);
      return blankState();
    }
  }

  var state = load();
  var saveTimer = null;

  App.save = function (immediate) {
    if (memoryOnly) return;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    var write = function () {
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
      catch (e) { memoryOnly = true; App.toast("Progress could not be saved (storage blocked). This session still works in memory.", "bad"); }
    };
    if (immediate) write(); else saveTimer = setTimeout(write, 350);
  };

  App.state = state;
  App.storageBlocked = function () { return memoryOnly; };

  App.markTopic = function (id, done) {
    if (done) state.topics[id] = new Date().toISOString();
    else delete state.topics[id];
    App.save();
  };
  App.topicDone = function (id) { return !!state.topics[id]; };

  App.setLab = function (id, status) {
    state.labs[id] = { status: status, at: new Date().toISOString() };
    App.save();
  };
  App.labStatus = function (id) { return (state.labs[id] && state.labs[id].status) || "todo"; };

  App.recordDrill = function (id, pass) {
    var d = state.drills[id] || { attempts: 0, solved: false, last: null, lastPass: false };
    d.attempts += 1; d.last = new Date().toISOString(); d.lastPass = pass;
    if (pass) d.solved = true;
    state.drills[id] = d; App.save();
  };
  App.drillSolved = function (id) { return !!(state.drills[id] && state.drills[id].solved); };

  App.recordQuiz = function (id, correct) {
    var q = state.quiz[id] || { attempts: 0, correct: false, last: null };
    q.attempts += 1; q.correct = correct; q.last = new Date().toISOString();
    state.quiz[id] = q; App.save();
  };

  App.recordCard = function (id, known) {
    var c = state.cards[id] || { seen: 0, known: null, unsure: null };
    c.seen += 1;
    if (known === true) { c.known = new Date().toISOString(); c.unsure = null; }
    else if (known === false) { c.unsure = new Date().toISOString(); c.known = null; }
    state.cards[id] = c; App.save();
  };

  App.addMockAttempt = function (attempt) {
    state.mock.attempts.push(attempt);
    App.save(true);
  };

  App.resetAll = function () {
    state = blankState();
    App.state = state;
    try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* memory only */ }
    App.save(true);
  };

  App.exportJSON = function () {
    return JSON.stringify(state, null, 2);
  };
  App.importJSON = function (text) {
    var parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || !parsed.topics) throw new Error("This does not look like a CKS Prep progress file.");
    var base = blankState();
    Object.keys(base).forEach(function (k) { if (k in parsed) base[k] = parsed[k]; });
    state = base; App.state = state; App.save(true);
  };

  /* ------------------------------------------------------------------ ui ---- */

  App.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  App.el = function (html) {
    var t = document.createElement("template");
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  };

  App.out = function () { return document.getElementById("out"); };

  App.render = function (html) {
    var host = App.out();
    host.innerHTML = html;
    window.scrollTo(0, 0);
  };

  App.copy = function (text) {
    var done = function () { App.toast("Copied to clipboard.", "ok"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { App.fallbackCopy(text, done); });
    } else App.fallbackCopy(text, done);
  };
  App.fallbackCopy = function (text, done) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { App.toast("Copy blocked by the browser.", "bad"); }
    document.body.removeChild(ta);
  };

  App.code = function (text, label) {
    return '<div class="codeblock">' +
      '<button class="copy small" data-act="copy" data-text="' + App.esc(text) + '">copy</button>' +
      (label ? '<div class="tiny mute" style="position:absolute;top:8px;left:10px">' + App.esc(label) + "</div>" : "") +
      "<pre>" + App.esc(text) + "</pre></div>";
  };

  App.domainPill = function (id) {
    return '<span class="pill-domain"><i style="background:' + App.esc(App.domainColor(id)) + '"></i>' +
      App.esc(App.domainName(id)) + "</span>";
  };

  App.bar = function (pct, color) {
    var w = Math.max(0, Math.min(100, Math.round(pct || 0)));
    return '<div class="bar"><i style="width:' + w + "%;background:" + App.esc(color || "#58a6ff") + '"></i></div>';
  };

  App.toast = function (msg, kind) {
    var host = document.getElementById("toasts");
    if (!host) return;
    var d = App.el('<div class="toast ' + (kind || "") + '">' + App.esc(msg) + "</div>");
    host.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3600);
  };

  /* -------------------------------------------------------- overlay/help ---- */

  App.openOverlay = function (html, focusSel) {
    var o = document.getElementById("overlay");
    o.innerHTML = '<div class="sheet">' + html + "</div>";
    o.hidden = false;
    var f = focusSel ? o.querySelector(focusSel) : null;
    if (f) f.focus();
  };
  App.closeOverlay = function () {
    var o = document.getElementById("overlay");
    o.hidden = true; o.innerHTML = "";
  };
  App.overlayOpen = function () { return !document.getElementById("overlay").hidden; };

  App.helpHTML = function () {
    return "<h2>Keyboard shortcuts</h2>" +
      '<table><tbody>' +
      "<tr><td><kbd>1</kbd>-<kbd>9</kbd></td><td>switch section</td></tr>" +
      "<tr><td><kbd>Ctrl</kbd>+<kbd>K</kbd> / <kbd>/</kbd></td><td>search everything (topics, drills, labs, cards, docs)</td></tr>" +
      "<tr><td><kbd>?</kbd></td><td>this help</td></tr>" +
      "<tr><td><kbd>Esc</kbd></td><td>close overlay</td></tr>" +
      "<tr><td><kbd>Space</kbd></td><td>flip a flashcard</td></tr>" +
      "<tr><td><kbd>k</kbd> / <kbd>u</kbd></td><td>card: known / unsure</td></tr>" +
      "<tr><td><kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td>drill: check answer</td></tr>" +
      "<tr><td><kbd>h</kbd></td><td>drill: reveal next hint</td></tr>" +
      "</tbody></table>" +
      '<p class="dim small">Everything on this site is stored in your browser only (key <code>' + STORE_KEY + "</code>). " +
      "Use Progress to export it, and re-import it on another machine.</p>" +
      '<button class="primary" data-act="close-overlay">Close</button>';
  };

  /* --------------------------------------------------- drill grading ---- */

  /*
   * The grading contract, shared with assets/data-drill.js:
   *   1. normalise the answer: lowercase, delete quote characters, collapse every
   *      run of whitespace (spaces, tabs, newlines, indentation) into one space.
   *   2. compile every need/avoid pattern with new RegExp(pattern, "i") and test
   *      it against the normalised answer.
   * Consequence: patterns must work without quotes and without line structure,
   * so ordering checks use bounded windows such as .{0,120}.
   */
  App.norm = function (s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/[\u2018\u2019"\x27`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  App.compile = function (pattern) {
    try { return new RegExp(pattern, "i"); }
    catch (e) { App.toast("A drill pattern failed to compile - report it: " + pattern, "bad"); return null; }
  };

  App.grade = function (drill, answer) {
    var norm = App.norm(answer);
    var need = (drill.need || []).map(function (n) {
      var re = App.compile(n.re);
      return { kind: "need", label: n.label, re: n.re, ok: !!re && re.test(norm) };
    });
    var avoid = (drill.avoid || []).map(function (n) {
      var re = App.compile(n.re);
      return { kind: "avoid", label: n.label, re: n.re, ok: !(re && re.test(norm)) };
    });
    var checks = need.concat(avoid);
    var pass = norm.length > 0 && checks.every(function (c) { return c.ok; });
    return {
      norm: norm,
      checks: checks,
      pass: pass,
      needTotal: need.length,
      needOk: need.filter(function (c) { return c.ok; }).length,
      tripped: avoid.filter(function (c) { return !c.ok; })
    };
  };

  App.gradeChecksHTML = function (res) {
    if (!res.checks.length) return '<div class="callout info">This item has no automatic checks - grade it against the solution yourself.</div>';
    var html = '<ul class="check-list">';
    res.checks.forEach(function (c) {
      var okIcon = c.ok ? "PASS" : "FAIL";
      html += '<li><span class="mark ' + (c.ok ? "pass" : "fail") + '">' + okIcon + "</span>" +
        '<span><b>' + (c.kind === "need" ? "needed" : "avoided") + "</b> &middot; " + App.esc(c.label) +
        '<div class="tiny mute mono">' + App.esc(c.re) + "</div></span></li>";
    });
    return html + "</ul>";
  };

  /* ------------------------------------------------------- search index ---- */

  var indexCache = null;

  function idx(type, id, title, text, domain, tab) {
    return { type: type, id: id, title: title, text: text || "", domain: domain || "", tab: tab };
  }

  App.buildIndex = function () {
    if (indexCache) return indexCache;
    var out = [];
    App.learn().forEach(function (t) {
      if (!t) return;
      var notes = (t.notes || []).join(" ");
      var cmds = (t.commands || []).map(function (c) { return c.cmd + " " + (c.why || ""); }).join(" ");
      var yam = (t.yaml || []).map(function (y) { return y.title + " " + y.body; }).join(" ");
      var got = (t.gotchas || []).join(" ");
      out.push(idx("topic", t.id, t.title, notes + " " + cmds + " " + yam + " " + got + " " + (t.tags || []).join(" "), t.domain, "learn"));
      (t.commands || []).forEach(function (c) {
        out.push(idx("command", t.id, c.cmd, c.why || "", t.domain, "learn"));
      });
    });
    App.drills().forEach(function (d) {
      out.push(idx("drill", d.id, d.title, (d.prompt || "") + " " + (d.hints || []).join(" ") + " " + (d.why || "") + " " + (d.tags || []).join(" "), d.domain, "drill"));
    });
    App.labs().forEach(function (l) {
      out.push(idx("lab", l.id, l.title, (l.scenario || "") + " " + (l.tasks || []).join(" ") + " " + (l.pitfalls || []).join(" "), l.domain, "labs"));
    });
    App.quiz().forEach(function (q) {
      out.push(idx("quiz", q.id, q.q, (q.explain || "") + " " + (q.tags || []).join(" "), q.domain, "quiz"));
    });
    App.cards().forEach(function (c) {
      out.push(idx("card", c.id, c.front, (c.back || "") + " " + (c.cmd || "") + " " + (c.tags || []).join(" "), c.domain, "cards"));
    });
    App.tips().forEach(function (t, i) { out.push(idx("tip", String(i), t.title, t.body, "", "dashboard")); });
    DOMAINS.forEach(function (d) {
      (d.competencies || []).forEach(function (c, i) {
        out.push(idx("competency", d.id + "-" + i, c, "blueprint domain " + d.name + " weight " + d.weight + "%", d.id, "dashboard"));
      });
    });
    App.resources().forEach(function (r, i) {
      out.push(idx("resource", String(i), r.label, r.url, "", "cheat"));
    });
    indexCache = out;
    return out;
  };

  App.search = function (query, limit) {
    var q = String(query || "").toLowerCase().trim();
    if (!q) return [];
    var terms = q.split(/\s+/);
    var hits = [];
    App.buildIndex().forEach(function (e) {
      var hay = (e.title + " " + e.text).toLowerCase();
      var score = 0, all = true;
      terms.forEach(function (t) {
        var at = hay.indexOf(t);
        if (at < 0) { all = false; return; }
        score += 12 - Math.min(10, at / 8);
        if (e.title.toLowerCase().indexOf(t) >= 0) score += 14;
      });
      if (!all) {
        /* allow partial matches only for single-term queries, ranked lower */
        if (terms.length > 1) return;
        var any = false;
        terms.forEach(function (t) { if (hay.indexOf(t) >= 0) any = true; });
        if (!any) return;
        score = 3;
      }
      hits.push({ e: e, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, limit || 25).map(function (h) { return h.e; });
  };

  /* ------------------------------------------------------------ router ---- */

  var tabs = {};            /* name -> render(id) */
  var currentTab = "dashboard";

  App.registerTab = function (name, render) { tabs[name] = render; };
  App.tabNames = function () { return Object.keys(tabs); };

  App.setTab = function (name, id, pushHash) {
    if (!tabs[name]) name = "dashboard";
    currentTab = name;
    var hash = "#/" + name + (id ? "/" + id : "");
    if (pushHash !== false && location.hash !== hash) {
      if (pushHash === "replace") history.replaceState(null, "", hash);
      else location.hash = hash;
    }
    state.visited[name] = new Date().toISOString();
    App.save();
    syncNav(name);
    try { tabs[name](id); }
    catch (e) {
      console.error("CKS Prep: view " + name + " failed", e);
      App.render('<div class="callout bad">This view failed to render: ' + App.esc(e.message) +
        '<div class="small mono">' + App.esc(String(e.stack || "")).slice(0, 700) + "</div></div>");
    }
  };

  App.currentTab = function () { return currentTab; };

  function syncNav(name) {
    var btns = document.querySelectorAll("#tabs .tab");
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute("data-tab") === name;
      btns[i].setAttribute("aria-selected", on ? "true" : "false");
    }
  }

  App.parseHash = function () {
    var h = String(location.hash || "").replace(/^#\/?/, "");
    if (!h) return { tab: "dashboard", id: "" };
    var parts = h.split("/");
    return { tab: parts[0] || "dashboard", id: parts.slice(1).join("/") || "" };
  };

  App.route = function (pushHash) {
    var r = App.parseHash();
    App.setTab(r.tab, r.id, pushHash === "replace" ? "replace" : false);
  };

  /* -------------------------------------------------- delegated actions ---- */

  document.addEventListener("click", function (ev) {
    var node = ev.target;
    while (node && node !== document && !(node.getAttribute && node.getAttribute("data-act"))) node = node.parentNode;
    if (!node || node === document) return;
    var act = node.getAttribute("data-act");
    var id = node.getAttribute("data-id") || "";

    if (act === "copy") { ev.preventDefault(); App.copy(node.getAttribute("data-text") || ""); return; }
    if (act === "tab") { ev.preventDefault(); App.setTab(node.getAttribute("data-tab") || "dashboard", id); return; }
    if (act === "close-overlay") { ev.preventDefault(); App.closeOverlay(); return; }
    if (act === "help") { ev.preventDefault(); App.openOverlay(App.helpHTML()); return; }
    if (act === "search-open") { ev.preventDefault(); App.openSearch(node.getAttribute("data-q") || ""); return; }
    if (act === "overlay-hit") {
      ev.preventDefault(); App.closeOverlay();
      App.setTab(node.getAttribute("data-tab"), id);
      if (typeof App.afterSearchOpen === "function") App.afterSearchOpen(node.getAttribute("data-type"), id);
      return;
    }
    if (act && App.action) { ev.preventDefault(); App.action(act, id, node, ev); }
  });

  App.openSearch = function (q) {
    var html = '<div class="head"><input id="search-q" placeholder="Search commands, topics, drills, labs, cards, docs..." value="' + App.esc(q) + '">' +
      '<button data-act="close-overlay" class="ghost">Close</button></div>' +
      '<div id="search-results"></div>';
    App.openOverlay(html, "#search-q");
    var input = document.getElementById("search-q");
    var draw = function () {
      var hits = App.search(input.value, 30);
      var host = document.getElementById("search-results");
      if (!input.value.trim()) { host.innerHTML = '<p class="dim">Type to search across everything on this site.</p>'; return; }
      if (!hits.length) { host.innerHTML = '<p class="dim">No match for <code>' + App.esc(input.value) + "</code>.</p>"; return; }
      var kindLabel = { topic: "Learn", command: "Command", drill: "Drill", lab: "Lab", quiz: "Quiz", card: "Flashcard", tip: "Exam tip", competency: "Blueprint", resource: "Reference" };
      host.innerHTML = hits.map(function (h) {
        return '<div class="search-hit" data-act="overlay-hit" data-tab="' + h.tab + '" data-id="' + App.esc(h.id) + '" data-type="' + h.type + '">' +
          "<b>" + App.esc(h.title.length > 120 ? h.title.slice(0, 120) + "..." : h.title) + "</b>" +
          '<p class="tiny">' + App.esc(kindLabel[h.type] || h.type) +
          (h.domain ? " &middot; " + App.esc(App.domainName(h.domain)) : "") + "</p>" +
          (h.text ? "<p>" + App.esc(h.text.length > 200 ? h.text.slice(0, 200) + "..." : h.text) + "</p>" : "") +
          "</div>";
      }).join("");
    };
    input.addEventListener("input", draw);
    input.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { var first = document.querySelector(".search-hit"); if (first) first.click(); } });
    draw();
  };

  /* --------------------------------------------------------- keyboard ---- */

  document.addEventListener("keydown", function (ev) {
    var tag = (ev.target.tagName || "").toLowerCase();
    var typing = tag === "input" || tag === "textarea" || tag === "select";

    if ((ev.ctrlKey || ev.metaKey) && (ev.key === "k" || ev.key === "K")) { ev.preventDefault(); App.openSearch(""); return; }
    if (ev.key === "Escape" && App.overlayOpen()) { App.closeOverlay(); return; }
    if (typing) return;

    if (ev.key === "?" || (ev.key === "/" && !ev.shiftKey)) { ev.preventDefault(); App.openOverlay(App.helpHTML()); return; }
    if (ev.key >= "1" && ev.key <= "9") {
      var names = ["dashboard", "learn", "labs", "quiz", "drill", "mock", "cards", "cheat", "progress"];
      var name = names[parseInt(ev.key, 10) - 1];
      if (name && tabs[name]) { ev.preventDefault(); App.setTab(name, ""); }
    }
  });

  /* ------------------------------------------------------- self-test ---- */

  /*
   * Dev-only integrity pass over the data files. Warnings go to the console and,
   * if anything is wrong, a banner appears on the page so a problem is visible
   * instead of silently producing a broken view.
   */
  App.selfTest = function () {
    var problems = [];
    var warn = function (m) { problems.push(m); console.warn("CKS self-test: " + m); };

    var validDomains = {};
    DOMAINS.forEach(function (d) { validDomains[d.id] = true; });
    if (DOMAINS.length !== 6) warn("expected 6 blueprint domains, found " + DOMAINS.length);
    var weightSum = DOMAINS.reduce(function (a, d) { return a + (d.weight || 0); }, 0);
    if (weightSum !== 100) warn("blueprint weights add to " + weightSum + ", not 100");

    var collections = [
      ["CKS_LEARN", App.learn()], ["CKS_QUIZ", App.quiz()], ["CKS_DRILLS", App.drills()],
      ["CKS_LABS", App.labs()], ["CKS_CARDS", App.cards()]
    ];
    collections.forEach(function (pair) {
      var name = pair[0], list = pair[1];
      if (!list.length) warn(name + " is empty or missing");
      var seen = {};
      list.forEach(function (item, i) {
        if (!item || typeof item !== "object") { warn(name + "[" + i + "] is not an object"); return; }
        if (!item.id) warn(name + "[" + i + "] has no id");
        else if (seen[item.id]) warn(name + ": duplicate id " + item.id);
        else seen[item.id] = true;
        if (item.domain && !validDomains[item.domain]) warn(name + " " + (item.id || i) + " has unknown domain " + item.domain);
      });
    });

    /* Per-option notes for the quiz bank live in assets/data-quiz-why-<n>.js. */
    var quizIds = {};
    App.quiz().forEach(function (q) { quizIds[q.id] = true; });
    var whyParts = 0, whyOrphans = 0;
    for (var wp = 1; wp <= 8; wp++) {
      var part = window["CKS_QUIZ_WHY_" + wp];
      if (!part) continue;
      whyParts++;
      Object.keys(part).forEach(function (k) { if (!quizIds[k]) whyOrphans++; });
    }
    if (!whyParts) warn("no per-option quiz notes loaded (expected assets/data-quiz-why-1..6.js)");
    if (whyOrphans) warn("per-option quiz notes contain " + whyOrphans + " id(s) that are not in the question bank");

    App.quiz().forEach(function (q) {
      var oks = (q.options || []).filter(function (o) { return o && o.ok === true; }).length;
      if (!q.options || q.options.length < 2) warn("quiz " + q.id + " has fewer than 2 options");
      if (q.type === "single" && oks !== 1) warn("quiz " + q.id + " is single-choice but has " + oks + " correct options");
      if (q.type === "multi" && oks < 2) warn("quiz " + q.id + " is multi-choice but has only " + oks + " correct options");
      if (q.type !== "single" && q.type !== "multi") warn("quiz " + q.id + " has type " + q.type);
      if (!q.explain) warn("quiz " + q.id + " has no explanation");
      var noNote = 0;
      (q.options || []).forEach(function (o, i) { if (!App.quizWhy(q, i)) noNote++; });
      if (noNote) warn("quiz " + q.id + ": " + noNote + " option(s) have no per-option note");
    });

    App.drills().forEach(function (d) {
      if (!d.need && !d.avoid) { warn("drill " + d.id + " has no checks (it will be self-graded only)"); return; }
      var sol = d.solution;
      if (!sol) { warn("drill " + d.id + " has checks but no solution to test against"); return; }
      var asText = Array.isArray(sol) ? sol.map(function (s) { return s.cmd; }).join("\n") : String(sol);
      var res = App.grade(d, asText);
      (d.need || []).forEach(function (n) {
        var re = App.compile(n.re);
        if (!re) warn("drill " + d.id + ": pattern did not compile: " + n.re);
        else if (!re.test(res.norm)) warn("drill " + d.id + ": its own solution misses its own requirement: " + n.label + " [" + n.re + "]");
        if (/["']/.test(n.re)) warn("drill " + d.id + ": pattern contains a quote character, which the normaliser deletes: " + n.re);
      });
      (d.avoid || []).forEach(function (n) {
        var re = App.compile(n.re);
        if (!re) warn("drill " + d.id + ": avoid pattern did not compile: " + n.re);
        else if (re.test(res.norm)) warn("drill " + d.id + ": its own solution trips its own avoid rule: " + n.label + " [" + n.re + "]");
      });
    });

    App.learn().forEach(function (t) {
      if (!t.notes || !t.notes.length) warn("learn " + t.id + " has no notes");
      if (!t.commands || !t.commands.length) warn("learn " + t.id + " has no commands");
    });
    App.labs().forEach(function (l) {
      if (!l.tasks || !l.tasks.length) warn("lab " + l.id + " has no tasks");
      if (!l.verify || !l.verify.length) warn("lab " + l.id + " has no verify commands");
      if (!l.solution || !l.solution.length) warn("lab " + l.id + " has no solution steps");
    });
    App.cards().forEach(function (c) {
      if (!c.front || !c.back) warn("card " + c.id + " is missing front or back");
    });

    var banner = document.getElementById("data-warn");
    if (problems.length && banner) {
      banner.innerHTML = '<div class="callout">Data self-test raised ' + problems.length +
        " issue(s) - see the browser console for the full list.<details><summary>Show</summary><ul class='small'>" +
        problems.map(function (p) { return "<li>" + App.esc(p) + "</li>"; }).join("") + "</ul></details></div>";
    }
    App.selfTest.problems = problems;
    return problems;
  };

  /* ------------------------------------------------------------- boot ---- */

  App.boot = function () {
    var missing = [];
    if (!window.CKS_LEARN) missing.push("data-learn-1.js / data-learn-2.js");
    if (!window.CKS_QUIZ) missing.push("data-quiz.js");
    if (!window.CKS_DRILLS) missing.push("data-drill.js");
    if (!window.CKS_LABS) missing.push("data-labs.js");
    if (!window.CKS_CARDS) missing.push("data-cards.js");
    if (missing.length) {
      document.getElementById("data-warn").innerHTML =
        '<div class="callout bad">Some content files did not load: ' + App.esc(missing.join(", ")) +
        ". Views will be partly empty. Check that the files exist in the assets folder.</div>";
    }
    var m = App.meta();
    document.getElementById("foot-note").innerHTML =
      App.esc(m.cert || "CKS") + " study workspace. Blueprint weights and exam facts transcribed " +
      App.esc(m.blueprintCaptured || "") + " from the Linux Foundation pages - verify them before you book. " +
      "Progress is stored in this browser only.";
    document.querySelectorAll("#tabs .tab").forEach(function (b) {
      b.addEventListener("click", function () { App.setTab(b.getAttribute("data-tab"), ""); });
    });
    document.getElementById("btn-search").addEventListener("click", function () { App.openSearch(""); });
    document.getElementById("btn-help").addEventListener("click", function () { App.openOverlay(App.helpHTML()); });
    var overlay = document.getElementById("overlay");
    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) App.closeOverlay(); });

    App.selfTest();
    App.route("replace");
  };
})();
