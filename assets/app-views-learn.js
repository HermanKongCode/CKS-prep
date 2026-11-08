/*
 * CKS PREP - views part 1: Dashboard, Learn, Labs, Quiz.
 * Classic script; uses the App namespace from app-core.js.
 */
(function () {
  "use strict";

  var App = window.CKSApp;
  var esc = App.esc;

  App.actions = App.actions || {};
  App.action = function (act, id, node, ev) {
    var h = App.actions[act];
    if (h) return h(act, id, node, ev);
    console.warn("CKS Prep: no handler for action " + act);
  };

  function domainChips(active, onChangeName, withAll) {
    var html = "";
    if (withAll) {
      html += '<button class="small' + (active === "all" ? " on" : "") + '" data-act="' + onChangeName + '" data-id="all">all domains</button>';
    }
    App.domains().forEach(function (d) {
      html += '<button class="small' + (active === d.id ? " on" : "") + '" data-act="' + onChangeName + '" data-id="' + esc(d.id) + '" title="' +
        esc(d.name) + ' - ' + d.weight + '% of the exam"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' +
        esc(d.color) + ';margin-right:5px"></i>' + esc(shortDomain(d.name)) + " " + d.weight + "%</button>";
    });
    return html;
  }

  function shortDomain(name) {
    var map = {
      "Cluster Setup": "Setup",
      "Cluster Hardening": "Hardening",
      "System Hardening": "System",
      "Minimize Microservice Vulnerabilities": "Microservices",
      "Supply Chain Security": "Supply chain",
      "Monitoring, Logging and Runtime Security": "Runtime"
    };
    return map[name] || name;
  }

  function tagList(tags) {
    return (tags || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join(" ");
  }

  function minutesLabel(m) {
    return m == null ? "" : '<span class="badge">' + esc(m) + " min</span>";
  }

  /* ============================================================= dashboard == */

  App.registerTab("dashboard", function () {
    var m = App.meta();
    var st = App.state;
    var today = new Date();
    var exam = st.examDate ? new Date(st.examDate + "T00:00:00") : null;
    var daysLeft = exam ? Math.ceil((exam.getTime() - today.setHours(0, 0, 0, 0)) / 86400000) : null;

    var counts = App.domains().map(function (d) {
      return {
        d: d,
        topics: App.byDomain(App.learn(), d.id).length,
        topicsDone: App.byDomain(App.learn(), d.id).filter(function (t) { return App.topicDone(t.id); }).length,
        labs: App.byDomain(App.labs(), d.id).length,
        labsDone: App.byDomain(App.labs(), d.id).filter(function (l) { return App.labStatus(l.id) === "done"; }).length,
        drills: App.byDomain(App.drills(), d.id).length,
        drillsDone: App.byDomain(App.drills(), d.id).filter(function (x) { return App.drillSolved(x.id); }).length,
        quiz: App.byDomain(App.quiz(), d.id).length,
        quizRight: App.byDomain(App.quiz(), d.id).filter(function (q) { return st.quiz[q.id] && st.quiz[q.id].correct; }).length
      };
    });

    function pct(a, b) { return b ? (a / b) * 100 : 0; }
    var totals = counts.reduce(function (a, c) {
      a.topics += c.topics; a.topicsDone += c.topicsDone; a.labs += c.labs; a.labsDone += c.labsDone;
      a.drills += c.drills; a.drillsDone += c.drillsDone; a.quiz += c.quiz; a.quizRight += c.quizRight;
      return a;
    }, { topics: 0, topicsDone: 0, labs: 0, labsDone: 0, drills: 0, drillsDone: 0, quiz: 0, quizRight: 0 });

    var attempts = st.mock.attempts.slice().sort(function (a, b) { return a.total - b.total; });
    var best = attempts.length ? attempts[attempts.length - 1] : null;
    var last = st.mock.attempts.length ? st.mock.attempts[st.mock.attempts.length - 1] : null;

    /* Study queue: weakest coverage first, weighted by blueprint weight. */
    var queue = [];
    counts.forEach(function (c) {
      App.byDomain(App.learn(), c.d.id).forEach(function (t) {
        if (!App.topicDone(t.id)) queue.push({ w: c.d.weight + (c.topicsDone === 0 ? 6 : 0), kind: "topic", id: t.id, title: t.title, domain: c.d.id, why: "not studied yet" });
      });
      App.byDomain(App.drills(), c.d.id).forEach(function (x) {
        if (!App.drillSolved(x.id)) queue.push({ w: c.d.weight, kind: "drill", id: x.id, title: x.title, domain: c.d.id, why: "drill not solved (" + (x.minutes || "?") + " min)" });
      });
      App.byDomain(App.labs(), c.d.id).forEach(function (l) {
        if (App.labStatus(l.id) !== "done") queue.push({ w: c.d.weight + 3, kind: "lab", id: l.id, title: l.title, domain: c.d.id, why: "lab " + App.labStatus(l.id) });
      });
    });
    queue.sort(function (a, b) { return b.w - a.w; });

    var html = '<h1>Certified Kubernetes Security Specialist</h1>' +
      '<p class="dim">' + esc(m.cert || "") + " - " + esc(m.issuer || "") + ". " +
      "Performance-based, hands-on, " + (m.durationMinutes || 120) + " minutes, " + esc(m.version || "") + ".</p>";

    if (m.disclaimer) html += '<div class="callout info">' + esc(m.disclaimer) + "</div>";

    html += '<div class="card"><div class="row"><div>' +
      "<label class='small dim'>Your exam date (saved locally, drives the countdown)</label>" +
      '<input type="date" id="exam-date" value="' + esc(st.examDate || "") + '">' +
      "</div><div class='spacer'></div><div class='stat'><b>" + (daysLeft === null ? "not set" : (daysLeft < 0 ? "past" : daysLeft)) + "</b><span>days left</span></div>" +
      "<div class='stat'><b>" + totals.topicsDone + "/" + totals.topics + "</b><span>topics studied</span></div>" +
      "<div class='stat'><b>" + totals.labsDone + "/" + totals.labs + "</b><span>labs finished</span></div>" +
      "<div class='stat'><b>" + totals.drillsDone + "/" + totals.drills + "</b><span>drills solved</span></div>" +
      '<div class="stat"><b>' + (best ? Math.round(best.total) + "%" : "-") + "</b><span>best mock score</span></div>" +
      "</div></div>";

    html += '<h2>Blueprint coverage</h2><div class="card"><table><thead><tr><th>Domain</th><th>Weight</th><th>Topics</th><th>Labs</th><th>Drills</th><th>Quiz correct</th><th>Domain progress</th></tr></thead><tbody>';
    counts.forEach(function (c) {
      var progress = (pct(c.topicsDone, c.topics) + pct(c.labsDone, c.labs) + pct(c.drillsDone, c.drills)) / 3;
      html += "<tr><td>" + App.domainPill(c.d.id) + '<div class="tiny mute">' + esc(c.d.summary || "") + "</div></td>" +
        '<td class="mono">' + c.d.weight + "%</td>" +
        '<td class="mono">' + c.topicsDone + "/" + c.topics + "</td>" +
        '<td class="mono">' + c.labsDone + "/" + c.labs + "</td>" +
        '<td class="mono">' + c.drillsDone + "/" + c.drills + "</td>" +
        '<td class="mono">' + c.quizRight + "/" + c.quiz + "</td>" +
        "<td style='min-width:130px'>" + App.bar(progress, c.d.color) + "</td></tr>";
    });
    html += "</tbody></table><p class='small dim'>Weights are the published CKS domain percentages; the item counts are how this site maps its content onto those domains.</p></div>";

    html += '<h2>Exam facts</h2><div class="grid cols-3">';
    [
      ["Duration", (m.durationMinutes || 120) + " min"],
      ["Pass mark", m.passMark + "%"],
      ["Kubernetes version", m.version],
      ["Prerequisite", m.prerequisites],
      ["Delivery", m.delivery],
      ["Attempts", m.attempts],
      ["Environment", m.environment],
      ["Results", m.results],
      ["Price", m.price]
    ].forEach(function (row) {
      html += '<div class="stat"><b style="font-size:1rem">' + esc(row[1] || "-") + "</b><span>" + esc(row[0]) + "</span></div>";
    });
    html += "</div>";
    if (m.passMarkNote) html += '<p class="small dim">' + esc(m.passMarkNote) + "</p>";

    if (m.sources && m.sources.length) {
      html += '<div class="card tight"><b class="small">Sources used for the facts above</b><div class="row tight">' +
        m.sources.map(function (s) { return '<a class="small" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "</a>"; }).join(" ") +
        "</div></div>";
    }

    html += '<h2>What to do next</h2><div class="card"><ul class="clean">';
    if (!queue.length) html += "<li>Everything on this site is marked complete. Time for a fresh Mock Exam and a killer.sh pass.</li>";
    queue.slice(0, 8).forEach(function (q) {
      var tab = q.kind === "topic" ? "learn" : (q.kind === "drill" ? "drill" : "labs");
      html += "<li><div class='row'><button class='small' data-act='tab' data-tab='" + tab + "' data-id='" + esc(q.id) + "'>" +
        esc(q.title) + "</button><span class='spacer'></span>" + App.domainPill(q.domain) +
        '<span class="badge">' + esc(q.kind) + "</span><span class='tiny mute'>" + esc(q.why) + "</span></div></li>";
    });
    html += "</ul>";
    if (queue.length > 8) html += '<p class="small dim">' + (queue.length - 8) + " more item(s) waiting in the other tabs.</p></div>";

    if (last) {
      html += '<h2>Last mock exam</h2><div class="card"><div class="row"><div class="stat"><b>' + Math.round(last.total) +
        "%</b><span>" + (last.pass ? "pass" : "below " + App.meta().passMark + "%") + "</span></div>" +
        '<span class="dim small">' + esc(last.at) + " - " + esc(last.minutes) + " min used</span></div>" +
        "<table><thead><tr><th>Domain</th><th>Weight</th><th>Your score</th></tr></thead><tbody>";
      App.domains().forEach(function (d) {
        var s = last.perDomain[d.id];
        if (!s) return;
        html += "<tr><td>" + App.domainPill(d.id) + '</td><td class="mono">' + d.weight + '%</td><td class="mono ' +
          (s >= 67 ? "pass" : "fail") + '">' + Math.round(s) + "%</td></tr>";
      });
      html += "</tbody></table></div>";
    }

    html += '<h2>Exam technique</h2>';
    App.tips().forEach(function (t) {
      html += '<div class="card tight"><b>' + esc(t.title) + "</b><p class='dim small' style='margin:.25rem 0 0'>" + esc(t.body) + "</p></div>";
    });

    App.render(html);

    var dateInput = document.getElementById("exam-date");
    if (dateInput) dateInput.addEventListener("change", function () {
      App.state.examDate = dateInput.value || "";
      App.save(true);
      App.setTab("dashboard", "", false);
    });
  });

  /* ================================================================= learn == */

  var learnFilter = { domain: "all", q: "" };

  App.registerTab("learn", function (id) {
    if (id) return renderTopic(id);

    var all = App.learn();
    var list = App.byDomain(all, learnFilter.domain);
    if (learnFilter.q) {
      var needle = learnFilter.q.toLowerCase();
      list = list.filter(function (t) {
        return (t.title + " " + t.summary + " " + (t.tags || []).join(" ") + " " + (t.notes || []).join(" ")).toLowerCase().indexOf(needle) >= 0;
      });
    }
    list.sort(function (a, b) {
      var wa = (App.domain(a.domain) || {}).weight || 0, wb = (App.domain(b.domain) || {}).weight || 0;
      return wb - wa || a.title.localeCompare(b.title);
    });

    var html = '<h1>Learn</h1><p class="dim small">' + all.length +
      " topics mapped onto the six blueprint domains. Each topic carries the explanation, the exact commands, the YAML you will actually write in the exam, and the traps that cost the most points.</p>" +
      '<div class="filterbar">' + domainChips(learnFilter.domain, "learn-domain", true) +
      '<input id="learn-q" class="small" placeholder="filter topics" value="' + esc(learnFilter.q) + '" style="max-width:220px">' +
      '<span class="spacer"></span><span class="tiny mute">' + list.length + " shown</span></div>";

    var grouped = {};
    list.forEach(function (t) { (grouped[t.domain] = grouped[t.domain] || []).push(t); });
    App.domains().forEach(function (d) {
      var items = grouped[d.id];
      if (!items || !items.length) return;
      html += '<h2 style="border-left:3px solid ' + esc(d.color) + ';padding-left:.5rem">' + esc(d.name) +
        ' <span class="mute small">' + d.weight + "% of the exam</span></h2>";
      items.forEach(function (t) {
        var done = App.topicDone(t.id);
        html += '<div class="card tight"><div class="row"><button class="small" data-act="tab" data-tab="learn" data-id="' + esc(t.id) + '">' +
          esc(t.title) + "</button>" +
          '<label class="check small"><input type="checkbox" data-act="topic-done" data-id="' + esc(t.id) + '"' + (done ? " checked" : "") + "> done</label>" +
          '<span class="spacer"></span>' + tagList(t.tags) + "</div>" +
          '<p class="dim small" style="margin:.35rem 0 0">' + esc(t.summary) + "</p></div>";
      });
    });

    App.render(html);
    var q = document.getElementById("learn-q");
    if (q) q.addEventListener("input", function () { learnFilter.q = q.value; App.setTab("learn", "", "replace"); });
  });

  App.actions["learn-domain"] = function (act, id) { learnFilter.domain = id; App.setTab("learn", "", "replace"); };
  App.actions["topic-done"] = function (act, id, node) { App.markTopic(id, node.checked); };

  function renderTopic(id) {
    var t = App.byId(App.learn(), id);
    if (!t) { App.render('<div class="callout bad">Topic <code>' + esc(id) + "</code> was not found.</div>"); return; }
    var rel = App.related(t.id);
    var all = App.learn();
    var i = all.indexOf(t);
    var prev = all[i - 1], next = all[i + 1];

    var html = '<div class="row"><button class="ghost small" data-act="tab" data-tab="learn">&larr; all topics</button>' +
      '<span class="spacer"></span>' + App.domainPill(t.domain) + "</div>" +
      '<h1 style="margin-top:.6rem">' + esc(t.title) + "</h1>" +
      '<div class="row tight">' + tagList(t.tags) + "</div>" +
      '<p class="dim">' + esc(t.summary) + "</p>" +
      '<div class="row"><label class="check"><input type="checkbox" data-act="topic-done" data-id="' + esc(t.id) + '"' + (App.topicDone(t.id) ? " checked" : "") + "> marked as studied</label>" +
      '<span class="spacer"></span>' +
      (prev ? '<button class="small" data-act="tab" data-tab="learn" data-id="' + esc(prev.id) + '">&larr; ' + esc(prev.title) + "</button>" : "") +
      (next ? '<button class="small" data-act="tab" data-tab="learn" data-id="' + esc(next.id) + '">' + esc(next.title) + " &rarr;</button>" : "") +
      "</div>";

    html += '<h2>What you need to understand</h2><div class="card"><ol>' +
      (t.notes || []).map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ol></div>";

    if ((t.commands || []).length) {
      html += '<h2>Commands</h2>';
      t.commands.forEach(function (c) {
        html += App.code(c.cmd) + '<p class="small dim" style="margin:-.5rem 0 .8rem">' + esc(c.why || "") + "</p>";
      });
    }
    if ((t.yaml || []).length) {
      html += '<h2>YAML to be able to write from memory</h2>';
      t.yaml.forEach(function (y) {
        html += App.code(y.body, y.title);
      });
    }
    if ((t.gotchas || []).length) {
      html += '<h2>Gotchas</h2><div class="card"><ul>' +
        t.gotchas.map(function (g) { return "<li>" + esc(g) + "</li>"; }).join("") + "</ul></div>";
    }
    if ((t.docs || []).length) {
      html += '<h2>Docs (the ones the exam browser will show you)</h2><div class="row tight">' +
        t.docs.map(function (d) { return '<a class="badge" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.label) + "</a>"; }).join(" ") + "</div>";
    }

    html += '<h2>Practice this topic</h2><div class="grid cols-2">';
    html += relatedBox("Labs", rel.labs, "labs", function (l) { return esc(l.title) + " " + minutesLabel(l.minutes); });
    html += relatedBox("Drills", rel.drills, "drill", function (d) { return esc(d.title) + " " + minutesLabel(d.minutes); });
    html += relatedBox("Quiz questions", rel.quiz.slice(0, 6), "quiz", function (q) { return esc(q.q.length > 90 ? q.q.slice(0, 90) + "..." : q.q); });
    html += relatedBox("Flashcards", rel.cards.slice(0, 8), "cards", function (c) { return esc(c.front.length > 90 ? c.front.slice(0, 90) + "..." : c.front); });
    html += "</div>";

    App.render(html);
  }

  function relatedBox(title, items, tab, label) {
    if (!items.length) return '<div class="card tight"><b class="small dim">' + esc(title) + "</b><p class='tiny mute'>nothing linked yet</p></div>";
    return "<div class='card tight'><b class='small'>" + esc(title) + "</b><ul class='clean' style='margin-top:.4rem'>" +
      items.map(function (x) {
        return "<li><button class='small' data-act='tab' data-tab='" + tab + "' data-id='" + esc(x.id) + "'>" + label(x) + "</button></li>";
      }).join("") + "</ul></div>";
  }

  /* ================================================================= labs == */

  var labFilter = { domain: "all", status: "all" };

  App.registerTab("labs", function (id) {
    if (id) return renderLab(id);
    var all = App.labs();
    var list = App.byDomain(all, labFilter.domain);
    if (labFilter.status !== "all") list = list.filter(function (l) { return App.labStatus(l.id) === labFilter.status; });
    list.sort(function (a, b) { return (a.id > b.id ? 1 : -1); });

    var statusIcon = { todo: '<span class="badge">not started</span>', doing: '<span class="badge warn">in progress</span>', done: '<span class="badge ok">finished</span>' };

    var html = '<h1>Labs</h1><p class="dim small">' + all.length +
      " exam-style walkthroughs: the scenario, the commands that prove the answer, the checks to run, and the pitfalls that cost marks. " +
      "Run them on any cluster you control, or read them end to end as worked examples - nothing on this site needs a cluster to work.</p>" +
      '<div class="callout">Plain file names (<code>manifests/20-netpol-deny.yaml</code>, a <code>Dockerfile</code>) are files you write yourself in a scratch folder; the YAML to put in them is in the linked topics under <b>Learn</b>. Absolute paths are paths on the node you are working on. Windows and WSL2 notes are in <code>README.md</code>.</div>' +
      '<div class="filterbar">' + domainChips(labFilter.domain, "lab-domain", true) +
      '<button class="small' + (labFilter.status === "all" ? " on" : "") + '" data-act="lab-status-filter" data-id="all">any status</button>' +
      '<button class="small' + (labFilter.status === "todo" ? " on" : "") + '" data-act="lab-status-filter" data-id="todo">not started</button>' +
      '<button class="small' + (labFilter.status === "doing" ? " on" : "") + '" data-act="lab-status-filter" data-id="doing">in progress</button>' +
      '<button class="small' + (labFilter.status === "done" ? " on" : "") + '" data-act="lab-status-filter" data-id="done">finished</button>' +
      '<span class="spacer"></span><span class="tiny mute">' + list.length + " of " + all.length + "</span></div>";

    App.domains().forEach(function (d) {
      var items = list.filter(function (l) { return l.domain === d.id; });
      if (!items.length) return;
      html += '<h2 style="border-left:3px solid ' + esc(d.color) + ';padding-left:.5rem">' + esc(d.name) + "</h2>";
      items.forEach(function (l) {
        html += '<div class="card tight"><div class="row"><button class="small" data-act="tab" data-tab="labs" data-id="' + esc(l.id) + '">' +
          esc(l.id.toUpperCase().replace("LAB-", "Lab ")) + " - " + esc(l.title) + "</button>" +
          '<span class="spacer"></span>' + (statusIcon[App.labStatus(l.id)] || "") +
          '<span class="badge">' + esc(l.difficulty || "") + "</span>" + minutesLabel(l.minutes) +
          (l.timed ? '<span class="badge warn">timed drill</span>' : "") + "</div>" +
          '<p class="dim small" style="margin:.35rem 0 0">' + esc((l.scenario || "").slice(0, 190)) + "</p></div>";
      });
    });

    App.render(html);
  });

  App.actions["lab-domain"] = function (act, id) { labFilter.domain = id; App.setTab("labs", "", "replace"); };
  App.actions["lab-status-filter"] = function (act, id) { labFilter.status = id; App.setTab("labs", "", "replace"); };
  App.actions["lab-set-status"] = function (act, id, node) {
    App.setLab(id, node.getAttribute("data-status"));
    renderLab(id);
  };

  function renderLab(id) {
    var l = App.byId(App.labs(), id);
    if (!l) { App.render('<div class="callout bad">Lab <code>' + esc(id) + "</code> was not found.</div>"); return; }
    var status = App.labStatus(l.id);
    var all = App.labs();
    var i = all.indexOf(l), prev = all[i - 1], next = all[i + 1];

    var html = '<div class="row"><button class="ghost small" data-act="tab" data-tab="labs">&larr; all labs</button>' +
      '<span class="spacer"></span>' + App.domainPill(l.domain) + "</div>" +
      '<h1 style="margin-top:.6rem">' + esc(l.id.toUpperCase()) + " - " + esc(l.title) + "</h1>" +
      '<div class="row tight"><span class="badge">' + esc(l.difficulty || "") + "</span>" + minutesLabel(l.minutes) +
      (l.timed ? '<span class="badge warn">timed</span>' : "") +
      '<button class="small' + (status === "todo" ? " on" : "") + '" data-act="lab-set-status" data-id="' + esc(l.id) + '" data-status="todo">not started</button>' +
      '<button class="small' + (status === "doing" ? " on" : "") + '" data-act="lab-set-status" data-id="' + esc(l.id) + '" data-status="doing">in progress</button>' +
      '<button class="small' + (status === "done" ? " on" : "") + '" data-act="lab-set-status" data-id="' + esc(l.id) + '" data-status="done">finished</button>' +
      '<span class="spacer"></span>' +
      (prev ? '<button class="small" data-act="tab" data-tab="labs" data-id="' + esc(prev.id) + '">&larr;</button>' : "") +
      (next ? '<button class="small" data-act="tab" data-tab="labs" data-id="' + esc(next.id) + '">&rarr;</button>' : "") +
      "</div>" +
      '<div class="card"><b class="small">Scenario</b><p style="margin:.35rem 0 0">' + esc(l.scenario) + "</p></div>";

    if ((l.needs || []).length) {
      html += '<h2>You will need</h2><div class="card"><ul>' + l.needs.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></div>";
    }
    if ((l.files || []).length) {
      html += '<h2>Files involved</h2>' + App.code(l.files.map(function (f) { return f.path ? (f.path + (f.note ? "   # " + f.note : "")) : String(f); }).join("\n"), "you write these in a scratch folder (absolute paths are on the node)");
    }
    if ((l.tasks || []).length) {
      html += '<h2>Tasks (the exam will phrase them like this)</h2><div class="card"><ol>' +
        l.tasks.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ol></div>";
    }
    if ((l.verify || []).length) {
      html += '<h2>Check it worked</h2>' + App.code(l.verify.join("\n"));
    }
    if ((l.solution || []).length) {
      html += '<h2>Solution</h2><div class="card"><ol>';
      l.solution.forEach(function (s) {
        html += "<li>" + esc(s.why || "") + "</li>";
      });
      html += "</ol></div>";
      l.solution.forEach(function (s) {
        if (!s.cmd) return;
        html += App.code(s.cmd);
      });
    }
    if ((l.pitfalls || []).length) {
      html += '<h2>Pitfalls that cost points</h2><div class="card"><ul>' +
        l.pitfalls.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul></div>";
    }
    if ((l.related || []).length) {
      html += '<h2>Study notes for this lab</h2><div class="row tight">' +
        l.related.map(function (rid) {
          var t = App.byId(App.learn(), rid);
          return '<button class="small" data-act="tab" data-tab="learn" data-id="' + esc(rid) + '">' + esc(t ? t.title : rid) + "</button>";
        }).join(" ") + "</div>";
    }

    App.render(html);
  }

  /* ================================================================= quiz == */

  var quizSession = null;

  function buildQuiz(domain, count) {
    var pool = App.byDomain(App.quiz(), domain);
    if (!pool.length) return [];
    var out = [];
    var wanted = count === "all" ? pool.length : Math.min(count, pool.length);
    var byDiff = { easy: [], medium: [], hard: [] };
    pool.forEach(function (q) { (byDiff[q.difficulty] = byDiff[q.difficulty] || []).push(q); });
    Object.keys(byDiff).forEach(function (k) { shuffle(byDiff[k]); });
    var order = ["easy", "medium", "hard"];
    var i = 0;
    while (out.length < wanted) {
      var picked = false;
      for (var d = 0; d < order.length; d++) {
        var arr = byDiff[order[d]];
        if (arr && arr.length) { out.push(arr.shift()); picked = true; if (out.length >= wanted) break; }
      }
      if (!picked) break;
      if (++i > 1000) break;
    }
    return out;
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  App.registerTab("quiz", function (id) {
    if (id) return renderQuizQuestion(id);

    var html = '<h1>Quiz</h1><p class="dim small">' + App.quiz().length +
      " knowledge questions. The real CKS is hands-on, so treat this as the theory layer: read the explanation even when you are right.</p>" +
      '<div class="card"><div class="row"><div><label class="small dim">Domain</label><br>' +
      '<select id="quiz-domain"><option value="all">all (mixed, blueprint-weighted)</option>' +
      App.domains().map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + " (" + d.weight + "%)</option>"; }).join("") +
      "</select></div>" +
      '<div><label class="small dim">Questions</label><br><select id="quiz-count">' +
      '<option value="10">10</option><option value="15" selected>15</option><option value="25">25</option><option value="40">40</option><option value="all">all in range</option></select></div>' +
      '<div><label class="small dim">Focus</label><br><select id="quiz-focus">' +
      '<option value="mixed" selected>mixed</option><option value="wrong">only ones I got wrong</option><option value="unseen">only unseen</option></select></div>' +
      '<div class="spacer"></div><button class="primary" data-act="quiz-start">Start quiz</button></div></div>';

    var st = App.state.quiz;
    var answered = App.quiz().filter(function (q) { return st[q.id]; });
    var right = answered.filter(function (q) { return st[q.id].correct; });
    html += '<div class="grid cols-4"><div class="stat"><b>' + answered.length + "</b><span>questions seen</span></div>" +
      '<div class="stat"><b>' + (answered.length ? Math.round((right.length / answered.length) * 100) : 0) + '%</b><span>first-try accuracy</span></div>' +
      '<div class="stat"><b>' + (answered.length - right.length) + "</b><span>currently wrong</span></div>" +
      '<div class="stat"><b>' + App.quiz().length + "</b><span>bank size</span></div></div>";

    if (answered.length) {
      html += '<h2>By domain</h2><div class="card"><table><thead><tr><th>Domain</th><th>Seen</th><th>Correct</th></tr></thead><tbody>';
      App.domains().forEach(function (d) {
        var seen = App.byDomain(App.quiz(), d.id).filter(function (q) { return st[q.id]; });
        var ok = seen.filter(function (q) { return st[q.id].correct; });
        html += "<tr><td>" + App.domainPill(d.id) + '</td><td class="mono">' + seen.length + '</td><td class="mono ' +
          (!seen.length || ok.length / seen.length >= 0.8 ? "pass" : "fail") + '">' + ok.length + "</td></tr>";
      });
      html += "</tbody></table></div>";
    }

    html += '<h2>All questions</h2><div class="card"><ul class="clean">';
    App.quiz().forEach(function (q) {
      var s = st[q.id];
      html += "<li><div class='row'><button class='small' data-act='tab' data-tab='quiz' data-id='" + esc(q.id) + "'>" +
        esc(q.q.length > 110 ? q.q.slice(0, 110) + "..." : q.q) + "</button><span class='spacer'></span>" +
        (s ? '<span class="badge ' + (s.correct ? "ok" : "bad") + '">' + (s.correct ? "correct" : "wrong") + " &times;" + s.attempts + "</span>" : '<span class="badge">unseen</span>') +
        '<span class="badge">' + esc(q.type) + "</span><span class='badge'>" + esc(q.difficulty) + "</span>" + App.domainPill(q.domain) + "</div></li>";
    });
    html += "</ul></div>";

    App.render(html);
  });

  App.actions["quiz-start"] = function () {
    var domain = document.getElementById("quiz-domain").value;
    var countSel = document.getElementById("quiz-count").value;
    var focus = document.getElementById("quiz-focus").value;
    var count = countSel === "all" ? "all" : parseInt(countSel, 10);
    var items;
    if (focus === "wrong") items = App.quiz().filter(function (q) { return App.state.quiz[q.id] && !App.state.quiz[q.id].correct; });
    else if (focus === "unseen") items = App.quiz().filter(function (q) { return !App.state.quiz[q.id]; });
    else items = buildQuiz(domain, count);
    if (domain !== "all") items = items.filter(function (q) { return q.domain === domain; });
    if (count !== "all" && items.length > count) items = items.slice(0, count);
    if (!items.length) { App.toast("No questions match that selection.", "bad"); return; }
    quizSession = { items: items, answers: {}, done: false, started: Date.now() };
    renderQuizSession();
  };

  function renderQuizSession() {
    var s = quizSession;
    if (!s) return App.setTab("quiz", "", false);
    var answeredCount = Object.keys(s.answers).length;
    var html = '<div class="row"><h1 style="margin:0">Quiz session</h1><span class="spacer"></span>' +
      '<span class="badge">' + answeredCount + " / " + s.items.length + " answered</span>" +
      '<button class="small" data-act="quiz-finish"' + (answeredCount ? "" : " disabled") + ">Submit session</button>" +
      '<button class="small ghost" data-act="quiz-abandon">Abandon</button></div>' +
      '<div style="margin:.6rem 0 1.1rem">' + App.bar((answeredCount / s.items.length) * 100) + "</div>";

    s.items.forEach(function (q, idx) {
      var a = s.answers[q.id];
      html += '<div class="card" id="qq-' + esc(q.id) + '"><div class="row"><span class="badge mono">' + (idx + 1) + "</span>" +
        App.domainPill(q.domain) + '<span class="badge">' + esc(q.type) + " choice</span><span class='badge'>" + esc(q.difficulty) + "</span>" +
        '<span class="spacer"></span>' + tagList(q.tags) + "</div>" +
        "<p style='margin:.5rem 0 .6rem'><b>" + esc(q.q) + "</b></p>" +
        (q.multiHint || q.type === "multi" ? '<p class="tiny mute">More than one option can be correct - select exactly the right set.</p>' : "") +
        '<div data-quiz-opts="' + esc(q.id) + '">';
      (q.options || []).forEach(function (o, i) {
        var name = "opt-" + esc(q.id) + "-" + i;
        var inputType = q.type === "multi" ? "checkbox" : "radio";
        var cls = "opt";
        if (a) {
          var chosen = a.indexOf(i) >= 0;
          if (o.ok && chosen) cls += " sel right";
          else if (o.ok && !chosen) cls += " right";
          else if (!o.ok && chosen) cls += " wrong";
        }
        html += '<label class="' + cls + '"><input type="' + inputType + '" name="' + name + '" data-act="quiz-pick" data-id="' + esc(q.id) + '" data-idx="' + i + '"' +
          (chosenAttr(a, i, q)) + '><span>' + esc(o.t) + "</span></label>";
      });
      html += "</div>";
      if (a) {
        var correct = isQuizCorrect(q, a);
        html += '<div class="callout ' + (correct ? "ok" : "bad") + '">' + (correct ? "Correct. " : "Not correct. ") + esc(q.explain || "") + "</div>";
      }
      html += "</div>";
    });

    App.render(html);
  }

  function chosenAttr(a, i, q) {
    if (!a) return "";
    return a.indexOf(i) >= 0 ? " checked" : "";
  }

  function isQuizCorrect(q, picked) {
    var right = [];
    (q.options || []).forEach(function (o, i) { if (o.ok) right.push(i); });
    if (!picked || picked.length !== right.length) return false;
    var sorted = picked.slice().sort(), r = right.slice().sort();
    return sorted.join(",") === r.join(",");
  }

  App.actions["quiz-pick"] = function (act, id, node) {
    var s = quizSession;
    if (!s) return;
    var q = App.byId(s.items, id);
    var idx = parseInt(node.getAttribute("data-idx"), 10);
    var picked = s.answers[id] ? s.answers[id].slice() : [];
    if (q.type === "multi") {
      var at = picked.indexOf(idx);
      if (at >= 0) picked.splice(at, 1); else picked.push(idx);
    } else picked = [idx];
    s.answers[id] = picked;
    App.recordQuiz(id, isQuizCorrect(q, picked));
    renderQuizSession();
  };

  App.actions["quiz-abandon"] = function () { quizSession = null; App.setTab("quiz", "", false); };

  App.actions["quiz-finish"] = function () {
    var s = quizSession;
    if (!s) return;
    var right = 0, perDomain = {};
    s.items.forEach(function (q) {
      var a = s.answers[q.id];
      var ok = a && isQuizCorrect(q, a);
      if (ok) right++;
      var d = perDomain[q.domain] || (perDomain[q.domain] = { n: 0, ok: 0 });
      d.n++; if (ok) d.ok++;
    });
    var total = s.items.length;
    var html = '<h1>Quiz result</h1><div class="row"><div class="stat"><b>' + Math.round((right / total) * 100) + "%</b><span>" + right + " of " + total + "</span></div>" +
      '<button class="small" data-act="quiz-retry-wrong">Retry the wrong ones</button>' +
      '<button class="small" data-act="quiz-abandon">Back to quiz</button></div><div class="card"><table><thead><tr><th>Domain</th><th>Answered</th><th>Correct</th></tr></thead><tbody>';
    App.domains().forEach(function (d) {
      var p = perDomain[d.id];
      if (!p) return;
      html += "<tr><td>" + App.domainPill(d.id) + '</td><td class="mono">' + p.n + '</td><td class="mono ' + (p.ok / p.n >= 0.8 ? "pass" : "fail") + '">' + p.ok + "</td></tr>";
    });
    html += "</tbody></table></div>";
    var wrong = s.items.filter(function (q) { var a = s.answers[q.id]; return !a || !isQuizCorrect(q, a); });
    if (wrong.length) {
      html += '<h2>Review</h2>';
      wrong.forEach(function (q) {
        html += '<div class="card tight"><b>' + esc(q.q) + "</b>" + App.domainPill(q.domain) +
          "<ul>" + (q.options || []).map(function (o) { return '<li class="' + (o.ok ? "pass" : "fail") + '">' + (o.ok ? "&#10003; " : "&#10007; ") + esc(o.t) + "</li>"; }).join("") + "</ul>" +
          '<p class="small dim">' + esc(q.explain || "") + "</p></div>";
      });
    }
    quizSession = null;
    App.render(html);
  };

  App.actions["quiz-retry-wrong"] = function () {
    var items = App.quiz().filter(function (q) { return App.state.quiz[q.id] && !App.state.quiz[q.id].correct; });
    if (!items.length) { App.toast("Nothing to retry - every question you have answered is currently correct.", "ok"); return; }
    quizSession = { items: shuffle(items.slice()), answers: {}, done: false, started: Date.now() };
    renderQuizSession();
  };

  function renderQuizQuestion(id) {
    var q = App.byId(App.quiz(), id);
    if (!q) { App.render('<div class="callout bad">Question <code>' + esc(id) + "</code> was not found.</div>"); return; }
    var st = App.state.quiz[q.id] || null;
    var html = '<div class="row"><button class="ghost small" data-act="tab" data-tab="quiz">&larr; quiz</button><span class="spacer"></span>' +
      App.domainPill(q.domain) + '<span class="badge">' + esc(q.type) + " choice</span><span class='badge'>" + esc(q.difficulty) + "</span></div>" +
      '<h1 style="margin-top:.6rem">' + esc(q.q) + "</h1>" + tagList(q.tags) +
      '<div class="card"><p class="tiny mute">Tick the option(s) to check the answer against the bank.</p>';
    (q.options || []).forEach(function (o, i) {
      html += '<label class="opt ' + (o.ok ? "right" : "") + '"><input type="' + (q.type === "multi" ? "checkbox" : "radio") + '" name="single-' + esc(q.id) + '">' +
        "<span>" + esc(o.t) + "</span></label>";
    });
    html += '<div class="callout info">' + esc(q.explain || "") + "</div></div>";
    if (st) html += '<p class="small dim">Last attempt: ' + (st.correct ? "correct" : "wrong") + " (" + st.attempts + " attempt" + (st.attempts === 1 ? "" : "s") + ").</p>";
    App.render(html);
  }
})();
