# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# yize-c.github.io
Static portfolio site (plain HTML/CSS/JS, no framework) published to GitHub Pages by Actions.

## Commands
- Install: nothing for the site; dev tools `pip install -r requirements-dev.txt`. Clone yize-c/interview-prep next to this repo.
- Test: `node --test` (one: `node --test --test-name-pattern "locks" tests/pg.test.js`); `python3 -m unittest discover -s tests` (one: `python3 -m unittest tests.test_sync_partials.SyncPartialsTests.<name>`)
- Lint/format: `ruff check . && ruff format --check .`; `npx stylelint@17.16.0 "css/*.css"`; `npx html-validate@11.16.2 "*.html" "projects/*.html"`; `python3 scripts/sync_partials.py --check`
- Security: `bandit -q -r .`; `pip-audit -r requirements-dev.txt`; `gitleaks detect`
- Run: `python3 scripts/sync_interview_prep.py --source ../interview-prep --out data`, then `python3 -m http.server 8000` (Learner Space can't load over file://)

## Structure
- The Learner Space list and "Me" progress come from the interview-prep README, not this repo; `data/library/` only adds details. Generated `data/*.json` is gitignored.
- Scripts share state through globals, so `<script>` order matters: `theme-init.js`, then `js/core/ui.js` (window.YC) before everything else; `js/logic/X.js` before its `demo-X.js`; on learn.html `js/learn/common.js` (window.YCLearn), then the `tab-*.js` files, then `js/learn.js`.
- `js/logic/*.js` work both in the browser and under `require()` (Node tests); keep page code out of them.

## Conventions
- Nav, footer and icons: edit `partials/*.html`, then run `sync_partials.py`; never edit between the `<!-- partial:... -->` markers. A new page needs a `PAGES` entry there.
- Build DOM with `YC.el` / `textContent`; no `innerHTML`, no inline scripts or styles (each page has a strict CSP).
- A new public top-level folder must be added to `PUBLIC` in `scripts/build_site.sh`; a new private file to its private-file check.
- No `?v=` in source HTML; `build_site.sh` adds content hashes.
- Colours and sizes only as variables in `css/tokens.css`; use only the breakpoints listed there.
- Python: standard library only; `%`-formatting kept on purpose (ruff UP031 off).
- There are no environment variables or secrets; keep it that way (no `.env.example` needed).

## Don't
- Change behaviour: CLI options and output of the scripts, the generated JSON shape, or what pages render.
- Add dependencies (Python, npm, CDN scripts) without asking.
- Put keys or tokens in code, logs or error messages.
- Unpin GitHub Actions or `requirements-dev.txt`; skip or weaken a test to get CI green.

## Decisions and known limitations
- The Node tests don't touch the DOM. After changing page code, check in a real browser (e.g. Playwright) that the rendered pages and demos still behave the same.
- interview-prep updates reach the site through a daily deploy (08:17 UTC), not on push: a push trigger would need a write token stored in the other repo.
- sql.js is vendored and checked against `vendor/sql.js/SHA256SUMS` (no CDN under the CSP); learn.html alone allows `'wasm-unsafe-eval'` for it.
- gitleaks runs as the checksum-verified release binary, not a third-party action.
- The sync treats interview-prep as untrusted data: known shapes only, symlinks skipped, code capped at 20 KB.
- `js/main.js` (~300 lines, five small features) and `createServer` in `js/logic/pg-logic.js` (a command table) are long on purpose; splitting would add requests or indirection.
- Visitor progress lives only in localStorage.
