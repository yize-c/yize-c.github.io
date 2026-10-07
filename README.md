# yize-c.github.io

My personal portfolio site: <https://yize-c.github.io/>

It has three parts:

- **Main page** (`index.html`): about me, projects, experience, education, skills, journey, certificate goals, and contact.
- **Project explainers** (`projects/*.html`): one page per project, with a plain-language summary, a small in-browser demo that uses made-up data, one bug I hit, and what's next.
- **Learner Space** (`learn.html`): my co-op interview prep (coding, SQL, Bash, Go, concepts), open for anyone to practice with. Its list and my progress come from my [interview-prep](https://github.com/yize-c/interview-prep) README.

Plain HTML, CSS, and JavaScript. No framework, no build step, no trackers or analytics.

## Run it locally

The Learner Space data is built from my [interview-prep](https://github.com/yize-c/interview-prep) repo, and pages load it with `fetch` (which browsers block for `file://` pages). So, once:

```bash
git clone https://github.com/yize-c/interview-prep ../interview-prep
python3 scripts/sync_interview_prep.py --source ../interview-prep --out data
```

Then start a small local server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

The generated files in `data/` are ignored by git. Run the sync again after changing the README there or `data/library/` here.

## How this site is organized

### Folders and main files

```
index.html               main page (hero, about, projects, experience, trail, certificates)
learn.html               Learner Space (coding, SQL, Bash, Go, concepts, study plan)
404.html                 "page not found" page; uses root-absolute links (/css/...) because it can be served at any path
projects/*.html          one explainer page per project, each with a small demo
partials/icons.html      the SVG icons (GitHub, LinkedIn, email, sun, moon, menu): the ONE place to edit them
partials/nav.html        the top bar (duck, water, links, theme button): the ONE place to edit it
partials/footer.html     the footer: the ONE place to edit it
scripts/sync_partials.py copies the partials into every page (see below)
scripts/build_site.sh    builds _site/, the folder that gets deployed (public files only, versioned CSS/JS links)
scripts/sync_interview_prep.py  builds the Learner Space data from my interview-prep README
css/tokens.css           fonts, colors, sizes and the dark theme (CSS variables); also lists the 3 breakpoints
css/base.css             plain HTML elements (text, headings, forms, tables) and utility classes
css/layout.css           the frame: top bar, duck and water, fixed footer, underwater background, bubbles, grids
css/components.css       reusable pieces: buttons, cards, badges, tooltips, hero, project cards, timeline, hobbies
css/pages.css            the project demos and the Learner Space, then the phone overrides (last, on purpose)
js/theme-init.js         applies the saved light/dark theme before the page draws (no flash)
js/core/ui.js            shared helpers every script uses: safe storage, building elements, tables, status lines
js/main.js               one small class per shared feature: ThemeToggle, SwimmingDuck, CardSheen, Bubbles, ReadMore
js/water.js              the water in the top bar: SpringSurface (physics), WaterView (drawing), Water (loop + API)
js/learn.js              Learner Space: loads data/*.json; a TabSet class switches between the tabs
js/learn/common.js       what every Learner Space tab shares (badges, checkboxes, the problem list)
js/learn/tab-*.js        one file per Learner Space tab (coding, sql, bash, go, concepts, plan)
js/sql-playground.js     the SQL playground (uses vendor/sql.js)
js/demo-*.js             the page part of each project demo, one class per demo (drawing, buttons)
js/logic/*.js            the logic part of the demos, with no page code, so it can be tested
tests/                   automated tests (Node's built-in test runner, plus Python unittest for the sync)
data/library/            details for the Learner Space items: hints, notes, flashcards, SQL exercises
data/bash-cheatsheet.json the Bash cheat sheet
assets/                  images and the self-hosted font
vendor/sql.js/           sql.js 1.14.2 (SQLite in WebAssembly), saved locally; see its README
.github/workflows/       CI checks and the GitHub Pages deployment
.github/dependabot.yml   weekly pull requests to update the pinned GitHub Actions
.stylelintrc.json        the CSS checks CI runs (duplicate selectors, syntax errors, typos)
```

### Changing the icons, nav or footer

They appear on every page, but there is only one source for each: `partials/icons.html`,
`partials/nav.html` and `partials/footer.html`. In each page the copy sits between
markers like `<!-- partial:nav start -->` and `<!-- partial:nav end -->`.

1. Edit the partial.
2. Run `python3 scripts/sync_partials.py` to copy it into every page.
3. Commit the partial **and** the updated pages.

Don't edit between the markers in a page: the next sync overwrites it, and CI runs
`python3 scripts/sync_partials.py --check`, which fails if any page doesn't match.
Links inside the partials use placeholders, because pages live at different depths:
`{{ROOT}}` (`""` or `"../"`), `{{HOME}}` (the home page in links like `{{HOME}}#about`),
`{{HOME_LINK}}` (where the duck logo goes) and `{{CURRENT:projects}}` (marks the current page).
A new page must be added to the `PAGES` list at the top of the script.

### Running the tests

```bash
node --test                                   # demos and the data library (Node 18+)
python3 -m unittest discover -s tests        # the interview-prep sync script
npx stylelint@17.16.0 "css/*.css"             # the CSS checks
```

Node 18 or newer, no `npm install` needed. The tests cover the demo logic (dependency
risk levels, password rules, lockout and expiry, the intrusion-detection counts, the SQL
result checker), run every SQL exercise's solution with the vendored sql.js, check that
every entry in `data/library/` has the fields the page code expects, and check how the
sync turns the interview-prep README into the Learner Space.

## The Learner Space: interview-prep's README is the single source of truth

The README of [yize-c/interview-prep](https://github.com/yize-c/interview-prep) decides **which items exist,
their order, their sections, and whether each one is done**. Every deploy (and a daily scheduled run) reads it with
`scripts/sync_interview_prep.py` and builds the Learner Space data from it. This repo only keeps the extra
**details** in `data/library/`.

### Updating my progress and solutions (in interview-prep)

- Tick an item in its `README.md` (`- [x] 1. Two Sum`) and it shows as **Done**.
- Push a solution file and that item shows as **In progress** until it's ticked; the site also shows the code and
  a link to the file. File names start with the problem number:

  | Folder | Example | Site id |
  |---|---|---|
  | `leetcode/` | `0001_two_sum.py` | `lc-1` |
  | `sql/` | `0175_combine_two_tables.sql` | `lc-sql-175` |
  | `bash/` | `0195_tenth_line.sh` | `lc-bash-195` |
  | `go/` | `0001_two_sum.go` | `go-lc-1` |

### Adding, removing or reordering items (in interview-prep)

Edit the README there; that's all. A new line shows up on the site even before it has details here, with
"Notes coming soon." A removed line disappears from the site. Each section must keep at least one item, and an
item may only be listed once; otherwise the sync stops with a clear error and CI fails.

The one exception is the **SQL playground** section: an exercise can't work without its solution, so a new line there
needs its exercise in `data/library/sql-exercises.json` first.

### Adding details for an item (here, in `data/library/`)

Details are found by **problem number** (LeetCode problems and Go re-solves) or by the **exact README line**
(everything else: the `readme` field below must match the line word for word). Ids must be unique, because
progress is stored by id. Then run `node --test` and the sync.

**LeetCode problems** (`data/library/leetcode.json`, lists `coding`, `sql`, `bash`). Only link to the problem;
never copy its statement. The title and category come from the README (the `###` heading above the line).

```json
{
  "id": "lc-128", "number": 128, "title": "Longest Consecutive Sequence",
  "url": "https://leetcode.com/problems/longest-consecutive-sequence/",
  "difficulty": "Medium", "category": "Arrays & Hashing",
  "keyIdea": "Hash set", "hint": "My own one- or two-sentence hint."
}
```

Use the prefix `lc-` for coding, `lc-sql-` for SQL, and `lc-bash-` for Bash.

**Concept flashcards** (`data/library/concepts/<area>.json`, areas: networking, linux, testing, devops, security).
The `quiz` part is used by the Quiz mode; `answer` is the index (starting at 0) of the correct option.

```json
{
  "id": "net-example", "readme": "The exact line from the interview-prep README",
  "topic": "Short topic name", "question": "…", "hint": "…", "answer": "Short answer.",
  "explanation": "Plain-language explanation for beginners.",
  "quiz": { "question": "…", "options": ["A", "B", "C", "D"], "answer": 1, "why": "Why B is right." }
}
```

**SQL playground exercises** (`data/library/sql-exercises.json`): `setup` holds the SQL that builds the sample
database (students, courses, enrollments). Each exercise:

```json
{
  "id": "sql-31", "readme": "31. Subqueries: Plain-English question.",
  "topic": "Subqueries", "difficulty": "Medium",
  "question": "Plain-English question.", "tables": ["students", "enrollments"],
  "hint": "…", "solution": "SELECT …;", "ordered": false
}
```

The expected result is whatever `solution` returns on a fresh copy of the sample data, so you never write the
expected rows by hand. Set `ordered` to `true` only when the question asks for a specific order and the ORDER BY
has no ties.

**Go** (`data/library/go.json`): `basics` and `tools` entries have a `readme` field; `resolve` entries are found by
`number`. The **Bash cheat sheet** is `data/bash-cheatsheet.json` (not part of the README).

## Updating CSS or JavaScript

The CSS is split into five files, loaded in this order: `tokens.css`, `base.css`, `layout.css`, `components.css`, `pages.css`. Colors and sizes are variables in `tokens.css`; use `var(--...)` instead of new hard-coded colors. Only three breakpoints are used: phones `max-width: 600px`, tablets `min-width: 721px`, desktops `min-width: 901px` (the bottom nav bar is shown up to 900px). CI runs stylelint on every pull request.

Cache versions are automatic: when the site is built, `scripts/build_site.sh` adds a version to every local CSS and JS link, made from the file's contents (`tokens.css?v=8bef780737`). A changed file gets a new version, so browsers fetch it again; unchanged files stay cached. The source HTML has no version numbers.

## Deployment

GitHub Pages uses **GitHub Actions** as its source. `.github/workflows/deploy-pages.yml` publishes the site every time `main` changes and once a day (so interview-prep updates show up), and you can also run it by hand from the Actions tab.

The deploy job:
1. runs `bash scripts/build_site.sh`, which copies only what visitors need (`*.html`, `css/`, `js/`, `assets/`, `projects/`, `vendor/`, the Bash cheat sheet) into `_site/`, versions the CSS/JS links, and fails if anything private (`tests/`, `scripts/`, `partials/`, `README.md`, `.github/`, `data/library/`) ends up there;
2. builds the Learner Space data from interview-prep into `_site/data/` (see above);
3. publishes `_site/` to GitHub Pages;
4. runs a **smoke test**: it fetches the live home page and checks it really is the home page. "Deployed" and "working" are not the same thing.

To roll back a bad change: revert the commit on `main` (`git revert <commit>` and push). The deploy runs again with the old version.

## CI checks

`.github/workflows/site-checks.yml` runs on every pull request, every push to `main`, and once a week (so a link that breaks on another website is noticed even when nothing here changed). You can also run it by hand from the Actions tab:

1. **HTML validation** with [html-validate](https://html-validate.org/) (rules in `.htmlvalidate.json`), and **CSS checks** with [stylelint](https://stylelint.io/) (rules in `.stylelintrc.json`: duplicate selectors, syntax errors such as a stray `}`, unknown properties).
2. **Public folder check**: `bash scripts/build_site.sh` must build `_site/` with nothing private in it.
3. **Partials check**: `python3 scripts/sync_partials.py --check`, so the icons, nav and footer in every page match `partials/`.
4. **Vendored files check**: `sha256sum --check` on `vendor/sql.js/SHA256SUMS`, so any change to sql.js fails the build.
5. **JSON check**: every file in `data/` must parse.
6. **Tests**: `node --test` (see above), `python3 -m unittest discover -s tests` for the sync script, and a real sync of interview-prep so a README problem is caught before deploy.
7. **Link checker** with [lychee](https://lychee.cli.rs/) (settings in `lychee.toml`). It checks internal and external links in every HTML page.

Every action in the workflows is pinned to a full commit SHA, with the version as a comment.
Dependabot opens a pull request each week if a newer version is available.
Every job gets a read-only token (only the deploy job may write to Pages), and `actions/checkout` runs with `persist-credentials: false`, so the token isn't left behind in `.git/config` for later steps.

To run the HTML check locally: `npx html-validate@11.16.2 "*.html" "projects/*.html"`.

## Security notes

Each page has a strict Content-Security-Policy `<meta>` tag: scripts, styles, and data only from this site, no inline scripts or styles. `learn.html` also allows `'wasm-unsafe-eval'`, which sql.js needs to run WebAssembly. External links open in a new tab with `rel="noopener noreferrer"`.
