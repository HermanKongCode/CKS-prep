/*
 * CKS PREP - views part 2: Command Drill, Mock Exam, Flashcards, Cheat Sheet,
 * Progress, plus the boot call. Classic script; uses the App namespace.
 */
(function () {
  "use strict";

  var App = window.CKSApp;
  var esc = App.esc;
  App.actions = App.actions || {};

  function dom(name) { return document.getElementById(name); }
  function minutesLabel(m) { return m == null ? "" : '<span class="badge">' + esc(m) + " min</span>"; }
  function tagList(tags) { return (tags || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join(" "); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function domainChips(active, actName) {
    var html = '<button class="small' + (active === "all" ? " on" : "") + '" data-act="' + actName + '" data-id="all">all</button>';
    App.domains().forEach(function (d) {
      html += '<button class="small' + (active === d.id ? " on" : "") + '" data-act="' + actName + '" data-id="' + esc(d.id) + '" title="' + esc(d.name) + '"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + esc(d.color) + ';margin-right:5px"></i>' + esc(d.name.length > 18 ? d.name.slice(0, 18) + "..." : d.name) + "</button>";
    });
    return html;
  }

  /* ================================================================= drill == */

  var drillFilter = { domain: "all", kind: "all", state: "all" };

  function drillList() {
    var list = App.byDomain(App.drills(), drillFilter.domain);
    if (drillFilter.kind !== "all") list = list.filter(function (d) { return d.kind === drillFilter.kind; });
    if (drillFilter.state === "unsolved") list = list.filter(function (d) { return !App.drillSolved(d.id); });
    if (drillFilter.state === "solved") list = list.filter(function (d) { return App.drillSolved(d.id); });
    return list;
  }

  App.registerTab("drill", function (id) {
    if (id) return renderDrill(id);

    if (drillSession) return renderDrillSprint();

    var all = App.drills();
    var list = drillList();
    var solved = all.filter(function (d) { return App.drillSolved(d.id); }).length;

    var html = '<h1>Command drill</h1><p class="dim small">' + all.length +
      " short typing drills. You write the exact command or YAML the task asks for; the site checks it for you. Your answer is normalised first (lowercase, quotes removed, all whitespace collapsed) so indentation and line breaks never cost you a point.</p>" +
      '<div class="grid cols-4"><div class="stat"><b>' + solved + "/" + all.length + "</b><span>drills solved</span></div>" +
      '<div class="stat"><b>' + App.drills().filter(function (d) { return d.minutes; }).reduce(function (a, d) { return a + d.minutes; }, 0) + "</b><span>minutes of drills</span></div>" +
      '<div class="stat"><b>' + all.filter(function (d) { return !App.drillSolved(d.id); }).length + "</b><span>still open</span></div>" +
      '<div class="stat"><b>' + App.drills().filter(function (d) { return (App.state.drills[d.id] || {}).lastPass === false; }).length + "</b><span>last attempt failed</span></div></div>" +
      '<div class="row" style="margin:1rem 0"><button class="primary" data-act="drill-sprint" data-id="6">Sprint: 6 unsolved drills</button>' +
      '<button class="small" data-act="drill-sprint" data-id="12">Long sprint (12)</button>' +
      '<button class="ghost small" data-act="drill-unsprint">End sprint</button></div>' +
      '<div class="filterbar">' + domainChips(drillFilter.domain, "drill-domain") +
      '<button class="small' + (drillFilter.kind === "all" ? " on" : "") + '" data-act="drill-kind" data-id="all">any type</button>' +
      '<button class="small' + (drillFilter.kind === "shell" ? " on" : "") + '" data-act="drill-kind" data-id="shell">shell</button>' +
      '<button class="small' + (drillFilter.kind === "yaml" ? " on" : "") + '" data-act="drill-kind" data-id="yaml">YAML</button>' +
      '<button class="small' + (drillFilter.kind === "dockerfile" ? " on" : "") + '" data-act="drill-kind" data-id="dockerfile">Dockerfile</button>' +
      '<button class="small' + (drillFilter.state === "all" ? " on" : "") + '" data-act="drill-state" data-id="all">any result</button>' +
      '<button class="small' + (drillFilter.state === "unsolved" ? " on" : "") + '" data-act="drill-state" data-id="unsolved">unsolved</button>' +
      '<button class="small' + (drillFilter.state === "solved" ? " on" : "") + '" data-act="drill-state" data-id="solved">solved</button>' +
      '<span class="spacer"></span><span class="tiny mute">' + list.length + " of " + all.length + "</span></div>";

    App.domains().forEach(function (d) {
      var items = list.filter(function (x) { return x.domain === d.id; });
      if (!items.length) return;
      html += '<h2 style="border-left:3px solid ' + esc(d.color) + ';padding-left:.5rem">' + esc(d.name) + "</h2>";
      items.forEach(function (x) {
        var rec = App.state.drills[x.id] || null;
        var badge = !rec ? '<span class="badge">not attempted</span>'
          : (rec.solved ? '<span class="badge ok">solved</span>' : '<span class="badge bad">last attempt failed</span>');
        html += '<div class="card tight"><div class="row"><button class="small" data-act="tab" data-tab="drill" data-id="' + esc(x.id) + '">' +
          esc(x.title) + "</button><span class='spacer'></span>" + badge +
          '<span class="badge">' + esc(x.kind) + "</span><span class='badge'>" + esc(x.difficulty) + "</span>" + minutesLabel(x.minutes) +
          (rec && rec.attempts > 1 ? '<span class="tiny mute">' + rec.attempts + " tries</span>" : "") + "</div>" +
          '<p class="dim small" style="margin:.35rem 0 0">' + esc((x.prompt || "").slice(0, 200)) + "</p></div>";
      });
    });

    App.render(html);
  });

  App.actions["drill-domain"] = function (a, id) { drillFilter.domain = id; App.setTab("drill", "", "replace"); };
  App.actions["drill-kind"] = function (a, id) { drillFilter.kind = id; App.setTab("drill", "", "replace"); };
  App.actions["drill-state"] = function (a, id) { drillFilter.state = id; App.setTab("drill", "", "replace"); };

  function renderDrill(id) {
    var d = App.byId(App.drills(), id);
    if (!d) { App.render('<div class="callout bad">Drill <code>' + esc(id) + "</code> was not found.</div>"); return; }
    App.currentDrillId = d.id;
    var rec = App.state.drills[d.id] || { attempts: 0, solved: false };
    var revealed = drillRevealed[d.id] || 0;
    var shownSolution = drillSolutionShown[d.id];

    var html = '<div class="row"><button class="ghost small" data-act="tab" data-tab="drill">&larr; all drills</button><span class="spacer"></span>' +
      App.domainPill(d.domain) + '<span class="badge">' + esc(d.kind) + "</span><span class='badge'>" + esc(d.difficulty) + "</span>" + minutesLabel(d.minutes) + "</div>" +
      '<h1 style="margin-top:.6rem">' + esc(d.title) + "</h1>" + tagList(d.tags) +
      '<div class="card"><b class="small">Task</b><p style="margin:.35rem 0 0;white-space:pre-wrap">' + esc(d.prompt) + "</p></div>";

    if ((d.need || []).length) {
      html += '<div class="card tight"><b class="small">What must appear in your answer</b><ul class="clean" style="margin-top:.4rem">' +
        d.need.map(function (n) { return "<li>" + esc(n.label) + "</li>"; }).join("") + "</ul></div>";
    }
    if ((d.avoid || []).length) {
      html += '<div class="card tight"><b class="small">What must not appear</b><ul class="clean" style="margin-top:.4rem">' +
        d.avoid.map(function (n) { return "<li>" + esc(n.label) + "</li>"; }).join("") + "</ul></div>";
    }

    html += '<div class="row"><label class="small dim" for="drill-answer">Your answer (' + esc(d.kind) + ")</label>" +
      '<span class="spacer"></span><span class="tiny mute">' + rec.attempts + " attempt" + (rec.attempts === 1 ? "" : "s") + " so far</span></div>" +
      '<textarea id="drill-answer" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="' +
      esc(d.kind === "shell" ? "kubectl ..." : "write the manifest / Dockerfile here") + '" autofocus>' +
      esc(drillDraft[d.id] || "") + "</textarea>" +
      '<div class="row" style="margin-top:.5rem"><button class="primary" data-act="drill-check" data-id="' + esc(d.id) + '">Check answer</button>' +
      '<kbd>Ctrl</kbd>+<kbd>Enter</kbd>' +
      '<button class="small ghost" data-act="drill-hint" data-id="' + esc(d.id) + '">Hint' + (revealed ? " (" + revealed + "/" + (d.hints || []).length + ")" : "") + "</button>" +
      '<button class="small ghost" data-act="drill-clear" data-id="' + esc(d.id) + '">Clear</button>' +
      '<span class="spacer"></span>' +
      (shownSolution ? '<button class="small" data-act="drill-hide-solution" data-id="' + esc(d.id) + '">Hide solution</button>'
        : '<button class="small" data-act="drill-show-solution" data-id="' + esc(d.id) + '">Show solution</button>') + "</div>";

    if (revealed > 0 && (d.hints || []).length) {
      html += '<div class="callout">Hints so far:<ol>' + d.hints.slice(0, revealed).map(function (h) { return "<li>" + esc(h) + "</li>"; }).join("") + "</ol></div>";
    }

    var res = drillResult[d.id];
    if (res) {
      html += '<div class="card ' + (res.pass ? "callout ok" : "callout bad") + '" style="border-radius:10px">' +
        "<b>" + (res.pass ? "Solved." : "Not yet: " + res.needOk + " of " + res.needTotal + " requirements met" + (res.tripped.length ? ", and " + res.tripped.length + " forbidden thing(s) present" : "") ) + "</b>" +
        App.gradeChecksHTML(res) + "</div>";
    }

    if (shownSolution) {
      var solText = Array.isArray(d.solution) ? d.solution.map(function (s) { return s.cmd || String(s); }).join("\n") : String(d.solution || "");
      html += App.code(solText, "one accepted answer");
      if (d.why) html += '<p class="small dim">' + esc(d.why) + "</p>";
    }

    if ((d.related || []).length) {
      html += '<h2>Related study notes</h2><div class="row tight">' + d.related.map(function (rid) {
        var t = App.byId(App.learn(), rid);
        return '<button class="small" data-act="tab" data-tab="learn" data-id="' + esc(rid) + '">' + esc(t ? t.title : rid) + "</button>";
      }).join(" ") + "</div>";
    }

    App.render(html);
    var ta = dom("drill-answer");
    if (ta) {
      ta.addEventListener("input", function () { drillDraft[d.id] = ta.value; });
      ta.addEventListener("keydown", function (ev) {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); checkDrill(d.id); }
        if (ev.key === "Tab") { ev.preventDefault(); insertAt(ta, "  "); }
      });
      ta.addEventListener("blur", function () { drillDraft[d.id] = ta.value; });
      ta.focus();
    }
  }

  function insertAt(ta, text) {
    var s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + text.length;
    drillDraft[App.currentDrillId] = ta.value;
  }

  var drillDraft = {}, drillResult = {}, drillRevealed = {}, drillSolutionShown = {}, drillSession = null;

  function checkDrill(id) {
    var d = App.byId(App.drills(), id);
    if (!d) return;
    var ta = dom("drill-answer");
    var answer = ta ? ta.value : (drillDraft[id] || "");
    drillDraft[id] = answer;
    if (!(d.need || []).length && !(d.avoid || []).length) {
      drillSolutionShown[id] = true;
      App.toast("This drill has no automatic checks - compare against the solution.", "ok");
      renderDrill(id);
      return;
    }
    var res = App.grade(d, answer);
    drillResult[id] = res;
    App.recordDrill(id, res.pass);
    if (res.pass) { App.toast("Solved: " + d.title, "ok"); drillSolutionShown[id] = true; }
    if (drillSession) {
      drillSession.answers[id] = res.pass;
      var missing = drillSession.items.filter(function (x) { return !(x.id in drillSession.answers); });
      if (res.pass && missing.length) { App.setTab("drill", missing[0].id, false); return; }
      if (drillSession.items.every(function (x) { return x.id in drillSession.answers; })) { renderDrillSprintReport(); return; }
    }
    renderDrill(id);
  }

  App.actions["drill-check"] = function (a, id) { checkDrill(id); };
  App.actions["drill-hint"] = function (a, id) {
    var d = App.byId(App.drills(), id);
    if (!d) return;
    drillRevealed[id] = Math.min((d.hints || []).length, (drillRevealed[id] || 0) + 1);
    renderDrill(id);
  };
  App.actions["drill-clear"] = function (a, id) {
    drillDraft[id] = ""; delete drillResult[id];
    var ta = dom("drill-answer"); if (ta) ta.value = "";
  };
  App.actions["drill-show-solution"] = function (a, id) { drillSolutionShown[id] = true; renderDrill(id); };
  App.actions["drill-hide-solution"] = function (a, id) { drillSolutionShown[id] = false; renderDrill(id); };

  App.actions["drill-sprint"] = function (a, count) {
    var n = parseInt(count, 10) || 6;
    var open = App.drills().filter(function (d) { return !App.drillSolved(d.id); });
    var pool = open.length >= n ? open : App.drills();
    var items = shuffle(pool.slice()).slice(0, n).map(function (d) { return { id: d.id, title: d.title, domain: d.domain }; });
    drillSession = { items: items, answers: {} };
    App.setTab("drill", items[0].id, false);
  };
  App.actions["drill-unsprint"] = function () { drillSession = null; App.setTab("drill", "", false); };

  function renderDrillSprint() {
    var s = drillSession;
    var done = Object.keys(s.answers).length;
    var solvedCount = Object.keys(s.answers).filter(function (k) { return s.answers[k]; }).length;
    var html = '<div class="row"><h1 style="margin:0">Drill sprint</h1><span class="spacer"></span>' +
      '<span class="badge">' + done + " / " + s.items.length + " attempted</span>" +
      '<span class="badge ' + (solvedCount === s.items.length ? "ok" : "") + '">' + solvedCount + " solved</span>" +
      '<button class="small ghost" data-act="drill-unsprint">End sprint</button></div>' +
      '<div style="margin:.6rem 0 1rem">' + App.bar((done / s.items.length) * 100) + "</div>" +
      '<div class="card"><ul class="clean">';
    s.items.forEach(function (it, i) {
      var st = (it.id in s.answers) ? (s.answers[it.id] ? '<span class="badge ok">solved</span>' : '<span class="badge bad">failed</span>') : '<span class="badge">open</span>';
      html += "<li><div class='row'><span class='mono tiny'>" + (i + 1) + "</span><button class='small' data-act='tab' data-tab='drill' data-id='" + esc(it.id) + "'>" +
        esc(it.title) + "</button><span class='spacer'></span>" + st + App.domainPill(it.domain) + "</div></li>";
    });
    html += "</ul></div>";
    App.render(html);
  }

  function renderDrillSprintReport() {
    var s = drillSession;
    var solved = Object.keys(s.answers).filter(function (k) { return s.answers[k]; });
    var failed = Object.keys(s.answers).filter(function (k) { return !s.answers[k]; });
    var html = '<h1>Sprint finished</h1><div class="row"><div class="stat"><b>' + solved.length + "/" + s.items.length + "</b><span>solved</span></div>" +
      '<button class="primary" data-act="drill-sprint" data-id="6">Next sprint</button>' +
      '<button class="small ghost" data-act="drill-unsprint">Back to drills</button></div>';
    if (failed.length) {
      html += '<h2>Retry these</h2><div class="card"><ul class="clean">';
      failed.forEach(function (id) {
        var d = App.byId(App.drills(), id);
        html += "<li><div class='row'><button class='small' data-act='tab' data-tab='drill' data-id='" + esc(id) + "'>" + esc(d ? d.title : id) + "</button>" +
          '<span class="spacer"></span>' + App.domainPill(d ? d.domain : "") + "</div></li>";
      });
      html += "</ul></div>";
    }
    drillSession = null;
    App.render(html);
  }

  /* ================================================================ mock == */

  var mockSession = null;
  var mockTimer = null;

  function weightedPick(pool, target) {
    /* allocate item counts across domains in proportion to blueprint weights */
    var domains = App.domains();
    var totalWeight = domains.reduce(function (a, d) { return a + d.weight; }, 0);
    var alloc = {};
    domains.forEach(function (d) { alloc[d.id] = Math.max(1, Math.round((d.weight / totalWeight) * target)); });
    var sum = domains.reduce(function (a, d) { return a + alloc[d.id]; }, 0);
    /* fix rounding drift against the largest domains first */
    var order = domains.slice().sort(function (a, b) { return b.weight - a.weight; });
    var i = 0;
    while (sum > target) { var d = order[i % order.length]; if (alloc[d.id] > 1) { alloc[d.id]--; sum--; } i++; if (i > 500) break; }
    i = 0;
    while (sum < target) { var d2 = order[i % order.length]; alloc[d2.id]++; sum++; i++; }

    var out = [];
    domains.forEach(function (dm) {
      var poolForDomain = pool.filter(function (x) { return x.domain === dm.id; });
      var want = Math.min(alloc[dm.id], poolForDomain.length);
      var chosen = shuffle(poolForDomain.slice()).slice(0, want);
      chosen.forEach(function (x) { out.push(x); });
    });
    return shuffle(out);
  }

  App.registerTab("mock", function () {
    if (mockSession) return renderMockExam();

    var qTotal = App.quiz().length, hTotal = App.drills().length;
    var attempts = App.state.mock.attempts;
    var html = '<h1>Mock exam</h1>' +
      '<div class="callout info">This mock copies the shape of the real thing, not its grading rigour: knowledge questions are sampled in proportion to the six blueprint weights, and hands-on tasks are presented as cards you score yourself against a published solution. Only the real exam (or killer.sh) can grade a hands-on task for you.</div>' +
      '<div class="card"><div class="row">' +
      '<div><label class="small dim">Knowledge questions</label><br><select id="mock-kn">' +
      [8, 12, 16, 20, 24].map(function (n) { return '<option value="' + n + '"' + (n === 16 ? " selected" : "") + ">" + n + " (weighted by domain)</option>"; }).join("") +
      '<option value="all">every question</option></select></div>' +
      '<div><label class="small dim">Hands-on task cards</label><br><select id="mock-ho">' +
      [4, 6, 8, 10].map(function (n) { return '<option value="' + n + '"' + (n === 8 ? " selected" : "") + ">" + n + "</option>"; }).join("") +
      '<option value="0">none (theory only)</option></select></div>' +
      '<div><label class="small dim">Time limit</label><br><select id="mock-min">' +
      [30, 60, 90, 120].map(function (n) { return '<option value="' + n + '"' + (n === 120 ? " selected" : "") + ">" + n + " minutes</option>"; }).join("") +
      "</select></div>" +
      '<div><label class="small dim">Mode</label><br><select id="mock-mode">' +
      '<option value="exam" selected>exam mode (timer, no solutions until the end)</option>' +
      '<option value="open">open mode (solutions available while working)</option></select></div>' +
      '<div class="spacer"></div><button class="primary" data-act="mock-start">Start mock exam</button></div>' +
      '<p class="tiny mute">Bank: ' + qTotal + " questions, " + hTotal + " hands-on drills. Passing line for this mock: " +
      App.meta().passMark + "% weighted overall, with every domain reported separately.</p></div>";

    if (attempts.length) {
      html += '<h2>Previous attempts</h2><div class="card"><table><thead><tr><th>When</th><th>Used</th><th>Knowledge</th><th>Hands-on</th><th>Weighted total</th><th>Result</th><th>Domains under ' + App.meta().passMark + "%</th></tr></thead><tbody>";
      attempts.slice().reverse().forEach(function (a) {
        var weak = App.domains().filter(function (d) { return a.perDomain[d.id] != null && a.perDomain[d.id] < App.meta().passMark; }).map(function (d) { return d.name; });
        html += "<tr><td class='mono small'>" + esc(a.at) + '</td><td class="mono">' + a.minutes + " min</td>" +
          '<td class="mono">' + a.knowledge.ok + "/" + a.knowledge.n + "</td>" +
          '<td class="mono">' + a.hands.ok.toFixed(1) + "/" + a.hands.n + "</td>" +
          '<td class="mono"><b>' + Math.round(a.total) + "%</b></td>" +
          '<td class="' + (a.pass ? "pass" : "fail") + '">' + (a.pass ? "pass" : "fail") + "</td>" +
          '<td class="small dim">' + esc(weak.join(", ") || "-") + "</td></tr>";
      });
      html += "</tbody></table></div>";
      html += '<div class="row"><button class="ghost small" data-act="mock-clear-history">Clear attempt history</button></div>';
    }

    App.render(html);
  });

  App.actions["mock-clear-history"] = function () {
    if (!window.confirm("Delete every stored mock exam attempt?")) return;
    App.state.mock.attempts = [];
    App.save(true);
    App.setTab("mock", "", false);
  };

  App.actions["mock-start"] = function () {
    var knSel = dom("mock-kn").value;
    var hoSel = dom("mock-ho").value;
    var minutes = parseInt(dom("mock-min").value, 10);
    var mode = dom("mock-mode").value;
    var kn = knSel === "all" ? App.quiz().slice() : weightedPick(App.quiz(), parseInt(knSel, 10));
    var ho = hoSel === "0" ? [] : weightedPick(App.drills(), parseInt(hoSel, 10));
    if (!kn.length && !ho.length) { App.toast("Nothing to ask - the content files look empty.", "bad"); return; }
    mockSession = {
      mode: mode, minutes: minutes, deadline: Date.now() + minutes * 60000, remaining: minutes * 60000,
      kn: kn, ho: ho, answers: {}, hands: {}, revealed: {}, started: Date.now(), submitted: false
    };
    if (mockTimer) clearInterval(mockTimer);
    mockTimer = setInterval(mockTick, 1000);
    App.setTab("mock", "", false);
    App.toast("Exam running: " + minutes + " minutes.", mode === "exam" ? "ok" : "ok");
  };

  function mockTick() {
    if (!mockSession) { clearInterval(mockTimer); return; }
    mockSession.remaining = Math.max(0, mockSession.deadline - Date.now());
    var el = dom("mock-timer");
    if (el) {
      el.textContent = fmtTime(mockSession.remaining);
      el.className = "timer " + (mockSession.remaining < 10 * 60000 ? "low" : mockSession.remaining < 30 * 60000 ? "mid" : "");
    }
    if (mockSession.remaining <= 0) {
      App.toast("Time is up - submitting your exam.", "bad");
      mockSubmit(true);
    }
  }

  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function renderMockExam() {
    var s = mockSession;
    var knAnswered = Object.keys(s.answers).length;
    var hoAnswered = Object.keys(s.hands).length;
    var html = '<div class="row"><h1 style="margin:0">Mock exam</h1>' +
      '<span class="badge">' + (s.mode === "exam" ? "exam mode" : "open mode") + "</span>" +
      '<span class="spacer"></span>' +
      '<span class="badge mono">' + (knAnswered + hoAnswered) + " / " + (s.kn.length + s.ho.length) + " answered</span>" +
      '<div class="timer" id="mock-timer">' + fmtTime(s.remaining) + "</div>" +
      '<button class="primary small" data-act="mock-submit">Submit and score</button>' +
      '<button class="ghost small" data-act="mock-abandon">Abandon</button></div>' +
      '<div style="margin:.6rem 0 1.2rem">' + App.bar(((knAnswered + hoAnswered) / (s.kn.length + s.ho.length)) * 100) + "</div>";

    App.domains().forEach(function (d) {
      var qs = s.kn.filter(function (q) { return q.domain === d.id; });
      var hs = s.ho.filter(function (x) { return x.domain === d.id; });
      if (!qs.length && !hs.length) return;
      html += '<h2 style="border-left:3px solid ' + esc(d.color) + ';padding-left:.5rem">' + esc(d.name) +
        ' <span class="mute small">' + d.weight + '% of the weighted score &middot; ' + qs.length + " questions + " + hs.length + " hands-on</span></h2>";

      qs.forEach(function (q) {
        var a = s.answers[q.id];
        html += '<div class="card"><div class="row"><span class="badge mono">' + esc(q.id) + '</span><span class="badge">' + esc(q.type) + " choice</span>" +
          '<span class="badge">' + esc(q.difficulty) + "</span>" + (a ? '<span class="badge ok">answered</span>' : '<span class="badge warn">unanswered</span>') + "</div>" +
          "<p style='margin:.5rem 0 .5rem'><b>" + esc(q.q) + "</b></p>" +
          (q.type === "multi" ? '<p class="tiny mute">Select exactly the set you believe is correct.</p>' : "");
        (q.options || []).forEach(function (o, i) {
          var picked = a && a.indexOf(i) >= 0;
          html += '<label class="opt' + (picked ? " sel" : "") + '"><input type="' + (q.type === "multi" ? "checkbox" : "radio") +
            '" name="mk-' + esc(q.id) + '" data-act="mock-pick" data-id="' + esc(q.id) + '" data-idx="' + i + '"' + (picked ? " checked" : "") + "><span>" + esc(o.t) + "</span></label>";
        });
        html += "</div>";
      });

      hs.forEach(function (x) {
        var h = s.hands[x.id];
        var shown = s.revealed[x.id];
        html += '<div class="card"><div class="row"><span class="badge mono">' + esc(x.id) + '</span><span class="badge">' + esc(x.kind) + "</span>" +
          minutesLabel(x.minutes) + '<span class="spacer"></span>' + (h == null ? '<span class="badge warn">unscored</span>'
            : '<span class="badge ' + (h === 1 ? "ok" : h === 0.5 ? "warn" : "bad") + '">' + (h === 1 ? "solved" : h === 0.5 ? "partial" : "not solved") + "</span>") + "</div>" +
          "<p style='margin:.5rem 0 .5rem;white-space:pre-wrap'>" + esc(x.prompt) + "</p>" +
          '<div class="row tight"><button class="small' + (h === 1 ? " ok on" : "") + '" data-act="mock-hands" data-id="' + esc(x.id) + '" data-score="1">Solved it</button>' +
          '<button class="small' + (h === 0.5 ? " on" : "") + '" data-act="mock-hands" data-id="' + esc(x.id) + '" data-score="0.5">Partial</button>' +
          '<button class="small' + (h === 0 ? " bad on" : "") + '" data-act="mock-hands" data-id="' + esc(x.id) + '" data-score="0">Not solved</button>' +
          (s.mode === "open" || shown ? '<button class="small ghost" data-act="mock-reveal" data-id="' + esc(x.id) + '">Show model answer</button>' : "") +
          "</div>";
          if (s.mode === "open" || shown) {
            var solText = Array.isArray(x.solution) ? x.solution.map(function (t) { return t.cmd || String(t); }).join("\n") : String(x.solution || "");
            html += App.code(solText) + (x.why ? '<p class="small dim">' + esc(x.why) + "</p>" : "");
          }
        html += "</div>";
      });
    });

    App.render(html);
  }

  App.actions["mock-pick"] = function (a, id, node) {
    var s = mockSession; if (!s) return;
    var q = App.byId(s.kn, id);
    var idx = parseInt(node.getAttribute("data-idx"), 10);
    var picked = s.answers[id] ? s.answers[id].slice() : [];
    if (q.type === "multi") { var at = picked.indexOf(idx); if (at >= 0) picked.splice(at, 1); else picked.push(idx); }
    else picked = [idx];
    s.answers[id] = picked;
    renderMockExam();
  };

  App.actions["mock-hands"] = function (a, id, node) {
    var s = mockSession; if (!s) return;
    s.hands[id] = parseFloat(node.getAttribute("data-score"));
    renderMockExam();
  };

  App.actions["mock-reveal"] = function (a, id) {
    var s = mockSession; if (!s) return;
    s.revealed[id] = true;
    renderMockExam();
  };

  App.actions["mock-abandon"] = function () {
    if (window.confirm("Abandon this mock exam? It will not be saved.")) mockEnd();
  };
  App.actions["mock-submit"] = function () { mockSubmit(false); };

  function mockEnd() {
    if (mockTimer) { clearInterval(mockTimer); mockTimer = null; }
    mockSession = null;
    App.setTab("mock", "", false);
  }

  function mockSubmit(auto) {
    var s = mockSession;
    if (!s || s.submitted) return;
    s.submitted = true;
    if (mockTimer) { clearInterval(mockTimer); mockTimer = null; }

    var kn = { n: 0, ok: 0 }, ho = { n: 0, ok: 0 };
    var per = {};
    App.domains().forEach(function (d) {
      var qd = s.kn.filter(function (q) { return q.domain === d.id; });
      var hd = s.ho.filter(function (x) { return x.domain === d.id; });
      if (!qd.length && !hd.length) return;
      var qok = 0;
      qd.forEach(function (q) {
        kn.n++;
        var a = s.answers[q.id];
        var rightSet = (q.options || []).map(function (o, i) { return o.ok ? i : -1; }).filter(function (i) { return i >= 0; });
        var correct = !!a && a.length === rightSet.length && a.slice().sort().join(",") === rightSet.slice().sort().join(",");
        if (correct) { qok++; kn.ok++; }
      });
      var hok = 0;
      hd.forEach(function (x) {
        ho.n++;
        var v = s.hands[x.id];
        if (v == null) v = 0;
        hok += v;
        ho.ok += v;
      });
      var portions = [];
      if (qd.length) portions.push(qok / qd.length);
      if (hd.length) portions.push(hok / hd.length);
      var score = portions.reduce(function (a, b) { return a + b; }, 0) / portions.length;
      per[d.id] = score * 100;
    });

    var weightSum = 0, acc = 0;
    App.domains().forEach(function (d) {
      if (per[d.id] == null) return;
      weightSum += d.weight;
      acc += d.weight * per[d.id];
    });
    var total = weightSum ? acc / weightSum : 0;
    var passMark = App.meta().passMark || 65;
    var pass = total >= passMark;

    var attempt = {
      at: new Date().toISOString(), minutes: Math.round((Date.now() - s.started) / 60000),
      auto: !!auto, mode: s.mode, pass: total >= passMark, total: total, perDomain: per,
      knowledge: { n: kn.n, ok: kn.ok }, hands: { n: ho.n, ok: ho.ok },
      wrong: s.kn.filter(function (q) {
        var a = s.answers[q.id];
        var rightSet = (q.options || []).map(function (o, i) { return o.ok ? i : -1; }).filter(function (i) { return i >= 0; });
        return !(a && a.length === rightSet.length && a.slice().sort().join(",") === rightSet.slice().sort().join(","));
      }).map(function (q) { return q.id; }),
      unsolvedHands: s.ho.filter(function (x) { return (s.hands[x.id] || 0) < 1; }).map(function (x) { return x.id; })
    };
    App.addMockAttempt(attempt);

    var html = '<h1>Mock exam result</h1><div class="row"><div class="stat"><b>' + Math.round(total) + "%</b><span>weighted overall</span></div>" +
      '<div class="stat"><b>' + (pass ? "PASS" : "FAIL") + "</b><span>pass line " + passMark + "%</span></div>" +
      '<div class="stat"><b>' + kn.ok + "/" + kn.n + "</b><span>knowledge questions</span></div>" +
      '<div class="stat"><b>' + ho.ok.toFixed(1) + "/" + ho.n + "</b><span>hands-on cards</span></div>" +
      '<div class="stat"><b>' + attempt.minutes + " / " + s.minutes + "</b><span>minutes used</span></div>" +
      (auto ? '<span class="badge bad">auto-submitted at time limit</span>' : "") + "</div>";

    if (auto) html += '<div class="callout bad">The clock ran out and the exam was submitted automatically. Unanswered items scored zero.</div>';

    html += '<h2>Domain breakdown against the blueprint</h2><div class="card"><table><thead><tr><th>Domain</th><th>Blueprint weight</th><th>Your score</th><th>Reading</th></tr></thead><tbody>';
    App.domains().forEach(function (d) {
      var sc = per[d.id];
      if (sc == null) return;
      var reading = sc >= 85 ? "solid" : sc >= passMark ? "acceptable" : sc >= 45 ? "shaky - needs another pass" : "weak - go back to the study notes";
      html += "<tr><td>" + App.domainPill(d.id) + '</td><td class="mono">' + d.weight + '%</td><td class="mono ' + (sc >= passMark ? "pass" : "fail") + '">' +
        Math.round(sc) + "%</td><td>" + App.bar(sc, d.color) + '<span class="tiny mute">' + esc(reading) + "</span></td></tr>";
    });
    html += "</tbody></table></div>";

    if (attempt.wrong.length) {
      html += '<h2>Questions to review (' + attempt.wrong.length + ")</h2>";
      attempt.wrong.forEach(function (qid) {
        var q = App.byId(App.quiz(), qid);
        if (!q) return;
        html += '<div class="card tight"><b>' + esc(q.q) + "</b> " + App.domainPill(q.domain) +
          "<ul>" + (q.options || []).map(function (o, i) {
            var note = App.quizWhy(q, i);
            return '<li class="' + (o.ok ? "pass" : "fail") + '">' + (o.ok ? "&#10003; " : "&#10007; ") + esc(o.t) +
              (note ? '<div class="tiny mute" style="margin-top:.25rem">' + esc(note) + "</div>" : "") + "</li>";
          }).join("") + "</ul>" +
          '<p class="small dim">' + esc(q.explain || "") + "</p>" +
          '<button class="small" data-act="tab" data-tab="learn" data-id="' + esc(firstTopicFor(q)) + '">study notes</button></div>';
      });
    }
    if (attempt.unsolvedHands.length) {
      html += '<h2>Hands-on tasks you did not fully solve</h2><div class="row tight">' +
        attempt.unsolvedHands.map(function (id) {
          var d = App.byId(App.drills(), id);
          return '<button class="small" data-act="tab" data-tab="drill" data-id="' + esc(id) + '">' + esc(d ? d.title : id) + "</button>";
        }).join(" ") + "</div>";
      html += '<p class="small dim">Repeat them on a real cluster in the Labs tab - self-scoring is honest only after you have run the commands once.</p>';
    }

    var weak = App.domains().filter(function (d) { return per[d.id] != null && per[d.id] < passMark; });
    if (weak.length) {
      html += '<h2>Recommended next study (weakest domains first)</h2><div class="card"><ul class="clean">';
      weak.sort(function (a, b) { return per[a.id] - per[b.id]; }).forEach(function (d) {
        var items = App.byDomain(App.learn(), d.id).slice(0, 3).concat(App.byDomain(App.labs(), d.id).slice(0, 2));
        html += "<li><div class='row'><b>" + esc(d.name) + '</b><span class="spacer"></span><span class="mono fail">' + Math.round(per[d.id]) + '%</span></div><div class="row tight">' +
          items.map(function (x) {
            var tab = x.tasks ? "labs" : "learn";
            return '<button class="small" data-act="tab" data-tab="' + tab + '" data-id="' + esc(x.id) + '">' + esc(x.title) + "</button>";
          }).join(" ") + "</div></li>";
      });
      html += "</ul></div>";
    }

    html += '<div class="row" style="margin-top:1rem"><button class="primary" data-act="mock-start-again">Run another mock</button>' +
      '<button class="small" data-act="mock-back">Back to mock setup</button></div>';

    mockSession = null;
    App.render(html);
  }

  function firstTopicFor(q) {
    var t = App.byDomain(App.learn(), q.domain)[0];
    if (!t) return "";
    var tags = q.tags || [];
    var all = App.byDomain(App.learn(), q.domain);
    for (var i = 0; i < all.length; i++) {
      var tt = all[i].tags || [];
      for (var j = 0; j < tags.length; j++) if (tt.indexOf(tags[j]) >= 0) return all[i].id;
    }
    return t.id;
  }

  App.actions["mock-start-again"] = function () { mockSession = null; App.setTab("mock", "", false); App.actions["mock-start"](); };
  App.actions["mock-back"] = function () { mockEnd(); };

  /* ============================================================ flashcards == */

  var cardDeck = null;

  App.registerTab("cards", function () {
    var all = App.cards();
    var st = App.state.cards;
    var known = all.filter(function (c) { return st[c.id] && st[c.id].known; });
    var unsure = all.filter(function (c) { return st[c.id] && st[c.id].unsure; });
    var unseen = all.filter(function (c) { return !st[c.id]; });

    var html = '<h1>Flashcards</h1><p class="dim small">' + all.length +
      " recall cards. Front is the question, back is the answer you should be able to say out loud, plus the command where one matters. Cards you mark unsure come back sooner.</p>" +
      '<div class="grid cols-4"><div class="stat"><b>' + known.length + "</b><span>known</span></div>" +
      '<div class="stat"><b>' + unsure.length + "</b><span>unsure</span></div>" +
      '<div class="stat"><b>' + unseen.length + "</b><span>never seen</span></div>" +
      '<div class="stat"><b>' + all.length + "</b><span>deck size</span></div></div>" +
      '<div class="card"><div class="row"><div><label class="small dim">Deck</label><br><select id="card-deck">' +
      '<option value="mix" selected>mixed (unseen and unsure first)</option><option value="unseen">only unseen</option>' +
      '<option value="unsure">only unsure</option><option value="known">only known (spaced review)</option><option value="all">everything in order</option></select></div>' +
      '<div><label class="small dim">Domain</label><br><select id="card-domain"><option value="all">all domains</option>' +
      App.domains().map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + " (" + d.weight + "%)</option>"; }).join("") +
      "</select></div>" +
      '<div class="spacer"></div><button class="primary" data-act="card-start">Start deck</button></div></div>';

    if (all.length && !all[0].front) html += '<div class="callout bad">Card data looks malformed - run the self-test in the Progress tab.</div>';

    App.render(html);
  });

  function buildDeck() {
    var mode = dom("card-deck").value;
    var domain = dom("card-domain").value;
    var st = App.state.cards;
    var pool = App.byDomain(App.cards(), domain);
    if (mode === "unseen") pool = pool.filter(function (c) { return !st[c.id]; });
    else if (mode === "unsure") pool = pool.filter(function (c) { return st[c.id] && st[c.id].unsure; });
    else if (mode === "known") pool = pool.filter(function (c) { return st[c.id] && st[c.id].known; });
    else if (mode === "mix") {
      pool = shuffle(pool.slice()).sort(function (a, b) {
        function rank(c) {
          var s = st[c.id];
          if (!s) return 0;
          if (s.unsure) return 1;
          if (s.known) return 3;
          return 2;
        }
        return rank(a) - rank(b);
      });
    }
    return pool.slice(0, 60);
  }

  App.actions["card-start"] = function () {
    var items = buildDeck();
    if (!items.length) { App.toast("No cards in that selection - try another deck filter.", "ok"); return; }
    cardDeck = { items: items, i: 0, flipped: false, done: 0, known: 0, started: Date.now() };
    renderCard();
  };

  function renderCard() {
    var d = cardDeck;
    if (!d) return App.setTab("cards", "", false);
    if (d.i >= d.items.length) return renderCardReport();
    var c = d.items[d.i];
    var seen = (App.state.cards[c.id] || {}).seen || 0;
    var html = '<div class="row"><h1 style="margin:0">Flashcards</h1><span class="spacer"></span>' +
      '<span class="badge mono">' + (d.i + 1) + " / " + d.items.length + "</span>" +
      '<span class="badge ok">' + d.known + " known</span>" +
      '<button class="ghost small" data-act="card-end">End deck</button></div>' +
      '<div style="margin:.6rem 0 1rem">' + App.bar((d.i / d.items.length) * 100) + "</div>" +
      '<div class="flash"><div class="row tight">' + App.domainPill(c.domain) + tagList(c.tags) +
      '<span class="spacer"></span><span class="tiny mute">seen ' + seen + " time" + (seen === 1 ? "" : "s") + "</span></div>" +
      '<div class="flash-face" id="card-face" data-act="card-flip">' +
      "<div>" + esc(c.front) + "</div>" +
      (d.flipped ? '<hr><div>' + esc(c.back) + "</div>" +
        (c.cmd ? '<div class="cmd">' + App.code(c.cmd, c.why || "command") + "</div>" : "") +
        "</div>" : '<div class="tiny mute" style="margin-top:1rem">click the card or press <kbd>Space</kbd> to reveal</div>') +
      "</div>" +
      '<div class="flash-ctl">' +
      (d.flipped
        ? '<button class="ok" data-act="card-grade" data-id="1">Known <kbd>k</kbd></button>' +
          '<button class="bad" data-act="card-grade" data-id="0">Unsure <kbd>u</kbd></button>' +
          '<button class="ghost" data-act="card-skip">Skip <kbd>s</kbd>'
        : '<button data-act="card-flip">Reveal <kbd>Space</kbd></button>') +
      '<button class="ghost" data-act="card-end">End</button></div></div>';
    App.render(html);
  }

  App.actions["card-flip"] = function () { if (cardDeck) { cardDeck.flipped = true; renderCard(); } };
  App.actions["card-skip"] = function () {
    if (!cardDeck) return;
    cardDeck.items.push(cardDeck.items.splice(cardDeck.i, 1)[0]);
    cardDeck.flipped = false;
    renderCard();
  };
  App.actions["card-grade"] = function (a, id) {
    if (!cardDeck) return;
    var known = id === "1";
    var c = cardDeck.items[cardDeck.i];
    App.recordCard(c.id, known);
    cardDeck.done++;
    if (known) cardDeck.known++;
    else cardDeck.items.push(cardDeck.items.splice(cardDeck.i, 1)[0]);
    cardDeck.i++;
    cardDeck.flipped = false;
    renderCard();
  };
  App.actions["card-end"] = function () { cardDeck = null; App.setTab("cards", "", false); };

  function renderCardReport() {
    var d = cardDeck;
    var html = '<h1>Deck finished</h1><div class="row"><div class="stat"><b>' + d.known + "/" + d.items.length + "</b><span>marked known</span></div>" +
      '<div class="stat"><b>' + (d.items.length - d.known) + "</b><span>still unsure</span></div>" +
      '<button class="primary" data-act="card-start">Run the unsure cards again</button>' +
      '<button class="ghost small" data-act="card-end">Back</button></div>' +
      "<p class='dim small'>Unsure cards stay in the mix pile and reappear early in the next deck.</p>";
    cardDeck = null;
    App.render(html);
  }

  document.addEventListener("keydown", function (ev) {
    if (App.currentTab() !== "cards" || !cardDeck || App.overlayOpen()) return;
    var tag = (ev.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); App.actions["card-flip"](); }
    else if (ev.key === "k" || ev.key === "K") { ev.preventDefault(); if (cardDeck.flipped) App.actions["card-grade"]("x", "1"); }
    else if (ev.key === "u" || ev.key === "U") { ev.preventDefault(); if (cardDeck.flipped) App.actions["card-grade"]("x", "0"); }
    else if (ev.key === "s" || ev.key === "S") { ev.preventDefault(); App.actions["card-skip"](); }
  });

  /* =========================================================== cheat sheet == */

  var cheatFilter = { domain: "all", q: "" };

  function pathMap() {
    var counts = {};
    var re = /\/(?:etc|var|usr|opt|run|proc|sys|root|home)\/[A-Za-z0-9_.\-*\/]*/g;
    function scan(text, src, tab) {
      String(text || "").split("\n").forEach(function (line) {
        var m = line.match(re);
        if (!m) return;
        m.forEach(function (p) {
          p = p.replace(/[.,;:]$/, "");
          var e = counts[p] || (counts[p] = { n: 0, src: src, tab: tab });
          e.n++;
        });
      });
    }
    App.learn().forEach(function (t) {
      scan((t.notes || []).join("\n") + "\n" + (t.commands || []).map(function (c) { return c.cmd + " " + (c.why || ""); }).join("\n"), t.title, "learn");
    });
    App.labs().forEach(function (l) {
      scan((l.tasks || []).join("\n") + "\n" + (l.solution || []).map(function (s) { return (s.cmd || "") + " " + (s.why || ""); }).join("\n") + "\n" + (l.files || []).map(function (f) { return f.path ? f.path : String(f); }).join("\n"), l.title, "labs");
    });
    App.tips().forEach(function (t) { scan(t.body, t.title, "dashboard"); });
    return Object.keys(counts).map(function (p) { return { path: p, n: counts[p].n, src: counts[p].src, tab: counts[p].tab }; })
      .sort(function (a, b) { return b.n - a.n || a.path.localeCompare(b.path); });
  }

  App.registerTab("cheat", function () {
    var paths = pathMap();
    var html = '<h1>Cheat sheet</h1><p class="dim small">Everything searchable, plus the paths you must know by heart and every command taught on this site. ' +
      "In the exam you get the Kubernetes docs in the remote browser - what you need from memory is <b>where things live</b> and <b>which command proves it</b>.</p>" +
      '<div class="card"><div class="row"><input id="cheat-q" placeholder="filter this page or search everything (Ctrl+K opens the global search)" value="' + esc(cheatFilter.q) + '" style="flex:1 1 320px">' +
      '<button data-act="search-open">Global search</button>' +
      '<button class="ghost small" data-act="cheat-copy" data-id="commands">Copy all commands</button>' +
      '<button class="ghost small" data-act="cheat-print">Print / save as PDF</button></div></div>';

    if (cheatFilter.q) {
      var hits = App.search(cheatFilter.q, 20);
      html += '<h2>Search results (' + hits.length + ")</h2>";
      html += hits.map(function (h) {
        return '<div class="search-hit" data-act="tab" data-tab="' + h.tab + '" data-id="' + esc(h.tab === "cheat" ? "" : h.id) + '"><b>' + esc(h.title) + "</b><p>" + esc(h.text.slice(0, 200)) + "</p></div>";
      }).join("");
    }

    html += '<h2>Where things live on a kubeadm node</h2><div class="card"><table><thead><tr><th>Path</th><th>Mentions on this site</th><th>Where it is explained</th></tr></thead><tbody>';
    paths.slice(0, 30).forEach(function (p) {
      html += '<tr><td class="mono">' + esc(p.path) + '</td><td class="mono">' + p.n + '</td><td class="small dim">' + esc(p.src) + "</td></tr>";
    });
    html += "</tbody></table></div>";

    html += '<h2>Commands by domain</h2><div class="filterbar">' + domainChips(cheatFilter.domain, "cheat-domain") + "</div>";
    App.domains().forEach(function (d) {
      if (cheatFilter.domain !== "all" && cheatFilter.domain !== d.id) return;
      var topics = App.byDomain(App.learn(), d.id);
      var cmds = [];
      topics.forEach(function (t) {
        (t.commands || []).forEach(function (c) {
          if (cheatFilter.q && (c.cmd + " " + (c.why || "") + " " + t.title).toLowerCase().indexOf(cheatFilter.q.toLowerCase()) < 0) return;
          cmds.push({ cmd: c.cmd, why: c.why, topic: t.id, title: t.title });
        });
      });
      if (!cmds.length) return;
      html += '<h3 style="border-left:3px solid ' + esc(d.color) + ';padding-left:.5rem;margin-top:1.2rem">' + esc(d.name) +
        ' <span class="tiny mute">' + cmds.length + " commands</span></h3>";
      html += '<div class="card tight"><ul class="check-list">';
      cmds.forEach(function (c) {
        html += '<li><span class="mark mono">#</span><span><span class="mono">' + App.esc(c.cmd) + "</span>" +
          '<div class="tiny mute">' + esc(c.why || "") + ' - <button class="small ghost" data-act="tab" data-tab="learn" data-id="' + esc(c.topic) + '">' + esc(c.title) + "</button></div></span></li>";
      });
      html += "</ul></div>";
    });

    html += '<h2>References (the ones worth bookmarking)</h2><div class="row tight">' +
      App.resources().map(function (r) { return '<a class="badge" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.label) + "</a>"; }).join(" ") + "</div>";

    html += '<h2>Blueprint competencies, verbatim</h2>';
    App.domains().forEach(function (d) {
      html += '<div class="card tight"><b>' + esc(d.name) + '</b> <span class="mono small dim">' + d.weight + '%</span><ul class="small">' +
        (d.competencies || []).map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div>";
    });

    App.render(html);
    var input = dom("cheat-q");
    if (input) input.addEventListener("input", function () { cheatFilter.q = input.value; App.setTab("cheat", "", "replace"); });
  });

  App.actions["cheat-domain"] = function (a, id) { cheatFilter.domain = id; App.setTab("cheat", "", "replace"); };
  App.actions["cheat-print"] = function () { window.print(); };
  App.actions["cheat-copy"] = function (a, id) {
    if (id !== "commands") return;
    var lines = [];
    App.domains().forEach(function (d) {
      lines.push("=== " + d.name + " (" + d.weight + "%) ===");
      App.byDomain(App.learn(), d.id).forEach(function (t) {
        lines.push("-- " + t.title);
        (t.commands || []).forEach(function (c) { lines.push(c.cmd); });
      });
      lines.push("");
    });
    App.copy(lines.join("\n"));
  };

  /* ============================================================= progress == */

  App.registerTab("progress", function () {
    var st = App.state;
    var attempts = st.mock.attempts;
    var html = '<h1>Progress</h1>' +
      '<p class="dim small">Stored in this browser under <code>cks_prep_v1</code>. ' +
      (App.storageBlocked() ? '<span class="badge bad">local storage is blocked - progress lives in memory only and will be lost when you close the tab</span>'
        : '<span class="badge ok">local storage active</span>') + "</p>";

    html += '<div class="card"><div class="row"><div><label class="small dim">Exam date</label><br><input type="date" id="p-exam-date" value="' + esc(st.examDate || "") + '"></div>' +
      '<span class="spacer"></span><button data-act="progress-export">Export progress (JSON)</button>' +
      '<button data-act="progress-import">Import progress</button>' +
      '<button class="ghost" data-act="progress-selftest">Run content self-test</button>' +
      '<button class="ghost bad" data-act="progress-reset">Reset everything</button></div>' +
      '<p class="tiny mute">Export writes a file you can keep or move to another machine; import replaces what is stored here.</p></div>';

    html += '<h2>Per domain</h2><div class="card"><table><thead><tr><th>Domain</th><th>Weight</th><th>Topics</th><th>Labs</th><th>Drills</th><th>Quiz seen</th><th>Cards known</th><th>Coverage</th></tr></thead><tbody>';
    App.domains().forEach(function (d) {
      var topics = App.byDomain(App.learn(), d.id), labs = App.byDomain(App.labs(), d.id),
        drills = App.byDomain(App.drills(), d.id), quiz = App.byDomain(App.quiz(), d.id), cards = App.byDomain(App.cards(), d.id);
      var tDone = topics.filter(function (x) { return App.topicDone(x.id); }).length;
      var lDone = labs.filter(function (x) { return App.labStatus(x.id) === "done"; }).length;
      var dDone = drills.filter(function (x) { return App.drillSolved(x.id); }).length;
      var qSeen = quiz.filter(function (x) { return st.quiz[x.id]; }).length;
      var cKnown = cards.filter(function (x) { return st.cards[x.id] && st.cards[x.id].known; }).length;
      var cov = ((topics.length ? tDone / topics.length : 0) + (labs.length ? lDone / labs.length : 0) + (drills.length ? dDone / drills.length : 0)) / 3 * 100;
      html += "<tr><td>" + App.domainPill(d.id) + '</td><td class="mono">' + d.weight + '</td><td class="mono">' + tDone + "/" + topics.length +
        '</td><td class="mono">' + lDone + "/" + labs.length + '</td><td class="mono">' + dDone + "/" + drills.length +
        '</td><td class="mono">' + qSeen + "/" + quiz.length + '</td><td class="mono">' + cKnown + "/" + cards.length +
        "</td><td style='min-width:140px'>" + App.bar(cov, d.color) + '<span class="tiny mute">' + Math.round(cov) + "%</span></td></tr>";
    });
    html += "</tbody></table></div>";

    html += '<h2>Drills: attempts log</h2>';
    var drillRows = App.drills().filter(function (d) { return st.drills[d.id]; });
    if (!drillRows.length) html += '<div class="card tight"><span class="dim small">No drills attempted yet. The Command Drill tab is the fastest way to build muscle memory.</span></div>';
    else {
      html += '<div class="card tight"><table><thead><tr><th>Drill</th><th>Attempts</th><th>Last result</th><th>Solved</th></tr></thead><tbody>';
      drillRows.sort(function (a, b) { return (st.drills[b.id].last || "").localeCompare(st.drills[a.id].last || ""); }).forEach(function (d) {
        var r = st.drills[d.id];
        html += '<tr><td><button class="small" data-act="tab" data-tab="drill" data-id="' + esc(d.id) + '">' + esc(d.title) + "</button></td>" +
          '<td class="mono">' + r.attempts + '</td><td class="mono ' + (r.lastPass ? "pass" : "fail") + '">' + (r.lastPass ? "pass" : "fail") + "</td>" +
          '<td class="mono">' + (r.solved ? "yes" : "no") + "</td></tr>";
      });
      html += "</tbody></table></div>";
    }

    html += '<h2>Mock exam history</h2>';
    if (!attempts.length) html += '<div class="card tight"><span class="dim small">No mock exam taken yet.</span></div>';
    else {
      var bestScore = attempts.map(function (a) { return a.total; }).sort(function (a, b) { return a - b; }).pop();
      var last10 = attempts.slice(-10);
      html += '<div class="card tight"><div class="row"><div class="stat"><b>' + Math.round(bestScore) + "%</b><span>best of " + attempts.length + "</span></div>" +
        '<div class="stat"><b>' + attempts.filter(function (a) { return a.pass; }).length + "</b><span>attempts above the pass line</span></div>" +
        '<div class="stat"><b>' + Math.round(attempts.reduce(function (a, x) { return a + x.minutes; }, 0) / attempts.length) + "</b><span>average minutes used</span></div></div>" +
        '<div class="row" style="margin-top:.6rem">' + last10.map(function (a) {
          return '<span class="badge ' + (a.pass ? "ok" : "bad") + '">' + Math.round(a.total) + "%</span>";
        }).join("") + "</div>";
      /* trend line: overall per domain for the most recent attempt */
      var lastA = attempts[attempts.length - 1];
      html += '<table style="margin-top:.7rem"><thead><tr><th>Domain</th>';
      attempts.slice(-6).forEach(function (a) { html += "<th>" + Math.round(a.total) + "%</th>"; });
      html += "</tr></thead><tbody>";
      App.domains().forEach(function (d) {
        html += "<tr><td>" + App.domainPill(d.id) + "</td>";
        attempts.slice(-6).forEach(function (a) {
          var v = a.perDomain[d.id];
          html += '<td class="mono ' + (v == null ? "mute" : v >= (App.meta().passMark || 65) ? "pass" : "fail") + '">' + (v == null ? "-" : Math.round(v) + "%") + "</td>";
        });
        html += "</tr>";
      });
      html += "</tbody></table><p class='tiny mute'>Showing the last " + Math.min(6, attempts.length) + " attempts, oldest to newest. Most recent overall: " + esc(lastA.at) + ".</p></div>";
    }

    html += '<h2>Study log</h2><div class="card"><div class="row">' +
      '<span class="badge">' + Object.keys(st.topics).length + " topics studied</span>" +
      '<span class="badge">' + Object.keys(st.labs).length + " labs touched</span>" +
      '<span class="badge">' + Object.keys(st.drills).length + " drills attempted</span>" +
      '<span class="badge">' + Object.keys(st.quiz).length + " questions answered</span>" +
      '<span class="badge">' + Object.keys(st.cards).filter(function (k) { return st.cards[k].seen; }).length + " cards seen</span>" +
      '<span class="spacer"></span><span class="tiny mute">started ' + esc(st.createdAt || "") + "</span></div>";
    if (App.state.examDate) {
      var days = Math.ceil((new Date(st.examDate + "T00:00:00").getTime() - Date.now()) / 86400000);
      html += '<p class="small dim">' + (days >= 0 ? days + " days until your booked exam." : "Your stored exam date has passed.") + "</p>";
    }
    html += "</div>";

    App.render(html);
    var dd = dom("p-exam-date");
    if (dd) dd.addEventListener("change", function () { st.examDate = dd.value || ""; App.save(true); App.setTab("progress", "", false); });
  });

  var importArea = false;
  App.actions["progress-export"] = function () {
    var json = App.exportJSON();
    try {
      var blob = new Blob([json], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cks-progress-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      App.toast("Progress exported as a JSON file.", "ok");
    } catch (e) {
      App.openOverlay("<h2>Progress JSON</h2><p class='small dim'>Your browser blocked the download, so here is the text - copy it into a file.</p>" + App.code(json), "textarea");
    }
  };
  App.actions["progress-import"] = function () {
    App.openOverlay('<h2>Import progress</h2><p class="small dim">Paste a previously exported CKS Prep JSON, or pick a file.</p>' +
      '<input type="file" id="import-file" accept="application/json,.json">' +
      '<textarea id="import-text" spellcheck="false" placeholder="paste JSON here"></textarea>' +
      '<div class="row"><button class="primary" data-act="progress-import-go">Import and replace</button>' +
      '<button class="ghost" data-act="close-overlay">Cancel</button></div>');
    var f = dom("import-file");
    if (f) f.addEventListener("change", function () {
      var file = f.files && f.files[0];
      if (!file) return;
      var r = new FileReader();
      r.onload = function () { dom("import-text").value = String(r.result); };
      r.onerror = function () { App.toast("That file could not be read.", "bad"); };
      r.readAsText(file);
    });
  };
  App.actions["progress-import-go"] = function () {
    var text = (dom("import-text") || {}).value || "";
    try { App.importJSON(text); App.closeOverlay(); App.toast("Progress imported.", "ok"); App.setTab("progress", "", false); }
    catch (e) { App.toast("Import failed: " + e.message, "bad"); }
  };
  App.actions["progress-reset"] = function () {
    if (!window.confirm("Reset all progress on this browser? Export first if you want to keep it.")) return;
    App.resetAll();
    App.toast("Progress cleared.", "ok");
    App.setTab("progress", "", false);
  };
  App.actions["progress-selftest"] = function () {
    var problems = App.selfTest();
    App.openOverlay("<h2>Content self-test</h2>" + (problems.length
      ? '<div class="callout bad">' + problems.length + " issue(s) found - open the browser console (F12) for the full list.</div><ul class='small'>" +
        problems.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>"
      : '<div class="callout ok">All content files passed: ids are unique, quiz answers are consistent, every quiz option has its own note, and every drill is validated against its own solution.</div>') +
      '<button class="primary" data-act="close-overlay">Close</button>');
  };

  /* ================================================================ boot == */

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", App.boot);
  else App.boot();
})();
