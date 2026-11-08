# CKS Prep - learn, practice, mock

A self-contained study site for the **Certified Kubernetes Security Specialist (CKS)** exam.
It is plain HTML + CSS + JavaScript with the content in data files: no build step, no bundler,
no npm install, no server required. Everything works offline from `file://`.

Location: `C:\Users\herma\Documents\development\CKS`

## How to open it

**Easiest:** in File Explorer, double-click `index.html`. It opens in your browser and works from there.

**Optional (recommended if you hit `file://` quirks with the progress export/import):**

```powershell
cd C:\Users\herma\Documents\development\CKS
python -m http.server 8791 --bind 127.0.0.1
```

then open `http://127.0.0.1:8791/index.html`. Any static file server works (`python -m http.server`,
VS Code Live Server, `npx serve`, IIS, nginx) - nothing in the site talks to a backend.

Your progress is saved in the browser's `localStorage` under the key `cks_prep_v1`, per browser and
per origin. Opening the site from `file://` and from `http://127.0.0.1:8791` gives you two separate
progress stores; use **Progress -> export / import** to move between them.

## The tabs

| Tab | Shortcut | What it is |
| --- | --- | --- |
| Dashboard | `1` | Exam facts (format, 120 minutes, CKA prerequisite, attempts, killer.sh), blueprint weights, your coverage per domain, and a "what to do next" queue. |
| Learn | `2` | 31 topic notes across the six CKS domains: why the control exists, the exact files and flags, YAML you can copy, gotchas, and official doc links. |
| Labs | `3` | 24 **exam-style walkthroughs**: scenario, what you need, tasks, the commands with the reasoning next to them, verification commands, and the pitfalls that cost people marks. |
| Quiz | `4` | 66 multiple-choice / multi-select questions. Multi-select needs exactly the right set. Explanations after every answer. |
| Command drill | `5` | 43 typing drills. You write the `kubectl` / `etcdctl` / Dockerfile / YAML answer, the site grades it against "must appear" and "must not appear" patterns, then you can reveal the model answer. This is the closest thing to muscle memory you can get from a webpage. |
| Mock exam | `6` | A timed (120 min, auto-submit) mock built by sampling questions in proportion to the blueprint weights, plus hands-on cards you self-score 1 / 0.5 / 0 after comparing with the model answer. Per-domain scores, overall score, pass line 65, and a review of everything you missed. |
| Flashcards | `7` | 91 cards with spaced repetition: "known" leaves, "unsure" comes back, and you can re-run only the unsure ones. |
| Cheat sheet | `8` | Every command, flag, path, and YAML key in one page, filterable by domain, with copy buttons. |
| Progress | `9` | Coverage per domain, per-item status, mock attempt history, export/import JSON, reset, and a data self-test. |

Global shortcuts: `Ctrl+K` or `/` for search across all content, `?` for the help sheet,
`Esc` to close overlays, `Space`/`k`/`u`/`s` on flashcards, `Ctrl+Enter` to grade a drill,
`Tab` to indent inside the drill box.

## What is in the files

```
index.html                 the whole app shell (dark UI, tab bar, overlay, toasts)
assets/styles.css          the styling
assets/data-meta.js        exam facts, blueprint weights (with sources), exam tips, resource links
assets/data-learn-1.js     topics for Cluster Setup, Cluster Hardening, System Hardening
assets/data-learn-2.js     topics for Microservice Vulnerabilities, Supply Chain, Monitoring/Runtime
assets/data-quiz.js        66 questions
assets/data-drill.js       43 typed drills with grading patterns and model answers
assets/data-labs.js        24 walkthroughs
assets/data-cards.js       91 flashcards
assets/app-core.js         state, storage, grading engine, search index, router, self-test
assets/app-views-learn.js  Dashboard / Learn / Labs / Quiz views
assets/app-views-exam.js   Drill / Mock / Cards / Cheat / Progress views, then App.boot()
```

Scripts are loaded as classic `<script>` tags in that order, and each data file exposes a global
(`window.CKS_LEARN`, `window.CKS_QUIZ`, `window.CKS_DRILLS`, `window.CKS_LABS`, `window.CKS_CARDS`,
`window.CKS_META`, `window.CKS_BLUEPRINT`, `window.CKS_EXAM_TIPS`, `window.CKS_RESOURCES`).
That is deliberate: no ES modules and no `fetch()` of local JSON, so `file://` works.

### Adding or editing content

Each item is a plain object literal, so you can edit any data file in a text editor and reload:

- topic: `{ id, domain, title, tags, summary, notes, commands:[{cmd,why}], yaml:[{title,body}], gotchas, docs:[{label,url}] }`
- question: `{ id, domain, type:"single"|"multi", difficulty, tags, q, options:[{t,ok}], explain }`
- drill: `{ id, kind:"shell"|"yaml"|"dockerfile", domain, difficulty, minutes, title, prompt, hints, need:[{label,re}], avoid:[{label,re}], solution, why }`
- lab: `{ id, domain, title, difficulty, minutes, timed, scenario, needs, files, tasks, verify, solution:[{cmd,why}], pitfalls, related }`
- card: `{ id, domain, tags, front, back, cmd, why }`

Two rules matter. **YAML and shell bodies are JavaScript template literals**, so a shell variable must be
written `\${VERSION}` - a bare `${VERSION}` throws `ReferenceError`. And **drill patterns are graded on
normalized text**: answers are lower-cased, quote characters (`'` `"` backtick) are removed, and all runs of
whitespace collapse to a single space. So a pattern should be quote-free and must not depend on newlines;
`--severity[=\s]+HIGH,CRITICAL` matches both `--severity HIGH,CRITICAL` and `--severity=HIGH,CRITICAL`.

If something in a data file breaks, the page prints it in the browser console and
**Progress -> data self-test** lists every problem it can find (weights not summing to 100, duplicate ids,
a multi-select question with fewer than two correct options, a drill whose own model answer fails its own
requirement, a pattern that contains a quote character). Right now the self-test reports nothing.

## Important honesty notes

- **CKS is a hands-on performance exam on a real cluster.** This site is a webpage: it does not create,
  reach, or simulate a cluster. The Labs tab is a set of worked examples you read and rehearse; the Command
  drill tab grades the *text you type*. To build real speed you still need a cluster - your own kind/kubeadm
  cluster or the Linux Foundation exam environment and killer.sh.
- **Blueprint weights** (Cluster Setup 15, Cluster Hardening 15, System Hardening 10, Minimize Microservice
  Vulnerabilities 20, Supply Chain Security 20, Monitoring/Logging/Runtime Security 20) were read from the
  Linux Foundation CKS page on **2026-11-08** (`blueprintCaptured` in `data-meta.js`, with the source links).
  These weights override the 30/20/20/20/10 split that many older guides still quote. Re-check the official
  page shortly before your exam date.
- The exam-target version recorded here is **Kubernetes v1.37**, the pass line is **65**, and the
  2 exam attempts / 2 killer.sh attempts / 12-month scheduling / USD 445 figures come from the current
  Linux Foundation CKS pages. `data-meta.js` flags which of these I verified from the live pages and which
  are quoted from the candidate handbook - verify them on the official page before you rely on them.
- Which specific note/question/drill belongs to which domain is **my interpretation** of the published
  competency lists, not a claim about how the real exam splits a question.
- Commands and field names change between releases. Anything version-sensitive in the content says so and
  tells you how to confirm it on your own cluster (for example `kubectl explain <resource>`, `kubectl get crd`,
  `kubectl apply -f bad.yaml --dry-run=server`). The Kubernetes docs are the cheat sheet the exam actually
  allows you; the memorise-without-docs items are called out in the exam tips (paths such as
  `/etc/kubernetes/manifests`, `/var/lib/kubelet/config.yaml`, `/etc/kubernetes/pki`, `/etc/kubernetes/admin.conf`).

## If you do want a practice cluster (optional, Windows-first)

Nothing in this site needs this, but it is how you turn the drills into reflexes:

1. Docker Desktop with the WSL2 backend, then `winget install Kubernetes.kind` (or `go install sigs.k8s.io/kind@latest`).
2. `kind create cluster --config kind-config.yaml` with extra `kubeadmConfigPatches` for the API server audit
   flags and the encryption provider config, and mount the audit policy from your scratch folder. The
   walkthroughs in the Labs tab name those files plain-relative because you create them yourself.
3. Expect Windows/WSL2 gaps rather than failures of the content: `kindest/node` has no AppArmor userspace
   tooling (`apparmor_status` is not there), Falco wants `driver.kind: modern_ebpf` on kernel 5.8+, and
   gVisor / Kata `RuntimeClass` handlers are not installed in a kind node image. CIS benchmarks (`kube-bench`)
   report extra FAILs on a kind cluster because kubeadm file paths are not where the checks look. The content
   says this where it matters, so you do not chase phantom findings.
4. For the CIS and etcd-encryption tasks specifically, a kubeadm-based cluster (a couple of VMs, or `k8s-in-play`-style
   setups) matches the exam's file layout much better than kind does.

## Fixing / extending

- All content lives in `assets/data-*.js`. No generated files, no caches to clear.
- Open the browser console (`F12`) after any edit: a broken data file shows up there as a syntax or
  reference error with its file and line, and the Learn/Quiz/etc. counts drop to zero for that collection.
- The site has no dependencies, so nothing to install, nothing to update, and it keeps working offline.

### Troubleshooting

- **The page looks dimmed and nothing responds to the mouse.** You are looking at a cached copy of
  `assets/styles.css`. Hard-refresh with `Ctrl`+`F5`, or close the tab and open `index.html` again.
  The stylesheet now hides the modal veil with `.overlay[hidden] { display: none }` - without that rule an
  author `display` declaration overrides the browser's `[hidden]` handling, and an empty full-screen veil
  sits over the page and swallows every click.
- **A tab is blank and a red callout says "This view failed to render".** That callout carries the error
  text and stack; open the console (`F12`) for the file and line.
- **Progress does not persist** (a toast says storage is blocked). The site still works for the session and
  you can export JSON from the Progress tab; that is a browser setting, not a site bug.
