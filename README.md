# yize-c.github.io

My personal portfolio site, live at <https://yize-c.github.io/>: an about page, one explainer page per project with a small in-browser demo, and the Learner Space, where I practise for co-op interviews in the open.

## Why

I wanted one place that shows what I have built in a form a reader can try, not only describe, and that keeps my interview preparation honest: the Learner Space list and my progress come straight from my [interview-prep](https://github.com/yize-c/interview-prep) repo, so the site cannot claim more than I have done.

The site is plain HTML, CSS and JavaScript with no framework, trackers or analytics. Two small scripts prepare it for publishing: `scripts/build_site.sh` copies the public files and versions the CSS/JS links, and `scripts/sync_interview_prep.py` builds the Learner Space data.

## Install

Needs Python 3.10+ and Node 18+ (Node only for the tests). There is nothing to install for the site itself.

```bash
git clone https://github.com/yize-c/yize-c.github.io
git clone https://github.com/yize-c/interview-prep   # next to it
cd yize-c.github.io
```

For the lint and security tools: `python3 -m pip install -r requirements-dev.txt`.

## Usage

Build the Learner Space data from interview-prep, then serve the folder (pages load their data with `fetch`, which browsers block for `file://`):

```console
$ python3 scripts/sync_interview_prep.py --source ../interview-prep --out data
Built 136 items (Not started: 136) and 0 solutions into data
$ python3 -m http.server 8000
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

Open <http://localhost:8000/>.

Run the tests:

```console
$ node --test
...
# tests 36
# pass 36
# fail 0
$ python3 -m unittest discover -s tests
.....................
----------------------------------------------------------------------
Ran 21 tests in 0.054s

OK
```

Build the folder that gets deployed:

```console
$ bash scripts/build_site.sh
Built _site/ with: index.html learn.html 404.html .nojekyll css js assets projects vendor data/bash-cheatsheet.json (CSS/JS links versioned by content hash)
```

Editing pages, adding Learner Space details, the CI checks and the deployment are described in [CONTRIBUTING.md](CONTRIBUTING.md).

## Configuration

There are no environment variables, keys or secrets. The only settings are command-line options:

| Script | Option | Meaning |
|---|---|---|
| `sync_interview_prep.py` | `--source DIR` | checkout of yize-c/interview-prep (required) |
| | `--out DIR` | where to write the data, e.g. `data` or `_site/data` (required) |
| | `--updated DATE` | date shown as "Last updated" (default: today, UTC) |
| `sync_partials.py` | `--check` | only check that every page matches `partials/`; exit 1 if not |

## Project structure

```
index.html, learn.html, 404.html   the main page, the Learner Space, "page not found"
projects/                          one explainer page per project
partials/                          the icons, nav and footer copied into every page
css/                               tokens, base, layout, components, pages (loaded in that order)
js/core/ui.js                      helpers shared by every script (window.YC)
js/main.js, js/water.js            theme toggle, the duck, bubbles, the water in the top bar
js/learn.js, js/learn/             the Learner Space tabs
js/sql-playground.js               the SQL playground (runs on vendor/sql.js)
js/demo-*.js, js/logic/            each project demo: page code, and its testable logic
data/library/                      Learner Space details: hints, flashcards, SQL exercises
data/bash-cheatsheet.json          the Bash cheat sheet
scripts/                           build_site.sh, sync_interview_prep.py, sync_partials.py
tests/                             Node tests (demos, data) and Python tests (sync scripts)
vendor/sql.js/                     sql.js 1.14.2, kept locally and checked against SHA256SUMS
assets/                            images and the self-hosted font
.github/                           CI checks, deployment, Dependabot
```

## Known limitations

- The Learner Space follows interview-prep once a day (08:17 UTC), not on every push there. A push to this repo or a manual run of the deploy workflow updates it sooner. GitHub pauses scheduled workflows after 60 days without activity in the repo.
- The Learner Space needs a web server; opened as `file://`, it shows a "Couldn't load the practice data" message.
- The demos use made-up data and simplified logic; they show the idea of each project, not the real tool. The SecureText demo needs the Web Crypto API (HTTPS or localhost).
- `learn.html` allows `'wasm-unsafe-eval'` in its Content-Security-Policy, because sql.js runs as WebAssembly. Every other page allows scripts from this site only.
- Visitor progress ("You") is kept only in that browser's localStorage. It is lost when site data is cleared, and is not saved at all where storage is blocked.
