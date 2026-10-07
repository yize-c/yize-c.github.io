# Maintaining this site

How to change the site, and what the checks and the deployment do. Setup and usage are in the [README](README.md).

## Checks to run before pushing

```bash
node --test                                   # demo logic and the data library
python3 -m unittest discover -s tests         # the two sync scripts
python3 scripts/sync_partials.py --check      # every page matches partials/
npx stylelint@17.16.0 "css/*.css"             # CSS
npx html-validate@11.16.2 "*.html" "projects/*.html"
ruff check . && ruff format --check .         # Python lint and format (pyproject.toml)
bandit -q -r . && pip-audit -r requirements-dev.txt
```

The Node tests cover the demo logic (dependency risk levels, password rules, lockout and expiry, the intrusion-detection counts, the SQL result checker), run every SQL exercise's solution with the vendored sql.js, and check that every entry in `data/library/` has the fields the page code expects. The Python tests cover how the README becomes the Learner Space data and how partials are copied into pages.

## The icons, nav and footer

They appear on every page, but each has one source: `partials/icons.html`, `partials/nav.html` and `partials/footer.html`. In each page the copy sits between markers like `<!-- partial:nav start -->` and `<!-- partial:nav end -->`.

1. Edit the partial.
2. Run `python3 scripts/sync_partials.py` to copy it into every page.
3. Commit the partial **and** the updated pages.

Don't edit between the markers in a page: the next sync overwrites it, and CI fails if a page doesn't match. Links in the partials use placeholders because pages live at different depths (see the top of `scripts/sync_partials.py`). A new page must be added to the `PAGES` list in that script.

## The Learner Space

The README of [yize-c/interview-prep](https://github.com/yize-c/interview-prep) decides **which items exist, their order, their sections, and whether each one is done**. `scripts/sync_interview_prep.py` reads it on every deploy (and once a day) and builds the Learner Space data. This repo only keeps the extra **details** in `data/library/`.

### Progress and solutions (in interview-prep)

- Tick an item in its `README.md` (`- [x] 1. Two Sum`) and it shows as **Done**.
- Push a solution file and that item shows as **In progress** until it's ticked; the site also shows the code (up to 20 KB) and a link to the file. File names start with the problem number:

  | Folder | Example | Site id |
  |---|---|---|
  | `leetcode/` | `0001_two_sum.py` | `lc-1` |
  | `sql/` | `0175_combine_two_tables.sql` | `lc-sql-175` |
  | `bash/` | `0195_tenth_line.sh` | `lc-bash-195` |
  | `go/` | `0001_two_sum.go` | `go-lc-1` |

### Adding, removing or reordering items (in interview-prep)

Edit the README there. A new line shows up even before it has details here, with "Notes coming soon." A removed line disappears from the site. Each section must keep at least one item, and an item may be listed only once; otherwise the sync stops with an error and CI fails.

The exception is the **SQL playground** section: an exercise can't work without its solution, so a new line there needs its exercise in `data/library/sql-exercises.json` first.

### Adding details (here, in `data/library/`)

Details are found by **problem number** (LeetCode problems and Go re-solves) or by the **exact README line** (everything else: the `readme` field must match the line word for word). Ids must be unique, because progress is stored by id. Then run `node --test` and the sync.

**LeetCode problems** (`leetcode.json`, lists `coding`, `sql`, `bash`; id prefixes `lc-`, `lc-sql-`, `lc-bash-`). Only link to the problem; never copy its statement. The title and category come from the README (the `###` heading above the line).

```json
{
  "id": "lc-128", "number": 128, "title": "Longest Consecutive Sequence",
  "url": "https://leetcode.com/problems/longest-consecutive-sequence/",
  "difficulty": "Medium", "category": "Arrays & Hashing",
  "keyIdea": "Hash set", "hint": "My own one- or two-sentence hint."
}
```

**Concept flashcards** (`concepts/<area>.json`; areas: networking, linux, testing, devops, security). The `quiz` part is used by the Quiz mode; `answer` is the index of the correct option, starting at 0.

```json
{
  "id": "net-example", "readme": "The exact line from the interview-prep README",
  "topic": "Short topic name", "question": "…", "hint": "…", "answer": "Short answer.",
  "explanation": "Plain-language explanation for beginners.",
  "quiz": { "question": "…", "options": ["A", "B", "C", "D"], "answer": 1, "why": "Why B is right." }
}
```

**SQL playground exercises** (`sql-exercises.json`): `setup` holds the SQL that builds the sample database (students, courses, enrollments). The expected result is whatever `solution` returns on a fresh copy of that data, so expected rows are never written by hand. Set `ordered` to `true` only when the question asks for an order and the ORDER BY has no ties.

```json
{
  "id": "sql-31", "readme": "31. Subqueries: Plain-English question.",
  "topic": "Subqueries", "difficulty": "Medium",
  "question": "Plain-English question.", "tables": ["students", "enrollments"],
  "hint": "…", "solution": "SELECT …;", "ordered": false
}
```

**Go** (`go.json`): `basics` and `tools` entries have a `readme` field; `resolve` entries are found by `number`. The **Bash cheat sheet** is `data/bash-cheatsheet.json` and is not part of the README.

## CSS and JavaScript

The CSS is split into five files, loaded in this order: `tokens.css`, `base.css`, `layout.css`, `components.css`, `pages.css`. Colours and sizes are variables in `tokens.css` (dark theme included); use `var(--...)` instead of new hard-coded colours. Only three breakpoints are used: phones `max-width: 600px`, tablets `min-width: 721px`, desktops `min-width: 901px`.

Cache versions are automatic: `scripts/build_site.sh` adds `?v=<hash of the file>` to every local CSS and JS link when it builds the site. The source HTML has no version numbers.

Each demo keeps its logic in `js/logic/*.js` (no page code, so Node can test it) and its drawing in `js/demo-*.js`. Build elements with `YC.el` (it sets text with `textContent`), never with `innerHTML`.

## Deployment

GitHub Pages uses **GitHub Actions** as its source. `.github/workflows/deploy-pages.yml` runs on every push to `main`, once a day, and by hand from the Actions tab. It:

1. runs `scripts/build_site.sh`, which copies only what visitors need into `_site/` and fails if anything private (tests, scripts, partials, README, config) ends up there;
2. builds the Learner Space data from interview-prep into `_site/data/`;
3. publishes `_site/` to GitHub Pages;
4. fetches the live home page and checks it really is the home page.

If the sync fails, nothing is published and the site keeps its previous version. To roll back a bad change, revert the commit on `main`; the deploy runs again with the old version.

## CI checks

`.github/workflows/site-checks.yml` runs on every pull request, every push to `main`, and once a week (so a link that breaks on another site is noticed):

1. HTML validation (html-validate, `.htmlvalidate.json`) and CSS checks (stylelint, `.stylelintrc.json`).
2. The public folder builds with nothing private in it.
3. Every page matches `partials/`.
4. The vendored sql.js matches `vendor/sql.js/SHA256SUMS`.
5. Every JSON file in `data/` parses.
6. The Node and Python tests, plus a real sync of interview-prep, so a README problem is caught before deploy.
7. ruff, bandit and pip-audit on the Python, and gitleaks on the whole git history.
8. A link checker (lychee, `lychee.toml`).

Every action is pinned to a full commit SHA, and the Python tools to exact versions in `requirements-dev.txt`; Dependabot proposes updates weekly. Every job gets a read-only token (only the deploy job may write to Pages), and checkout runs with `persist-credentials: false`.

## Security

Each page has a strict Content-Security-Policy `<meta>` tag: scripts, styles and data only from this site, no inline scripts or styles. `learn.html` also allows `'wasm-unsafe-eval'`, which sql.js needs. External links open in a new tab with `rel="noopener noreferrer"`. The interview-prep repo is treated as data only: the sync accepts known shapes, skips symlinks and caps embedded code at 20 KB, and the page shows everything as text.
